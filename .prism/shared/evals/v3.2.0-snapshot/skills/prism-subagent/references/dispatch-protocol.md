# Dispatch Protocol

Templates for the three subagent dispatches. **The controller (you) constructs every prompt — subagents never read plan files.**

## Token Discipline

- **Implementer** gets: full task text + scoped file list + domain primer + acceptance criteria
- **Spec reviewer** gets: spec excerpt + `git diff` + file list (NO full files)
- **Quality reviewer** gets: `git diff` + story context (why/risks/patterns) + file list (NO full files)

Reviewers read the diff. If they need to see surrounding context they have Read/Grep — but the *default* is diff-only. This is the single biggest token win in the entire flow.

## 1. Implementer Dispatch

Use `Task(subagent_type="general-purpose")` (or domain-specialized agent if appropriate).

```
You are implementing task {TASK_ID} from plan {PLAN_SLUG}.

## Task
{FULL task text from state.json — paste verbatim, do not link}

## Files In Scope
- {file1}: {action: create|modify|delete}
- {file2}: ...

DO NOT modify any file outside this list. If you believe you must, stop and report
NEEDS_CLARIFICATION.

## Acceptance Criteria
{from task.acceptance in state.json}

## Domain Context
{paste the matching domain primer from references/domain-hints.md — R3F | electron |
fullstack | experimental — controller selects based on state.json.domain}

## Existing Patterns To Follow
{any task.patterns entries — e.g., "follow the IPC handler pattern in src/main/ipc/auth.ts"}

## Known Risks
{any task.risks entries}

## Before You Begin
If anything in the spec is ambiguous, pause and ask **one** consolidated question.
Do not guess. Do not partially implement and hope.

## Your Job
1. Read the in-scope files (Read tool, no offset/limit unless file >2000 lines)
2. Implement exactly what the task specifies — nothing more
3. Run the verification commands listed in acceptance criteria
4. Self-review against the spec (completeness, scope discipline, naming, tests)
5. Commit with conventional-commit message: `{type}({task-id}): {title}`
6. Report status

## Status Protocol
Report exactly one of: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | NEEDS_CLARIFICATION | BLOCKED

- DONE: Spec fully met, verification passes, committed.
- DONE_WITH_CONCERNS: Same as DONE, but flag specific doubts in a `## Concerns` section.
- NEEDS_CONTEXT: A piece of information the controller can provide is missing. List it.
- NEEDS_CLARIFICATION: A user-level decision is required (architecture, product intent).
- BLOCKED: You cannot complete this task. Describe what you tried, what failed, and what
  kind of help (more context / more capable model / smaller task) would unblock you.

NEVER silently produce work you are unsure about.
NEVER claim DONE if any verification step failed or was skipped.
NEVER touch files outside the in-scope list.

## Report Format
Status: {one of the five above}
Files changed: {list with line counts}
Verification: {commands run + results}
Commit: {sha}
Concerns: {if any}
```

## 2. Spec Reviewer Dispatch

Use `Task(subagent_type="spec-reviewer")`. The agent definition is at [agents/spec-reviewer.md](../../../agents/spec-reviewer.md).

```
Story: {TASK_ID} — {TASK_TITLE}

## Specification
{Paste task.spec_text from state.json — the requirements only, not the whole plan}

## Acceptance Criteria
{from state.json}

## Files Modified (from implementer report)
- {file1}
- {file2}

## Diff
```diff
{output of: git diff {parent_sha}..HEAD -- {file1} {file2}}
```

## Previously Raised Issues (DO NOT re-raise these unless they recur)
{list state.json.tasks[current].raised_issues — empty on first review}

## What To Verify
1. Every requirement in the spec is implemented (point to file:line in the diff)
2. No code beyond the spec was added (over-building)
3. Acceptance criteria are testable from this diff
4. Edge cases mentioned in the spec are handled

You may use Read/Grep on files OUTSIDE the diff if you need surrounding context, but
do not re-read the modified files in full — the diff is authoritative for what changed.

Output the Spec Compliance Review format from your agent definition.
```

## 3. Quality Reviewer Dispatch

Use `Task(subagent_type="quality-reviewer")`. Dispatched ONLY after spec review passes.

```
Story: {TASK_ID} — {TASK_TITLE}

## Story Context
- Why this task exists: {task.why}
- Known risks: {task.risks}
- Patterns to follow: {task.patterns}
- Domain: {state.json.domain}

## Diff
```diff
{git diff {parent_sha}..HEAD -- {files}}
```

## Previously Raised Issues (DO NOT re-raise unless recurred)
{state.json.tasks[current].raised_issues}

## What To Review
- Architectural fit (does this pattern match the codebase?)
- Naming clarity
- Error handling at boundaries (NOT internal functions — see project conventions)
- Test quality (do tests verify behavior, not mocks?)
- Dead code, unused exports, defensive validation that can't trigger

Severity: Critical | Important | Minor
- Critical: must fix before merge
- Important: should fix before merge
- Minor: note in state.json, don't block

Output the standard quality review format.
```

## 4. Final Pass Reviewer (after all tasks complete)

```
Task(subagent_type="quality-reviewer")

This is the final pass over the entire plan implementation. Plan: {PLAN_SLUG}.

## Tasks Completed
{list from state.json.tasks where status=complete, with commit shas}

## Cumulative Diff
```diff
{git diff {plan_start_sha}..HEAD}
```

## What To Verify
1. Tasks compose correctly (no integration gaps)
2. No file is touched by multiple tasks in conflicting ways
3. The full implementation matches the plan's stated outcome
4. No accumulated dead code or orphaned exports across tasks

Report any cross-task issues that per-task review would have missed.
```

## Why This Order

Spec compliance MUST come before code quality. Reasoning: a beautifully-written piece of code that doesn't match the spec is worse than scrappy code that does. Fix the *what* before the *how*. Quality review on a non-compliant implementation just wastes tokens — the diff is going to change.
