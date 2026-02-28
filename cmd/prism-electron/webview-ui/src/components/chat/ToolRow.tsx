import React, { useState } from "react"
import { PrismChatMessage } from "../../context/PrismStateContext"

// ---------------------------------------------------------------------------
// Tool icons
// ---------------------------------------------------------------------------

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄",
  write_file: "✏️",
  edit_file: "✏️",
  execute_command: "⚡",
  search_files: "🔍",
  list_files: "📁",
  ask_followup: "❓",
  attempt_completion: "✅",
}

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read File",
  write_file: "Write File",
  edit_file: "Edit File",
  execute_command: "Execute Command",
  search_files: "Search Files",
  list_files: "List Files",
  ask_followup: "Ask Followup",
  attempt_completion: "Task Complete",
}

// ---------------------------------------------------------------------------
// Tool use row (pending / approved / denied)
// ---------------------------------------------------------------------------

interface ToolUseRowProps {
  message: PrismChatMessage
  onApprove?: (toolUseId: string, approved: boolean) => void
}

export const ToolUseRow: React.FC<ToolUseRowProps> = ({ message, onApprove }) => {
  const [expanded, setExpanded] = useState(false)

  const toolName = message.toolName ?? "unknown"
  const icon = TOOL_ICONS[toolName] ?? "🔧"
  const label = TOOL_LABELS[toolName] ?? toolName

  const statusColor =
    message.approved === true
      ? "#22c55e"
      : message.approved === false
        ? "#ef4444"
        : message.needsApproval
          ? "#f59e0b"
          : "#6b7280"

  const statusText =
    message.approved === true
      ? "Approved"
      : message.approved === false
        ? "Denied"
        : message.needsApproval
          ? "Awaiting approval"
          : "Running"

  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        border: `1px solid ${statusColor}44`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: "6px",
        margin: "4px 0",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: "14px" }}>{icon}</span>
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--vscode-foreground)",
            fontFamily: "var(--vscode-font-family)",
          }}
        >
          {label}
          {message.toolInput && getToolSummary(toolName, message.toolInput)}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: statusColor,
            flexShrink: 0,
          }}
        >
          {statusText}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          {expanded ? "▼" : "▶"}
        </span>
      </div>

      {/* Expanded input */}
      {expanded && message.toolInput && (
        <div
          style={{
            padding: "0 12px 10px",
            borderTop: "1px solid var(--vscode-widget-border, #333)",
          }}
        >
          <pre
            style={{
              margin: "8px 0 0",
              fontSize: "11px",
              color: "var(--vscode-descriptionForeground)",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </div>
      )}

      {/* Approval buttons */}
      {message.needsApproval && message.approved === undefined && onApprove && message.toolUseId && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "8px 12px",
            borderTop: "1px solid var(--vscode-widget-border, #333)",
          }}
        >
          <button
            onClick={() => onApprove(message.toolUseId!, true)}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#22c55e",
              color: "#fff",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Allow
          </button>
          <button
            onClick={() => onApprove(message.toolUseId!, false)}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              border: "1px solid var(--vscode-widget-border, #555)",
              backgroundColor: "transparent",
              color: "var(--vscode-foreground)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool result row
// ---------------------------------------------------------------------------

interface ToolResultRowProps {
  message: PrismChatMessage
}

export const ToolResultRow: React.FC<ToolResultRowProps> = ({ message }) => {
  const [expanded, setExpanded] = useState(false)
  const isError = message.isToolError === true
  const result = message.toolResult ?? ""
  const preview = result.slice(0, 120).replace(/\n/g, " ")
  const isTruncated = result.length > 120

  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        border: `1px solid ${isError ? "#ef444444" : "var(--vscode-widget-border, #333)"}`,
        borderRadius: "6px",
        margin: "2px 0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "6px 12px",
          cursor: result ? "pointer" : "default",
        }}
        onClick={() => result && setExpanded(!expanded)}
      >
        <span style={{ fontSize: "12px", flexShrink: 0, marginTop: "2px" }}>
          {isError ? "❌" : "↳"}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: "11px",
            color: isError ? "#ef4444" : "var(--vscode-descriptionForeground)",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            overflow: expanded ? "visible" : "hidden",
            textOverflow: expanded ? "unset" : "ellipsis",
          }}
        >
          {expanded ? result : preview + (isTruncated && !expanded ? "…" : "")}
        </span>
        {result && (
          <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", flexShrink: 0 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "read_file":
    case "write_file":
    case "edit_file":
      return input.path ? `: ${String(input.path)}` : ""
    case "execute_command":
      return input.command ? `: ${String(input.command).slice(0, 50)}` : ""
    case "search_files":
      return input.pattern ? `: "${String(input.pattern)}"` : ""
    case "list_files":
      return input.path ? `: ${String(input.path)}` : ""
    case "ask_followup":
      return input.question ? `: ${String(input.question).slice(0, 60)}` : ""
    default:
      return ""
  }
}
