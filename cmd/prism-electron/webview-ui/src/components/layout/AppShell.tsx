import React, { useEffect } from "react"
import { useLayout } from "../../context/LayoutContext"
import { ChatView } from "../../views/ChatView"
import { SpectrumServiceClient } from "../../services/grpc-client"
import { HeaderBar } from "./HeaderBar"
import { ActivityBar } from "./ActivityBar"
import { ContentRail } from "./ContentRail"
import { TabBar } from "./TabBar"
import { FloatingChatPill } from "./FloatingChatPill"
import { BottomPanel } from "./BottomPanel"
import { BottomStatusBar } from "./BottomStatusBar"

/**
 * AppShell — VS Code-style IDE layout.
 *
 * Phase 2: Real activity bars + collapsible rails. ChatView mounted in center.
 * Panels are placeholder content — real panels come in later phases.
 */
export const AppShell: React.FC = () => {
  const layout = useLayout()

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
            {/* Phase 1: ChatView always rendered in center */}
            <ChatView />

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
