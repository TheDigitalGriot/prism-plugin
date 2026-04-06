import React from "react"
import { usePrismState } from "@prism-ui/context/PrismStateContext"
import { CollapsibleSection } from "../common/CollapsibleSection"
import { SpectrumControls } from "@prism-ui/components/spectrum/SpectrumControls"
import { ProgressBar } from "@prism-ui/components/spectrum/ProgressBar"
import { SignalStatus } from "@prism-ui/components/spectrum/SignalStatus"
import { StoryList } from "@prism-ui/components/spectrum/StoryList"
import { ActivityLog } from "@prism-ui/components/spectrum/ActivityLog"

// ---------------------------------------------------------------------------
// Execution state labels
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: "Idle", color: "var(--prism-fg-muted)" },
  running: { label: "Running", color: "var(--prism-green)" },
  paused: { label: "Paused", color: "var(--prism-amber)" },
  complete: { label: "Complete", color: "var(--prism-green)" },
  maxIterations: { label: "Max Iterations", color: "var(--prism-amber)" },
  error: { label: "Error", color: "var(--prism-red)" },
}

// ---------------------------------------------------------------------------
// SpectrumPanel
// ---------------------------------------------------------------------------

export const SpectrumPanel: React.FC = () => {
  const state = usePrismState()
  const {
    spectrum,
    stories,
    hasStoriesJson,
    hasClaudeCli,
  } = state

  const meta = STATE_LABELS[spectrum.executionState] ?? STATE_LABELS.idle

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Spectrum Engine */}
      <CollapsibleSection title="Spectrum Engine" defaultOpen>
        <div style={{ padding: "6px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>
              {meta.label}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--prism-fg-disabled)" }}>
              Iteration {spectrum.currentIteration}/{spectrum.maxIterations}
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <ProgressBar progress={spectrum.progress} />
          </div>

          <SpectrumControls
            executionState={spectrum.executionState}
            hasStoriesJson={hasStoriesJson}
            hasClaudeCli={hasClaudeCli}
          />
        </div>
      </CollapsibleSection>

      {/* Activity Log */}
      <CollapsibleSection title="Activity Log" defaultOpen>
        <ActivityLog
          logs={spectrum.logs}
          recentActivities={spectrum.recentActivities}
          maxHeight="200px"
        />
      </CollapsibleSection>

      {/* Signal Status */}
      <CollapsibleSection title="Signal Status" defaultOpen>
        <div style={{ padding: "6px 12px" }}>
          <SignalStatus
            signalType={spectrum.lastSignalType}
            signalContent={spectrum.lastSignalContent}
            consecutiveErrors={spectrum.consecutiveErrors}
          />
        </div>
      </CollapsibleSection>

      {/* Stories */}
      <CollapsibleSection title="Stories" defaultOpen badge={stories.length || undefined}>
        <StoryList stories={stories} currentStoryId={spectrum.currentStoryId} />
      </CollapsibleSection>
    </div>
  )
}
