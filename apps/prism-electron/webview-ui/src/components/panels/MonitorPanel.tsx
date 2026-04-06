import React from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { CollapsibleSection } from "../common/CollapsibleSection"
import { StatusDot } from "../common/StatusDot"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GateState {
  status: "idle" | "running" | "pass" | "fail"
  output?: string
  duration?: number
}

interface GateResult {
  success: boolean
  output: string
  duration: number
  cancelled?: boolean
}

// ---------------------------------------------------------------------------
// MonitorPanel
// ---------------------------------------------------------------------------

export const MonitorPanel: React.FC = () => {
  const state = usePrismState()
  const { spectrum, stories, epic } = state

  const isRunning = spectrum.executionState === "running"
  const statusLabel = isRunning ? "Prism: Running" : "Prism: Idle"
  const statusDotStatus = isRunning ? "running" as const : "complete" as const

  const completedStories = stories.filter((s) => s.status === "complete")

  // Local gate execution state
  const [gateStates, setGateStates] = React.useState<Record<string, GateState>>({})
  const [expandedGates, setExpandedGates] = React.useState<Set<string>>(new Set())

  const runGate = async (command: string) => {
    setGateStates((prev) => ({ ...prev, [command]: { status: "running" } }))
    try {
      const result = await window.electronAPI.invoke("prism:executeGate", command) as GateResult
      if (result.cancelled) {
        setGateStates((prev) => ({ ...prev, [command]: { status: "idle" } }))
        return
      }
      setGateStates((prev) => ({
        ...prev,
        [command]: {
          status: result.success ? "pass" : "fail",
          output: result.output,
          duration: result.duration,
        },
      }))
      // Auto-expand output on failure
      if (!result.success) {
        setExpandedGates((prev) => new Set(prev).add(command))
      }
    } catch (err) {
      setGateStates((prev) => ({
        ...prev,
        [command]: { status: "fail", output: String(err) },
      }))
      setExpandedGates((prev) => new Set(prev).add(command))
    }
  }

  const cancelGate = async (command: string) => {
    await window.electronAPI.invoke("prism:cancelGate", command)
  }

  const runAllGates = () => {
    if (!epic?.qualityGates) return
    for (const gate of epic.qualityGates) {
      void runGate(gate)
    }
  }

  const toggleExpand = (command: string) => {
    setExpandedGates((prev) => {
      const next = new Set(prev)
      next.has(command) ? next.delete(command) : next.add(command)
      return next
    })
  }

  const anyRunning = Object.values(gateStates).some((g) => g.status === "running")

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* System Health */}
      <CollapsibleSection title="System Health" defaultOpen>
        <div style={{ padding: "6px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <StatusDot status={statusDotStatus} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--prism-fg)" }}>
              {statusLabel}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--prism-fg-disabled)" }}>
            Last refresh: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </CollapsibleSection>

      {/* Execution History */}
      <CollapsibleSection
        title="Execution History"
        defaultOpen
        badge={completedStories.length || undefined}
      >
        {completedStories.length === 0 ? (
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              color: "var(--prism-fg-disabled)",
              textAlign: "center",
            }}
          >
            No completed stories
          </div>
        ) : (
          completedStories.map((story) => (
            <div
              key={story.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 12px",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--prism-bg-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              <StatusDot status="complete" size={6} />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--prism-fg-muted)",
                  flexShrink: 0,
                }}
              >
                {story.id}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--prism-fg)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {story.title}
              </span>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* Quality Gates */}
      <CollapsibleSection
        title="Quality Gates"
        defaultOpen={false}
        badge={
          epic?.qualityGates?.length
            ? `${Object.values(gateStates).filter((g) => g.status === "pass").length}/${epic.qualityGates.length}`
            : undefined
        }
      >
        {epic?.qualityGates && epic.qualityGates.length > 0 ? (
          <div style={{ padding: "4px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Run All button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button
                onClick={runAllGates}
                disabled={anyRunning}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 3,
                  border: "1px solid var(--prism-border)",
                  background: anyRunning ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                  color: anyRunning ? "var(--prism-fg-disabled)" : "var(--prism-fg-muted)",
                  cursor: anyRunning ? "not-allowed" : "pointer",
                }}
              >
                {anyRunning ? "Running…" : "Run All"}
              </button>
            </div>

            {epic.qualityGates.map((gate, i) => {
              const gs = gateStates[gate]
              const isExpanded = expandedGates.has(gate)
              const hasOutput = gs?.output && gs.output.trim().length > 0

              return (
                <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: hasOutput && isExpanded ? "4px 4px 0 0" : 4,
                      border: "1px solid var(--prism-border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    {/* Status indicator */}
                    <span style={{ width: 14, textAlign: "center", flexShrink: 0 }}>
                      {!gs || gs.status === "idle" ? (
                        <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)" }}>—</span>
                      ) : gs.status === "running" ? (
                        <Spinner />
                      ) : gs.status === "pass" ? (
                        <span style={{ fontSize: 11, color: "#3fb950" }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#f85149" }}>✗</span>
                      )}
                    </span>

                    {/* Command */}
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--prism-fg-muted)",
                        fontFamily: "var(--prism-font-code)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {gate}
                    </span>

                    {/* Duration */}
                    {gs?.duration !== undefined && (
                      <span style={{ fontSize: 9.5, color: "var(--prism-fg-disabled)", flexShrink: 0 }}>
                        {(gs.duration / 1000).toFixed(1)}s
                      </span>
                    )}

                    {/* Expand toggle (only if there's output) */}
                    {hasOutput && (
                      <button
                        onClick={() => toggleExpand(gate)}
                        style={{
                          fontSize: 9,
                          padding: "1px 4px",
                          borderRadius: 2,
                          border: "1px solid var(--prism-border)",
                          background: "transparent",
                          color: "var(--prism-fg-disabled)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    )}

                    {/* Cancel button (only while running) */}
                    {gs?.status === "running" && (
                      <button
                        onClick={() => void cancelGate(gate)}
                        title="Cancel this gate"
                        style={{
                          fontSize: 9.5,
                          padding: "1px 6px",
                          borderRadius: 3,
                          border: "1px solid var(--prism-border)",
                          background: "rgba(248,81,73,0.12)",
                          color: "#f85149",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Cancel
                      </button>
                    )}

                    {/* Run button (hidden while running) */}
                    {gs?.status !== "running" && (
                      <button
                        onClick={() => void runGate(gate)}
                        style={{
                          fontSize: 9.5,
                          padding: "1px 6px",
                          borderRadius: 3,
                          border: "1px solid var(--prism-border)",
                          background: "rgba(255,255,255,0.06)",
                          color: "var(--prism-fg-muted)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Run
                      </button>
                    )}
                  </div>

                  {/* Output panel */}
                  {hasOutput && isExpanded && (
                    <pre
                      style={{
                        margin: 0,
                        padding: "6px 8px",
                        fontSize: 10,
                        fontFamily: "var(--prism-font-code)",
                        color:
                          gs.status === "pass"
                            ? "rgba(63,185,80,0.9)"
                            : "rgba(248,81,73,0.9)",
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid var(--prism-border)",
                        borderTop: "none",
                        borderRadius: "0 0 4px 4px",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {gs.output}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
            No quality gates defined
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const Spinner: React.FC = () => {
  const [frame, setFrame] = React.useState(0)
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % frames.length), 80)
    return () => clearInterval(id)
  }, [frames.length])

  return (
    <span style={{ fontSize: 11, color: "var(--prism-fg-muted)", display: "inline-block" }}>
      {frames[frame]}
    </span>
  )
}
