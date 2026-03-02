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
| Retry | `<spectrum-retry reason="...">` | Transient failure, retry |
| Blocked | `<spectrum-blocked reason="...">` | Cannot proceed, skip |
| Error | `<spectrum-error reason="...">` | Fatal error, stop |
