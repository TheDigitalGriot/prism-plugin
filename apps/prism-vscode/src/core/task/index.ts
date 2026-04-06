/**
 * PrismTask — the main AI conversation loop.
 *
 * Adapted from Cline's Task class, simplified for Claude-only usage.
 * Implements a recursive request cycle: API call → stream → tool calls → API call...
 *
 * Lifecycle:
 * 1. Created with a user message
 * 2. Calls Claude API with streaming
 * 3. Processes text and tool call chunks
 * 4. For tool calls: waits for approval (if needed), executes, adds result
 * 5. If tool results exist: makes another API call (recurse)
 * 6. Ends when attempt_completion or abort
 */
import * as vscode from "vscode"
import { PrismApiHandler, ModelName } from "../api/claude-sdk"
import { PrismChatMessage, ApiStreamChunk } from "@prism-core/core/api/types"
import { MessageState } from "./message-state"
import { TaskState, createInitialTaskState } from "./task-state"
import { ToolCoordinator } from "./tools/coordinator"
import { PrismTool, PRISM_TOOL_DEFINITIONS } from "./tools/types"
import { buildSystemPrompt, SystemPromptContext } from "@prism-core/core/prompts/system-prompt"

export type TaskUpdateFn = (messages: PrismChatMessage[], isStreaming: boolean) => void

export interface PrismTaskOptions {
  apiHandler: PrismApiHandler
  workspaceRoot: string
  systemPromptCtx: SystemPromptContext
  onUpdate: TaskUpdateFn
}

export class PrismTask {
  private readonly _api: PrismApiHandler
  private readonly _workspaceRoot: string
  private readonly _systemPromptCtx: SystemPromptContext
  private readonly _onUpdate: TaskUpdateFn
  private readonly _messages = new MessageState()
  private readonly _tools = new ToolCoordinator()
  private _state = createInitialTaskState()

  /** Pending approval requests: toolUseId → { resolve, reject } */
  private _pendingApprovals = new Map<
    string,
    { resolve: (approved: boolean) => void; reject: (err: Error) => void }
  >()

  constructor(options: PrismTaskOptions) {
    this._api = options.apiHandler
    this._workspaceRoot = options.workspaceRoot
    this._systemPromptCtx = options.systemPromptCtx
    this._onUpdate = options.onUpdate
  }

  get chatMessages(): PrismChatMessage[] {
    return this._messages.chatMessages
  }

  get isStreaming(): boolean {
    return this._state.isStreaming
  }

  get isComplete(): boolean {
    return this._state.isComplete
  }

  /** Start a new user message and run the conversation loop. */
  async sendMessage(userText: string): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error("Task is already streaming")
    }

    this._messages.addUserMessage(userText)
    this._pushUpdate()

    await this._recursiveApiRequest()
  }

  /** Abort the current streaming operation. */
  abort(): void {
    this._state.isAborted = true
    // Reject all pending approvals
    for (const [, pending] of this._pendingApprovals) {
      pending.reject(new Error("Task aborted"))
    }
    this._pendingApprovals.clear()
  }

  /**
   * Resolve a pending tool approval.
   * Called by the controller when the user clicks Allow/Deny in the UI.
   */
  resolveApproval(toolUseId: string, approved: boolean): void {
    const pending = this._pendingApprovals.get(toolUseId)
    if (pending) {
      pending.resolve(approved)
      this._pendingApprovals.delete(toolUseId)
    }
  }

  /**
   * Handle a followup response from the user (for ask_followup tool).
   * This adds the user's response as a new user message and continues.
   */
  async handleFollowup(response: string): Promise<void> {
    if (!this._state.pendingApprovalToolUseId) return
    // The followup response will be treated as a tool result for the ask_followup tool
    this._state.pendingApprovalToolUseId = undefined
    await this.sendMessage(response)
  }

  // ---------------------------------------------------------------------------
  // Core recursive loop
  // ---------------------------------------------------------------------------

  private async _recursiveApiRequest(): Promise<void> {
    if (this._state.isAborted) return

    this._state.isStreaming = true
    this._pushUpdate()

    const systemPrompt = buildSystemPrompt(this._systemPromptCtx)

    // Current streaming assistant message
    let currentMsg = this._messages.startAssistantMessage()
    let accumulatedText = ""

    // Collect all tool calls from this response
    const toolCalls: Array<{
      toolName: string
      toolInput: Record<string, unknown>
      toolUseId: string
    }> = []

    try {
      const stream = this._api.createMessage(
        systemPrompt,
        this._messages.apiMessages,
        PRISM_TOOL_DEFINITIONS,
      )

      for await (const chunk of stream) {
        if (this._state.isAborted) break
        await this._processChunk(chunk, currentMsg, toolCalls, (text) => {
          accumulatedText += text
        })
        this._pushUpdate()
      }

      if (this._state.isAborted) {
        this._messages.finalizeAssistantMessage(currentMsg)
        this._state.isStreaming = false
        this._pushUpdate()
        return
      }

      // Finalize the streaming message
      this._messages.finalizeAssistantMessage(currentMsg)
      this._state.isStreaming = false

      if (toolCalls.length === 0) {
        // No tool calls — conversation turn is complete
        this._pushUpdate()
        return
      }

      // Add the assistant's tool_use blocks to API history
      this._messages.addApiToolUseBlocks(accumulatedText, toolCalls)

      // Execute tool calls
      await this._executeToolCalls(toolCalls)

      if (this._state.isAborted || this._state.isComplete) {
        this._pushUpdate()
        return
      }

      // Recurse to process tool results
      await this._recursiveApiRequest()
    } catch (err) {
      this._state.isStreaming = false
      const errorMsg = err instanceof Error ? err.message : String(err)
      this._messages.addError(`API error: ${errorMsg}`)
      this._pushUpdate()
    }
  }

  private async _processChunk(
    chunk: ApiStreamChunk,
    currentMsg: PrismChatMessage,
    toolCalls: Array<{ toolName: string; toolInput: Record<string, unknown>; toolUseId: string }>,
    onText: (text: string) => void,
  ): Promise<void> {
    switch (chunk.type) {
      case "text":
        this._messages.appendAssistantText(currentMsg, chunk.text)
        onText(chunk.text)
        break

      case "tool_call":
        toolCalls.push({
          toolName: chunk.toolName,
          toolInput: chunk.toolInput,
          toolUseId: chunk.toolUseId,
        })
        break

      case "usage":
        this._state.totalInputTokens += chunk.inputTokens
        this._state.totalOutputTokens += chunk.outputTokens
        break

      case "input_json_delta":
        // Partial tool input — streaming visualization only
        // The complete tool_call chunk will come after content_block_stop
        break
    }
  }

  private async _executeToolCalls(
    toolCalls: Array<{ toolName: string; toolInput: Record<string, unknown>; toolUseId: string }>,
  ): Promise<void> {
    for (const tc of toolCalls) {
      if (this._state.isAborted) break

      const toolName = tc.toolName as PrismTool

      // Handle special tools
      if (toolName === "attempt_completion") {
        const result = tc.toolInput.result as string
        this._messages.addCompletion(result)
        this._messages.addApiToolResult(tc.toolUseId, result, false)
        this._state.isComplete = true
        return
      }

      if (toolName === "ask_followup") {
        const question = tc.toolInput.question as string
        // Add the question as a tool_use message that shows in the UI
        this._messages.addToolUse(toolName, tc.toolInput, tc.toolUseId, false)
        // The user's response will come via a new sendMessage call
        // For now, add a placeholder result to keep API history consistent
        this._messages.addApiToolResult(
          tc.toolUseId,
          "[Waiting for user response]",
          false,
        )
        this._state.pendingApprovalToolUseId = tc.toolUseId
        this._pushUpdate()
        return
      }

      // Check if tool needs approval
      const needsApproval = this._tools.requiresApproval(toolName)
      const toolUseMsg = this._messages.addToolUse(
        toolName,
        tc.toolInput,
        tc.toolUseId,
        needsApproval,
      )
      this._pushUpdate()

      if (needsApproval) {
        // Wait for user approval
        const approved = await this._waitForApproval(tc.toolUseId)
        this._messages.setToolApproval(tc.toolUseId, approved)
        this._pushUpdate()

        if (!approved) {
          this._messages.addApiToolResult(
            tc.toolUseId,
            "Tool execution denied by user.",
            true,
          )
          continue
        }
      }

      // Execute the tool
      try {
        const result = await this._tools.execute(toolName, tc.toolInput, {
          workspaceRoot: this._workspaceRoot,
          emitResult: () => {}, // handled via addToolResult
        })
        this._messages.addToolResult(tc.toolUseId, toolName, result, false)
        this._messages.addApiToolResult(tc.toolUseId, result, false)
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err)
        this._messages.addToolResult(tc.toolUseId, toolName, errorText, true)
        this._messages.addApiToolResult(tc.toolUseId, errorText, true)
      }

      this._pushUpdate()
    }
  }

  private _waitForApproval(toolUseId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._pendingApprovals.set(toolUseId, { resolve, reject })
    })
  }

  private _pushUpdate(): void {
    this._onUpdate(
      [...this._messages.chatMessages],
      this._state.isStreaming,
    )
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateTaskOptions {
  context: vscode.ExtensionContext
  apiKey: string
  model: ModelName
  workspaceRoot: string
  systemPromptCtx: SystemPromptContext
  onUpdate: TaskUpdateFn
}

export function createTask(options: CreateTaskOptions): PrismTask {
  const { PrismApiHandler } = require("../api/claude-sdk") as typeof import("../api/claude-sdk")
  const apiHandler = new PrismApiHandler({
    apiKey: options.apiKey,
    model: options.model,
  })

  return new PrismTask({
    apiHandler,
    workspaceRoot: options.workspaceRoot,
    systemPromptCtx: options.systemPromptCtx,
    onUpdate: options.onUpdate,
  })
}
