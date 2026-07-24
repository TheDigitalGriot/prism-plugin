---
name: prism-subagent
description: Same-session subagent-driven plan execution. Use when executing a 3-10 task plan from .prism/shared/plans/ where Spectrum is overkill and prism-implement is too thin. Triggers on "subagent execute", "drive this plan with subagents", "dispatch implementers", "subagent driven development". Fresh implementer per task, two-stage review, bounded retries, compaction-survivable state.
model: opus
effort: xhigh
---

# Prism Subagent

Execute a plan task-by-task in **this session** using fresh implementer subagents with two-stage review (`spec-reviewer` then `quality-reviewer`). Same-session sibling to `prism-spectrum`.

## When To Use

| Scope | Skill |
|---|---|
| Single phase / quick fix | [prism-implement](../prism-implement/SKILL.md) |
| 3–10 tasks, mostly independent, stay in session | **prism-subagent** ← here |
| 10+ stories, autonomous overnight | [prism-spectrum](../prism-spectrum/SKILL.md) |
| Parallel investigation of unrelated failures | [prism-debug](../prism-debug/SKILL.md) |

## Core Loop

1. **Pre-flight** — the **work-definition is `.prism/stories/stories.json`** (emitted from the plan; schema at `.prism/shared/contracts/stories-contract.md`). Seed [state.json](references/state-schema.md) from it: **one story = one task, keyed by the story `id`**, carrying each story's `files`, `steps`, `priority`, and `blockedBy`. `state.json` holds only runtime status — it never redefines the tasks. If `stories.json` is missing (a legacy plan), run `decompose_plan` on the plan to emit stories first, then seed. (The legacy `python ${CLAUDE_PLUGIN_ROOT}/scripts/extract-tasks.py <plan-path>` path parses a plan straight into a **non-story-keyed** `state.json` — treat it as degraded / manual-reconciliation only, never an equivalent to `decompose_plan`, since its tasks carry no story `id`.) Review and adjust before dispatching.
2. **Per task** (sequential, never parallel implementers):
   1. Consult [review-decision-matrix](references/review-decision-matrix.md) → which stages apply
   2. Dispatch **implementer** via [dispatch-protocol](references/dispatch-protocol.md) (full task text inlined, never the plan path)
   3. Handle status per [status-protocol](references/status-protocol.md): `DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | NEEDS_CLARIFICATION | BLOCKED`
   4. Dispatch **spec-reviewer** with diff + spec excerpt only (not full files)
   5. Dispatch **quality-reviewer** with diff + story context
   6. On reviewer ❌ → fix loop bounded by [retry-ladder](references/retry-ladder.md)
   7. Update state.json, mark complete
3. **Final pass** — single full-implementation reviewer → hand off to [prism-finish](../prism-finish/SKILL.md)

## Iron Laws

```
ONE IMPLEMENTER AT A TIME. NEVER PARALLEL IMPLEMENTERS.
PASTE TASK TEXT. NEVER MAKE A SUBAGENT READ THE PLAN FILE.
REVIEWERS SEE DIFFS, NOT FULL FILES.
NEVER RETRY THE SAME (TASK, MODEL, ISSUE) MORE THAN ONCE.
NEVER SKIP A REVIEW STAGE THE MATRIX SAYS IS REQUIRED.
STORIES.JSON IS THE WORK-DEFINITION. STATE.JSON IS THE RUNTIME-STATUS SOURCE OF TRUTH (keyed by story id). CONVERSATIONAL MEMORY IS NEITHER.
NEVER FORWARD PARENT SESSION HISTORY. CONSTRUCT CONTEXT FROM FILES.
IMPLEMENTERS GET: task text + files + domain primer + criteria — nothing else.
REVIEWERS GET: diff + spec excerpt + raised_issues — nothing else.
```

> **Why context isolation matters** (Superpowers v5.0.2): subagents that inherit the full parent session history start "behaving as the lead developer, not a reviewer." A reviewer who has absorbed the controller's reasoning will unconsciously rationalize the same choices. Construct every prompt from `state.json` + files — not from the conversation accumulated above.

## Innovations Over Generic SDD

- **Domain-aware context priming** — R3F / Electron / full-stack / experimental sandbox each prime the implementer differently. See [domain-hints](references/domain-hints.md).
- **5-status protocol** — adds `NEEDS_CLARIFICATION` (asks the user) distinct from `NEEDS_CONTEXT` (controller resolves).
- **Diff-only review** — reviewers receive `git diff` + spec excerpt, not full files. ~80% token reduction vs naive review.
- **Reviewer isolation** — reviewers never see prior reviewers' complaints. Prevents groupthink reinforcement.
- **No-op spin detection** — if implementer's diff is unchanged after a fix cycle, halt immediately.
- **Repeated-issue detection** — if a reviewer raises an issue already in `state.json.raised_issues`, the fix isn't sticking → halt.
- **Auto model escalation** — haiku → sonnet → opus on `BLOCKED`.
- **Cross-task halt** — 3 consecutive tasks needing escalation → the plan itself is wrong, stop.
- **Graph blast-radius pre-check** — if codebase-memory-mcp is available, run `trace_call_path` on each task's target functions before dispatch.

## Subagent Role Audit

Audit of v3.4.0 (2026-06-03) — classification of every subagent dispatched by prism-subagent and its sibling skills:

| Agent | Dispatched by | Role type | Demotable to inline checklist? |
|-------|--------------|-----------|-------------------------------|
| `spec-reviewer` | prism-subagent, prism-spectrum | Cross-entity reviewer (reviews implementer's diff, never the controller's own work) | **No** — reviews code produced by a different agent |
| `quality-reviewer` | prism-subagent, prism-spectrum | Cross-entity reviewer (same) | **No** — same rationale; diff-only access enforces independence |
| `visual-regression-grader` | prism-validate, prism-verify | Artifact judge (judges playwright diff images) | **No** — requires image interpretation of playwright output the lead AI doesn't produce |
| `browser-verifier` | prism-verify | Tool executor (runs playwright-cli via Bash) | **No** — Bash tool required; lead AI cannot run playwright-cli inline |
| eval runners | prism-eval | Isolated execution (runs skills in fresh session context) | **No** — isolation IS the point; inline execution would contaminate the eval |

**Finding**: All subagents have cross-entity or tool-execution roles. The Superpowers v5.0.6 demotion pattern applies to *self-review* (an agent reviewing its own output); none of these agents review the controller's own work. Spec-reviewer and quality-reviewer review the *implementer*'s diff — that IS the "implementer vs reviewer of someone else's code" pattern Superpowers says to keep.

## Rationalization Prevention

| Rationalization | Reality |
|---|---|
| "I'll just dispatch two implementers in parallel, the files don't overlap" | They will overlap. Sequential. |
| "The reviewer is being pedantic, I'll skip this fix" | The matrix decides what's required, not your patience. |
| "I can re-extract tasks from the plan, it's just one read" | Tasks come from stories.json (the work-definition). Operate from state.json for run status. Don't re-parse the plan. |
| "This task is small, the reviewer is overkill" | The matrix decides. Config-only / docs-only have explicit skip rules. |
| "I'll let the implementer read the plan file, faster than pasting" | No. Full task text inline. Always. |
| "The reviewer raised the same issue twice, I'll fix it harder" | Halt. The fix isn't sticking. Escalate. |
| "I'll merge tasks T2 and T3 since they're related" | One task per dispatch. Always. |
| "I'll include the conversation so far for context" | That IS the session history. Build prompts from state.json + files. |

## Compaction Survival

State lives at `.prism/local/subagent/<plan-slug>/state.json`. On wake from compaction:
1. Find the most recent `state.json` under `.prism/local/subagent/`
2. Read `current` task ID and `tasks[*].status`
3. Run `git diff --stat` to confirm in-flight changes match the in-progress task
4. Resume from the next pending task — do NOT re-dispatch a task already marked complete

See [state-schema](references/state-schema.md) for full recovery protocol.

## Integration

- **Reuses existing agents** — [agents/spec-reviewer.md](../../agents/spec-reviewer.md), [agents/quality-reviewer.md](../../agents/quality-reviewer.md)
- **Inherits Prism conventions** — conventional commits, `.prism/shared/plans/` plan format, `.prism/local/` for ephemeral state
- **Hands off to** — [prism-finish](../prism-finish/SKILL.md) when all tasks complete
