# Status Protocol

The implementer reports exactly one of five statuses. Each has a deterministic handler. **Never improvise** — the protocol exists so the controller's behavior is predictable across compactions and resumptions.

## The Five Statuses

| Status | Meaning | Handler |
|---|---|---|
| `DONE` | Spec met, verification passes, committed | → spec review |
| `DONE_WITH_CONCERNS` | Same as DONE plus flagged doubts | → log concerns to state.json, then spec review |
| `NEEDS_CONTEXT` | Missing info the controller can provide | → provide it, re-dispatch SAME model, increment retry_count |
| `NEEDS_CLARIFICATION` | User-level decision required | → STOP. Ask the user. Do NOT guess. |
| `BLOCKED` | Cannot complete this task | → consult retry-ladder.md |

## Why Five (Not Four)

Generic SDD has four statuses and folds product/architecture questions into `NEEDS_CONTEXT`. That's a trap: the controller, given a fresh subagent and ambient pressure to keep moving, will *invent* the missing context rather than escalate to the user. Splitting `NEEDS_CLARIFICATION` out makes the escalation explicit and unmistakable.

**Rule of thumb:**
- "Which file holds the User type?" → `NEEDS_CONTEXT` (controller can grep)
- "Should this validation happen on the client or the server?" → `NEEDS_CLARIFICATION` (only the user knows the product intent)

## Handler Details

### DONE
1. Read the implementer's report
2. Verify the commit exists: `git log -1 --format=%H`
3. Update `state.json.tasks[current]`: set `commit_sha`, `implementer_status: "DONE"`
4. Proceed to spec review

### DONE_WITH_CONCERNS
1. Same as DONE
2. Append concerns to `state.json.tasks[current].concerns[]`
3. Pass concerns into the spec reviewer dispatch as additional context
4. Do not let concerns become silent — they must surface in the final pass too

### NEEDS_CONTEXT
1. Read the question carefully — is it really controller-resolvable?
2. If yes: gather the missing info (Read/Grep, never another subagent for this)
3. Re-dispatch the implementer with the original prompt + an `## Additional Context` section
4. Increment `state.json.tasks[current].retry_count` — counts toward retry-ladder budget
5. If the same implementer asks for context twice in a row → that's a `BLOCKED` masquerading as `NEEDS_CONTEXT`. Treat as BLOCKED.

### NEEDS_CLARIFICATION
1. STOP all dispatching
2. Update `state.json.tasks[current].status = "awaiting_user"`
3. Surface the question to the user in plain text — quote the implementer's question verbatim
4. Wait for the user's answer
5. Persist the answer to `state.json.tasks[current].clarifications[]` (so it survives compaction)
6. Re-dispatch with the answer added as `## Clarifications`
7. **Do not increment retry_count** — clarification is not a retry, it's a dependency

### BLOCKED
1. Read the implementer's blocker description
2. Consult [retry-ladder.md](retry-ladder.md) — the next move depends on the current `retry_count` and `implementer_model` for this task
3. Cycle 1 BLOCKED: more context same model
4. Cycle 2 BLOCKED: escalate model (haiku → sonnet → opus)
5. Cycle 3 BLOCKED: STOP. The plan is wrong or the task is too large. Escalate to user.
6. Increment `state.json.consecutive_blocks`. If ≥3 across different tasks → halt entire run.

## Anti-Pattern: The Optimistic DONE

The most dangerous failure mode is an implementer reporting DONE when verification was skipped or partially run. Defenses:

1. The implementer prompt explicitly forbids claiming DONE if verification didn't run
2. The controller verifies the commit exists before accepting DONE
3. The spec reviewer is told "DO NOT TRUST THE IMPLEMENTER'S SELF-REPORT" (already in agent definition)
4. The diff-based review can't be fooled by a missing implementation — empty diff means nothing was done

## Anti-Pattern: The Eternal NEEDS_CONTEXT

Some tasks generate context requests forever because the implementer doesn't really understand the system. Defenses:

1. Two consecutive `NEEDS_CONTEXT` from the same implementer → reclassify as BLOCKED
2. `retry_count` increments on every `NEEDS_CONTEXT` re-dispatch — burns the same budget as BLOCKED
3. The retry ladder eventually escalates the model, which usually breaks the deadlock

## State Updates Per Status

| Status | state.json mutations |
|---|---|
| DONE | `commit_sha`, `implementer_status`, `status: reviewing_spec` |
| DONE_WITH_CONCERNS | above + `concerns[]` append |
| NEEDS_CONTEXT | `retry_count++`, `last_status: "NEEDS_CONTEXT"` |
| NEEDS_CLARIFICATION | `status: "awaiting_user"`, `pending_question` |
| BLOCKED | `retry_count++`, `last_block_reason`, `consecutive_blocks++` |

Persist these immediately. If the session compacts mid-handler, the state.json must be enough to resume.
