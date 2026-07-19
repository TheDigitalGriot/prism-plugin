# Fragment Conformance Checklist

The concrete, item-by-item spec `/fragment-sync` diffs against. Distilled from the last full audit (`.prism/shared/research/2026-07-19-griot-tracks-readiness.md` §3–§4). **Update this file whenever `cl-plugin-structure` gains a new capability** — this checklist is the skill's memory of "what current means."

Each item: what current `cl-plugin-structure` requires · where Fragment must reflect it · Layer.

## A · `fragment-plugin` (the plugin itself)

| # | Requirement (cl-plugin-structure) | Fragment target | Layer |
|---|---|---|---|
| A1 | Agent frontmatter **`color` is REQUIRED** (+ `model`) | `agents/connector-agent.md` frontmatter | A |
| A2 | Agents declare a **"When to invoke"** section (2–4 trigger scenarios) | `agents/connector-agent.md` body | A |
| A3 | Manifest-reading vocabulary includes **`channels`** and **`userConfig`** (not just MCP servers / skills / hooks) | `skills/fragment-connect/SKILL.md` step 2; `scripts/detect-surfaces.py` | A |
| A4 | **Cowork** is a first-class surface/target awareness (remote-connector cloud-routing caveat; Customize-menu install) | `scripts/detect-surfaces.py`; fragment-connect guidance | A |
| A5 | `claude plugin validate .` is a **completion gate** | run against `plugins/fragment-plugin/` | A |
| A6 | Plugin currency: submodule tracks its own remote `main` | `git submodule` pin (GATED) | A |
| A7 | Marketplace manifest schema-compliant (`description` in `metadata`, no `$schema`, no stray root keys) | `.claude-plugin/marketplace.json` — verify (was compliant) | A |

## B · `create-fragment` (the generator + what it emits)

| # | Requirement | Fragment target | Layer |
|---|---|---|---|
| B1 | Emitted manifests + the CLI's reader carry **`channels`, `userConfig`, `hooks`, `skills`** (not only `mcpServers`) | `src/engine/plugin-discovery.ts` (`PluginInfo`, `parsePluginManifest`) | B |
| B2 | **Cowork** as an emittable/aware target | `src/engine/plugin-discovery.ts` `detectSurfaces`; templates | B |
| B3 | Emitted projects use the **current Claude model line** — Opus/Sonnet/Haiku tiers, `effort` levels, `[1m]` context — not vendor-only (`claude`/`codex`/`gemini`) switching | `templates/*`, `src/engine/generators/*-glue.ts` | B |
| B4 | Emitted plugins can wire **channels** (event push into Claude), not just an in-app event bus | `templates/*`, glue generators | B |
| B5 | Emit a **routing-table `CLAUDE.md`** + a **`.prism/`-aware scaffold** — REQUIRED (every Griot tool is Prism-image). Pattern source: `cl-plugin-structure` §"Folder Architecture: The Routing-Table Pattern" + `references/folder-architecture-routing.md` | `templates/base/CLAUDE.md.tmpl`, `templates/base/.prism/` | B |
| B6 | Vendored `@anthropic-ai/*` deps current (was `claude-agent-sdk ^0.2.23`) | template `package.json.tmpl` files | B |
| B7 | CLI/root **version reconciled** (root `1.0.0` vs published CLI `1.0.1`) before any republish | `package.json` files | B |

## Model line reference (for B3)

Current tiers per `cl-plugin-structure` model-config: **Opus 4.8** (`model: opus`, ceiling), **Sonnet 4.6** (`model: sonnet`), **Haiku 4.5** (`model: haiku`); **Fable 5 is RESERVED / NOT ENABLED** — do not emit `claude-fable-5`. Effort: `low|medium|high|xhigh|max` (Opus 4.7+). `[1m]` suffix opens 1M context.

## Idempotence

A clean `/fragment-sync` run marks **every** row conformant with a `file:line`. Any row still "gap" means the sync is incomplete — do not report done.
