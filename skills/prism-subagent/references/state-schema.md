# State Schema

`state.json` is the **runtime-status** source of truth for a prism-subagent run — keyed by story id. The **work-definition** is `.prism/stories/stories.json` (schema: `.prism/shared/contracts/stories-contract.md`); state.json *references* stories, it does not redefine them. Conversational memory is neither: read state, mutate it, persist it, never trust the in-context summary.

## Location

```
.prism/local/subagent/<plan-slug>/state.json
```

`<plan-slug>` is derived from the plan filename: `2026-04-10-add-auth.md` → `2026-04-10-add-auth`. The directory is gitignored (`.prism/local/` is in `.gitignore`).

If multiple subagent runs target the same plan, suffix with a timestamp: `<plan-slug>-<HHMMSS>`. The latest is always the one with the most recent mtime — the recovery protocol uses that.

## Schema

> Each task's `id`, `title`, `spec_text` (from the story `description`), `acceptance` (from the story
> `steps`), and `files` are **seeded from the corresponding story** in `stories_path` — one story = one
> task, same `id`. state.json then layers *runtime status* (`status`, `retry_count`, `raised_issues`, …)
> on top. The story is the definition; state is the run.

```json
{
  "version": 1,
  "plan_path": ".prism/shared/plans/2026-04-10-add-auth.md",
  "plan_slug": "2026-04-10-add-auth",
  "stories_path": ".prism/stories/stories.json",
  "started_at": "2026-04-10T14:32:00Z",
  "last_updated": "2026-04-10T14:47:21Z",
  "domain": "fullstack",
  "sandbox_paths": ["prototypes/", "playground/"],
  "starting_sha": "abc123...",
  "current_task": "T2",
  "consecutive_escalations": 0,
  "consecutive_blocks": 0,
  "tasks": [
    {
      "id": "T1",
      "title": "Add password hash field to users table",
      "spec_text": "Add a `password_hash` column to the `users` table...",
      "acceptance": [
        "Migration runs cleanly on a fresh DB",
        "Existing users get NULL password_hash",
        "ORM type is updated"
      ],
      "files": [
        {"path": "migrations/0007_password_hash.sql", "action": "create"},
        {"path": "src/db/types.ts", "action": "modify"}
      ],
      "review_class": "feature",
      "review_class_reason": "rule 9: default",
      "starting_model": "sonnet",
      "model_ladder": ["sonnet", "opus", "opus"],
      "implementer_model": "sonnet",
      "status": "complete",
      "retry_count": 0,
      "review_cycles": 1,
      "implementer_status": "DONE",
      "spec_review_skipped": false,
      "quality_review_skipped": false,
      "concerns": [],
      "raised_issues": [
        "missing-down-migration:migrations/0007_password_hash.sql"
      ],
      "clarifications": [],
      "caller_count": null,
      "commit_sha": "def456...",
      "completed_at": "2026-04-10T14:41:08Z"
    },
    {
      "id": "T2",
      "title": "...",
      "status": "in_progress",
      "...": "..."
    }
  ]
}
```

## Field Reference

| Field | Type | Purpose |
|---|---|---|
| `version` | int | Schema version. Bump when the schema changes. |
| `plan_path` | string | Path to the plan markdown — for resume only, never re-extracted from |
| `plan_slug` | string | Sluggified plan filename |
| `domain` | enum | `fullstack` \| `r3f` \| `electron` \| `experiment` \| `mixed` — drives [domain-hints](domain-hints.md) selection |
| `sandbox_paths` | string[] | User-declared experimental paths — overrides default sandbox detection |
| `starting_sha` | string | `git rev-parse HEAD` at run start. Used for cumulative diffs in the final pass. |
| `current_task` | string | The task currently being processed. Used for compaction recovery. |
| `consecutive_escalations` | int | Resets to 0 on any task completion. Halts run at ≥3. |
| `consecutive_blocks` | int | Same semantics. |
| `tasks[*].id` | string | Task identifier (T1, T2, ...) |
| `tasks[*].spec_text` | string | The full task description, extracted ONCE from the plan and never re-read |
| `tasks[*].acceptance` | string[] | Acceptance criteria, extracted from plan |
| `tasks[*].files` | object[] | Files in scope with action |
| `tasks[*].review_class` | enum | See [review-decision-matrix](review-decision-matrix.md) |
| `tasks[*].model_ladder` | string[] | The 3-step escalation sequence for this task |
| `tasks[*].status` | enum | `pending` \| `in_progress` \| `reviewing_spec` \| `reviewing_quality` \| `complete` \| `escalated` \| `awaiting_user` |
| `tasks[*].retry_count` | int | Total implementer dispatches for this task. Hard cap at 3. |
| `tasks[*].review_cycles` | int | Total reviewer dispatches (spec + quality combined). Hard cap at 3. |
| `tasks[*].raised_issues` | string[] | Normalized fingerprints of every issue any reviewer has raised. **Used for repeated-issue detection.** |
| `tasks[*].clarifications` | object[] | `{question, answer, asked_at, answered_at}` — survives compaction so the user never has to answer the same question twice |
| `tasks[*].caller_count` | int\|null | For `contract` class only. Number of callers found via grep/graph. |

## Issue Fingerprint Normalization

When a reviewer raises an issue, the controller computes a fingerprint and adds it to `raised_issues`:

```
{kebab-case-issue-summary}:{file-path}
```

Examples:
- `missing-input-validation:src/auth/login.ts`
- `magic-number:src/recovery.ts`
- `untested-error-path:src/api/users.ts`

The summary is generated by the controller from the reviewer's issue text — strip filler words, lowercase, hyphenate. Two issues with the same fingerprint = the same issue.

This is approximate, not perfect. If the controller is unsure whether two issues are "the same," it should err on the side of marking them as duplicates and halting — false positives just cause an escalation, false negatives cause an infinite loop.

## Persistence Rules

1. **Write after every state change.** Not at the end of a turn. Not when convenient. Every change.
2. **Atomic writes.** Write to `state.json.tmp`, then rename. Prevents corrupted state on a crash mid-write.
3. **Never edit by hand mid-run.** If the user wants to intervene, they should pause the run, edit, and explicitly resume.
4. **Never re-read the plan file** to refresh `spec_text`. The whole point of state.json is that it's frozen at extraction time.

## Compaction Recovery Protocol

On a fresh session post-compaction (or after `prism-subagent` is invoked again on an in-progress run):

1. Look in `.prism/local/subagent/` for state files. Pick the one with the most recent `last_updated`.
2. Read the state file completely.
3. Read `current_task` — that's where we were.
4. Run `git status` and `git diff --stat` — does the working tree match an in-flight task?
   - **Clean tree** + `current_task.status == "complete"`: previous task finished, advance to next pending
   - **Clean tree** + `current_task.status != "complete"`: previous attempt was rolled back, re-dispatch from scratch (do NOT increment retry_count — the prior attempt didn't count)
   - **Dirty tree**: a previous attempt left uncommitted changes. Do NOT continue blindly. Surface to user: "Found uncommitted changes from {task_id}. Discard and retry, or commit and mark complete?"
5. If `current_task.status == "awaiting_user"`: surface the `pending_question` to the user immediately. Do not dispatch anything else first.
6. **Never** ask the user "what were we doing?" — the answer is in state.json.

## What State.json Is NOT

- Not a log. Don't append events. Mutate fields.
- Not a plan. The plan stays in `.prism/shared/plans/`. State.json is a snapshot of execution.
- Not for cross-run history. A new run = a new state file. Old ones stay for forensics but aren't read.
- Not human-edited at runtime. Tools or the controller mutate it, never the user mid-run.
