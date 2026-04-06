import React, { useEffect, useState } from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { ChatView } from "@prism-ui/views/ChatView"
import { SpectrumView } from "@prism-ui/views/SpectrumView"
import { WelcomeView } from "@prism-ui/components/WelcomeView"
import { SpectrumServiceClient } from "@prism-ui/services/grpc-client"

// ---------------------------------------------------------------------------
// View type
// ---------------------------------------------------------------------------

type AppView = "chat" | "spectrum"

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

const LoadingView: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: "var(--prism-fg-muted)",
      fontSize: "13px",
    }}
  >
    Loading Prism…
  </div>
)

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const state = usePrismState()
  const [currentView, setCurrentView] = useState<AppView>("chat")

  // True first-time user: no .prism/ dir
  const isFirstTimeUser = !state.hasPrismDir

  // Listen for command messages from extension host
  // (e.g. "startSpectrum" triggered by prism.spectrum command or status bar click)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; command?: string; payload?: unknown }
      if (msg?.type !== "command") return

      switch (msg.command) {
        case "startSpectrum":
          setCurrentView("spectrum")
          break
        case "startPhase":
          setCurrentView("chat")
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
  }, [])

  // Hydration loading state
  if (!state.isHydrated) {
    return <LoadingView />
  }

  const outerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "var(--prism-bg)",
    color: "var(--prism-fg)",
    fontFamily: "var(--prism-font-family)",
    fontSize: "var(--prism-font-size)",
  }

  // Spectrum dashboard view
  if (currentView === "spectrum") {
    return (
      <div style={outerStyle}>
        <SpectrumView onBack={() => setCurrentView("chat")} />
      </div>
    )
  }

  // First-time user: show welcome onboarding
  if (isFirstTimeUser) {
    return (
      <div style={outerStyle}>
        <WelcomeView />
      </div>
    )
  }

  // Default: Chat view (always mounted to preserve state)
  return (
    <div style={outerStyle}>
      {/* Spectral accent bar at top of sidebar */}
      <div className="prism-header-accent" />
      {/* Spectrum shortcut pill — only visible when Spectrum is active */}
      {state.hasStoriesJson && state.spectrum?.executionState !== "idle" && (
        <button
          onClick={() => setCurrentView("spectrum")}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 100,
            padding: "3px 10px",
            borderRadius: "9999px",
            border: "1px solid #3b82f655",
            backgroundColor: "#3b82f622",
            color: "#3b82f6",
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: 500,
          }}
          title="Open Spectrum dashboard"
        >
          ◉ Spectrum
        </button>
      )}
      <ChatView />
    </div>
  )
}
