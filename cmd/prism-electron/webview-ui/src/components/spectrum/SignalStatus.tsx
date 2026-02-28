/**
 * SignalStatus — visualizes the last signal received from Spectrum execution.
 */
import React from "react"

interface SignalStatusProps {
  signalType: string
  signalContent: string
  consecutiveErrors: number
}

const SIGNAL_STYLE: Record<string, { icon: string; color: string; label: string }> = {
  none: { icon: "—", color: "#6b7280", label: "No signal" },
  complete: { icon: "✓", color: "#22c55e", label: "Complete" },
  continue: { icon: "→", color: "#3b82f6", label: "Continue" },
  retry: { icon: "↺", color: "#f59e0b", label: "Retry" },
  blocked: { icon: "⊘", color: "#f59e0b", label: "Blocked" },
  error: { icon: "✗", color: "#ef4444", label: "Error" },
}

export const SignalStatus: React.FC<SignalStatusProps> = ({
  signalType,
  signalContent,
  consecutiveErrors,
}) => {
  const meta = SIGNAL_STYLE[signalType] ?? SIGNAL_STYLE.none

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 10px",
          borderRadius: "9999px",
          backgroundColor: `${meta.color}22`,
          border: `1px solid ${meta.color}55`,
          color: meta.color,
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <span>{meta.icon}</span>
        {meta.label}
      </span>

      {signalContent && (
        <span
          style={{
            color: "var(--vscode-descriptionForeground)",
            fontSize: "11px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "200px",
          }}
          title={signalContent}
        >
          {signalContent}
        </span>
      )}

      {consecutiveErrors > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            padding: "2px 8px",
            borderRadius: "9999px",
            backgroundColor: "#ef444422",
            border: "1px solid #ef444455",
            color: "#ef4444",
            fontSize: "11px",
          }}
        >
          ⚠ {consecutiveErrors} error{consecutiveErrors !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}
