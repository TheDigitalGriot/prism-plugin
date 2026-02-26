/**
 * Spectrum execution state — placeholder for Phase 5.
 *
 * This file will hold the Spectrum state machine and runner when
 * Phase 5 (Spectrum Execution Dashboard) is implemented.
 */

export type SpectrumExecutionState =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "maxIterations"
  | "error"

/** Minimal Spectrum state tracked during Phase 2 (before full implementation). */
export interface SpectrumState {
  executionState: SpectrumExecutionState
  currentIteration: number
  maxIterations: number
  consecutiveErrors: number
}

export const DEFAULT_SPECTRUM_STATE: SpectrumState = {
  executionState: "idle",
  currentIteration: 0,
  maxIterations: 50,
  consecutiveErrors: 0,
}
