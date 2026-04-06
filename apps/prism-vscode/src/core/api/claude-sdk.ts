/**
 * PrismApiHandler — wraps the Anthropic SDK for streaming message creation.
 *
 * Provides a clean AsyncGenerator interface over Anthropic's streaming API,
 * yielding ApiStreamChunks that are consumed by PrismTask.
 */
import Anthropic from "@anthropic-ai/sdk"
import {
  ApiStream,
  ApiStreamChunk,
  ApiConversationMessage,
  ApiToolDefinition,
} from "@prism-core/core/api/types"

// ---------------------------------------------------------------------------
// Model IDs
// ---------------------------------------------------------------------------

export const MODEL_IDS = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const

export type ModelName = keyof typeof MODEL_IDS

// ---------------------------------------------------------------------------
// PrismApiHandler
// ---------------------------------------------------------------------------

export interface PrismApiHandlerOptions {
  apiKey: string
  model?: ModelName
  maxTokens?: number
}

export class PrismApiHandler {
  private readonly _client: Anthropic
  private readonly _model: string
  private readonly _maxTokens: number

  constructor(options: PrismApiHandlerOptions) {
    this._client = new Anthropic({ apiKey: options.apiKey })
    this._model = MODEL_IDS[options.model ?? "sonnet"]
    this._maxTokens = options.maxTokens ?? 8192
  }

  /**
   * Create a streaming message and yield ApiStreamChunks.
   *
   * @param systemPrompt - The system prompt for this request
   * @param messages     - Conversation history
   * @param tools        - Tool definitions available to Claude
   */
  async *createMessage(
    systemPrompt: string,
    messages: ApiConversationMessage[],
    tools?: ApiToolDefinition[],
  ): ApiStream {
    const stream = this._client.messages.stream({
      model: this._model,
      max_tokens: this._maxTokens,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      ...(tools && tools.length > 0
        ? { tools: tools as Anthropic.Tool[] }
        : {}),
    })

    let currentToolUseId: string | undefined
    let currentToolName: string | undefined
    let currentToolInputJson = ""

    for await (const event of stream) {
      switch (event.type) {
        case "content_block_start":
          if (event.content_block.type === "tool_use") {
            currentToolUseId = event.content_block.id
            currentToolName = event.content_block.name
            currentToolInputJson = ""
          }
          break

        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            const chunk: ApiStreamChunk = {
              type: "text",
              text: event.delta.text,
            }
            yield chunk
          } else if (event.delta.type === "input_json_delta") {
            currentToolInputJson += event.delta.partial_json
            const chunk: ApiStreamChunk = {
              type: "input_json_delta",
              toolUseId: currentToolUseId ?? "",
              delta: event.delta.partial_json,
            }
            yield chunk
          }
          break

        case "content_block_stop":
          if (currentToolUseId && currentToolName) {
            // Parse the accumulated JSON and emit the complete tool call
            let toolInput: Record<string, unknown> = {}
            try {
              toolInput = JSON.parse(currentToolInputJson || "{}") as Record<string, unknown>
            } catch {
              toolInput = {}
            }
            const chunk: ApiStreamChunk = {
              type: "tool_call",
              toolName: currentToolName,
              toolInput,
              toolUseId: currentToolUseId,
            }
            yield chunk
            currentToolUseId = undefined
            currentToolName = undefined
            currentToolInputJson = ""
          }
          break

        case "message_delta":
          if (event.usage) {
            const chunk: ApiStreamChunk = {
              type: "usage",
              inputTokens: 0, // delta only has output tokens
              outputTokens: event.usage.output_tokens,
            }
            yield chunk
          }
          break

        case "message_start":
          if (event.message.usage) {
            const chunk: ApiStreamChunk = {
              type: "usage",
              inputTokens: event.message.usage.input_tokens,
              outputTokens: event.message.usage.output_tokens,
            }
            yield chunk
          }
          break
      }
    }
  }
}

/** Build a PrismApiHandler from a raw API key, defaulting to Sonnet model. */
export function buildApiHandler(
  apiKey: string,
  model: ModelName = "sonnet",
): PrismApiHandler {
  return new PrismApiHandler({ apiKey, model })
}
