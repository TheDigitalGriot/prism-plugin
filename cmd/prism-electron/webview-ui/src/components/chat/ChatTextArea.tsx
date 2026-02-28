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
  placeholder = "Message Prism\u2026",
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
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        if (!disabled && value.trim()) {
          onSubmit()
        }
        return
      }
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
        backgroundColor: "var(--prism-bg-input)",
        border: "1px solid var(--prism-border-input)",
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
          color: "var(--prism-fg)",
          fontSize: "var(--prism-font-size)",
          fontFamily: "var(--prism-font-family)",
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
            ? "var(--prism-bg-button-secondary)"
            : "var(--prism-bg-button)",
          color: disabled || !value.trim()
            ? "var(--prism-fg-muted)"
            : "var(--prism-fg-button)",
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          transition: "background-color 0.1s",
        }}
      >
        &#x2191;
      </button>
    </div>
  )
}
