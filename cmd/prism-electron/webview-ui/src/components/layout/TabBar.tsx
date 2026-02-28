import React from "react"
import { useLayout } from "../../context/LayoutContext"

/** 36px tab strip — placeholder for Phase 1 */
export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useLayout()

  return (
    <div
      style={{
        height: 36,
        flexShrink: 0,
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--prism-bg-panel)",
        borderBottom: "1px solid var(--prism-border)",
        overflow: "hidden",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              border: "none",
              borderTop: isActive ? "2px solid var(--prism-blue)" : "2px solid transparent",
              borderRight: "1px solid var(--prism-border)",
              background: isActive ? "var(--prism-bg)" : "transparent",
              color: isActive ? "var(--prism-fg)" : "var(--prism-fg-muted)",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab.pinned && (
              <span style={{ fontSize: 8, color: "var(--prism-blue)" }}>●</span>
            )}
            {tab.label}
            {!tab.pinned && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                style={{
                  fontSize: 14,
                  lineHeight: 1,
                  color: "var(--prism-fg-disabled)",
                  marginLeft: 2,
                  cursor: "pointer",
                }}
              >
                ×
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
