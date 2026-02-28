import React from "react"
import { PrismChatMessage } from "../../context/PrismStateContext"
import { MarkdownBlock } from "../common/MarkdownBlock"
import { ToolUseRow, ToolResultRow } from "./ToolRow"

interface ChatRowProps {
  message: PrismChatMessage
  onApproveToolUse?: (toolUseId: string, approved: boolean) => void
}

export const ChatRow: React.FC<ChatRowProps> = ({ message, onApproveToolUse }) => {
  switch (message.type) {
    case "user":
      return <UserMessageRow message={message} />
    case "assistant_text":
      return <AssistantTextRow message={message} />
    case "tool_use":
      return <ToolUseRow message={message} onApprove={onApproveToolUse} />
    case "tool_result":
      return <ToolResultRow message={message} />
    case "completion":
      return <CompletionRow message={message} />
    case "error":
      return <ErrorRow message={message} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

const UserMessageRow: React.FC<{ message: PrismChatMessage }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: "16px",
    }}
  >
    <div
      style={{
        maxWidth: "85%",
        backgroundColor: "var(--prism-bg-button)",
        color: "var(--prism-fg-button)",
        borderRadius: "12px 12px 2px 12px",
        padding: "8px 12px",
        fontSize: "13px",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {message.text}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Assistant text
// ---------------------------------------------------------------------------

const AssistantTextRow: React.FC<{ message: PrismChatMessage }> = ({ message }) => {
  const text = message.text ?? ""
  const isStreaming = message.isStreaming === true

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        marginBottom: "12px",
        alignItems: "flex-start",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "4px",
          background: "linear-gradient(135deg, #3b82f6, #14b8a6)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          color: "#fff",
          fontWeight: 700,
          marginTop: "2px",
        }}
      >
        P
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {text ? (
          <MarkdownBlock content={text} />
        ) : isStreaming ? (
          <StreamingIndicator />
        ) : null}

        {/* Streaming cursor */}
        {isStreaming && text && (
          <span
            style={{
              display: "inline-block",
              width: "2px",
              height: "14px",
              backgroundColor: "var(--prism-fg)",
              animation: "blink 1s step-end infinite",
              verticalAlign: "text-bottom",
              marginLeft: "2px",
            }}
          />
        )}
      </div>
    </div>
  )
}

const StreamingIndicator: React.FC = () => (
  <div
    style={{
      display: "flex",
      gap: "4px",
      alignItems: "center",
      padding: "4px 0",
    }}
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: "var(--prism-fg-muted)",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

const CompletionRow: React.FC<{ message: PrismChatMessage }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
      margin: "12px 0",
      padding: "12px",
      backgroundColor: "#22c55e18",
      border: "1px solid #22c55e44",
      borderRadius: "8px",
    }}
  >
    <span style={{ fontSize: "16px", flexShrink: 0 }}>&#x2705;</span>
    <div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#22c55e",
          marginBottom: "4px",
        }}
      >
        Task Complete
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--prism-fg)",
          lineHeight: 1.5,
        }}
      >
        {message.completionText}
      </div>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

const ErrorRow: React.FC<{ message: PrismChatMessage }> = ({ message }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
      margin: "8px 0",
      padding: "10px 12px",
      backgroundColor: "#ef444418",
      border: "1px solid #ef444444",
      borderRadius: "6px",
    }}
  >
    <span style={{ fontSize: "14px", flexShrink: 0 }}>&#x26a0;&#xfe0f;</span>
    <div
      style={{
        fontSize: "12px",
        color: "#ef4444",
        fontFamily: "var(--prism-font-mono)",
      }}
    >
      {message.errorText}
    </div>
  </div>
)
