import React from "react"

// ---------------------------------------------------------------------------
// SVG Icons (20x20, stroke-based, strokeWidth 1.5)
// ---------------------------------------------------------------------------

const FolderIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H11L9 5H5C3.9 5 3 5.9 3 7Z" />
  </svg>
)

const ClipboardIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    <path d="M9 14l2 2 4-4" />
  </svg>
)

const GitBranchIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <circle cx="18" cy="12" r="2" />
    <path d="M12 8v8M14 18h2a2 2 0 002-2v-2" />
  </svg>
)

const MonitorIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

const SpectrumIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12L7 3l5 13 4-7 6 11" />
  </svg>
)

const WorkspaceIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const SettingsIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

// ---------------------------------------------------------------------------
// Item definitions
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string
  label: string
  icon: React.ReactNode
  color: string
}

const LEFT_ITEMS: ActivityItem[] = [
  { id: "files", label: "Files", icon: <FolderIcon />, color: "var(--prism-purple)" },
  { id: "stories", label: "Stories", icon: <ClipboardIcon />, color: "var(--prism-teal)" },
  { id: "git", label: "Git", icon: <GitBranchIcon />, color: "var(--prism-amber)" },
]

const RIGHT_ITEMS: ActivityItem[] = [
  { id: "monitor", label: "Monitor", icon: <MonitorIcon />, color: "var(--prism-blue)" },
  { id: "spectrum", label: "Spectrum", icon: <SpectrumIcon />, color: "var(--prism-green)" },
  { id: "workspace", label: "Workspace", icon: <WorkspaceIcon />, color: "var(--prism-teal)" },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActivityBarProps {
  side: "left" | "right"
  activeId: string
  collapsed: boolean
  onSelect: (id: string) => void
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  side,
  activeId,
  collapsed,
  onSelect,
}) => {
  const items = side === "left" ? LEFT_ITEMS : RIGHT_ITEMS

  return (
    <div
      style={{
        width: 44,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 4,
        gap: 2,
        backgroundColor: "var(--prism-bg-panel)",
        borderLeft: side === "right" ? "1px solid var(--prism-border)" : "none",
        borderRight: side === "left" ? "1px solid var(--prism-border)" : "none",
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId && !collapsed
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: isActive ? item.color : "var(--prism-fg-muted)",
              opacity: isActive ? 1 : 0.6,
              cursor: "pointer",
              position: "relative",
              transition: "opacity 0.15s ease, color 0.15s ease",
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isActive ? "1" : "0.6"
            }}
          >
            {item.icon}
            {/* Active indicator — 2px colored border on inner edge */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  bottom: 4,
                  [side === "left" ? "right" : "left"]: -4,
                  width: 2,
                  borderRadius: 1,
                  backgroundColor: item.color,
                }}
              />
            )}
          </button>
        )
      })}

      {/* Spacer + Settings at bottom (left bar only) */}
      {side === "left" && (
        <>
          <div style={{ flex: 1 }} />
          <button
            title="Settings"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: "var(--prism-fg-muted)",
              opacity: 0.6,
              cursor: "pointer",
              marginBottom: 4,
              padding: 0,
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.6"
            }}
          >
            <SettingsIcon />
          </button>
        </>
      )}
    </div>
  )
}
