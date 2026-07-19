# Prism 4.4.0 — The Unification Milestone

**Released:** 2026-07-19 · **Baseline moving forward.**

4.4.0 aligns the whole ecosystem — **Prism**, **Fragment** (`create-fragment` + `fragment-plugin`), and every tool Fragment scaffolds — on **one version**. It consolidates **P1** (go-sovereign prep) and **P2** (the Claude connector + artifact-popout line, and the Fragment ecosystem it grew into). One version, one image, moving forward.

---

## P1 · Go-sovereign prep

**PASEO reference audit** — a definitive, categorized rename inventory across the monorepo, produced as the greenlight artifact for the eventual `paseo → prism` sovereign rename (the rename itself stays deferred; this is the inventory that makes it safe). Categories: wire/protocol-sensitive seams (the `paseo.bearer.<secret>` WS subprotocol, daemon dialect strings — governed by the dual-accept back-compat rule), env vars (`PASEO_*`), code identifiers (`PaseoWebSocketAdapter`, adapter ids, CLI/package names, defaults), user-visible text, visual assets to regenerate, and external/hosted config (Coolify env, EAS/Apple bundle ids). Each item carries file:line, change-vs-generate, risk, and a coordinated-update flag.

## P2 · Claude connector + artifact popout

### Decision ledger (brainstorm)

- **One feature**, not two — a connector whose tools render their own popouts (inline card + fullscreen).
- **Target C · directory-grade**, built once (no staged B→C) — OAuth 2.1, remote HTTPS, review, screenshot carousel in scope.
- **Breadth: full Griot suite via the broker's live registry**, reality-gated (v1 = the 7 broker-wired Tier-1 services; others slot in as their adapters/refreshes land).
- **agent-run: auto · manual · interrupt** (Claude-Code-style) — elicitation (manual) + mode flag (auto) + Tasks-cancel (interrupt).
- **Substrate: `ext-apps` MCP App** (Desktop + web + Cowork; inline + fullscreen).
- **Primitives: Tasks + elicitation** (+ Live-Artifact opportunistically).

Ledger: `.prism/shared/brainstorms/2026-07-19-connector-artifact-popout.md`.

### Research

- **MCP Apps is the confirmed popout substrate** (launched 2026-01-26; renders in Desktop/web/Cowork; inline + fullscreen; no allowlist to render). Claude Code CLI does **not** render MCP Apps — IDE-side popouts remain Prism's own webviews.
- **What Desktop keys on to surface a plugin's MCP server:** being a declared `mcpServers` entry in the installed plugin manifest — not the `channels` binding or `claude/channel` capability.
- **The brainstorm companion's click-to-drive works live in Desktop** via Cowork `show_widget` + `sendPrompt()` (documented surface adapter).
- **Griot tracks readiness** — Fragment (was ~a generation stale, now synced), Valence (v2 complete but stale), Lucid ⇄ idea_init (converging design→asset pipeline; Lucid a migration orphan to relocate into `GriotApps/`), ModelMaker (not local).

Research: `.prism/shared/research/2026-07-18-claude-connector-artifact-popout.md`, `2026-07-19-griot-tracks-readiness.md`.

## Fragment ecosystem (shipped to `TheDigitalGriot/fragment-ai-scaffold` + `fragment-plugin`)

- **`/fragment-sync` skill** (Prism) — a callable spec→generator conformance bridge reconciling Fragment to `cl-plugin-structure`. `skills/fragment-sync/`.
- **Conformance (Layer A/B)** — `color` + "When to invoke" on the connector agent; channels/userConfig in the manifest reader; Cowork awareness; the CLI reader now surfaces channels/userConfig/hooks/skills.
- **Prism-image scaffold** — every project emits a routing-table `CLAUDE.md` + `.prism/` seed.
- **Mobile (Expo/EAS) surface** — `fragment init --mobile`: a React Native / Expo app reusing `packages/core` + the DOM-free half of `packages/ui` through a `WebSocketTransport`. The first network-transport, native-render surface.
- **Click-to-drive** — a surface-agnostic `DriveIntent` + `drive()`: a click in any surface advances the agent session (the brainstorm companion's click-to-wake, generalized) as **direct in-process agent input, not a channel** (Fragment apps embed their own agent). electron IPC + vscode command + per-surface glue.
- **Prism-image plugin skeleton + meta-skills** — every scaffolded project emits `.claude-plugin/plugin.json` + `skills/{docs-update,bookend,release}`, inheriting the release workflow.

Harvests: `.prism/shared/research/2026-07-19-fragment-mobile-harvest.md`, `2026-07-19-click-to-drive-harvest.md`.

## Version baseline

`Prism 4.4.0` · `create-fragment 4.4.0` · `fragment-plugin 4.4.0` — unified. New Griot tools scaffold at the 4.4.0 Prism-image and version forward from here.
