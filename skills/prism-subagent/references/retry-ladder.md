# Retry Ladder

Bounded retries with auto-escalation. **The single most important defense against logic loops.** Read this in full before starting any plan execution.

## The Three Loops You Must Bound

A subagent-driven flow has three nested loops, each capable of spinning forever if unbounded:

1. **Per-task retry loop** — implementer fails, controller re-dispatches
2. **Per-task review loop** — reviewer finds issues, implementer fixes, reviewer reviews again
3. **Cross-task escalation loop** — too many tasks fail in a row → the plan itself is wrong

Each loop has explicit budgets. **No exceptions, no "just one more try."**

## Loop 1: Implementer Retry Budget

Tracked in `state.json.tasks[*].retry_count`. Each cycle is one retry.

| Cycle | Trigger | Action | Model Change |
|---|---|---|---|
| 0 | Fresh task | Dispatch implementer at `task.starting_model` (default: sonnet) | none |
| 1 | NEEDS_CONTEXT or BLOCKED | Provide more context, re-dispatch | none |
| 2 | BLOCKED again, or 2nd NEEDS_CONTEXT | Re-dispatch one tier up | haiku→sonnet, sonnet→opus |
| 3 | Still BLOCKED | **STOP. Escalate to user.** | n/a |

Hard ceiling: **3 cycles per task.** No exceptions.

If `retry_count >= 3`:
1. Set `state.json.tasks[*].status = "escalated"`
2. Increment `state.json.consecutive_escalations`
3. Surface to user with: full task spec, every implementer attempt's report, and a recommendation (split task / clarify spec / abandon)

## Loop 2: Review Fix Budget

Tracked in `state.json.tasks[*].review_cycles`. Counts spec + quality cycles together.

| Cycle | Trigger | Action |
|---|---|---|
| 0 | First review after implementation | Reviewer reads diff |
| 1 | Reviewer found issues, implementer fixed, re-review | Same reviewer, same model |
| 2 | Issues remain, fix again, re-review | Same reviewer, escalate model |
| 3 | Still failing review | **STOP. Surface to user.** |

Hard ceiling: **3 review cycles per task.**

## The Killer Loop: Repeated Issues

The classic logic loop: implementer fixes A, reviewer flags B, implementer fixes B and breaks A, reviewer flags A again. This must be detected, not retried.

**Defense:** Every reviewer issue is recorded in `state.json.tasks[*].raised_issues[]` as a normalized fingerprint (e.g., `"missing-input-validation:src/auth/login.ts"`). Before re-dispatching after a fix:

1. Compute the new reviewer's issue fingerprints
2. Intersect with `raised_issues` from prior cycles
3. If the intersection is non-empty → the fix isn't sticking → **HALT this task immediately**, do not enter another cycle
4. Surface to user: "Issue {X} recurred after fix. The implementer is oscillating. Manual intervention required."

This is non-negotiable. Two of the same issue fingerprint = halt.

## The No-Op Spin Detector

After each implementer cycle, before re-dispatching:

1. Capture `git diff HEAD~1..HEAD --stat` (or `git diff` if uncommitted)
2. Compare to the diff from the previous cycle
3. If the diff is byte-identical to the previous cycle's diff → the implementer is producing no changes → **HALT**

Symptoms this catches:
- Implementer claims fix but actually only re-runs tests
- Implementer "fixes" by reverting prior fix
- Implementer commits empty changes

## Loop 3: Cross-Task Halt

Tracked in `state.json.consecutive_escalations` and `state.json.consecutive_blocks`.

| Counter | Threshold | Action |
|---|---|---|
| `consecutive_escalations` | ≥ 3 | **HALT. The plan is wrong.** Surface every escalation to user, recommend re-planning. |
| `consecutive_blocks` (across tasks) | ≥ 3 | Same as above. |
| Total tasks where `retry_count > 0` | > 50% of plan | Warn user: "More than half of tasks needed retries. Consider re-planning before continuing." |

`consecutive_escalations` resets to 0 when a task completes successfully. So a single rough patch doesn't halt the run, but a sustained pattern does.

## Model Escalation Ladder

Default ladder for general tasks:
```
haiku → sonnet → opus
```

For tasks classified as `feature` or `contract` in the review matrix:
```
sonnet → opus → opus
```
(Skip haiku — these tasks need judgment from the start.)

For tasks classified as `experiment`:
```
haiku → haiku → sonnet
```
(Stay cheap; experiments fail fast and that's fine.)

The ladder is encoded in `state.json.tasks[*].model_ladder`. When escalating, take the next entry. When you hit the end, the next BLOCKED is a hard escalation to user.

## What "Escalate To User" Looks Like

When the controller surfaces an escalation, the message MUST include:

```
## Task {TASK_ID} Escalated

**Title:** {title}

**What happened:**
- Cycle 1 ({model}): {one-line summary of failure}
- Cycle 2 ({model}): {one-line summary of failure}
- Cycle 3 ({model}): {one-line summary of failure}

**Recurring issues:**
{list of issue fingerprints that appeared more than once, if any}

**Last implementer report (verbatim):**
{paste}

**Recommended next step:**
- Split this task into smaller pieces, OR
- Clarify the spec section: {quote the ambiguous part}, OR
- Abandon this task and continue with the rest of the plan, OR
- Pause execution entirely

What would you like to do?
```

Never escalate without giving the user a concrete decision menu. "Help, I'm stuck" wastes a turn.

## Why Bounds Are Sacred

The single biggest failure mode of long subagent runs is unbounded retries that look like progress. Token spend goes up, the task list goes nowhere, and by the time you notice, you've burned an hour and the user has lost trust. Bounds are not pessimism — they are the only thing standing between you and that outcome.

If a bound is wrong (too tight, not enough room), the user can raise it explicitly per task. The default is tight on purpose.
