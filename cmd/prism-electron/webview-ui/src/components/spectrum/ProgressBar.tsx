/**
 * ProgressBar — animated progress bar with spectral gradient.
 */
import React from "react"

interface ProgressBarProps {
  progress: number // 0-100
  /** Show the percentage text inside the bar. */
  showLabel?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, showLabel = true }) => {
  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "18px",
        borderRadius: "9px",
        backgroundColor: "var(--prism-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${clamped}%`,
          background: "linear-gradient(90deg, #3b82f6 0%, #14b8a6 33%, #22c55e 66%, #f59e0b 100%)",
          borderRadius: "9px",
          transition: "width 0.5s ease",
        }}
      />
      {showLabel && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 600,
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            letterSpacing: "0.05em",
          }}
        >
          {clamped}%
        </div>
      )}
    </div>
  )
}
