---
title: Behavioral Principles
description: The five key behavioral constraints enforced through Prism's prompt engineering.
outline: [2, 3]
---

# Behavioral Principles

The plugin enforces several key behavioral constraints through its prompt engineering:

## 1. "Documentarian, Not Critic"

All research agents are instructed to **only describe what exists**. They do NOT:
- Suggest improvements
- Critique implementation choices
- Perform root cause analysis (unless explicitly asked)
- Recommend refactoring

This prevents research from becoming opinionated, ensuring clean separation between observation (research phase) and decision-making (plan phase).

## 2. Interactive Planning

Plans are contracts, not suggestions. The planning process:
1. Present understanding of the codebase first
2. Get user buy-in before proceeding
3. Iterate on each section with feedback
4. Never write a full plan in one shot
5. Resolve all unknowns before finalizing
6. Always separate "Automated Verification" (runnable commands) from "Manual Verification" (human testing)

## 3. Fresh Context Per Iteration

Spectrum gives each story a fresh Claude session via `spectrum.sh`. Memory persists through:
- `stories.json` (status, steps, commit hashes)
- `progress.md` (accumulated learnings)
- Git commits (the actual work)

This prevents context window degradation across long-running autonomous execution.

## 4. Two-Category Success Criteria

Every plan separates verification into:

| Category | Examples | Runner |
|----------|----------|--------|
| **Automated Verification** | `npm test`, `npm run typecheck`, `npm run lint` | Claude / Spectrum |
| **Manual Verification** | "Click the login button and verify redirect" | Human tester |

## 5. Signal Protocol

Autonomous execution uses XML-like signals for flow control:

| Signal | Tag | Meaning |
|--------|-----|---------|
| Complete | `<promise>COMPLETE</promise>` | Story finished successfully |
| Continue | `<spectrum-continue>` | Success, schedule next iteration |
| Continue w/ Concerns | `<spectrum-continue><concerns>...</concerns>` | Success, but flagged doubts (v3.0.1) |
| Retry | `<spectrum-retry reason="...">` | Transient failure, retry |
| Blocked | `<spectrum-blocked reason="...">` | Cannot proceed, skip |
| Needs Context | `<spectrum-needs-context>` | Missing information, skip to next (v3.0.1) |
| Error | `<spectrum-error reason="...">` | Fatal error, stop |

### 6. Two-Stage Review (v3.0.1)

After Spectrum quality gates pass, two reviewer agents are dispatched sequentially:

1. **Spec Compliance** (`spec-reviewer` agent) — verifies implementation matches requirements exactly. Checks for missing requirements, over-building, and scope drift. **Does not trust implementer self-reports.**
2. **Code Quality** (`quality-reviewer` agent) — reviews code quality, architecture, and testing. Only dispatched after spec compliance passes.

Review is skipped only for config-only changes, documentation-only stories, or reverts.

### 7. Implementer Status Protocol (v3.0.1)

During Spectrum execution, stories report one of four statuses:

| Status | Meaning | What Happens |
|--------|---------|-------------|
| **DONE** | Confident in quality | Proceed to quality gates → review |
| **DONE_WITH_CONCERNS** | Complete but with doubts | Log concerns, proceed (review catches issues) |
| **NEEDS_CONTEXT** | Missing information | Emit signal, skip to next story |
| **BLOCKED** | Cannot complete | Emit signal with root cause |

### 8. Independent Verification / Distrust Pattern (v3.0.1)

The `prism-validate` skill independently verifies all claimed completions. It does NOT trust checkbox status in plans — it reads actual code, greps for implementing functions, and checks `git diff --stat` for unplanned changes.
