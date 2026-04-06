import React, { useEffect } from "react"
import { useLayout } from "../../context/LayoutContext"
import { ChatView } from "@prism-ui/views/ChatView"
import { StoryDetailView } from "../../views/StoryDetailView"
import { FileContentView } from "../../views/FileContentView"
import { GitGraphView } from "../../views/GitGraphView"
import { SpectrumServiceClient } from "@prism-ui/services/grpc-client"
import { HeaderBar } from "./HeaderBar"
import { ActivityBar } from "./ActivityBar"
import { ContentRail } from "./ContentRail"
import { TabBar } from "./TabBar"
import { FloatingChatPill } from "./FloatingChatPill"
import { BottomPanel } from "./BottomPanel"
import { BottomStatusBar } from "./BottomStatusBar"

// ---------------------------------------------------------------------------
// Center content router
// ---------------------------------------------------------------------------

const CenterContent: React.FC = () => {
  const { tabs, activeTabId } = useLayout()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Keep ChatView always mounted (hidden when not active) for scroll position preservation
  const showChat = !activeTab || activeTab.type === "chat"

  return (
    <>
      <div style={{ height: "100%", display: showChat ? "block" : "none" }}>
        <ChatView />
      </div>
      {!showChat && activeTab && (
        <div style={{ height: "100%", overflow: "auto" }}>
          {activeTab.type === "story" && (
            <StoryDetailView storyId={activeTab.id.replace("story:", "")} />
          )}
          {activeTab.type === "file" && (
            <FileContentView filePath={activeTab.id.replace("file:", "")} />
          )}
          {activeTab.type === "git" && <GitGraphView />}
        </div>
      )}
    </>
  )
}

/**
 * AppShell — VS Code-style IDE layout.
 *
 * Phase 3: Tab system + center content router. Views switch based on active tab.
 */
export const AppShell: React.FC = () => {
  const layout = useLayout()

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && !e.shiftKey && e.key === "b") {
        e.preventDefault()
        layout.toggleLeftCollapsed()
      }
      if (ctrl && e.shiftKey && e.key === "B") {
        e.preventDefault()
        layout.toggleRightCollapsed()
      }
      if (ctrl && !e.shiftKey && e.key === "j") {
        e.preventDefault()
        layout.toggleBottom()
      }
      if (ctrl && e.key === "1") { e.preventDefault(); layout.setLeftPanel("files") }
      if (ctrl && e.key === "2") { e.preventDefault(); layout.setLeftPanel("stories") }
      if (ctrl && e.key === "3") { e.preventDefault(); layout.setLeftPanel("git") }
      if (ctrl && e.key === "w") {
        e.preventDefault()
        layout.closeTab(layout.activeTabId)
      }
      if (e.key === "Escape") {
        layout.setActiveTab("chat")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [layout])

  // Command message handler (moved from App.tsx)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; command?: string; payload?: unknown }
      if (msg?.type !== "command") return

      switch (msg.command) {
        case "startSpectrum":
          layout.setRightPanel("spectrum")
          break
        case "startPhase":
          layout.setActiveTab("chat")
          break
        case "spectrumPause":
          void SpectrumServiceClient.pause()
          break
        case "spectrumStop":
          void SpectrumServiceClient.stop()
          break
        default:
          console.log("[Prism] Received command:", msg.command, msg.payload)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "var(--prism-bg)",
        color: "var(--prism-fg)",
        fontFamily: "var(--prism-font-family)",
        fontSize: "var(--prism-font-size)",
      }}
    >
      {/* 34px header */}
      <HeaderBar />

      {/* Main area: activity bars + rails + center */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left activity bar (44px) */}
        <ActivityBar
          side="left"
          activeId={layout.leftPanel}
          collapsed={layout.leftCollapsed}
          onSelect={(id) => layout.setLeftPanel(id as typeof layout.leftPanel)}
        />

        {/* Left content rail (260px, collapsible) */}
        <ContentRail side="left" />

        {/* Center column */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* 36px tab bar */}
          <TabBar />

          {/* Center content area */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Center content router — renders view based on active tab */}
            <CenterContent />

            {/* Floating chat pill (visible when not on chat tab) */}
            <FloatingChatPill />
          </div>

          {/* 180px bottom panel (conditional) */}
          {layout.bottomOpen && <BottomPanel />}
        </div>

        {/* Right content rail (260px, collapsible) */}
        <ContentRail side="right" />

        {/* Right activity bar (44px) */}
        <ActivityBar
          side="right"
          activeId={layout.rightPanel}
          collapsed={layout.rightCollapsed}
          onSelect={(id) => layout.setRightPanel(id as typeof layout.rightPanel)}
        />
      </div>

      {/* 24px status bar */}
      <BottomStatusBar />
    </div>
  )
}
