import React from "react"
import { useLayout } from "../../context/LayoutContext"

/** 180px collapsible bottom panel — placeholder for Phase 1 */
export const BottomPanel: React.FC = () => {
  const { bottomTab, setBottomTab } = useLayout()

  return (
    <div
      style={{
        height: 180,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--prism-bg-editor)",
        borderTop: "1px solid var(--prism-border)",
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          height: 30,
          flexShrink: 0,
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--prism-border)",
        }}
      >
        {(["office", "terminal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBottomTab(tab)}
            style={{
              padding: "0 12px",
              border: "none",
              borderTop: bottomTab === tab ? "2px solid var(--prism-teal)" : "2px solid transparent",
              background: "transparent",
              color: bottomTab === tab ? "var(--prism-fg)" : "var(--prism-fg-muted)",
              fontSize: 11,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Placeholder content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--prism-fg-disabled)",
          fontSize: 11,
        }}
      >
        {bottomTab} panel
      </div>
    </div>
  )
}
