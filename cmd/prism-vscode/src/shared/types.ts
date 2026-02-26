/**
 * Prism shared types — used by both extension host and webview.
 * Keep this file free of VS Code API imports (webview can't access vscode module).
 */

export enum WorkflowPhase {
  Idle = "idle",
  Research = "research",
  Plan = "plan",
  Implement = "implement",
  Validate = "validate",
}

export const WORKFLOW_PHASE_COLORS: Record<WorkflowPhase, string> = {
  [WorkflowPhase.Idle]: "#6B7280",
  [WorkflowPhase.Research]: "#3B82F6",
  [WorkflowPhase.Plan]: "#14B8A6",
  [WorkflowPhase.Implement]: "#22C55E",
  [WorkflowPhase.Validate]: "#F59E0B",
}

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  [WorkflowPhase.Idle]: "Idle",
  [WorkflowPhase.Research]: "Research",
  [WorkflowPhase.Plan]: "Plan",
  [WorkflowPhase.Implement]: "Implement",
  [WorkflowPhase.Validate]: "Validate",
}
