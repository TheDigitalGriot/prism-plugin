import React from "react"
import { usePrismState, type WorkflowPhase } from "../../context/PrismStateContext"
import { WorkflowServiceClient, type WorkflowTransition } from "../../services/grpc-client"
import { StatusDot } from "../common/StatusDot"

// ---------------------------------------------------------------------------
// Phase button metadata
// ---------------------------------------------------------------------------

const PHASES: Array<{
  key: WorkflowPhase
  label: string
  color: string
  transition: WorkflowTransition
}> = [
  { key: "research", label: "Research", color: "#3b82f6", transition: "start_research" },
  { key: "plan", label: "Plan", color: "#14b8a6", transition: "start_plan" },
  { key: "implement", label: "Implement", color: "#22c55e", transition: "start_implement" },
  { key: "validate", label: "Validate", color: "#f59e0b", transition: "start_validate" },
]

// ---------------------------------------------------------------------------
// HeaderBar — 34px top header with project name, RPIV phase buttons, status
// ---------------------------------------------------------------------------

export const HeaderBar: React.FC = () => {
  const state = usePrismState()
  const currentPhase = state.workflowPhase

  // Extract folder basename from prismDir path
  const projectName = state.prismDir
    ? state.prismDir.replace(/\\/g, "/").split("/").filter(Boolean).slice(-1)[0] || "Prism"
    : "Prism"

  const handlePhaseClick = async (transition: WorkflowTransition) => {
    try {
      await WorkflowServiceClient.transition(transition)
    } catch (err) {
      console.error("[Prism] Phase transition failed:", err)
    }
  }

  return (
    <div
      style={{
        height: 34,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: "var(--prism-bg-panel)",
        borderBottom: "1px solid var(--prism-border)",
        gap: 8,
      }}
    >
      {/* Left: Spectral accent stripe + project name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            background: "var(--prism-gradient)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--prism-fg)",
            letterSpacing: "0.04em",
          }}
        >
          {projectName}
        </span>
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Center: RPIV phase buttons */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {PHASES.map(({ key, label, color, transition }) => {
          const isActive = currentPhase === key

          return (
            <button
              key={key}
              onClick={() => void handlePhaseClick(transition)}
              title={`Switch to ${label} phase`}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? color : "var(--prism-fg-muted)",
                backgroundColor: isActive ? `${color}22` : "transparent",
                border: isActive ? `1px solid ${color}44` : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: Status dot + label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <StatusDot status={state.hasActiveTask ? "running" : "pending"} size={6} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: state.hasActiveTask ? "var(--prism-amber)" : "var(--prism-fg-muted)",
          }}
        >
          {state.hasActiveTask ? "RUNNING" : "IDLE"}
        </span>
      </div>
    </div>
  )
}
