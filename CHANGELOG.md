# Changelog

All notable changes to Prism Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [3.9.0] - 2026-07-07

Relay pairing landing page + iOS universal links — the offer link now works **end-to-end from anywhere** (was Cloudflare 522). This is the keystone for the always-on droplet: a phone can pair to the daemon by opening a `https://prism.digitalgriot.studio/#offer=…` link.

### Added

- **Pairing landing page** — served from the relay Cloudflare Worker at the apex (`prism.digitalgriot.studio/` and `/pair`). Self-contained HTML reads the `#offer=` fragment client-side and bridges into the app via the `prism://` custom scheme (shows the offer's server + relay endpoint). New `apps/prism-mobile/packages/relay/src/pairing-page.ts`.
- **iOS universal links** — Apple App Site Association served at `/.well-known/apple-app-site-association` (Team `M6K8N36JN8`, bundles `com.thedigitalgriot.prism` + `.debug`); `ios.associatedDomains: ["applinks:prism.digitalgriot.studio"]` added to `app.config.js`. The `https://…/#offer=` link opens the app directly (no browser hop).
- **Droplet offer host** — `PASEO_APP_BASE_URL=https://prism.digitalgriot.studio` in `apps/prism-mobile/deploy/` so the always-on droplet's offers point at the landing page instead of the `app.paseo.sh` default.
- **Standalone `preview` EAS profile** — internal-distribution iOS build (no dev client) for on-device deep-link testing; built and paired on iPhone + iPad.
- **Docs** — `SURFACE-CONNECTIVITY-AND-TESTING.md`, `ANDROID-APP-LINKS-DEFERRED.md`, `EAS-ARCHIVE-AND-EASIGNORE.md` under `.prism/shared/docs/`.

### Fixed

- **Offer link 522 from anywhere** — the relay Worker route was widened `prism.digitalgriot.studio/relay/*` → `/*`, so the offer host (the apex) hits the Worker instead of a missing origin. `handlePairingStaticRoutes` runs before the `/relay` strip, so relay traffic is untouched (tests 13/13). Verified apex `522 → 200`; `/relay/ws` still `400` to a bare GET.

### Notes

- App-side deep-link handling (`OfferLinkListener` in `packages/app/src/app/_layout.tsx`) already shipped — no app change was needed for pairing itself.
- **Android App Links deferred** (Apple-only for now); re-add steps in `.prism/shared/docs/ANDROID-APP-LINKS-DEFERRED.md`.
- `prism-eval` (embedded Electron eval app, 57 files that were uncommitted) backed up to branch `prism-eval-app`; the plugin gitlink now points at the real commit (`200d344`).

## [3.8.0] - 2026-07-03

Daemon `agent-run` handshake fix (the mobile/broker path to `:6767`), first EAS iOS dev builds with per-variant icons, always-on droplet deploy assets, and the Architecture Explorer ported to native VitePress. Bookended `3.7.5 → 3.7.6 → 3.7.7 → 3.8.0`.

### Added

- **Always-on droplet deploy assets** — `apps/prism-mobile/deploy/` (Dockerfile, docker-compose, `.env.example`, RUNBOOK) for running the agent daemon on the DO droplet via Coolify, dialing the same Griot relay (`PASEO_RELAY_ENDPOINT=wss://prism.digitalgriot.studio/relay`).
- **EAS iOS dev builds + per-variant icons** — blue = Prism Debug (`icon-debug.png`), green = Prism (`icon.png`) via `variant.icon` in `app.config.js`; installed on the registered iPhone.
- **Architecture Explorer** — ported to a native themed VitePress component; live at `thedigitalgriot.github.io/prism-plugin/architecture` (GitHub Pages).
- **Docs** — 3.8.0 documentation snapshot + VitePress sync; `daemon/adapters.md` corrected (documented the fictional `welcome` handshake); daemon bring-up validation + verified-state snapshot.

### Fixed

- **Daemon `agent-run` error → ready** (`32dc3a6`) — `PaseoWebSocketAdapter` now dials `/ws` and accepts the daemon's `server_info` status frame (the daemon never sends `welcome`); regression test added. `prism-cli daemon ls` read limit raised to 1 MiB.
- **Tauri installer build** (`5ad2fe4`) — resolved an `E0382` borrow-after-move in the macOS editor-detect path.
- **Release hygiene** — stopped tracking VitePress build output (`dist`/`cache`) so release commits aren't polluted with a stale site build.

## [3.7.5] - 2026-06-29

Design Studio surface online + full Prism rebrand/theme. First-ever run of `apps/prism-design-studio` (the relay that fronts the forked `prism-design-engine`), then a complete "Open Design → Prism Design Studio" rebrand and Griotwave-aligned recolor. Broker `design-gen` now reaches **ready**.

### Added

- **prism-design-studio brought online (first run)** — relay (:7457) → `prism-design-engine` daemon (:7456). Required node 24 (`nvm use 24.11.1`; `better-sqlite3` ABI) + `pnpm install` (3m20s; pnpm self-provisions 10.33.2). Engine serves `/api/skills` (155 skills) → broker `design-gen` flips `error` → **ready**.
- **Griotwave design system** committed to `prism-design-engine` (`design-systems/griotwave/DESIGN.md`) — canonical Griot ecosystem design language (Neural `#3B82F6` primary, dark-first, glassmorphic, ember-bloom motion).
- **Research + plan docs** — `.prism/shared/research/2026-06-29-prism-design-studio-rebrand.md` (branding inventory, the 4-layer accent override system, Griotwave palette map) and `.prism/shared/plans/2026-06-29-design-studio-surface-qa-sweep.md` (surface-consistency sweep).

### Changed

- **Rebrand Open Design → Prism Design Studio** (`prism-design-engine`, branch `feat/prism-rebrand-theme`) — tab title, `app.brand` + `app.brandSubtitle` across 19 locales, the *hardcoded* home-hero wordmark, secondary demo copy (`content.*.ts`, 36→0), and new prism-spectrum logo art (brand-icon / logo / app-icon SVG + regenerated PNG). Functional identifiers (`@open-design/*`, `OD_*`, `od`, `.open-design`) and hosted-service refs ("Share to Open Design" / AMR) left intact.
- **Prism color theme** — primary accent coral `#c96442` → Griotwave **Neural `#3B82F6`** across all four override layers (`tokens.css` ×3 blocks, `appearance.ts` `DEFAULT_ACCENT_COLOR`, the `layout.tsx` pre-hydration script, and the persisted `localStorage` value that was masking the rest). Warm-brown neutrals → cool slate (interim step toward Griotwave Void `#000` / Graphite `#0E0F11`).

### Notes

- `node-pty` loads via prebuilt `win32-x64` binary despite pnpm skipping its build script — not a blocker.
- The rebrand/theme lives in the **`prism-design-engine`** repo on branch `feat/prism-rebrand-theme` (commits `d98a4c23`, `50449153`) — not yet merged to its `main`. The full surface-consistency sweep onto Griotwave tokens is **planned, not done**.

## [3.7.0] - 2026-06-29

Bookend of all work since `v3.6.0` (17 commits). Headline: the interactive Architecture Explorer, broker/daemon substrate expansion, and a full repair + hardening of the VSCode extension surface (which would not load in Cursor / newer-engine editors).

### Added

- **Architecture Explorer** — interactive, deployable site with three views (**Runtime / Workflows / Plugin**), node expansion, and every skill / command / agent / hook / script rendered as its own node; ships via GitHub Pages deploy.
- **`/prism-wiki` command** — generates an architecture wiki from the code-intelligence graph, plus a generated repo overview.
- **AgentRunClient** (`packages/prism-daemon-client`) — brokered agent substrate (full-managed, step 1) for routing agent runs through the daemon broker.
- **Daemon knowledge service** wired to `graphify-mcp` over stdio-MCP.
- **Relay pairing** — relay pairing endpoint + desktop QR-pairing UI for device handoff.
- **VSCode seam-bridge broker forwarder** — the VSCode webview's gRPC client reaches brokered services (code-intel / design-gen / etc.) via `POST :6780/call` when the daemon broker is running (mirror of the Electron side).

### Fixed

- **VSCode extension would not load in Cursor / newer-engine editors** — `apps/prism-vscode` declared `engines.vscode` `^1.109.0` (set at v3.0.0), newer than the editor's VS Code base (e.g. Cursor 2.4.31), so the editor **silently excluded** the extension — Prism was absent from **both** the activity-bar sidebar and the bottom panel. Restored to `^1.84.0`, the last known-good "working ecosystem" value (`3de58aa`). `scripts/bump-version.py` does not manage this field, so it will not regress on a version bump.
- **Blank sidebar / bottom-panel webviews** — providers chose Vite HMR mode from the mere existence of a `.vite-port` / `.vite-panel-port` / `.vite-office-port` file, so a stale file left by a dead dev server routed the webview at a dead `localhost` and rendered blank. Removed stale port files and built the sidebar production bundle. (Tree views are native and were unaffected.)
- **Release version-string drift** — bump script now syncs all version strings (incl. `prism-mobile`) and tracks previously-missed files.

### Changed

- **Webview dev-server detection hardened** — new shared helper `apps/prism-vscode/src/hosts/vscode/viteDevServer.ts` (`resolveLiveViteServer`) does a fast TCP liveness probe of the advertised port before choosing HMR; a stale/dead port falls back to the production build. Wired into `VscodeWebviewProvider`, `PrismPanelProvider`, and `OfficeViewProvider`; base `WebviewProvider.getHtmlContent` widened to `string | Promise<string>`. Preserves HMR, zero added latency when no port file exists.
- **`apps/prism-vscode/.gitignore`** — added `webview-panel/.vite-panel-port` and `webview-office/.vite-office-port` (the sidebar's `.vite-port` was already ignored) so stale dev-server pointers can't be committed.

### Verified (no code change)

- **prism-electron surface** tested end-to-end: `build:daemon` ✓, single window + Vite-served renderer ✓, broker **adopts** the daemon on `:6780` (`/health` → 7 services) ✓, no crash. Electron is **immune** to the VSCode stale-port class — it binds `MAIN_WINDOW_VITE_DEV_SERVER_URL` at build time, not via a runtime port file.

### Notes

- The `Canceled: Canceled` extension-host error seen during VSCode F5, and the Chromium DevTools `Autofill.enable` error in Electron, are host/runtime teardown noise — not Prism faults.
- Investigation record: `.prism/shared/research/2026-06-25-vscode-f5-extension-host-fixes.md`.

## [3.4.0] - 2026-06-03

### Added

- **prism-decompose skill** — Greenfield-style spec decomposition into epic-scoped spectrum work queues; coverage report guarantees zero behavioral requirement drop during chunking. Use before `/prism-spectrum` for large specs.
- **Code intelligence layer foundation** — `prism-plan` now runs graph-based blast-radius analysis (Step 1.5: `trace_call_path` + `search_graph`) and includes a Structural Impact template in plan output. `prism-validate` §3b gains a fourth structural check: cross-service contracts via `search_graph(relationship="HTTP_CALLS")` with graceful skip for single-service codebases.
- **Spectrum CSD-style supervision** — deterministic worker shim paths (`/tmp/claude-spectrum-workers/<story-id>`); PreToolUse approval window (30s auto-approve, filesystem IPC via `.prism/local/spectrum-approvals/`); `VALID_SIGNALS` constant with unknown-signal detection; Controller-Worker Supervision and Signal Vocabulary sections in `prism-spectrum/SKILL.md`.

### Changed

- **Subagent discipline** — `prism-dispatch` and `prism-subagent`: added "NEVER FORWARD PARENT SESSION HISTORY" iron law and Context Isolation section (Superpowers v5.0.2). `prism-subagent` gains a Subagent Role Audit table classifying all dispatched agents as cross-entity role executors (Superpowers v5.0.6: zero demotion candidates found).
- **Worktrees** — `commands/worktree.md` and `prism-finish` updated to reference native `EnterWorktree`/`ExitWorktree` tools (CC ≥ v2.1.154) with git fallback (Superpowers v5.1.0).
- **prism-plan** — No Placeholders Gate added: explicit failure-condition table with iron law prevents `TBD`/empty-criteria plans from exiting the planning phase (Superpowers v5.0.6 writing-plans pattern).
- **Brainstorm engine** (surgical fixes; `server.cjs` unchanged):
  - Wake-path unified: channel POST is now a minimal wake signal; events file remains canonical event log.
  - Multi-session channel routing via session registry (`/register` + `/unregister` endpoints); single-session backward compat preserved.
  - Porter drift fixed: `port-griotwave.cjs` emit regenerated to flat native-variable format; griotwave tokens path updated; `frame-template.html` regenerated from v0.3.0 tokens; `scripts/tests/test_porter_check.sh` invariant test added and wired into `prism-release` validation gate.
  - Pre-v2.1.80 fallback: startup capability probe; passive mode with `/status` endpoint; version requirements in `prism-brainstorm/SKILL.md`.
- **plugin.json** — keywords: + `code-intelligence`, `graph-navigator`, `blast-radius`, `dead-code-detection`.
- **marketplace.json** — description updated to mention code intelligence layer.

### Fixed

- **scripts/bump-version.py** — repo-wide drift detection: post-bump sweep searches for the prior version string (targeted, not broad semver regex); `--strict` mode for release gates; `update_json()` and `update_text()` gain `also_replace` parameter for files stuck at older versions; `Cargo.toml` and `tauri.conf.json` (non-standard spacing) added to explicit file list; `apps/prism-setup/` excluded from sweep (deprecated). The four straggler files (`main.go`, `footer.go`, `PrismState.ts`, `PrismStateContext.tsx`) and five app `package.json` files stuck at `3.3.0` correctly bumped to `3.4.0`.

### Deferred to v3.5

GitNexus dual-index, `scripts/prism-sync-skills.py`, live-stats CLAUDE.md marker injection, `/prism-wiki`, `/prism-reflect`, hybrid BM25 + vector + RRF search.

## [3.3.1] - 2026-06-03
### Fixed
- prism-spectrum: reverted from `opus[1m]` back to `sonnet[1m]` with rationale comment — spectrum is the outer-loop orchestrator, the agents it dispatches carry the deep reasoning load (Karpathy two-tier delegation pattern). Avoids paying opus premium on shepherding work.
- hook-validator schema: updated `validate-hook-schema.sh` to accept both flat (`{ "EventName": [...] }`) and nested (`{ "hooks": { "EventName": [...] } }`) root formats, matching Claude Code's actual behaviour. Also fixes empty-matcher false-positive (empty string `""` is valid — means "match all"), adds missing valid event types (`PostCompact`, `WorktreeCreate`, `WorktreeRemove`, `SubagentStart`), and guards `((counter++))` with `|| true` to prevent premature `set -e` exit on first-error.

## [3.3.0] - 2026-06-03

### Added
- `skills/cl-plugin-structure/` — cl-plugin-structure v0.7.2 bundled as a skill. Includes `references/model-config.md` (current Claude model line, effort levels, ultrathink, 1M context), `references/folder-architecture-routing.md` (Cliefnotes routing-table pattern), `references/token-optimization-research.md` (~51 KB: autoresearch, Attention Residuals, observational memory), `examples/` (3 plugin scaffolds), and `scripts/` (6 validator scripts).
- Routing table added to `CLAUDE.md` — maps 5 core task types to per-task file loads (addresses the "guess-what-to-read" context leak).
- `## Requirements` section added to `README.md` — documents Claude Code v2.1.154+ and Max/Team/Enterprise plan requirements.
- `ultrathink` keyword woven into `prism-brainstorm` (Step 4), `prism-iterate` (Step 2), and `prism-validate` (Iron Law) prompt bodies.
- 9 existing skills cross-linked to cl-plugin-structure references (folder-architecture-routing, component-patterns, hook-events, validators, token-optimization-research, examples, cowork-compatibility, model-config).

### Changed
- Opus pin updated: `claude-opus-4-6` → `claude-opus-4-8` in `apps/prism-vscode/src/core/api/claude-sdk.ts` and `skills/prism-eval/references/eval-schemas.md`.
- `effort: xhigh` added to 6 heavy-reasoning skills: `prism-brainstorm`, `prism-iterate`, `prism-plan`, `prism-prd`, `prism-design`, `prism-subagent`.
- `prism-spectrum` model changed `sonnet` → `opus[1m]` for autonomous multi-story execution with full 1M context window.
- Plugin version bumped 3.2.1 → 3.3.0 in `plugin.json` and `marketplace.json`.

### Notes
- After merging: run `/prism-release` to build VSIX, CLI binaries, and create the GitHub release tag v3.3.0.
- Do NOT run `/prism-bookend` — it re-analyzes and re-suggests a version bump, conflicting with the bump applied here.

## [2.4.1] - 2026-03-05

### Added
- Chat agent working
- Version display in VSCode panel StatusBar and Electron BottomStatusBar
- `prism-release` skill for automated version bumping across all version files

### Fixed
- Stale hardcoded version in CLI TUI footer (was v1.9.8)
- Stale version defaults in prism-core/prism-ui state (was 2.1.8)

## [2.0.0] - 2026-02-10

### Changed
- **BREAKING**: Renamed `ralph` namespace to `spectrum` across all skills, commands, agents, and scripts
- **BREAKING**: Migrated directory structure from `thoughts/` to `.prism/` with separated concerns
- **BREAKING**: Separated `stories.json` into `.prism/stories/` (task definitions) from execution state in `.prism/shared/spectrum/` (progress.md)
- Renamed `cmd/ralph-tui/` to `cmd/prism-cli/`
- Renamed `scripts/ralph.sh` to `scripts/spectrum.sh`
- Renamed `init_thoughts.py` to `init_prism.py`
- Renamed `thoughts-analyzer` agent to `prism-analyzer`
- Renamed `thoughts-locator` agent to `prism-locator`
- Updated all skill YAML frontmatter and cross-references
- Updated README with Spectrum branding and new directory structure
- Updated `.gitignore` for new build paths and prism-cli artifacts
- Updated GitHub workflow for prism-cli release builds

### Added
- `/prism-dir-update` command for migrating existing projects from `thoughts/` to `.prism/`
- Prism CLI with multi-screen dashboard, 3D prism rendering (FauxGL), spring physics animation (harmonica), 7 render views, story pagination, and demo mode
- `.prism/shared/ref/` and `.prism/shared/docs/` directories for reference materials and documentation
- `.prism/local/ref/` and `.prism/local/docs/` directories for personal (gitignored) artifacts

### Removed
- Legacy `thoughts/` directory structure
- All `ralph` naming from active codebase
