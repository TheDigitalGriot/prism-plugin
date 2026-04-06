import React from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { WelcomeView } from "@prism-ui/components/WelcomeView"
import { AppShell } from "./components/layout/AppShell"

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

  if (!state.isHydrated) return <LoadingView />
  if (!state.hasPrismDir) return <WelcomeView />

  return <AppShell />
}
