import React, { useState } from "react"
import { useLayout, type TabType } from "../../context/LayoutContext"

// ---------------------------------------------------------------------------
// Tab icons (16x16, stroke-based)
// ---------------------------------------------------------------------------

const ChatBubbleIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

const ClipboardIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const DocIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const GitBranchIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <circle cx="18" cy="12" r="2" />
    <path d="M12 8v8M14 18h2a2 2 0 002-2v-2" />
  </svg>
)

// ---------------------------------------------------------------------------
// Icon + color mapping per tab type
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<TabType, React.ReactNode> = {
  chat: <ChatBubbleIcon />,
  story: <ClipboardIcon />,
  file: <DocIcon />,
  git: <GitBranchIcon />,
}

const TAB_COLORS: Record<TabType, string> = {
  chat: "var(--prism-blue)",
  story: "var(--prism-teal)",
  file: "var(--prism-purple)",
  git: "var(--prism-amber)",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useLayout()
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)

  return (
    <div
      style={{
        height: 36,
        flexShrink: 0,
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--prism-bg-panel)",
        borderBottom: "1px solid var(--prism-border)",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const isHovered = tab.id === hoveredTabId
        const color = TAB_COLORS[tab.type]
        const icon = TAB_ICONS[tab.type]

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              border: "none",
              borderTop: isActive ? `2px solid ${color}` : "2px solid transparent",
              borderRight: "1px solid var(--prism-border)",
              background: isActive ? "var(--prism-bg)" : "transparent",
              color: isActive ? "var(--prism-fg)" : "var(--prism-fg-muted)",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "background 0.1s ease",
            }}
          >
            {/* Tab type icon */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                color: isActive ? color : "var(--prism-fg-disabled)",
              }}
            >
              {icon}
            </span>

            {/* Pinned dot */}
            {tab.pinned && (
              <span style={{ fontSize: 6, color, lineHeight: 1 }}>●</span>
            )}

            {/* Tab label */}
            {tab.label}

            {/* Close button — visible on hover, hidden for pinned */}
            {!tab.pinned && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                style={{
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "var(--prism-fg-disabled)",
                  borderRadius: 3,
                  marginLeft: 2,
                  cursor: "pointer",
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.1s ease, background 0.1s ease",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--prism-bg-hover)"
                  e.currentTarget.style.color = "var(--prism-fg)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                  e.currentTarget.style.color = "var(--prism-fg-disabled)"
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
