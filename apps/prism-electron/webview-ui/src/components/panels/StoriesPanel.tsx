import React, { useCallback, useEffect, useState } from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { useLayout } from "../../context/LayoutContext"
import { CollapsibleSection } from "../common/CollapsibleSection"
import { StatusDot } from "../common/StatusDot"
import type { StatusDotStatus } from "../common/StatusDot"

// ---------------------------------------------------------------------------
// Helper — map story status string to StatusDot status
// ---------------------------------------------------------------------------

function toStatusDotStatus(s: string): StatusDotStatus {
  if (s === "complete") return "complete"
  if (s === "in_progress") return "in_progress"
  return "pending"
}

// ---------------------------------------------------------------------------
// Research / Plan types (match packages/prism-core/src/workspace/research.ts + plans.ts)
// ---------------------------------------------------------------------------

interface ResearchItem {
  filename: string
  date: string
  topic: string
  tags: string[]
  status: string
  filePath: string
}

interface PlanItem {
  filename: string
  date: string
  feature: string
  status: string
  phases: number
  filePath: string
}

// ---------------------------------------------------------------------------
// Plan status helpers
// ---------------------------------------------------------------------------

function planStatusIcon(status: string): string {
  switch (status) {
    case "complete":
      return "✓"
    case "in_progress":
      return "◐"
    case "approved":
      return "✔"
    default:
      return "○"
  }
}

function planStatusColor(status: string): string {
  switch (status) {
    case "complete":
      return "var(--prism-green)"
    case "in_progress":
      return "var(--prism-blue)"
    case "approved":
      return "var(--prism-amber)"
    default:
      return "var(--prism-fg-muted)"
  }
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

const PhaseProgressBar: React.FC<{ completedCount: number; totalCount: number }> = ({
  completedCount,
  totalCount,
}) => {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  return (
    <div
      style={{
        height: 3,
        background: "var(--prism-border)",
        borderRadius: 2,
        overflow: "hidden",
        margin: "4px 0 6px",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--prism-teal), var(--prism-green))",
          borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export const StoriesPanel: React.FC = () => {
  const state = usePrismState()
  const layout = useLayout()

  const { stories, workflowPhase, epic, completedCount } = state
  const total = stories.length

  const [research, setResearch] = useState<ResearchItem[]>([])
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set())

  const PHASE_COLORS: Record<string, string> = {
    idle: "var(--prism-fg-muted)",
    research: "var(--prism-blue)",
    plan: "var(--prism-teal)",
    implement: "var(--prism-green)",
    validate: "var(--prism-amber)",
  }
  const phaseColor = PHASE_COLORS[workflowPhase] ?? "var(--prism-fg-muted)"

  const loadResearchAndPlans = useCallback(async () => {
    if (!window.electronAPI) return
    const [researchResult, plansResult] = await Promise.all([
      window.electronAPI.invoke("prism:getResearch"),
      window.electronAPI.invoke("prism:getPlans"),
    ])
    setResearch((researchResult as ResearchItem[]) ?? [])
    setPlans((plansResult as PlanItem[]) ?? [])
  }, [])

  useEffect(() => {
    void loadResearchAndPlans()
  }, [loadResearchAndPlans])

  // Re-fetch when .prism/ files change (project switch, new research added)
  useEffect(() => {
    if (!window.electronAPI) return
    const unsub = window.electronAPI.on("prism:fileChange", () => {
      void loadResearchAndPlans()
    })
    return unsub
  }, [loadResearchAndPlans])

  const toggleStory = (id: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Current Phase */}
      <CollapsibleSection title="Current Phase" defaultOpen>
        <div style={{ padding: "4px 12px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: phaseColor,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {workflowPhase === "idle" ? "Idle" : workflowPhase}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--prism-fg-muted)" }}>
              {completedCount}/{total} stories
            </span>
          </div>
          <PhaseProgressBar completedCount={completedCount} totalCount={total} />
          {epic && (
            <div
              style={{
                fontSize: 10.5,
                color: "var(--prism-fg-disabled)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {epic.name}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Stories list */}
      <CollapsibleSection title="Stories" defaultOpen badge={total || undefined}>
        {stories.length === 0 ? (
          <div
            style={{
              padding: "12px",
              fontSize: 11,
              color: "var(--prism-fg-disabled)",
              textAlign: "center",
            }}
          >
            No stories loaded
          </div>
        ) : (
          stories.map((story) => {
            const doneSteps = story.steps.filter((s) => s.done).length
            const totalSteps = story.steps.length
            const isExpanded = expandedStories.has(story.id)
            return (
              <div key={story.id}>
                <button
                  onClick={() => {
                    if (totalSteps > 0) {
                      toggleStory(story.id)
                    } else {
                      layout.openTab({
                        id: "story:" + story.id,
                        type: "story",
                        label: story.title,
                      })
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--prism-bg-hover)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    <StatusDot status={toStatusDotStatus(story.status)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--prism-fg-muted)",
                        marginBottom: 1,
                      }}
                    >
                      {story.id}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--prism-fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {story.title}
                    </div>
                  </div>
                  {totalSteps > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                        paddingTop: 2,
                      }}
                    >
                      <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)" }}>
                        {doneSteps}/{totalSteps}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          color: "var(--prism-fg-muted)",
                          transition: "transform 0.15s",
                          display: "inline-block",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        ›
                      </span>
                    </div>
                  )}
                </button>

                {/* Expandable steps */}
                {isExpanded && totalSteps > 0 && (
                  <div style={{ paddingLeft: 32, paddingBottom: 4 }}>
                    {story.steps.map((step, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                          padding: "2px 12px 2px 0",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: step.done ? "var(--prism-green)" : "var(--prism-fg-disabled)",
                            flexShrink: 0,
                            lineHeight: "16px",
                          }}
                        >
                          {step.done ? "✓" : "○"}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: step.done ? "var(--prism-fg-muted)" : "var(--prism-fg)",
                            textDecoration: step.done ? "line-through" : "none",
                            lineHeight: "16px",
                          }}
                        >
                          {step.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CollapsibleSection>

      {/* Research section */}
      <CollapsibleSection title="Research" defaultOpen={false} badge={research.length || undefined}>
        {research.length === 0 ? (
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
            No research documents
          </div>
        ) : (
          research.map((item) => (
            <button
              key={item.filePath}
              onClick={() =>
                layout.openTab({
                  id: "file:" + item.filePath,
                  type: "file",
                  label: item.topic,
                })
              }
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                padding: "5px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--prism-bg-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              <span style={{ fontSize: 11, color: "var(--prism-fg-muted)", flexShrink: 0, lineHeight: "16px" }}>
                📄
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--prism-fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.topic}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
                  {item.date && (
                    <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)" }}>{item.date}</span>
                  )}
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 9.5,
                        color: "var(--prism-teal)",
                        borderRadius: 3,
                        padding: "0px 4px",
                        border: "1px solid var(--prism-teal)",
                        opacity: 0.7,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))
        )}
      </CollapsibleSection>

      {/* Plans section */}
      <CollapsibleSection title="Plans" defaultOpen={false} badge={plans.length || undefined}>
        {plans.length === 0 ? (
          <div style={{ padding: "4px 12px", fontSize: 11, color: "var(--prism-fg-disabled)" }}>
            No plans
          </div>
        ) : (
          plans.map((item) => (
            <button
              key={item.filePath}
              onClick={() =>
                layout.openTab({
                  id: "file:" + item.filePath,
                  type: "file",
                  label: item.feature,
                })
              }
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                padding: "5px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--prism-bg-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: planStatusColor(item.status),
                  flexShrink: 0,
                  lineHeight: "16px",
                  fontWeight: 700,
                }}
              >
                {planStatusIcon(item.status)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--prism-fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.feature}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                  {item.date && (
                    <span style={{ fontSize: 10, color: "var(--prism-fg-disabled)" }}>{item.date}</span>
                  )}
                  {item.status && (
                    <span style={{ fontSize: 9.5, color: planStatusColor(item.status) }}>
                      {item.status}
                    </span>
                  )}
                  {item.phases > 0 && (
                    <span style={{ fontSize: 9.5, color: "var(--prism-fg-disabled)" }}>
                      {item.phases} phases
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </CollapsibleSection>
    </div>
  )
}
