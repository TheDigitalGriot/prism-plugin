---
date: 2026-07-19
author: Claude
git_commit: a0923b51305a1d085965ffea80de2716f9407592
branch: main
topic: "/fragment-sync — a callable Prism skill that reconciles Fragment to current cl-plugin-structure"
tags: [plan, fragment-sync, cl-plugin-structure, skill, conformance]
status: approved-structure — full plan written; implementation partial (Phase 1 + Phase 3 audit run AFK; Phases 2/4/5 staged for Gavin's go)
related: [.prism/shared/brainstorms/2026-07-19-connector-artifact-popout.md, .prism/shared/research/2026-07-19-griot-tracks-readiness.md]
---

# Plan: `/fragment-sync` — Fragment ⇄ cl-plugin-structure conformance skill

## Overview

Build a callable Prism skill, **`/fragment-sync`**, that reconciles **Fragment** (`create-fragment` CLI + templates, and the `fragment-plugin`) to current `cl-plugin-structure` v0.7.2 / Prism patterns. Fragment is the generator that should emit "Prism-image" projects but has drifted ~a full standard-generation behind since April 2026. The skill turns a manual, easily-forgotten reconciliation into a one-command operation, and is validated by running it once (which actually re-syncs Fragment). It is the prerequisite that unblocks Fragment's connector exposure and `idea_init`.

**Approach (locked in brainstorm):**
- **Pure-instructions skill** (no bundled audit script) — Claude reconciles by judgment guided by `SKILL.md` + a conformance checklist. *(Q2=b)*
- **Skill + first real re-sync** — the plan builds the skill AND runs it once against real Fragment. *(Q1=b)*
- **Layer A fully → Layer B audit-and-report → Layer B full.** *(Q3 corrected)*
- Skill authored per `/cl-plugin-structure`.

## Current State (verified on disk, 2026-07-19)

Repo: `c:\Users\digit\GriotApps\fragment-ai-scaffold` — root frozen at `105c30d` (2026-04-05); submodule `plugins/fragment-plugin` pinned at `e989c98` (v1.0.0), **behind** its remote `main` (`46682f0`, v1.5.0, 2026-04-08 — adds a `/fragment` skill absent locally).

**Layer A — `fragment-plugin` (the Claude Code plugin):**
- `plugins/fragment-plugin/agents/connector-agent.md:1-8` — frontmatter has `name, description, model: sonnet, effort: medium, maxTurns: 10, disallowedTools: []`; **missing required `color`**; no "When to invoke" section.
- `plugins/fragment-plugin/skills/fragment-connect/SKILL.md:22` — discovery vocabulary is "MCP servers, skills, hooks" — **missing `channels` and `userConfig`**.
- `plugins/fragment-plugin/scripts/detect-surfaces.py:15` — hardcodes `["electron", "vscode", "tui"]`; returns the raw plugin manifest without extracting channels/userConfig; **no Cowork awareness**.
- Local skills present: `fragment-connect`, `fragment-status` only (**`/fragment` skill missing** vs remote).

**Layer B — `create-fragment` CLI + templates (what it emits):**
- `packages/create-fragment/package.json` — `create-fragment@1.0.1`; deps `commander`, `glob`.
- `packages/create-fragment/src/engine/plugin-discovery.ts:10-16,39-48` — `PluginInfo` / `parsePluginManifest` extract only `name, version, description, mcpServers` — **missing `channels`, `userConfig`, `hooks`, `skills`**.
- `packages/create-fragment/src/engine/plugin-discovery.ts:54-60` — `detectSurfaces` hardcodes `['electron', 'vscode', 'tui']` — **no Cowork surface**.
- `packages/create-fragment/templates/{base,core,electron,tui,ui,vscode}/` — emitted surfaces; no channels wiring, no Cowork target, vendor-only model config (per readiness doc §3).
- `packages/create-fragment/src/engine/generators/{electron,tui,vscode}-glue.ts` — glue generators; no channels/Cowork.

**Reference (north star):** `Prism/skills/cl-plugin-structure/SKILL.md` (v0.7.2), `Prism/.claude-plugin/plugin.json` (v4.3.1).

## Desired End State

1. `skills/fragment-sync/` exists in Prism (SKILL.md + references), passing `claude plugin validate .`.
2. Running `/fragment-sync` reconciles Fragment: Layer A conformed, Layer B audited then updated.
3. `fragment-plugin` passes `claude plugin validate`; `connector-agent.md` has `color` + "When to invoke"; the manifest-reader (skill + CLI) recognizes `channels` + `userConfig`; submodule re-pinned to current main.
4. `create-fragment` emits Prism-image projects (channels + Cowork awareness + current model line); republished.
5. A second `/fragment-sync` run reports **zero conformance gaps** (idempotent).
6. Readiness doc updated: Fragment → synced.

## What We're NOT Doing

- NOT exposing Fragment in the P2 connector (downstream — this unblocks it).
- NOT building `idea_init` (separate; unblocked by this).
- NOT the connector / artifact-popout build (separate plan).
- NOT bundling an audit script (skill is pure-instructions).
- NOT re-architecting Fragment's surface set beyond adding Cowork awareness (Electron/VSCode/TUI stay).

## Structural Impact (graph-informed)

**N/A by construction.** This plan authors a *new* Prism skill (no existing Prism symbols modified) and edits a *separate* repo (`fragment-ai-scaffold`). Blast radius within the Prism graph is nil; no `trace_call_path` targets exist. Graph analysis skipped intentionally.

## Gates (require Gavin's explicit go — do NOT execute AFK)

- **Phase 2:** submodule re-pin (git), GitHub release for the 1.5.0 manifest (`gh`).
- **Phase 4:** `create-fragment` republish (`npm publish`).
- **Any** `git commit` / `git push` in `fragment-ai-scaffold`.
- **Phase 4 execution** waits until Gavin reviews the Phase 3 audit (his "audit then full" sequencing).

---

## Phase 1 — Author `/fragment-sync` (Prism, per `/cl-plugin-structure`)

**Files (create):**
- `skills/fragment-sync/SKILL.md`
- `skills/fragment-sync/references/conformance-checklist.md`

**Steps:**
1. Write `SKILL.md` frontmatter per cl-plugin-structure: `name: fragment-sync`, a trigger-rich `description`, and a body documenting the reconciliation workflow — (a) read the current `cl-plugin-structure` standard + Prism `plugin.json`; (b) diff Fragment across Layer A (`fragment-plugin`) and Layer B (`create-fragment` CLI + templates) against the checklist; (c) apply Layer A fully; (d) audit-and-report Layer B; (e) apply Layer B fully; (f) validate + re-diff to zero.
2. Write `references/conformance-checklist.md` — the concrete checklist distilled from the readiness doc §3/§4: required `color` field, `channels` + `userConfig` in manifest-reading, Cowork surface awareness, current model line (Opus/Sonnet/Haiku + effort + `[1m]`), missing component classes (`hooks/`, `.mcp.json`, `settings.json`/`.local.md`, output-styles, validator gate), submodule currency, `claude plugin validate` gate.
3. Reference `../cl-plugin-structure/SKILL.md` as the authority the skill reads at runtime.

**Automated Verification:**
- [ ] `cd c:/Users/digit/GriotApps/Prism && claude plugin validate .` passes clean (SKILL.md frontmatter valid).
- [ ] `skills/fragment-sync/SKILL.md` + `references/conformance-checklist.md` exist and are non-empty.

**Manual Verification:**
- [ ] `/fragment-sync` appears in the skill picker with an accurate description.
- [ ] SKILL.md body is followable by a fresh session with no external context beyond the checklist + cl-plugin-structure.

---

## Phase 2 — First run · Layer A: conform `fragment-plugin` *(edits + gated git — Gavin's go)*

**Files (modify, in `fragment-ai-scaffold/plugins/fragment-plugin/`):**
- `agents/connector-agent.md` — add `color: cyan` (or chosen) to frontmatter; add a "## When to invoke" section with 2–4 trigger scenarios (per cl-plugin-structure convention).
- `skills/fragment-connect/SKILL.md:22` — extend the discovery vocabulary to "MCP servers, **channels**, skills, hooks, **userConfig**".
- `scripts/detect-surfaces.py` — extract `channels` + `userConfig` from the manifest into the returned dict; add Cowork awareness to the surface model (documented note; Cowork is not an `apps/` dir but a plugin target).
- **Gated:** `git submodule` re-pin `plugins/fragment-plugin` → current `main`; cut the GitHub release for the 1.5.0 manifest.

**Automated Verification:**
- [ ] `cd fragment-ai-scaffold/plugins/fragment-plugin && claude plugin validate .` passes clean (color now present).
- [ ] `python scripts/detect-surfaces.py <a fixture with channels+userConfig>` returns them in the JSON.

**Manual Verification:**
- [ ] `connector-agent.md` frontmatter + "When to invoke" reads correctly.
- [ ] `git submodule status` shows the re-pinned commit (after Gavin's go).

---

## Phase 3 — First run · Layer B: audit & report *(read-only)*

**Files (create):** `.prism/shared/research/2026-07-19-fragment-sync-B-audit.md`

**Steps:**
1. Read `create-fragment/src/engine/plugin-discovery.ts`, `manifest.ts`, `generators/*-glue.ts`, and each `templates/*/` surface.
2. Produce a gap report enumerating, per file, exactly what must change to emit Prism-image projects: `PluginInfo` fields (`channels`/`userConfig`/`hooks`/`skills`), Cowork surface, template model-line wiring, channels event-push wiring, routing-table `CLAUDE.md`, dep bumps.

**Automated Verification:**
- [ ] Audit file exists; every gap cites a `file:line` and a concrete change.

**Manual Verification:**
- [ ] Gavin reviews the audit — this gates Phase 4.

---

## Phase 4 — First run · Layer B: execute full *(edits + gated npm — Gavin's go, post-audit-review)*

**Files (modify, in `fragment-ai-scaffold/packages/create-fragment/`):**
- `src/engine/plugin-discovery.ts` — extend `PluginInfo` + `parsePluginManifest` with `channels`, `userConfig`, `hooks`, `skills`; add Cowork to `detectSurfaces`.
- `src/engine/generators/*-glue.ts` + `templates/*` — wire channels event-push, Cowork awareness, current model-line selection, a routing-table `CLAUDE.md` (per cl-plugin-structure §Folder Architecture) **+ a `.prism/`-aware scaffold** (B5 CONFIRMED in scope, Gavin 2026-07-19: every Griot tool is Prism-image); bump vendored `@anthropic-ai/*` deps per audit.
- Reconcile root/CLI version; **gated:** `npm publish` `create-fragment`.

**Automated Verification:**
- [ ] `cd create-fragment && npm run build && npm test` pass.
- [ ] Scaffolding a fixture (`node bin/fragment.js init …`) emits a project that passes `claude plugin validate` and contains channels/Cowork/model-line.

**Manual Verification:**
- [ ] Emitted project inspected — genuinely Prism-image.

---

## Phase 5 — Verify & close

**Steps:**
1. Re-run `/fragment-sync` → reports **zero** conformance gaps (idempotent).
2. Update `2026-07-19-griot-tracks-readiness.md`: Fragment → synced (date, versions).

**Automated Verification:**
- [ ] Second `/fragment-sync` diff is empty.

**Manual Verification:**
- [ ] Fragment no longer flagged stale in the readiness doc.

---

## Risks & Mitigations

- **Submodule drift vs. local edits** — editing the stale local submodule then re-pinning would clobber edits. *Mitigation:* re-pin FIRST (Phase 2, gated), then apply Layer A edits against current `main`.
- **Layer B is large surgery** — template changes across 6 surface dirs. *Mitigation:* audit-and-report (Phase 3) before executing (Phase 4); Gavin reviews between.
- **Cowork ≠ an `apps/` surface** — Cowork is a plugin *target*, not a scaffolded app dir; "Cowork awareness" means manifest/plugin-level, not a new `apps/cowork`. *Mitigation:* scope Cowork support to manifest + emitted plugin.json, not a UI surface.
- **npm/GitHub irreversibility** — publishes are one-way. *Mitigation:* gated on Gavin's explicit go; never AFK.

## Edge Cases

- Fragment already partially synced → the skill's diff must be idempotent (re-runnable, no double-edits).
- `create-fragment` version already bumped but not published → reconcile version before publish (root `1.0.0` vs CLI `1.0.1` mismatch noted in readiness doc).
- Submodule remote unreachable → skill reports and continues with local Layer B (degrade, don't fail).

## Follow-on Initiatives (captured 2026-07-19 — not in fragment-sync scope)

### FO-1 · Mobile (EAS/Expo) surface for Fragment — the full Prism-image surface set
**Why:** the Prism-image is the *whole* surface set — CLI · VSCode · Electron · **Mobile** · Cowork. Today Fragment emits only electron/vscode/tui, so a new Griot tool (Cinopsis, Lucid, …) can't `fragment init` its way to a mobile app. Closing this makes the ecosystem *compound* — every tool inherits mobile immediately.
**Concrete gap:** surface set is hardcoded in `create-fragment/src/commands/init.ts` (`VALID_SURFACES`), `create-fragment/src/engine/plugin-discovery.ts` (`detectSurfaces`), and `fragment-plugin/scripts/detect-surfaces.py`. Adding mobile = a new `templates/mobile/` (Expo/EAS) + a `mobile-glue` generator + extending those three lists.
**Prerequisite — harvest before templating ("in a stable state"):**
1. **Harvest (read-only research):** mine `apps/prism-mobile` (the EAS/Expo/paseo fork) + the Prism `CHANGELOG.md` + docs for the mobile architecture AND the reusable architectural patterns captured along the way. Output → `.prism/shared/research/`.
2. **Plan:** design `templates/mobile/` + glue from the harvest.
3. **Build:** add the mobile surface.
**Resolves** the connector brainstorm's parked concern #4 (Prism stale EAS/mobile surface) from the *reusability* angle — not just un-staling Prism's mobile, but making the pattern reproducible.

### FO-2 · Encode captured architectural patterns into the Prism-image
Patterns developed across the ecosystem and captured in CHANGELOGs / docs (not yet in cl-plugin-structure or Fragment templates) should be harvested and encoded so new tools inherit them. Pairs with FO-1's harvest step.

## Completion status (2026-07-19) — SHIPPED beyond fragment-sync

The session went past conformance and delivered the full Prism-image surface set + interactivity into Fragment (all pushed to `TheDigitalGriot/fragment-ai-scaffold` + `fragment-plugin`):

- ✅ **fragment-sync conformance** (Layer A + B1 + B5) — pushed. `create-fragment@1.1.0`.
- ✅ **FO-1 · Mobile (Expo/EAS) surface** — `templates/mobile/` (Expo Router app reusing `core` + DOM-free `ui` via a `WebSocketTransport`), `--mobile` flag, `detectSurfaces` + tests. Pushed (`01b1634`). Harvest: `2026-07-19-fragment-mobile-harvest.md`.
- ✅ **Click-to-drive (B4)** — `DriveIntent` + `BaseController.drive` + `ChatService.driveIntent` (a click funnels into the same agent call as a typed message); electron `app:drive` IPC + preload; vscode `<plugin>.drive` command; per-surface `drive-client` glue (electron/vscode/mobile). TUI Go prereqs documented as follow-on. Harvest: `2026-07-19-click-to-drive-harvest.md`. Resolved: Fragment apps embed their own agent → direct agent-input, NOT a Claude Code channel.
- ✅ **Meta-skills** — `templates/base/` now emits a `.claude-plugin/plugin.json` + `skills/{docs-update,bookend,release}` (generalized from Prism's release workflow), so every scaffolded tool is a Prism-image plugin with the release workflow. `discoverPlugin` prefers a colocated `plugins/*` manifest over the project's own root. Pushed (`84f4b28`).

**Remaining external walls (Gavin's one-liners):** `gh release` for fragment-plugin (harness-classifier blocked me); `npm login` → `npm publish create-fragment`.
**TUI click-to-drive** (Go: chat-enter→agent + `plugin.Context` drive handle + mouse hit-testing) is the one documented follow-on from the click-to-drive harvest.
