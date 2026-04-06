/**
 * WorkflowStatusBar — VS Code status bar items showing Prism workflow state.
 *
 * Items:
 *   1. Phase indicator — spectral color, phase icon + name
 *   2. Story progress  — "3/12 stories" (only shown when stories.json exists)
 *   3. Spectrum status — "$(play) Running" (only shown when Spectrum active)
 *
 * Colors map to WORKFLOW_PHASE_COLORS from shared/types.ts.
 * Click actions: phase → open sidebar, progress → open sidebar, spectrum → open sidebar.
 */

import * as vscode from "vscode"
import { WorkflowPhase, WORKFLOW_PHASE_COLORS, WORKFLOW_PHASE_LABELS } from "@prism-core/shared/types"
import type { SpectrumState } from "@prism-core/core/controller/prism/spectrum"

// ---------------------------------------------------------------------------
// Phase icons (VS Code Codicon names)
// ---------------------------------------------------------------------------

const PHASE_ICONS: Record<WorkflowPhase, string> = {
  [WorkflowPhase.Idle]: "$(circle-outline)",
  [WorkflowPhase.Research]: "$(beaker)",
  [WorkflowPhase.Plan]: "$(list-tree)",
  [WorkflowPhase.Implement]: "$(code)",
  [WorkflowPhase.Validate]: "$(check-all)",
}

// ---------------------------------------------------------------------------
// WorkflowStatusBar
// ---------------------------------------------------------------------------

export class WorkflowStatusBar implements vscode.Disposable {
  private readonly _phaseItem: vscode.StatusBarItem
  private readonly _progressItem: vscode.StatusBarItem
  private readonly _spectrumItem: vscode.StatusBarItem

  constructor() {
    // Phase indicator — left-most, always visible
    this._phaseItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    )
    this._phaseItem.command = "prism.openSidebar"
    this._phaseItem.tooltip = "Prism workflow phase — click to open sidebar"

    // Story progress — visible only when stories.json exists
    this._progressItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99,
    )
    this._progressItem.command = "prism.openSidebar"
    this._progressItem.tooltip = "Story progress — click to open sidebar"

    // Spectrum status — visible only when Spectrum is active
    this._spectrumItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98,
    )
    this._spectrumItem.command = "prism.spectrum"
    this._spectrumItem.tooltip = "Spectrum autonomous execution — click to manage"

    // Show phase item immediately
    this._phaseItem.show()
  }

  /**
   * Update all status bar items from current extension state.
   */
  update(params: {
    phase: WorkflowPhase
    completedCount: number
    remainingCount: number
    hasStoriesJson: boolean
    spectrum: SpectrumState
  }): void {
    const { phase, completedCount, remainingCount, hasStoriesJson, spectrum } = params
    const total = completedCount + remainingCount

    // -----------------------------------------------------------------------
    // Phase indicator
    // -----------------------------------------------------------------------
    const icon = PHASE_ICONS[phase]
    const label = WORKFLOW_PHASE_LABELS[phase]
    this._phaseItem.text = `${icon} Prism: ${label}`

    // VS Code status bar color must be a ThemeColor ID — we approximate using
    // the predefined status bar color tokens. Custom hex is not directly
    // supported, so we choose the closest semantic color for each phase.
    this._phaseItem.backgroundColor = this._backgroundFor(phase)
    this._phaseItem.color = undefined // let VS Code decide contrast

    // -----------------------------------------------------------------------
    // Story progress
    // -----------------------------------------------------------------------
    if (hasStoriesJson && total > 0) {
      const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0
      this._progressItem.text = `$(tasklist) ${completedCount}/${total} stories (${pct}%)`
      this._progressItem.show()
    } else {
      this._progressItem.hide()
    }

    // -----------------------------------------------------------------------
    // Spectrum status
    // -----------------------------------------------------------------------
    const specState = spectrum.executionState
    if (specState !== "idle") {
      this._spectrumItem.text = this._spectrumText(spectrum)
      this._spectrumItem.show()
    } else {
      this._spectrumItem.hide()
    }
  }

  private _backgroundFor(phase: WorkflowPhase): vscode.ThemeColor | undefined {
    // VS Code only allows a small set of status bar background colors.
    // We use "statusBarItem.warningBackground" for active phases to draw attention.
    if (phase === WorkflowPhase.Idle) return undefined
    return new vscode.ThemeColor("statusBarItem.prominentBackground")
  }

  private _spectrumText(spectrum: SpectrumState): string {
    const { executionState, currentIteration, maxIterations } = spectrum
    switch (executionState) {
      case "running":
        return `$(sync~spin) Spectrum: ${currentIteration}/${maxIterations}`
      case "paused":
        return `$(debug-pause) Spectrum: Paused`
      case "complete":
        return `$(pass-filled) Spectrum: Done`
      case "maxIterations":
        return `$(warning) Spectrum: Max iterations`
      case "error":
        return `$(error) Spectrum: Error`
      default:
        return `$(play) Spectrum`
    }
  }

  show(): void {
    this._phaseItem.show()
  }

  hide(): void {
    this._phaseItem.hide()
    this._progressItem.hide()
    this._spectrumItem.hide()
  }

  dispose(): void {
    this._phaseItem.dispose()
    this._progressItem.dispose()
    this._spectrumItem.dispose()
  }
}
