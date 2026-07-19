---
date: 2026-07-19
author: Claude
topic: "Fragment Layer B audit — create-fragment CLI + templates conformance gaps"
tags: [fragment-sync, audit, layer-b, create-fragment]
status: complete — awaiting Gavin's review before Phase 4 execution
related: [.prism/shared/plans/2026-07-19-fragment-sync.md]
gate: "Phase 4 (Layer B execute) requires Gavin's go AFTER reading this."
---

# Fragment Layer B Audit — `create-fragment` CLI + Templates

Read-only enumeration of every gap between what `create-fragment` emits and the "Prism-image" standard (`cl-plugin-structure` v0.7.2). This is the "see the extent before cutting" report; **Phase 4 executes against it after Gavin's review.**

## Method

Read: `src/commands/connect.ts`, `src/engine/plugin-discovery.ts`, `src/engine/manifest.ts`, `src/engine/generators/electron-glue.ts`. Grepped all of `src/` + `templates/` for `channel|cowork|userConfig` (**zero hits**) and for model/vendor references (spread across surfaces). Listed `templates/{base,core,electron,tui,ui,vscode}/`.

## Gaps (grouped by checklist item)

### B1 · Manifest reader is MCP-only → add `channels`, `userConfig`, `hooks`, `skills`
- `src/engine/plugin-discovery.ts:10-16` — `PluginInfo` has only `name, version, description, mcpServers, pluginDir`.
- `src/engine/plugin-discovery.ts:39-48` — `parsePluginManifest` extracts only `raw.mcpServers`.
- `src/commands/connect.ts:52-53` — reports only `MCP Servers: …`.
**Change:** extend `PluginInfo` + `parsePluginManifest` to read `channels`, `userConfig`, `hooks`, `skills`; surface them in `connect.ts` output and pass to generators.

### B2 · No Cowork awareness
- `src/engine/plugin-discovery.ts:54-60` — `detectSurfaces` hardcodes `['electron','vscode','tui']`.
- `plugins/fragment-plugin/scripts/detect-surfaces.py:15` — same hardcode (Layer A twin).
- Grep `cowork` across `src/`+`templates/` → **0**.
**Change:** Cowork is a *plugin target*, not an `apps/` surface — add awareness at the manifest/emit level (emit a plugin.json that declares nothing Cowork-hostile; document the remote-connector cloud-routing caveat in the emitted README). Do NOT add an `apps/cowork` surface.

### B3 · "Model" means vendor, not Claude tier
- `src/engine/generators/electron-glue.ts:63` — generated glue hardcodes `model: 'claude'`.
- Vendor-switch concept lives in `templates/ui/src/components/ModelSelector.tsx`, `templates/tui/agent/{codex,gemini}.go`, `templates/vscode/src/agents/manager.ts`, `templates/core/src/shared/types.ts` (`ToolCall.model`).
**Change:** introduce Claude model-line awareness (Opus/Sonnet/Haiku + `effort` + `[1m]`) distinct from vendor selection; emitted glue must not hardcode `model:'claude'`. Minimal: stop hardcoding + emit a model-tier field. (See checklist "Model line reference.")

### B4 · No channels wiring (only an in-app event bus)
- Grep `channel` across `src/`+`templates/` → **0**.
- `templates/core/src/bus/event-bus.ts` is a vendor-agnostic *in-app* bus — NOT an MCP channel pushing into Claude's context.
- `src/engine/generators/electron-glue.ts:17-90` — `generateBridge` wires `plugin.mcpServers` only.
**Change:** teach discovery (B1) + generators to wire `channels` (event push). New glue path emitting a channel listener/notifier per declared channel.

### B5 · No routing-table `CLAUDE.md` emitted
- `templates/base/` contains only `gitignore.tmpl`, `package.json.tmpl`, `tsconfig.base.json` — no `CLAUDE.md.tmpl`.
**Change (CONFIRMED in scope — Gavin, 2026-07-19: "every Griot tool is a Prism-image"):** emit a routing-table `CLAUDE.md` **and** a `.prism/`-aware scaffold. Source of the pattern: `cl-plugin-structure/SKILL.md` §"Folder Architecture: The Routing-Table Pattern" + `references/folder-architecture-routing.md` (grounded in `token-optimization-research.md` §3). The `.prism/`-aware scaffold is for ecosystem interconnectivity — every scaffolded tool is born wired into the Prism workflow layer.

### B6 · Vendored `@anthropic-ai/*` deps likely behind
- `templates/electron/package.json.tmpl` + `templates/vscode/package.json.tmpl` carry `@anthropic-ai` deps (grep hits; readiness doc noted `claude-agent-sdk ^0.2.23`).
**Change:** read each template `package.json.tmpl`, bump `@anthropic-ai/*` to current.

### B7 · Version mismatch to reconcile before republish
- Root `package.json` `1.0.0` vs published `create-fragment@1.0.1`.
**Change:** reconcile versions, then (GATED) `npm publish`.

## Suggested Phase 4 execution order

1. **B1** (reader) — everything downstream needs the richer `PluginInfo`.
2. **B3** (model line) — bounded; stop the `model:'claude'` hardcode + add tier field.
3. **B4** (channels) — depends on B1; new glue path.
4. **B2** (Cowork awareness) — manifest/README-level; light.
5. **B6** (deps) — mechanical.
6. **B5** (routing CLAUDE.md + `.prism/` scaffold) — CONFIRMED in scope (every Griot tool is Prism-image).
7. **B7** (version) → **GATED republish**.

## Size read

**Medium-large but bounded.** B1/B3/B6/B7 are surgical and fast. B4 (channels glue) is the real new code — a per-channel emitter across 3 glue generators. B2 is light. B5 (routing `CLAUDE.md` + `.prism/` scaffold) is now confirmed in scope — a new `templates/base/CLAUDE.md.tmpl` + a `.prism/` skeleton in `templates/base/`. No surface needs restructuring; all changes are additive.
