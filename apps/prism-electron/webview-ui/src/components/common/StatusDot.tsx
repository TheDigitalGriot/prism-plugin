import React from "react"

export type StatusDotStatus = "complete" | "in_progress" | "running" | "pending"

interface StatusDotProps {
  status: StatusDotStatus
  size?: number
}

const STATUS_COLORS: Record<StatusDotStatus, string> = {
  complete: "var(--prism-green)",
  in_progress: "var(--prism-amber)",
  running: "var(--prism-amber)",
  pending: "var(--prism-text-dim)",
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 8 }) => {
  const isPulsing = status === "in_progress" || status === "running"
  const color = STATUS_COLORS[status]
  const isHollow = isPulsing

  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: isHollow ? "transparent" : color,
        border: isHollow ? `2px solid ${color}` : "none",
        flexShrink: 0,
        animation: isPulsing ? "statusDotPulse 2s ease-in-out infinite" : undefined,
      }}
    />
  )
}
