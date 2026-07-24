---
name: fragment-sync
description: Use when Fragment (the create-fragment scaffolder / fragment-plugin) has drifted from the current cl-plugin-structure / Prism standard and needs re-syncing — after Prism advances, before exposing Fragment anywhere, or when scaffolded projects look stale (missing Cowork awareness, channels, or the current model line). Reconciles Fragment so it once again emits "Prism-image" projects. Triggers on "sync fragment", "update fragment", "fragment fell behind", "conform fragment", "fragment is stale".
version: 0.1.0
---

# Fragment Sync

Reconcile **Fragment** to the current **cl-plugin-structure / Prism** standard. Fragment is a *generator* (the `create-fragment` CLI + templates, plus the `fragment-plugin`) that should emit "Prism-image" projects — but it drifts whenever Prism advances and Fragment isn't updated in lockstep. This skill makes the reconciliation a single deliberate pass instead of a manual chore that gets forgotten.

`cl-plugin-structure` is the source of truth. Fragment is downstream. This skill is the **spec → generator conformance bridge** between them.

## Iron rule

```
Fragment must EMIT what cl-plugin-structure TEACHES.
If the standard gained a capability, the generator must emit it — and the plugin must model it.
```

## Inputs (read these first, completely)

1. **The standard** — `../cl-plugin-structure/SKILL.md` (+ its `references/`). The authority. Note its version.
2. **Prism's own manifest** — `../../.claude-plugin/plugin.json` — a live example of a current plugin (channels, current version).
3. **The conformance checklist** — [references/conformance-checklist.md](references/conformance-checklist.md). The concrete item-by-item spec, distilled from the last full audit. Update it whenever the standard gains something new.
4. **Fragment on disk** — default `c:/Users/digit/GriotApps/fragment-ai-scaffold` (confirm the path). Two layers:
   - **Layer A** — `plugins/fragment-plugin/` (the Claude Code plugin: `agents/`, `skills/`, `scripts/`, `.claude-plugin/`).
   - **Layer B** — `packages/create-fragment/` (the CLI + `templates/` — what Fragment *emits*).

## Workflow

Run the layers in order. Layer A is bounded; Layer B is large, so it is audited before it is executed.

### 1. Diff against the checklist
For each checklist item, mark Fragment **conformant** / **gap**, citing `file:line`. Do this for Layer A and Layer B separately.

### 2. Layer A — conform `fragment-plugin` (fully)
Apply every Layer-A gap: required frontmatter (`color`, "When to invoke"), manifest-reading vocabulary (must include `channels` + `userConfig`, not just MCP servers/skills/hooks), Cowork awareness, missing component classes, and the `claude plugin validate` gate.
- **Gate:** re-pinning the submodule and cutting any GitHub release are git/publish actions — **stop and get the user's explicit go** before running them. Re-pin *before* editing so edits land on current `main`.

### 3. Layer B — audit & report (before touching templates)
Read the CLI engine (`src/engine/`) and every `templates/*/` surface. Write a gap report to `.prism/shared/research/<date>-fragment-sync-B-audit.md` — per file, the exact change needed. **Present the audit to the user and get their go before executing Layer B** (the surgery is large; seeing its extent first is the point).

### 4. Layer B — execute (fully, post-review)
Apply the audited template/engine changes so emitted projects carry channels + Cowork awareness + the current model line. Reconcile the CLI version.
- **Gate:** `npm publish` — **stop and get the user's explicit go.**

### 5. Verify
Re-run the diff (step 1). A clean run reports **zero gaps** — the skill is idempotent. Update the readiness doc: Fragment → synced.

## Gates (never run these without an explicit go)

- `git submodule` re-pin · `git commit`/`push` in Fragment · `gh release` · `npm publish`.

## Authoring note

When this skill (or Fragment) itself is edited, it is a Claude Code plugin skill — author it per `/cl-plugin-structure` and finish with `claude plugin validate .`.
