/**
 * SpectrumControls — Start / Pause / Resume / Stop / Skip buttons.
 */
import React, { useState } from "react"
import { SpectrumServiceClient } from "../../services/grpc-client"
import type { SpectrumExecutionState } from "../../context/PrismStateContext"

interface SpectrumControlsProps {
  executionState: SpectrumExecutionState
  hasStoriesJson: boolean
  hasClaudeCli: boolean
}

const BTN: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: "4px",
  border: "1px solid transparent",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 500,
  transition: "opacity 0.15s",
}

export const SpectrumControls: React.FC<SpectrumControlsProps> = ({
  executionState,
  hasStoriesJson,
  hasClaudeCli,
}) => {
  const [loading, setLoading] = useState(false)

  const call = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setLoading(true)
    try {
      const result = await fn()
      if (!result.ok && result.error) {
        console.error("[Spectrum]", result.error)
      }
    } catch (err) {
      console.error("[Spectrum] Control error:", err)
    } finally {
      setLoading(false)
    }
  }

  const isIdle = executionState === "idle"
  const isRunning = executionState === "running"
  const isPaused = executionState === "paused"
  const isTerminal =
    executionState === "complete" ||
    executionState === "maxIterations" ||
    executionState === "error"
  const canStart = (isIdle || isTerminal) && hasStoriesJson && hasClaudeCli
  const disabled = loading

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      {/* Start */}
      {canStart && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.start())}
          style={{
            ...BTN,
            backgroundColor: "#22c55e22",
            borderColor: "#22c55e55",
            color: "#22c55e",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ▶ Start
        </button>
      )}

      {/* Pause */}
      {isRunning && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.pause())}
          style={{
            ...BTN,
            backgroundColor: "#f59e0b22",
            borderColor: "#f59e0b55",
            color: "#f59e0b",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ⏸ Pause
        </button>
      )}

      {/* Resume */}
      {isPaused && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.resume())}
          style={{
            ...BTN,
            backgroundColor: "#22c55e22",
            borderColor: "#22c55e55",
            color: "#22c55e",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ▶ Resume
        </button>
      )}

      {/* Stop */}
      {(isRunning || isPaused) && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.stop())}
          style={{
            ...BTN,
            backgroundColor: "#ef444422",
            borderColor: "#ef444455",
            color: "#ef4444",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ■ Stop
        </button>
      )}

      {/* Skip Story */}
      {(isRunning || isPaused) && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.skipStory())}
          style={{
            ...BTN,
            backgroundColor: "#6b728022",
            borderColor: "#6b728055",
            color: "#9ca3af",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ⏭ Skip Story
        </button>
      )}

      {/* Reset */}
      {isTerminal && (
        <button
          disabled={disabled}
          onClick={() => void call(() => SpectrumServiceClient.reset())}
          style={{
            ...BTN,
            backgroundColor: "#6b728022",
            borderColor: "#6b728055",
            color: "#9ca3af",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ↺ Reset
        </button>
      )}

      {/* Warning messages */}
      {!hasClaudeCli && (
        <span style={{ color: "#ef4444", fontSize: "11px" }}>
          Claude CLI not found
        </span>
      )}
      {hasClaudeCli && !hasStoriesJson && (
        <span style={{ color: "#f59e0b", fontSize: "11px" }}>
          No stories.json — run /decompose_plan first
        </span>
      )}
    </div>
  )
}
