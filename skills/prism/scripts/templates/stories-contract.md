# Stories Contract — the single work-definition

> The canonical schema for `stories.json` and the plan→stories mapping rules. Every Prism executor
> reads stories from here; every plan emits stories to here. When plan and stories disagree, the
> stories are what the executors actually run — so this contract is what keeps them from drifting.

## Where stories live

- **Flat**: `.prism/stories/stories.json` + `.prism/shared/spectrum/progress.md`
- **Epic-scoped**: `.prism/stories/<epic>/stories.json` + `.prism/shared/spectrum/<epic>/progress.md`

`scripts/spectrum.sh` derives the `progress.md` path from the stories path — do not change the
`.prism/stories/` location or that derivation breaks.

## Schema

```json
{
  "epic": "kebab-slug-matching-the-plan-frontmatter-epic",
  "stories": [
    {
      "id": "s7f3a9c2",
      "_id_note": "content-hash of the requirement text (see rule 4) — stable across re-emits, NOT a sequential label like STORY-001",
      "title": "Short imperative title",
      "description": "One behavioral requirement, self-contained — no 'see plan' cross-refs.",
      "priority": 1,
      "status": "pending",
      "blockedBy": [],
      "files": ["path/to/file/this/story/touches"],
      "steps": ["Concrete step 1", "Concrete step 2"],
      "completedAt": null,
      "commitHash": null
    }
  ]
}
```

Required keys per story: `id`, `title`, `description`, `priority`, `status`, `blockedBy`, `files`, `steps`.
`completedAt` and `commitHash` are populated by executors at runtime — never authored by the planner.

`status` vocabulary: `pending` · `in_progress` · `done` (aliases tolerated on read: `todo`, `open`,
`complete`, `completed`, `passed`).

## Plan → stories mapping rules

1. **One behavioral requirement per story.** A plan phase with N distinct steps becomes N stories
   (or fewer if steps are truly one requirement); never bundle unrelated requirements into one story.
2. **Zero requirements dropped.** Every phase step and every success criterion in the plan maps to at
   least one story. Coverage is checked by `validate_plan`.
3. **Epic = one execution context.** An epic is the set of stories that fit a single spectrum session
   (≈200K tokens: stories.json + progress.md + CLAUDE.md + one story at a time). A plan larger than one
   epic is split via `prism-decompose` into multiple epics with explicit `blockedBy` ordering.
4. **Stable ids across re-emits.** A story's `id` is derived from a hash of its behavioral-requirement
   text. When a plan is iterated (`iterate_plan`), unchanged requirements keep their id — so in-flight
   `status` / `commitHash` survive; only added/changed/removed requirements churn.
5. **`blockedBy` encodes ordering.** Risk-ordered plan phases translate to `blockedBy` chains so
   spectrum/subagent respect dependencies.

## The two kinds of source of truth (do not conflate)

- **Work-definition** = `stories.json`. Unified. Every executor reads it. This is what this contract governs.
- **Runtime status** = `state.json` (subagent) / `progress.md` (spectrum). Per-run. These record which
  story `id` is done / what issues were raised — they *reference* stories, they do not *redefine* them.

## Producers and consumers

| Component | Role | Reads | Writes |
|-----------|------|-------|--------|
| `/prism-plan`, `/create_plan` | producer | the plan | `plan.md` + (via `decompose_plan`) `stories.json` |
| `decompose_plan` | engine | `plan.md` | `stories.json` |
| `prism-decompose` | engine (big specs) | a 500K+ spec | multi-epic `stories.json` |
| `prism-implement` | consumer | `stories.json` (+ `plan.md` for narrative) | code, TodoWrite |
| `prism-subagent` | consumer | `stories.json` | code, `state.json` (status by story id) |
| `prism-spectrum` | consumer | `stories.json` | code, `progress.md` (status by story id) |
| `iterate_plan` | maintainer | `plan.md` + `stories.json` | re-emitted `stories.json` (stable ids) |
| `validate_plan` | guard | `plan.md` + `stories.json` | pass/fail (coverage + stable ids) |
