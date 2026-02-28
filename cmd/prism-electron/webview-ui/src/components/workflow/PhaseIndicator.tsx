import React from "react"
import { WorkflowPhase } from "../../context/PrismStateContext"
import { WorkflowServiceClient, WorkflowTransition } from "../../services/grpc-client"

// ---------------------------------------------------------------------------
// Phase metadata
// ---------------------------------------------------------------------------

const PHASE_META: Record<
  WorkflowPhase,
  { label: string; color: string; icon: string; description: string }
> = {
  idle: {
    label: "Idle",
    color: "#6b7280",
    icon: "○",
    description: "Ready to start",
  },
  research: {
    label: "Research",
    color: "#3b82f6",
    icon: "◎",
    description: "Documenting the codebase",
  },
  plan: {
    label: "Plan",
    color: "#14b8a6",
    icon: "◈",
    description: "Designing the implementation",
  },
  implement: {
    label: "Implement",
    color: "#22c55e",
    icon: "◆",
    description: "Executing the plan",
  },
  validate: {
    label: "Validate",
    color: "#f59e0b",
    icon: "◉",
    description: "Verifying success criteria",
  },
}

// Phase order for the progress bar
const PHASE_ORDER: WorkflowPhase[] = ["idle", "research", "plan", "implement", "validate"]

// ---------------------------------------------------------------------------
// PhaseIndicator
// ---------------------------------------------------------------------------

interface PhaseIndicatorProps {
  currentPhase: WorkflowPhase
  onPhaseChange?: (phase: WorkflowPhase) => void
  compact?: boolean
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({
  currentPhase,
  compact = false,
}) => {
  const meta = PHASE_META[currentPhase]

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          borderRadius: "9999px",
          backgroundColor: `${meta.color}22`,
          border: `1px solid ${meta.color}55`,
          color: meta.color,
          fontSize: "11px",
          fontWeight: 500,
        }}
      >
        <span>{meta.icon}</span>
        {meta.label}
      </span>
    )
  }

  // Use CSS phase-bar class for glow animation when active (non-idle)
  const phaseBarClass = currentPhase !== "idle" ? `prism-phase-bar-${currentPhase} prism-phase-transition` : ""

  return (
    <div
      className={phaseBarClass}
      style={{
        padding: "8px 12px",
        backgroundColor: `${meta.color}11`,
      }}
    >
      {/* Phase label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: meta.color, fontSize: "14px" }}>{meta.icon}</span>
          <span
            style={{
              color: meta.color,
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {meta.label}
          </span>
        </div>
        <span style={{ color: "var(--prism-fg-muted)", fontSize: "11px" }}>
          {meta.description}
        </span>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {PHASE_ORDER.filter((p) => p !== "idle").map((phase) => {
          const phaseMeta = PHASE_META[phase]
          const phaseIdx = PHASE_ORDER.indexOf(phase)
          const currentIdx = PHASE_ORDER.indexOf(currentPhase)
          const isActive = phase === currentPhase
          const isDone = phaseIdx < currentIdx

          return (
            <div
              key={phase}
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                backgroundColor: isDone || isActive ? phaseMeta.color : "var(--prism-border)",
                opacity: isActive ? 1 : isDone ? 0.7 : 0.3,
                transition: "all 0.2s ease",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PhaseTransition — buttons to move between phases
// ---------------------------------------------------------------------------

interface PhaseTransitionProps {
  currentPhase: WorkflowPhase
}

const PHASE_TRANSITIONS: Record<WorkflowPhase, { label: string; transition: WorkflowTransition; color: string }[]> = {
  idle: [
    { label: "Start Research", transition: "start_research", color: "#3b82f6" },
    { label: "Start Plan", transition: "start_plan", color: "#14b8a6" },
    { label: "Start Implement", transition: "start_implement", color: "#22c55e" },
    { label: "Start Validate", transition: "start_validate", color: "#f59e0b" },
  ],
  research: [
    { label: "→ Plan", transition: "start_plan", color: "#14b8a6" },
    { label: "Reset", transition: "reset", color: "#6b7280" },
  ],
  plan: [
    { label: "→ Implement", transition: "start_implement", color: "#22c55e" },
    { label: "← Research", transition: "start_research", color: "#3b82f6" },
    { label: "Reset", transition: "reset", color: "#6b7280" },
  ],
  implement: [
    { label: "→ Validate", transition: "start_validate", color: "#f59e0b" },
    { label: "← Plan", transition: "start_plan", color: "#14b8a6" },
    { label: "Reset", transition: "reset", color: "#6b7280" },
  ],
  validate: [
    { label: "Complete ✓", transition: "complete", color: "#22c55e" },
    { label: "← Implement", transition: "start_implement", color: "#22c55e" },
    { label: "Reset", transition: "reset", color: "#6b7280" },
  ],
}

export const PhaseTransition: React.FC<PhaseTransitionProps> = ({ currentPhase }) => {
  const buttons = PHASE_TRANSITIONS[currentPhase] ?? []

  const handleTransition = async (transition: WorkflowTransition) => {
    try {
      await WorkflowServiceClient.transition(transition)
    } catch (err) {
      console.error("[Prism] Transition failed:", err)
    }
  }

  if (buttons.length === 0) return null

  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "8px 12px" }}>
      {buttons.map(({ label, transition, color }) => (
        <button
          key={transition}
          onClick={() => void handleTransition(transition)}
          style={{
            padding: "3px 10px",
            borderRadius: "4px",
            border: `1px solid ${color}55`,
            backgroundColor: `${color}22`,
            color: color,
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
