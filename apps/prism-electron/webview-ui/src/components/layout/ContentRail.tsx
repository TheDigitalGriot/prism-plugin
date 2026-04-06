import React from "react"
import { useLayout, type LeftPanel, type RightPanel } from "../../context/LayoutContext"
import { StoriesPanel } from "../panels/StoriesPanel"
import { FilesPanel } from "../panels/FilesPanel"
import { GitPanel } from "../panels/GitPanel"
import { MonitorPanel } from "../panels/MonitorPanel"
import { SpectrumPanel } from "../panels/SpectrumPanel"
import { WorkspacePanel } from "../panels/WorkspacePanel"

// ---------------------------------------------------------------------------
// Collapse chevron icon
// ---------------------------------------------------------------------------

const CollapseChevron: React.FC<{ direction: "left" | "right" }> = ({ direction }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
)

// ---------------------------------------------------------------------------
// Panel title mapping
// ---------------------------------------------------------------------------

const PANEL_TITLES: Record<LeftPanel | RightPanel, string> = {
  files: "Explorer",
  stories: "Stories",
  git: "Source Control",
  monitor: "Monitor",
  spectrum: "Spectrum",
  workspace: "Workspace",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContentRailProps {
  side: "left" | "right"
}

export const ContentRail: React.FC<ContentRailProps> = ({ side }) => {
  const layout = useLayout()
  const collapsed = side === "left" ? layout.leftCollapsed : layout.rightCollapsed
  const panel = side === "left" ? layout.leftPanel : layout.rightPanel
  const toggleCollapse =
    side === "left" ? layout.toggleLeftCollapsed : layout.toggleRightCollapsed

  return (
    <div
      className="prism-rail-collapse"
      style={{
        width: collapsed ? 0 : 260,
        minWidth: collapsed ? 0 : 260,
        backgroundColor: "var(--prism-bg-rail)",
        borderLeft: side === "right" ? "1px solid var(--prism-border)" : "none",
        borderRight: side === "left" ? "1px solid var(--prism-border)" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Rail header */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          paddingRight: 4,
          borderBottom: "1px solid var(--prism-border)",
          gap: 4,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--prism-fg-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {PANEL_TITLES[panel]}
        </span>
        <button
          onClick={toggleCollapse}
          title={`Collapse ${side} panel`}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 3,
            background: "transparent",
            color: "var(--prism-fg-muted)",
            cursor: "pointer",
            padding: 0,
            opacity: 0.6,
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6"
          }}
        >
          <CollapseChevron direction={side} />
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {side === "left" && (
          <>
            {panel === "files" && <FilesPanel />}
            {panel === "stories" && <StoriesPanel />}
            {panel === "git" && <GitPanel />}
          </>
        )}
        {side === "right" && (
          <>
            {panel === "monitor" && <MonitorPanel />}
            {panel === "spectrum" && <SpectrumPanel />}
            {panel === "workspace" && <WorkspacePanel />}
          </>
        )}
      </div>
    </div>
  )
}
