/**
 * 4-phase Workflow State Machine
 *
 * Tracks the current development phase (Idle → Research → Plan → Implement → Validate)
 * and validates transitions between phases.
 *
 * This is a pure TypeScript class with no VS Code API dependencies,
 * making it unit-testable in isolation.
 */

import { WorkflowPhase } from "../../../shared/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowTransition =
  | "start_research"
  | "start_plan"
  | "start_implement"
  | "start_validate"
  | "complete"
  | "reset"

export interface WorkflowContext {
  /** Path to the active research document (if any). */
  researchDoc?: string
  /** Path to the active plan document (if any). */
  activePlan?: string
  /** ID of the currently executing story (if any). */
  activeStoryId?: string
}

export interface TransitionResult {
  ok: boolean
  newPhase?: WorkflowPhase
  error?: string
}

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

/**
 * Valid transitions from each phase.
 * Mirrors the 4-phase workflow from the Prism plan.
 */
const VALID_TRANSITIONS: Record<WorkflowPhase, WorkflowTransition[]> = {
  [WorkflowPhase.Idle]: [
    "start_research",
    "start_plan",
    "start_implement",
    "start_validate",
  ],
  [WorkflowPhase.Research]: ["start_plan", "reset"],
  [WorkflowPhase.Plan]: ["start_implement", "start_research", "reset"],
  [WorkflowPhase.Implement]: ["start_validate", "start_plan", "reset"],
  [WorkflowPhase.Validate]: ["complete", "start_implement", "reset"],
}

const TRANSITION_TARGET: Record<WorkflowTransition, WorkflowPhase> = {
  start_research: WorkflowPhase.Research,
  start_plan: WorkflowPhase.Plan,
  start_implement: WorkflowPhase.Implement,
  start_validate: WorkflowPhase.Validate,
  complete: WorkflowPhase.Idle,
  reset: WorkflowPhase.Idle,
}

// ---------------------------------------------------------------------------
// WorkflowStateMachine
// ---------------------------------------------------------------------------

export class WorkflowStateMachine {
  private _phase: WorkflowPhase = WorkflowPhase.Idle
  private _context: WorkflowContext = {}

  get phase(): WorkflowPhase {
    return this._phase
  }

  /** Returns a shallow copy of the current context. */
  get context(): WorkflowContext {
    return { ...this._context }
  }

  /**
   * Attempt a phase transition.
   * Returns { ok: true, newPhase } on success,
   * or { ok: false, error } if the transition is invalid.
   */
  transition(t: WorkflowTransition): TransitionResult {
    const allowed = VALID_TRANSITIONS[this._phase]
    if (!allowed.includes(t)) {
      return {
        ok: false,
        error: `Cannot '${t}' from phase '${this._phase}'. Allowed: [${allowed.join(", ")}]`,
      }
    }
    this._phase = TRANSITION_TARGET[t]
    return { ok: true, newPhase: this._phase }
  }

  /** Force-set the phase (e.g. on startup / state restore). */
  setPhase(phase: WorkflowPhase): void {
    this._phase = phase
  }

  /** Merge partial context into the current context. */
  setContext(ctx: Partial<WorkflowContext>): void {
    this._context = { ...this._context, ...ctx }
  }

  /** Clear all workflow context (research doc, plan, active story). */
  clearContext(): void {
    this._context = {}
  }

  /** Check if a transition is valid from the current phase. */
  canTransition(t: WorkflowTransition): boolean {
    return VALID_TRANSITIONS[this._phase].includes(t)
  }

  /** All transitions valid from the current phase. */
  availableTransitions(): WorkflowTransition[] {
    return [...VALID_TRANSITIONS[this._phase]]
  }
}
