# Prism 4.5.7 — Plan → Story source-of-truth unification

**Release date:** 2026-07-22
**Type:** feature (workflow coherence)
**Branch:** `feat/plan-story-source-unification`

## Summary

Unified the plan → story → execute flow onto a single work-definition. Before 4.5.7, three executors
read three different artifacts — `prism-implement` parsed the plan `.md`, `prism-subagent` operated
from its own `state.json`, and only `prism-spectrum` read `stories.json`. Getting stories at all
required a separate, easily-skipped `decompose_plan` step, so the plan and the story queue drifted.

As of 4.5.7, **`stories.json` is the single work-definition every executor reads**, `/prism-plan`
emits it automatically, and the maintainers keep it in sync.

## What changed

### Generation
- `/prism-plan` and `/create_plan` now **emit `.prism/stories/stories.json` as their final step**, via
  the `decompose_plan` engine — one parser, two entry points. A plan is not complete until it has
  stories.
- `decompose_plan` is documented as the **canonical plan→stories engine**.
- Plans carry an `epic:` front-matter field — the stable back-link between `plan.md` (narrative) and
  `stories.json` (executable truth).
- New contract: **`.prism/shared/contracts/stories-contract.md`** — the canonical `stories.json`
  schema + plan→stories mapping rules (one requirement per story, none dropped, stable ids).

### Consumers
- `prism-implement` / `implement_plan` load **stories** into TodoWrite; the plan `.md` is read for
  narrative only, not for task extraction.
- `prism-subagent` seeds `state.json` from stories — **one story = one task, keyed by story `id`**.
  `state.json` holds *runtime status only*; it references stories, it does not redefine them.
- `state-schema.md` gains a `stories_path` pointer and keys tasks by story id.

### Coherence guards
- `prism-iterate` / `iterate_plan` **re-emit stories on plan edit**, preserving stable ids so in-flight
  `status` / `commitHash` survive.
- `prism-validate` / `validate_plan` add a **plan ↔ stories coverage gate** (no stories = hard fail;
  every requirement maps to ≥1 story; stable ids after iteration).
- `prism-locator` **co-surfaces a plan's emitted stories**.

### Tooling
- New `scripts/verify-story-unification.mjs` — static guard (15 checks) that the flow stays unified.

## The two kinds of source of truth

- **Work-definition** = `stories.json` — unified, every executor reads it.
- **Runtime status** = `state.json` / `progress.md` — per-run, keyed by story id; references stories,
  never a rival task list.

## Compatibility

Strictly additive. The `.prism/stories/` path and `stories.json` schema are unchanged, so existing
spectrum runs keep working. `spectrum.sh` is untouched. Each phase reverts cleanly.

## Verification

- `node scripts/verify-story-unification.mjs --all` → 15/15 PASS
- `claude plugin validate .` → passed
