/**
 * Unit tests for src/core/controller/prism/workflow.ts
 */

import { WorkflowStateMachine } from "@prism-core/core/controller/prism/workflow"
import { WorkflowPhase } from "@prism-core/shared/types"

describe("WorkflowStateMachine", () => {
  let sm: WorkflowStateMachine

  beforeEach(() => {
    sm = new WorkflowStateMachine()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  test("starts in Idle phase", () => {
    expect(sm.phase).toBe(WorkflowPhase.Idle)
  })

  test("starts with empty context", () => {
    expect(sm.context).toEqual({})
  })

  // -------------------------------------------------------------------------
  // Valid transitions from Idle
  // -------------------------------------------------------------------------

  test("Idle → start_research → Research", () => {
    const result = sm.transition("start_research")
    expect(result.ok).toBe(true)
    expect(result.newPhase).toBe(WorkflowPhase.Research)
    expect(sm.phase).toBe(WorkflowPhase.Research)
  })

  test("Idle → start_plan → Plan", () => {
    const result = sm.transition("start_plan")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Plan)
  })

  test("Idle → start_implement → Implement", () => {
    const result = sm.transition("start_implement")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Implement)
  })

  test("Idle → start_validate → Validate", () => {
    const result = sm.transition("start_validate")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Validate)
  })

  // -------------------------------------------------------------------------
  // Valid transitions from Research
  // -------------------------------------------------------------------------

  test("Research → start_plan → Plan", () => {
    sm.transition("start_research")
    const result = sm.transition("start_plan")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Plan)
  })

  test("Research → reset → Idle", () => {
    sm.transition("start_research")
    const result = sm.transition("reset")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Idle)
  })

  // -------------------------------------------------------------------------
  // Valid transitions from Plan
  // -------------------------------------------------------------------------

  test("Plan → start_implement → Implement", () => {
    sm.transition("start_plan")
    const result = sm.transition("start_implement")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Implement)
  })

  test("Plan → start_research → Research", () => {
    sm.transition("start_plan")
    const result = sm.transition("start_research")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Research)
  })

  // -------------------------------------------------------------------------
  // Valid transitions from Validate
  // -------------------------------------------------------------------------

  test("Validate → complete → Idle", () => {
    sm.transition("start_validate")
    const result = sm.transition("complete")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Idle)
  })

  test("Validate → start_implement → Implement (re-implement cycle)", () => {
    sm.transition("start_validate")
    const result = sm.transition("start_implement")
    expect(result.ok).toBe(true)
    expect(sm.phase).toBe(WorkflowPhase.Implement)
  })

  // -------------------------------------------------------------------------
  // Invalid transitions are rejected
  // -------------------------------------------------------------------------

  test("Research → complete is invalid", () => {
    sm.transition("start_research")
    const result = sm.transition("complete")
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
    expect(sm.phase).toBe(WorkflowPhase.Research) // unchanged
  })

  test("Research → start_implement is invalid", () => {
    sm.transition("start_research")
    const result = sm.transition("start_implement")
    expect(result.ok).toBe(false)
    expect(sm.phase).toBe(WorkflowPhase.Research)
  })

  test("Implement → complete is invalid", () => {
    sm.transition("start_implement")
    const result = sm.transition("complete")
    expect(result.ok).toBe(false)
    expect(sm.phase).toBe(WorkflowPhase.Implement)
  })

  test("Idle → complete is invalid", () => {
    const result = sm.transition("complete")
    expect(result.ok).toBe(false)
    expect(sm.phase).toBe(WorkflowPhase.Idle)
  })

  // -------------------------------------------------------------------------
  // setPhase (force)
  // -------------------------------------------------------------------------

  test("setPhase forces phase without validation", () => {
    sm.setPhase(WorkflowPhase.Validate)
    expect(sm.phase).toBe(WorkflowPhase.Validate)
  })

  // -------------------------------------------------------------------------
  // context management
  // -------------------------------------------------------------------------

  test("setContext merges into existing context", () => {
    sm.setContext({ researchDoc: "/path/to/research.md" })
    sm.setContext({ activePlan: "/path/to/plan.md" })
    expect(sm.context.researchDoc).toBe("/path/to/research.md")
    expect(sm.context.activePlan).toBe("/path/to/plan.md")
  })

  test("clearContext removes all context fields", () => {
    sm.setContext({ researchDoc: "/some/doc.md", activePlan: "/some/plan.md" })
    sm.clearContext()
    expect(sm.context).toEqual({})
  })

  test("context getter returns a copy (not the internal object)", () => {
    sm.setContext({ researchDoc: "/doc.md" })
    const ctx = sm.context
    ctx.researchDoc = "mutated"
    expect(sm.context.researchDoc).toBe("/doc.md")
  })

  // -------------------------------------------------------------------------
  // canTransition / availableTransitions
  // -------------------------------------------------------------------------

  test("canTransition returns true for valid transition", () => {
    expect(sm.canTransition("start_research")).toBe(true)
  })

  test("canTransition returns false for invalid transition from current phase", () => {
    expect(sm.canTransition("complete")).toBe(false)
  })

  test("availableTransitions returns all valid transitions from current phase", () => {
    const transitions = sm.availableTransitions()
    expect(transitions).toContain("start_research")
    expect(transitions).toContain("start_plan")
    expect(transitions).toContain("start_implement")
    expect(transitions).toContain("start_validate")
    expect(transitions).not.toContain("complete")
    expect(transitions).not.toContain("reset")
  })

  test("availableTransitions changes after phase transition", () => {
    sm.transition("start_research")
    const transitions = sm.availableTransitions()
    expect(transitions).toContain("start_plan")
    expect(transitions).toContain("reset")
    expect(transitions).not.toContain("start_research")
    expect(transitions).not.toContain("complete")
  })

  // -------------------------------------------------------------------------
  // Full workflow cycle
  // -------------------------------------------------------------------------

  test("full workflow cycle: Idle → Research → Plan → Implement → Validate → Idle", () => {
    expect(sm.phase).toBe(WorkflowPhase.Idle)
    sm.transition("start_research")
    expect(sm.phase).toBe(WorkflowPhase.Research)
    sm.transition("start_plan")
    expect(sm.phase).toBe(WorkflowPhase.Plan)
    sm.transition("start_implement")
    expect(sm.phase).toBe(WorkflowPhase.Implement)
    sm.transition("start_validate")
    expect(sm.phase).toBe(WorkflowPhase.Validate)
    sm.transition("complete")
    expect(sm.phase).toBe(WorkflowPhase.Idle)
  })
})
