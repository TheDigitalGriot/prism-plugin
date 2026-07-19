---
date: 2026-07-19
researcher: Claude
git_commit: a0923b51305a1d085965ffea80de2716f9407592
branch: main
topic: "Griot tracks & Fragment — readiness for connector exposure (Tier-2 scoping)"
tags: [readiness, connector, fragment, valence, lucid, idea_init, modelmaker, griot-tracks, cl-plugin-structure]
status: complete
related: [2026-07-18-claude-connector-artifact-popout.md, .prism/local/brainstorm/1399-1784445402]
---

# Griot Tracks & Fragment — Readiness for Connector Exposure

## Why this exists

The connector + artifact-popout brainstorm (`.prism/local/brainstorm/1399-1784445402`) locked **Q3 = C · readiness-gated**: expose the full Griot breadth, but only what's actually *ready*, letting maturing tools slot into the broker's live registry as their adapters land. That decision only works if we know each track's real state. This doc is that readiness map — Fragment plus the Valence / Lucid⇄idea_init / ModelMaker tracks Gavin flagged. Two parallel research passes (2026-07-19) produced it. Documentation only — describes what exists.

## Readiness matrix

| Track | What it is | State (as of 2026-07-19) | Exposure readiness |
|---|---|---|---|
| **Tier-1 spine (7 svcs)** | broker-wired services | ready (fronted by `:6780`) | **v1 core** — expose now |
| **Lucid (3d-gen)** | asset gen — Remotion + 3D (ComfyUI) + slides | active v1.2; **already wired** as Prism `3d-gen` (`:7520`/cloud) | **already in Tier-1** via `3d-gen`; canonical repo external |
| **Fragment** | `create-fragment` scaffolder + `fragment-plugin` | **frozen ~Apr 2026**, ~a full standard-gen behind | **blocked** — needs `/fragment-sync` before exposure |
| **Valence** | AI agent observability & orchestration | v2 functionally complete but **stale (last commit 2026-03-31)**; refresh-eval | **hold** — until refresh lands |
| **idea_init** | design-intent front end (capture→Griotwave→`design_prompt.yaml`) | **seed bundle only** — not yet scaffolded | **far** — doesn't exist as running code yet |
| **ModelMaker** | (unknown) | **not found in any local repo** | **out of scope** until it materializes locally |

## Per-track detail

### Fragment — blocked, needs `/fragment-sync` first
Two coupled artifacts: **`create-fragment`** (npm CLI, `init|add|connect`, scaffolds Electron/VSCode/TUI surfaces) + **`fragment-plugin`** (GitHub `TheDigitalGriot/fragment-plugin`; skills `/fragment`, `/fragment-connect`, `/fragment-status`; explicitly downstream of `/cl-plugin-structure`). Fragment is the *generator* that should emit "Prism-image" projects — **not** itself Prism's EAS/mobile or Cowork surfaces.

- **Freshness:** local last commit **2026-04-08**; only later event a **2026-05-02** npm republish (`create-fragment@1.0.1`) of the April code. **~3.5 months cold.** GitHub `fragment-plugin` manifest says 1.5.0 but only a `v0.0.1` release exists; the local submodule is pinned behind its own remote (missing the `/fragment` skill).
- **Staleness vs `cl-plugin-structure` v0.7.2 / Prism v4.3.1:** repo-wide grep found **zero** occurrences of `cowork`, `channel`, `userConfig`, `CLAUDE_PLUGIN_DATA`, model tiers/`effort`/`[1m]`, or `routing-table`. Missing the now-**required** agent `color` field. No `hooks/`, `.mcp.json`, `settings.json`/`.local.md`, output-styles, or validator gate. One bright spot: `marketplace.json` is schema-compliant. **Verdict: ~a full standard-generation behind.**
- **Re-sync = two layers:** (A) conform `fragment-plugin` to `cl-plugin-structure` (add `color`, cut a real release, re-pin submodule, teach manifest-reading about channels/userConfig); (B) update `create-fragment` templates so emitted projects are Prism-image (channels, Cowork awareness, current model line, optional routing-table `CLAUDE.md`).
- **Connector-exposure note:** wrapping `fragment`'s verbs behind an MCP server is net-new (no `.mcp.json` today). **Cowork constraint:** cloud sessions can't write to local disk — a Fragment connector must run **local-stdio** (scaffold on-machine) or emit a **downloadable artifact/git repo**. And re-sync must precede exposure, or it faithfully scaffolds stale projects.

### Valence — hold (mature but stale, refresh pending)
`valence-context-platform` — AI **agent observability & orchestration**; CONTEXT.md calls it the "Main strategic project," ecosystem-viz the flagship **Observe** tool.
- **v2 (active):** a **Superset fork** (Electron + tRPC): desktop/api/streams/mobile/web/docs apps; `@valence/observability` + `@valence/adapters` (Claude Code / Codex / Cursor); Postgres/Drizzle + SQLite local-first; **35+ tRPC routers**; **Neo4j** (context graphs) + **ClickHouse** (traces); Bun + Turborepo; Elastic License 2.0.
- **v1 (archived):** `agentlens` — a Langfuse fork; ported into v2 during Phases C–F.
- **State:** README marks all phases **Done**, but **last commit 2026-03-31** (~3.5 months) — consistent with the refresh-eval framing; no in-repo refresh doc yet (decision is external/current). → **Hold** per brainstorm Q3 until the refresh lands.

### Lucid ⇄ idea_init — a converging design→asset pipeline (early)
Documented as a pair per steering: the **front and back of one pipeline consolidating**.
- **Lucid (back):** agentic **asset creation** — Remotion video + 3D (ComfyUI) + slide/design exports. **Canonical repo is external** (`Developer/lucid-ai-gen/`, v1.2, active) — **absent from GriotApps**. Surfaces locally as: the Prism **`3d-gen`** service (`services.config.json`: `:7520` local / `https://3d.prism.digitalgriot.studio` cloud, VRAM-gate ≥24GB) and research/roadmap docs. **Implication: Lucid's asset backend is *already* reachable through the connector via the Tier-1 `3d-gen` service** — no new work for that slice.
- **idea_init (front):** a **design-intent** pipeline — capture UX/UI refs → triage → translate to **Griotwave** → emit `design_prompt.yaml` for Claude Design. **Seed bundle only** (curated 2026-06-03), built via `npm create fragment idea-init`; the designated **first engine-built app** and pilot for the "Fragment refactor" archetype, sequenced **after v3.4.0 + the Fragment refactor**. Contains a **snapshot of Prism's `prism-brainstorm` engine**. Linked in `prism-brainstorm/SKILL.md` as the `idea_init → emit → design_prompt.yaml → Claude Design` path.
- **Convergence:** idea_init's structured design intent feeds forward into Lucid's asset generation (extending the existing `lucidHandoff.ts` brand→asset handoff). **Early/forming** — not yet one codebase, no dedicated convergence doc; a directional decision grounded in the artifacts. (Note: ecosystem-viz has a "Convergence" section, but it's a *different* idea — a naming collision, not evidence of this merge.)

### ModelMaker — not locally tracked
Ripgrep for `[Mm]odel[ -]?[Mm]aker` across **all of `GriotApps`** → **no files**. Absent from Prism, idea_init, DigitalGriotStudios, griot-hub, ecosystem-viz, and `.prism`. Known only from **Cowork research-intake session titles** ("Model Maker app architecture research", "Modelmaker Research Intake Read"). → **Out of connector scope** until it materializes as a local track (would require pulling the Cowork intake sessions).

## Cross-cutting findings

1. **`/fragment-sync` is a keystone, not a side-quest.** It unblocks Fragment's connector exposure **and** idea_init (which is *built by* `create-fragment`). The existing roadmap sequence (`v3.4.0 → Fragment refactor → idea_init`) already implies it. Its spec = the Fragment staleness diff above.
2. **Lucid is already half-exposed.** The `3d-gen` Tier-1 service is Lucid's runtime hook — so "expose Lucid" is largely done for v1; the idea_init front and the convergence are roadmap, not v1 targets.
3. **The `readiness-gated` decision holds up empirically.** Of the Tier-2 candidates, only Fragment (post-sync) is near-term; Valence is held, idea_init is pre-build, ModelMaker is absent. v1 core stays the 7 broker-wired services; Tier-2 slots in via the registry as each matures.
4. **Two external/invisible dependencies to flag for the plan:** Lucid's canonical repo lives outside `GriotApps` (`Developer/lucid-ai-gen/`) — **⚠️ per Gavin (2026-07-19): this is a MIGRATION ORPHAN. Lucid was left behind in `Developer/` during a large migration and should be relocated into `GriotApps/`** (housekeeping task; check `griot-ecosystem-viz` `location:` refs after moving) — and ModelMaker exists only in Cowork; neither is scannable from the GriotApps set today.

## Implications for the P2 connector (feeds the plan phase)

- **v1 exposure = Tier-1 spine** (incl. Lucid via `3d-gen`), agent-run gated (auto/manual/interrupt). Unchanged by this research — confirmed safe.
- **Fast-follow order:** `/fragment-sync` → expose Fragment (scaffold-a-plugin tool, local-stdio or artifact-emitting) → idea_init once scaffolded → Valence once refreshed.
- **Explicitly out of v1:** ModelMaker (absent), idea_init (unbuilt), Valence (stale), un-synced Fragment.

## Sources

- Fragment assessment: GitHub `TheDigitalGriot/fragment-plugin`, `npm view create-fragment`, `c:\Users\digit\GriotApps\fragment-ai-scaffold`, vs `Prism/skills/cl-plugin-structure/SKILL.md` (v0.7.2) + `Prism/.claude-plugin/plugin.json` (v4.3.1)
- Tracks: `valence-context-platform/` (README, planning docs, git log); `Prism/packages/prism-daemon/services.config.json`; `Prism/.prism/shared/research/2026-04-11-griot-ecosystem-knowledge-architecture.md`; `griot-ecosystem-viz/src/data/ecosystem.ts`; `idea_init/README.md`; `Prism/skills/prism-brainstorm/SKILL.md` + `references/design-sources.md`; `GriotApps/CONTEXT.md`; `DIGITAL-GRIOT-STUDIOS-ROADMAP.md`
- Brainstorm ledger: `.prism/local/brainstorm/1399-1784445402/state/decisions.json`
