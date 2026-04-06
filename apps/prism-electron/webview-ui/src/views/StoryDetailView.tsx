import React from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { StatusDot } from "../components/common/StatusDot"
import type { StatusDotStatus } from "../components/common/StatusDot"

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  complete: "var(--prism-green)",
  in_progress: "var(--prism-amber)",
  running: "var(--prism-amber)",
  pending: "var(--prism-text-dim)",
}

function toStatusDot(status: string): StatusDotStatus {
  if (status === "complete") return "complete"
  if (status === "in_progress" || status === "running") return "in_progress"
  return "pending"
}

// ---------------------------------------------------------------------------
// StoryDetailView
// ---------------------------------------------------------------------------

export const StoryDetailView: React.FC<{ storyId: string }> = ({ storyId }) => {
  const { stories } = usePrismState()
  const story = stories.find((s) => s.id === storyId)

  if (!story) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 8,
          color: "var(--prism-fg-muted)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Story not found</div>
        <div style={{ fontSize: 11 }}>{storyId}</div>
      </div>
    )
  }

  const doneSteps = story.steps.filter((s) => s.done).length
  const totalSteps = story.steps.length
  const statusColor = STATUS_COLORS[story.status] ?? "var(--prism-text-dim)"

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ maxWidth: 700 }}>
        {/* Status badge + step count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatusDot status={toStatusDot(story.status)} size={12} />
          <span
            style={{
              fontSize: 11,
              color: statusColor,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {story.status.replace("_", " ")}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--prism-text-dim)",
              marginLeft: "auto",
            }}
          >
            {doneSteps}/{totalSteps} STEPS
          </span>
        </div>

        {/* Story ID */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--prism-fg)",
            marginBottom: 4,
          }}
        >
          {story.id}
        </h2>

        {/* Title */}
        <h3
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "var(--prism-fg-muted)",
            marginBottom: 20,
          }}
        >
          {story.title}
        </h3>

        {/* Description block */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 8,
            border: "1px solid var(--prism-border)",
            background: "rgba(255,255,255,0.02)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--prism-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Description
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--prism-fg)", margin: 0 }}>
            {story.description}
          </p>
        </div>

        {/* Modified files */}
        {story.files.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--prism-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Modified Files
            </div>
            {story.files.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 12px",
                  fontSize: 12.5,
                  color: "var(--prism-teal)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--prism-teal)"
                  strokeWidth="1.5"
                  style={{ opacity: 0.6, flexShrink: 0 }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontFamily: "var(--prism-font-code)" }}>{f.path}</span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background:
                      f.action === "create"
                        ? "var(--prism-green)20"
                        : f.action === "delete"
                          ? "var(--prism-red)20"
                          : "var(--prism-amber)20",
                    color:
                      f.action === "create"
                        ? "var(--prism-green)"
                        : f.action === "delete"
                          ? "var(--prism-red)"
                          : "var(--prism-amber)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {f.action}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Segmented progress bar */}
        {totalSteps > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--prism-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              Progress
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {story.steps.map((step, i) => (
                <div
                  key={i}
                  title={step.description}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: step.done
                      ? "linear-gradient(90deg, var(--prism-teal), var(--prism-green))"
                      : "rgba(255,255,255,0.06)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Steps list */}
        {totalSteps > 0 && (
          <div>
            <div
              style={{
                fontSize: 10,
                color: "var(--prism-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Steps
            </div>
            {story.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  color: step.done ? "var(--prism-fg-muted)" : "var(--prism-fg)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: step.done ? "var(--prism-green)" : "var(--prism-text-dim)",
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  {step.done ? "✓" : "○"}
                </span>
                <span style={{ textDecoration: step.done ? "line-through" : "none", opacity: step.done ? 0.7 : 1 }}>
                  {step.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
