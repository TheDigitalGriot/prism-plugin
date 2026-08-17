# Review Decision Matrix

Not every task needs both review stages. Skipping unnecessary reviews is a major token win — but the rules must be **explicit and inspectable**, never improvised. The matrix decides, not your patience.

## Classification

Classify each task into **exactly one** type before dispatching the implementer. Store the type in `state.json.tasks[*].review_class`.

| Class | Definition | Spec Review | Quality Review |
|---|---|---|---|
| `config` | Only touches `.json`, `.yaml`, `.toml`, `.env*`, `.ini` config files. No logic. | skip | skip |
| `docs` | Only touches `.md`, `.mdx`, `.txt`, `.adoc`. README, CHANGELOG, comments. | skip | skip |
| `revert` | Pure revert of a previous commit. No new code. | skip | skip |
| `test-only` | Adds/modifies tests but no production code. The test IS the spec. | skip | REQUIRED |
| `refactor` | Behavior unchanged, structure changed. Tests must still pass unchanged. | skip | REQUIRED + extra scrutiny |
| `bugfix` | Fixes a defect. Adds a regression test. | REQUIRED | REQUIRED |
| `feature` | New behavior. | REQUIRED | REQUIRED |
| `contract` | Touches `.prism/shared/contracts/`, API schemas, IPC handlers, type-shared exports. | REQUIRED | REQUIRED + grep callers |
| `experiment` | Lives in `prototypes/`, `playground/`, `experiments/`, `.prism/local/`, or any path the user marked sandbox in `state.json.sandbox_paths` | skip | LIGHT (style only) |

## Classification Rules

Apply in order — first match wins:

1. If `task.files` is entirely under a sandbox path → `experiment`
2. If `task.files` is entirely under `.prism/shared/contracts/` or matches `**/api/**/*.{ts,proto,graphql}` → `contract`
3. If `task.files` is entirely tests (`*.test.*`, `*.spec.*`, `**/__tests__/**`) → `test-only`
4. If `task.files` is entirely config patterns → `config`
5. If `task.files` is entirely docs patterns → `docs`
6. If task title/description starts with "revert " → `revert`
7. If task title/description starts with "refactor " or "rename " → `refactor`
8. If task title/description starts with "fix " or has a bug ID → `bugfix`
9. Otherwise → `feature`

If you cannot confidently classify, default to `feature` (most conservative). Never classify as a skip-eligible class to save tokens — the failure mode of skipping a needed review is worse than the cost of running one.

## Skip-Eligible Override

The user can force a stricter review class by adding to `state.json.tasks[*].review_class_override`. The override is always more strict, never more lenient. The controller can never auto-promote leniency.

## Why "Refactor" Skips Spec Review

Refactors have no spec to comply with — the spec is "behavior unchanged." Spec review on a refactor is a category error: it would either rubber-stamp or hallucinate violations. Quality review, by contrast, is *more* important on refactors because the only thing that matters is whether the structural change actually improved things.

Defense against bad refactor classification: **the test suite must pass unchanged**. If a refactor required test changes, it's not a refactor — promote it to `feature` or `bugfix`.

## Why "Contract" Gets Extra Scrutiny

API contracts, IPC handlers, and shared type exports have callers you can't see in the diff. After spec + quality review on a `contract` task, the controller MUST also:

1. `grep -r "{exported_symbol}"` across the repo for each new/changed export
2. Note the caller count in `state.json.tasks[*].caller_count`
3. If callers exist that weren't in the task's `files` list → flag as DONE_WITH_CONCERNS (the change has blast radius the plan didn't acknowledge)
4. If codebase-memory-mcp is available, prefer `trace_call_path` over grep

## Why "Experiment" Gets Light Review

Experimental sandboxes exist precisely so you can move fast and break things. Heavy review there fights the purpose. But "light" still means *something*:

- No quality review for: pattern fit, naming, dead code, test coverage, error handling
- Yes quality review for: secrets in source, accidental imports of production modules, infinite loops, file system writes outside the sandbox

The reviewer prompt for `experiment` class should be limited to those checks only. Pass `--experiment` flag in the dispatch context.

## What Gets Logged

Every task records in `state.json.tasks[*]`:
- `review_class`: the classification
- `review_class_reason`: which rule fired (e.g., "rule 4: all files match config patterns")
- `spec_review_skipped`: bool + reason if skipped
- `quality_review_skipped`: bool + reason if skipped

This makes the matrix inspectable in retrospectives — if a bug shipped, you can ask "did we skip the review that would have caught it, and why?"

## Final Pass Reviewer Always Runs

The post-loop final reviewer runs regardless of per-task classifications. It catches integration gaps and accumulated dead code that per-task review can't see. Skipping the final pass is never an option.
