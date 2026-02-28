/**
 * SpectrumView — Spectrum autonomous execution dashboard.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ Header (title + back button)            │
 *   ├─────────────────────────────────────────┤
 *   │ Status badge + Iteration counter        │
 *   ├─────────────────────────────────────────┤
 *   │ Controls (Start/Pause/Resume/Stop/Skip) │
 *   ├─────────────────────────────────────────┤
 *   │ Progress bar (0-100%)                   │
 *   ├─────────────────────────────────────────┤
 *   │ Signal status                           │
 *   ├─────────────────────────────────────────┤
 *   │ Stories list (scrollable)               │
 *   ├─────────────────────────────────────────┤
 *   │ Activity log (auto-scroll)              │
 *   └─────────────────────────────────────────┘
 */
import React from "react"
import { usePrismState, type SpectrumExecutionState } from "../context/PrismStateContext"
import { SpectrumControls } from "../components/spectrum/SpectrumControls"
import { ProgressBar } from "../components/spectrum/ProgressBar"
import { StoryList } from "../components/spectrum/StoryList"
import { ActivityLog } from "../components/spectrum/ActivityLog"
import { SignalStatus } from "../components/spectrum/SignalStatus"

// ---------------------------------------------------------------------------
// Status header
// ---------------------------------------------------------------------------

const STATE_STYLE: Record<
  SpectrumExecutionState,
  { label: string; color: string; description: string }
> = {
  idle: { label: "Idle", color: "#6b7280", description: "Ready to start" },
  running: { label: "Running", color: "#3b82f6", description: "Executing stories" },
  paused: { label: "Paused", color: "#f59e0b", description: "Loop suspended" },
  complete: { label: "Complete", color: "#22c55e", description: "All stories done!" },
  maxIterations: { label: "Max Iterations", color: "#f59e0b", description: "Iteration cap reached" },
  error: { label: "Error", color: "#ef4444", description: "Too many consecutive errors" },
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return `${m}m ${String(s).padStart(2, "0")}s`
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ title: string; badge?: string }> = ({ title, badge }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px 4px",
      borderTop: "1px solid var(--vscode-widget-border, #333)",
    }}
  >
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color: "var(--vscode-descriptionForeground)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {title}
    </span>
    {badge !== undefined && (
      <span
        style={{
          fontSize: "10px",
          color: "var(--vscode-descriptionForeground)",
          backgroundColor: "var(--vscode-badge-background, #333)",
          borderRadius: "9999px",
          padding: "0 5px",
        }}
      >
        {badge}
      </span>
    )}
  </div>
)

// ---------------------------------------------------------------------------
// SpectrumView
// ---------------------------------------------------------------------------

interface SpectrumViewProps {
  onBack: () => void
}

export const SpectrumView: React.FC<SpectrumViewProps> = ({ onBack }) => {
  const state = usePrismState()
  const { spectrum, stories, completedCount, remainingCount, hasStoriesJson, hasClaudeCli } = state

  const stateMeta = STATE_STYLE[spectrum.executionState] ?? STATE_STYLE.idle
  const total = completedCount + remainingCount

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--vscode-sideBar-background)",
        color: "var(--vscode-foreground)",
        fontFamily: "var(--vscode-font-family)",
        fontSize: "var(--vscode-font-size, 13px)",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: `2px solid ${stateMeta.color}`,
          backgroundColor: `${stateMeta.color}11`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={onBack}
            title="Back to Chat"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--vscode-descriptionForeground)",
              fontSize: "14px",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: stateMeta.color,
            }}
          >
            Spectrum
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "1px 8px",
              borderRadius: "9999px",
              backgroundColor: `${stateMeta.color}22`,
              border: `1px solid ${stateMeta.color}55`,
              color: stateMeta.color,
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            {stateMeta.label}
          </span>
        </div>

        {/* Iteration + elapsed */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground)",
          }}
        >
          {spectrum.executionState !== "idle" && (
            <>
              <span>
                {spectrum.currentIteration}/{spectrum.maxIterations} iterations
              </span>
              {spectrum.elapsedMs > 0 && <span>{formatElapsed(spectrum.elapsedMs)}</span>}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable content                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Controls */}
        <div style={{ padding: "10px 12px" }}>
          <SpectrumControls
            executionState={spectrum.executionState}
            hasStoriesJson={hasStoriesJson}
            hasClaudeCli={hasClaudeCli}
          />
        </div>

        {/* Progress */}
        {hasStoriesJson && total > 0 && (
          <div style={{ padding: "4px 12px 10px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "var(--vscode-descriptionForeground)",
                marginBottom: "4px",
              }}
            >
              <span>
                {completedCount}/{total} stories
              </span>
              <span>{spectrum.progress}%</span>
            </div>
            <ProgressBar progress={spectrum.progress} showLabel={false} />
          </div>
        )}

        {/* Signal status */}
        {spectrum.lastSignalType !== "none" && (
          <>
            <SectionHeader title="Last Signal" />
            <div style={{ padding: "6px 12px 10px" }}>
              <SignalStatus
                signalType={spectrum.lastSignalType}
                signalContent={spectrum.lastSignalContent}
                consecutiveErrors={spectrum.consecutiveErrors}
              />
            </div>
          </>
        )}

        {/* Stories */}
        <SectionHeader title="Stories" badge={String(stories.length)} />
        <div style={{ padding: "4px 4px 10px" }}>
          <StoryList stories={stories} currentStoryId={spectrum.currentStoryId} />
        </div>

        {/* Activity log */}
        <SectionHeader
          title="Activity Log"
          badge={String(spectrum.logs.length + spectrum.recentActivities.length)}
        />
        <div style={{ padding: "0 0 8px" }}>
          <ActivityLog
            logs={spectrum.logs}
            recentActivities={spectrum.recentActivities}
            maxHeight="200px"
          />
        </div>
      </div>
    </div>
  )
}
