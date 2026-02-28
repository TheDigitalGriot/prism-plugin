import React from "react"
import { useLayout } from "../../context/LayoutContext"

/** 24px status strip — placeholder for Phase 1 */
export const BottomStatusBar: React.FC = () => {
  const { bottomOpen, toggleBottom } = useLayout()

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
      }}
    >
      <div style={{ flex: 1 }} />
      <button
        onClick={toggleBottom}
        style={{
          padding: "0 8px",
          height: 18,
          border: "1px solid var(--prism-border)",
          borderRadius: 3,
          background: bottomOpen ? "var(--prism-bg-active)" : "transparent",
          color: "var(--prism-fg-muted)",
          fontSize: 10,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        🏢 Office
      </button>
    </div>
  )
}
