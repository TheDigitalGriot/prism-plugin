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
import {
  resolveAnthropicAuth,
  OAUTH_BETA_HEADER,
  type ResolvedAuth,
} from "@prism-core/core/api/auth"

// ---------------------------------------------------------------------------
// Model IDs
// ---------------------------------------------------------------------------

export const MODEL_IDS = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
  fable: "claude-fable-5",
} as const

export type ModelName = keyof typeof MODEL_IDS

// ---------------------------------------------------------------------------
// PrismApiHandler
// ---------------------------------------------------------------------------

export interface PrismApiHandlerOptions {
  /**
   * Metered Anthropic API key (fallback). Optional — when a Claude Code
   * subscription OAuth token is present (`CLAUDE_CODE_OAUTH_TOKEN`), it is
   * preferred and this is ignored.
   */
  apiKey?: string
  model?: ModelName
  maxTokens?: number
}

export class PrismApiHandler {
  private readonly _client: Anthropic
  private readonly _model: string
  private readonly _maxTokens: number
  private readonly _authMode: ResolvedAuth["mode"]

  constructor(options: PrismApiHandlerOptions) {
    // Prefer the Claude Code subscription OAuth token (CLAUDE_CODE_OAUTH_TOKEN)
    // so requests bill against the Max subscription like the daemon/CLI already
    // do; fall back to a metered API key when no subscription token is present.
    const auth = resolveAnthropicAuth(options.apiKey)
    this._authMode = auth.mode
    if (auth.mode === "subscription") {
      // OAuth tokens go on Authorization: Bearer (not x-api-key) and require the
      // oauth beta header. apiKey: null disables the SDK's ANTHROPIC_API_KEY env
      // fallback, so two credentials are never sent at once (the API rejects that).
      this._client = new Anthropic({
        apiKey: null,
        authToken: auth.authToken,
        defaultHeaders: { "anthropic-beta": OAUTH_BETA_HEADER },
      })
    } else {
      this._client = new Anthropic({
        apiKey: auth.mode === "api-key" ? auth.apiKey : "",
      })
    }
    this._model = MODEL_IDS[options.model ?? "sonnet"]
    this._maxTokens = options.maxTokens ?? 8192
  }

  /** Which credential is in use: 'subscription' (Max) or 'api-key' (metered). */
  get authMode(): ResolvedAuth["mode"] {
    return this._authMode
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
          // SDK StopReason union lacks "refusal" here; cast required
          if ((event.delta.stop_reason as string) === "refusal") {
            throw new Error(
              "Request declined by safety classifier (stop_reason: refusal). " +
                "This can occur on certain content. Retry or rephrase.",
            )
          }
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
