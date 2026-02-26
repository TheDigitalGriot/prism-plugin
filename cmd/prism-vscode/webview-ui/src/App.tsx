import React, { useEffect, useState } from "react"
import { usePrismState } from "./context/PrismStateContext"
import { vscodeApi } from "./vscode"

// ---------------------------------------------------------------------------
// Phase badge
// ---------------------------------------------------------------------------

const PHASE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  idle: { label: "Idle", color: "#6b7280", icon: "○" },
  research: { label: "Research", color: "#3b82f6", icon: "◎" },
  plan: { label: "Plan", color: "#14b8a6", icon: "◈" },
  implement: { label: "Implement", color: "#22c55e", icon: "◆" },
  validate: { label: "Validate", color: "#f59e0b", icon: "◉" },
}

const PhaseBadge: React.FC<{ phase: string }> = ({ phase }) => {
  const meta = PHASE_META[phase] ?? PHASE_META.idle
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "9999px",
        backgroundColor: meta.color + "33",
        border: `1px solid ${meta.color}66`,
        color: meta.color,
        fontSize: "calc(0.85 * var(--prism-font-size))",
        fontWeight: 500,
      }}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hello Prism view (Phase 1 placeholder)
// ---------------------------------------------------------------------------

const HelloPrismView: React.FC = () => {
  const state = usePrismState()

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "24px",
        gap: "16px",
        textAlign: "center",
      }}
    >
      {/* Prism logo / title */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            fontSize: "calc(2 * var(--prism-font-size))",
            fontWeight: 700,
            letterSpacing: "0.15em",
            background:
              "linear-gradient(90deg, #3b82f6, #14b8a6, #22c55e, #f59e0b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          P R I S M
        </div>
        <div
          style={{
            color: "var(--prism-fg-muted)",
            fontSize: "calc(0.9 * var(--prism-font-size))",
            marginTop: "4px",
          }}
        >
          Research → Plan → Implement → Validate
        </div>
      </div>

      {/* Spectral gradient bar */}
      <div
        style={{
          width: "160px",
          height: "3px",
          borderRadius: "2px",
          background:
            "linear-gradient(90deg, #3b82f6, #14b8a6, #22c55e, #f59e0b)",
        }}
      />

      {/* State debug panel */}
      {state.isHydrated && (
        <div
          style={{
            width: "100%",
            maxWidth: "320px",
            backgroundColor: "var(--prism-bg-panel)",
            border: "1px solid var(--prism-border)",
            borderRadius: "var(--prism-radius-md)",
            padding: "12px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "var(--prism-fg-muted)",
              fontSize: "calc(0.8 * var(--prism-font-size))",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Extension State
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
          >
            <StateRow
              label="Phase"
              value={<PhaseBadge phase={state.workflowPhase} />}
            />
            <StateRow
              label=".prism/ dir"
              value={
                state.hasPrismDir ? (
                  <span style={{ color: "#22c55e" }}>✓ detected</span>
                ) : (
                  <span style={{ color: "var(--prism-fg-muted)" }}>
                    not found
                  </span>
                )
              }
            />
            <StateRow
              label="stories.json"
              value={
                state.hasStoriesJson ? (
                  <span style={{ color: "#22c55e" }}>✓ found</span>
                ) : (
                  <span style={{ color: "var(--prism-fg-muted)" }}>
                    not found
                  </span>
                )
              }
            />
            <StateRow label="Version" value={state.version} />
          </div>
        </div>
      )}

      {/* IPC round-trip indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "calc(0.85 * var(--prism-font-size))",
          color: state.isHydrated ? "#22c55e" : "var(--prism-fg-muted)",
        }}
      >
        <span>{state.isHydrated ? "●" : "○"}</span>
        {state.isHydrated
          ? "IPC bridge active — state received"
          : "Connecting to extension host…"}
      </div>
    </div>
  )
}

const StateRow: React.FC<{
  label: string
  value: React.ReactNode
}> = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ color: "var(--prism-fg-muted)", fontSize: "calc(0.9 * var(--prism-font-size))" }}>
      {label}
    </span>
    <span style={{ fontSize: "calc(0.9 * var(--prism-font-size))" }}>{value}</span>
  </div>
)

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const state = usePrismState()
  const [commandEvent, setCommandEvent] = useState<{
    command: string
    payload?: unknown
  } | null>(null)

  // Listen for command messages from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg?.type === "command") {
        setCommandEvent({ command: msg.command, payload: msg.payload })
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  // Hydration loading state
  if (!state.isHydrated) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--prism-fg-muted)",
          fontSize: "var(--prism-font-size)",
        }}
      >
        Loading Prism…
      </div>
    )
  }

  return <HelloPrismView />
}
