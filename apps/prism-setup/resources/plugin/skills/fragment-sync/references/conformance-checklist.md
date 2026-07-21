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
| B8 | Emitted projects carry the canonical **strict subscription-first auth protocol** — `resolveAnthropicAuth`: `CLAUDE_CODE_OAUTH_TOKEN` wins; metered API key only behind the `GRIOT_ALLOW_METERED` flag, else `none` — so a Griot tool never silently bills the metered API. Surfaces resolve + inject via `authEnv`. Source of truth: Prism `packages/prism-core/src/core/api/auth.ts` | `templates/core/src/shared/auth.ts`; `templates/vscode` + `templates/electron` glue | B |
| B9 | Emitted projects carry the **Prism-image meta-skills** — `bookend`, `docs-update` (incl. root `CHANGELOG.md` update), `release`, and **`closing-ceremony`** (one-pass bookend→docs→release wrap-up) — generalized from Prism's release workflow | `templates/base/skills/{bookend,docs-update,release,closing-ceremony}` | B |

## Model line reference (for B3)

Current tiers per `cl-plugin-structure` model-config: **Opus 4.8** (`model: opus`, routine ceiling), **Sonnet 4.6** (`model: sonnet`), **Haiku 4.5** (`model: haiku`); **Fable 5 is enabled but HITL-gated — never a resting default**, so generated scaffolds must **not** emit `claude-fable-5` in template/agent frontmatter (it's a deliberate, gated escalation, not a routing default). Effort: `low|medium|high|xhigh|max` (Opus 4.7+). `[1m]` suffix opens 1M context.

> **B-layer design note (for the next full `/fragment-sync`):** now that Fable is enabled-but-gated in Prism, decide whether emitted "Prism-image" projects should also scaffold the HITL-gate infrastructure (flag + confirm/deny gate) rather than just omit the model — Gavin's call during the gated Layer-B pass, not assumed here.

## Idempotence

A clean `/fragment-sync` run marks **every** row conformant with a `file:line`. Any row still "gap" means the sync is incomplete — do not report done.
