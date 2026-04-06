/**
 * Conversation state management for PrismTask.
 *
 * Maintains two parallel message arrays:
 * - apiMessages: sent to the Claude API (follows Anthropic message format)
 * - chatMessages: displayed in the webview UI (richer display format)
 */
import { v4 as uuidv4 } from "uuid"
import { ApiConversationMessage, PrismChatMessage } from "@prism-core/core/api/types"

export class MessageState {
  /** API-level conversation history. Sent to Claude on each request. */
  readonly apiMessages: ApiConversationMessage[] = []

  /** UI-level messages rendered in ChatView. */
  readonly chatMessages: PrismChatMessage[] = []

  /** Add a user message to both arrays. */
  addUserMessage(text: string): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "user",
      text,
    }
    this.chatMessages.push(msg)
    this.apiMessages.push({ role: "user", content: text })
    return msg
  }

  /**
   * Start a new assistant streaming message.
   * Returns the message object (you'll mutate it as tokens arrive).
   */
  startAssistantMessage(): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "assistant_text",
      text: "",
      isStreaming: true,
    }
    this.chatMessages.push(msg)
    return msg
  }

  /** Append text to the current streaming assistant message. */
  appendAssistantText(msg: PrismChatMessage, text: string): void {
    msg.text = (msg.text ?? "") + text
  }

  /** Finalize the assistant message (stop streaming). */
  finalizeAssistantMessage(msg: PrismChatMessage): void {
    msg.isStreaming = false
    // Add to API history
    this.apiMessages.push({ role: "assistant", content: msg.text ?? "" })
  }

  /** Add a tool use message (pending approval or auto-approved). */
  addToolUse(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId: string,
    needsApproval: boolean,
  ): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "tool_use",
      toolName,
      toolInput,
      toolUseId,
      needsApproval,
      approved: needsApproval ? undefined : true,
    }
    this.chatMessages.push(msg)
    return msg
  }

  /** Update tool use approval status. */
  setToolApproval(toolUseId: string, approved: boolean): void {
    const msg = this.chatMessages.find(
      (m) => m.type === "tool_use" && m.toolUseId === toolUseId,
    )
    if (msg) {
      msg.approved = approved
    }
  }

  /** Add a tool result message. */
  addToolResult(
    toolUseId: string,
    toolName: string,
    result: string,
    isError: boolean,
  ): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "tool_result",
      toolUseId,
      toolName,
      toolResult: result,
      isToolError: isError,
    }
    this.chatMessages.push(msg)
    return msg
  }

  /** Add an error message. */
  addError(errorText: string): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "error",
      errorText,
    }
    this.chatMessages.push(msg)
    return msg
  }

  /** Add a completion message. */
  addCompletion(completionText: string): PrismChatMessage {
    const msg: PrismChatMessage = {
      id: uuidv4(),
      ts: Date.now(),
      type: "completion",
      completionText,
    }
    this.chatMessages.push(msg)
    return msg
  }

  /**
   * Build the API tool result content to append to API history.
   * Called after a tool has been executed.
   */
  addApiToolResult(toolUseId: string, result: string, isError: boolean): void {
    this.apiMessages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: result,
          is_error: isError,
        },
      ],
    })
  }

  /**
   * Add the assistant's tool_use content block to API history.
   * Called after all tool calls in a response have been collected.
   */
  addApiToolUseBlocks(
    textContent: string,
    toolCalls: Array<{ toolName: string; toolInput: Record<string, unknown>; toolUseId: string }>,
  ): void {
    const content: ApiConversationMessage["content"] = []

    if (textContent.trim()) {
      content.push({ type: "text", text: textContent })
    }

    for (const tc of toolCalls) {
      content.push({
        type: "tool_use",
        id: tc.toolUseId,
        name: tc.toolName,
        input: tc.toolInput,
      })
    }

    if (content.length > 0) {
      this.apiMessages.push({ role: "assistant", content })
    }
  }

  /** Clear all messages (new conversation). */
  clear(): void {
    this.apiMessages.length = 0
    this.chatMessages.length = 0
  }
}
