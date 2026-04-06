import React from "react"
import { useLayout } from "../../context/LayoutContext"
import { usePrismState } from "@prism-ui/context/PrismStateContext"

// ---------------------------------------------------------------------------
// Prism logo icon (small triangle prism shape)
// ---------------------------------------------------------------------------

const PrismLogoIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    style={{ flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="sb-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="50%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <polygon points="12,2 22,20 2,20" fill="url(#sb-logo-grad)" />
  </svg>
)

// ---------------------------------------------------------------------------
// BottomStatusBar — 24px strip at the very bottom of the window
// ---------------------------------------------------------------------------

export const BottomStatusBar: React.FC = () => {
  const { bottomOpen, toggleBottom } = useLayout()
  const { completedCount, remainingCount, version } = usePrismState()

  const totalCount = completedCount + remainingCount
  const storyLabel = totalCount > 0 ? `${completedCount}/${totalCount} Stories` : "No Stories"

  return (
    <div
      style={{
        height: 24,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        paddingLeft: 10,
        paddingRight: 10,
        gap: 8,
        backgroundColor: "var(--prism-bg-surface)",
        borderTop: "1px solid var(--prism-border)",
        fontSize: 11,
        color: "var(--prism-fg-muted)",
        userSelect: "none",
      }}
    >
      {/* Left: logo + version */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <PrismLogoIcon />
        <span style={{ fontSize: 10.5, color: "var(--prism-fg-muted)" }}>
          v{version}
        </span>
      </div>

      {/* Center: story count with spectral gradient */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <span
          className="prism-text-gradient"
          style={{
            fontSize: 10.5,
            fontWeight: 500,
          }}
        >
          {storyLabel}
        </span>
      </div>

      {/* Right: Office toggle */}
      <button
        onClick={toggleBottom}
        style={{
          padding: "0 8px",
          height: 18,
          border: "none",
          borderRadius: 3,
          background: "transparent",
          color: bottomOpen ? "var(--prism-teal)" : "var(--prism-fg-muted)",
          fontSize: 10.5,
          fontWeight: bottomOpen ? 600 : 400,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          transition: "color 0.15s ease",
        }}
      >
        Office
      </button>
    </div>
  )
}
