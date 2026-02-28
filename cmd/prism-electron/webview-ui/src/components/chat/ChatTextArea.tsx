import React, { useRef, useEffect, useCallback } from "react"

interface ChatTextAreaProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

export const ChatTextArea: React.FC<ChatTextAreaProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Message Prism…",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        if (!disabled && value.trim()) {
          onSubmit()
        }
        return
      }
      // Shift+Enter for newline (default behavior)
      // Plain Enter → submit if not on mobile
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (!disabled && value.trim()) {
          onSubmit()
        }
      }
    },
    [disabled, onSubmit, value],
  )

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "8px",
        padding: "8px",
        backgroundColor: "var(--vscode-input-background)",
        border: "1px solid var(--vscode-input-border, #3c3c3c)",
        borderRadius: "8px",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          backgroundColor: "transparent",
          color: "var(--vscode-input-foreground)",
          fontSize: "var(--vscode-font-size, 13px)",
          fontFamily: "var(--vscode-font-family, sans-serif)",
          lineHeight: 1.5,
          minHeight: "20px",
          maxHeight: "200px",
          padding: "0",
        }}
      />
      <button
        onClick={() => !disabled && value.trim() && onSubmit()}
        disabled={disabled || !value.trim()}
        title="Send message (Enter)"
        style={{
          flexShrink: 0,
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          border: "none",
          backgroundColor: disabled || !value.trim()
            ? "var(--vscode-button-secondaryBackground, #3c3c3c)"
            : "var(--vscode-button-background, #0e639c)",
          color: disabled || !value.trim()
            ? "var(--vscode-descriptionForeground)"
            : "var(--vscode-button-foreground, #fff)",
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          transition: "background-color 0.1s",
        }}
      >
        ↑
      </button>
    </div>
  )
}
