# Changelog

All notable changes to Prism Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [4.5.4] - 2026-07-20

### Changed

- **Release cut to propagate the 4.5.x line to the Desktop marketplace mirror.** The `prism-closing-ceremony` skill (bookend -> docs-update -> release), the strict subscription-only auth resolver (`resolveAnthropicAuth`, `GRIOT_ALLOW_METERED`), the Fable-5 HITL reframe, and the `prism-docs-update` CHANGELOG step all shipped across 4.5.0-4.5.3 but had not been loaded into Claude Desktop's Prism plugin. This version bump + marketplace sync makes the whole line available in Desktop.

## [4.5.3] - 2026-07-20

### Fixed

- **skill-guard no longer false-positives on Fragment scaffold templates** — hand-authored `create-fragment/templates/**` meta-skills (e.g. the `closing-ceremony` meta-skill, which says "Generalized from the Prism … workflow") name-matched the `prism` generator skill and were wrongly blocked. Added a Gavin-approved template allowlist to `~/.claude/hooks/skill-guard/skill_guard.py`.

## [4.5.2] - 2026-07-20

### Added

- **Closing-ceremony meta-skill handed down to Fragment** — `fragment-ai-scaffold` now emits a generalized `closing-ceremony` skill (`templates/base/skills/`) so every scaffolded Griot tool inherits the one-command bookend → docs-update → release wrap-up (parity with Prism's `prism-closing-ceremony`). Fragment's `docs-update` meta-skill also gained the required root `CHANGELOG.md` step. Conformance-checklist **B9** tracks the emitted meta-skill set.

## [4.5.1] - 2026-07-20

### Added

- **`prism-docs-update` now updates the root `CHANGELOG.md`** — the changelog was never touched during a docs/release cycle. The skill now requires a Keep-a-Changelog entry for the version (new Step 7 + rule).

### Fixed

- Backfilled the missing **4.5.0** changelog entry (the 4.5.0 bump shipped without one).

## [4.5.0] - 2026-07-20

**Subscription-native auth across the ecosystem.** (Detailed cycle notes in commits `dd1b0eb` + `36ccf23`.)

### Added

- **`/prism-closing-ceremony` skill** — runs bookend → docs-update → release in one pass, so a release wraps in one command.
- **Strict subscription-first auth** (`resolveAnthropicAuth`, `packages/prism-core`) — the Claude Max subscription OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`) is preferred everywhere; a metered API key is used **only** behind the `GRIOT_ALLOW_METERED` flag, else the request errors. A Griot tool never silently bills the metered API.
- **VS Code extension on subscription auth** — migrated off the metered API-key path onto the OAuth token (Bearer + `oauth-2025-04-20`), with `authMode` observability and a strict fallback policy.

### Changed

- **Fable 5 enabled (HITL-gated), no longer RESERVED** — reframed across `cl-plugin-structure` / `prism-spectrum` model docs + gate copy from "~2.6× metered cost" to "capped weekly Max allowance". Fable stays an opt-in, HITL-gated escalation, never a routing default.
- **Fragment-sync propagates the auth protocol** — `fragment-ai-scaffold` templates now emit the canonical strict resolver (`core/shared/auth.ts`); conformance-checklist **B8** tracks it.

### Fixed

- Mobile always-on daemon confirmed subscription-only (no metered path).

## [4.4.0] - 2026-07-19

**The unification milestone.** One version across the ecosystem — Prism, Fragment, and the tools it scaffolds are all **4.4.0**, the baseline moving forward. Consolidates **P1** (go-sovereign prep) and **P2** (the Claude connector + artifact-popout line, and the Fragment ecosystem it grew into). Full account: `.prism/shared/docs/PRISM-DOCUMENTATION-4.4.0.md`.

### Added

- **`/fragment-sync` skill** — a callable spec→generator conformance bridge that reconciles Fragment (`create-fragment` CLI + `fragment-plugin`) to the current `cl-plugin-structure` standard. `skills/fragment-sync/` + `references/conformance-checklist.md`; the readiness audit is its spec.
- **Fragment: mobile (Expo/EAS) surface** — every Griot tool can now `fragment init --mobile` into a React Native / Expo app that reuses `packages/core` + the DOM-free half of `packages/ui` via a `WebSocketTransport`. First network-transport, native-render surface. (`fragment-ai-scaffold`)
- **Fragment: click-to-drive** — a surface-agnostic `DriveIntent` + `drive()` so a click in any surface (electron / vscode / tui / mobile) advances the agent session — the brainstorm companion's click-to-wake, generalized. Resolved as **direct in-process agent input, not a Claude Code channel** (Fragment apps embed their own agent). electron `app:drive` IPC + preload; vscode `<plugin>.drive` command; per-surface `drive-client` glue.
- **Fragment: Prism-image plugin skeleton + meta-skills** — every scaffolded project emits `.claude-plugin/plugin.json` + `skills/{docs-update,bookend,release}` (generalized from Prism's release workflow), so new tools inherit the docs/version/release workflow. `discoverPlugin` prefers a colocated plugin over the project's own root.
- **P2 · Connector + artifact-popout brainstorm ledger** — one-feature connector whose tools render `ext-apps` popouts; directory-grade (C) target; readiness-gated full-Griot-suite breadth; agent-run **auto / manual / interrupt**; Tasks + elicitation. Plus MCP-Apps-substrate + Desktop-connector research and the Griot-tracks readiness map (Fragment / Valence / Lucid⇄idea_init / ModelMaker).

### Changed

- **Ecosystem version unified to 4.4.0** — Prism, `create-fragment`, and `fragment-plugin` aligned. This is the version baseline moving forward.

### P1 · go-sovereign prep

- **PASEO reference audit** — definitive, categorized rename inventory across the monorepo (wire/protocol seams, env vars, code identifiers, user-visible text, assets, hosted/deployed config), with the dual-accept back-compat seam mapped. Audit only; the rename stays deferred.

## [4.3.1] - 2026-07-17

### Fixed

- **Marketplace `failed_content` root cause: orphan `prism-eval` gitlink untracked** — a mode-160000 submodule entry with no `.gitmodules` (unresolvable by any fetcher) sat in the tree since Jul 7. Claude Desktop logs show every marketplace sync settling `status=failed_content`; the timeline matches the entire stale-package saga (3.9.5's "backend re-indexed metadata but served a stale package" began Jul 8). `git archive` skips gitlinks — which is why `/prism-sideload` zips always worked while marketplace sync failed. The `prism-eval/` directory stays on disk (own repo; remote backup `electron-react-vite-ts-starter#prism-eval-app` @ `7db4497`) and is now gitignored.

### Notes

- Tree-only change; release binaries are unchanged from [v4.3.0](https://github.com/TheDigitalGriot/prism/releases/tag/v4.3.0).

## [4.3.0] - 2026-07-17

**Resilience release** — hardens the three layers behind the 2026-07-17 cloud fail-close incident: hook fail-modes, the release process, and the collaboration protocol. Full account: `.prism/shared/docs/PRISM-DOCUMENTATION-4.3.0.md`.

### Added

- **prism-release Step 1c: clean-tree guard** (MANDATORY) — review `git status --porcelain` before staging; parallel Claude sessions share the working tree and can write into it mid-release (v4.2.0 raced past an uncommitted 5-file fix exactly this way).
- **prism-release Step 2 warning** — never hand-edit `VERSION` before `bump-version.py`; the script keys off it and silently no-ops when it already equals the target (`--set` shares the trap).
- **Hook fail-mode audit** — line-level proof that no hook can environmentally fail-close a session (deliberate denies only); `sh -n` verified on all five. Documented in PRISM-DOCUMENTATION-4.3.0 §2 and the docs-site hooks page ("The POSIX contract").
- **Mid-task interjection protocol** encoded in project + global CLAUDE.md — stop, answer first, integrate, resume on go.

### Fixed

- **CRLF line endings — the true cloud fail-close trigger** (found in Gavin's parallel session): `core.autocrlf=true` checked out `.sh` files with CRLF; cloud sync ships disk bytes verbatim; Linux sh reads `set -o pipefail\r` as an invalid option → exit 2 → PreToolUse DENY. New `.gitattributes` pins `*.sh` + `hooks/hooks.json` to `eol=lf`; index renormalized; working tree re-smudged (0 CR bytes verified). A CRLF-synced POSIX script still dies — 4.2.1's hardening alone was insufficient.
- **hooks.json runner**: `bash ${CLAUDE_PLUGIN_ROOT}/…` → `sh "${CLAUDE_PLUGIN_ROOT}/…"` (POSIX runner, quoted paths).
- **prepare-resources.sh**: installer plugin packaging now includes `hooks/` and `scripts/` (previously missing from resources).

### Changed

- Docs-site hooks page: POSIX contract section replaces the stale "`#!/usr/bin/env bash`" portability claim.

### Housekeeping

- prism-eval embedded repo healed (stale 5-day `index.lock` cleared; `7db4497` pushed to `prism-eval-app`; gitlink updated).
- Adopted: `AGENTS.md`, `.claude/skills/gitnexus/*`, 2026-07-12 semantic-layer plan; `.superpowers/` gitignored; "excellent option" principle landed in CLAUDE.md.

## [4.2.1] - 2026-07-17

### Fixed

- **All 5 sh hook scripts POSIX-hardened** (`spectrum-approval`, `fable-gate`, `detect-changes-gate`, `worktree-setup`, `worktree-cleanup`) — cloud sandboxes run hooks under dash/busybox, where `set -o pipefail` exits 2; the PreToolUse protocol reads non-zero as DENY, and with matcher `""` this **fail-closed every tool in the session** (observed live in Claude Desktop/Cowork cloud). New pattern: `set -eu` + `if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi`, `[[ ]]` → `[ ]`. The fix was authored in a parallel session but sat uncommitted — v4.2.0 shipped without it; 4.2.1 lands it.

### Notes

- Plugin-tree-only change; release binaries are unchanged from v4.2.0.
- Cloud surfaces additionally pinned to a stale-cached "3.9.5" tree (the documented stale-package marketplace bug) — refresh via marketplace re-fetch of 4.2.1 or `/prism-sideload` upload.

## [4.2.0] - 2026-07-17

**Model B is live.** The always-on agent daemon runs on the DO droplet (`digitalgriot-server-tor1`, Coolify resource `prism:main-daemon`), dials the Griot relay from production (`relay_control_connected` verified in container logs, `authRequired: true`), and generates valid pairing offers carrying the droplet's own identity (`srv_-Xi2lw5SY7Zz`).

### Added

- **Droplet daemon deployed** — Coolify Docker Compose resource (base dir `/apps/prism-mobile`, compose `/deploy/docker-compose.yml`, repo `TheDigitalGriot/prism@main`). Speech models auto-download to `/data/models/local-speech` on first boot.
- **RUNBOOK prereqs 0–3** — swap memory (hard requirement on ≤4 GB droplets; first build without it drove load to 145 and knocked the box offline), Claude Max auth, workspace clones, git credentials for private repos.
- **`PRISM-DOCUMENTATION-4.2.0.md`** — resumes the release-doc convention (lapsed after 3.8.0), scoped to this release's delta.
- **`v4.2.0` eval snapshot** — resumes the snapshot convention (lapsed after 3.3.1); skills/agents/commands byte-identical to 4.1.0, noted in `SNAPSHOT-NOTE.md`.

### Fixed

- **Relay endpoint format** — `PASEO_RELAY_ENDPOINT` must be `host:port[/path]` (`prism.digitalgriot.studio:443/relay`); the daemon's `parseHostPort()` throws on scheme URLs (`wss://…`), so the previous deploy values could never dial the relay. TLS auto-derives from `:443`. Fixed in Dockerfile, compose, `.env.example`.
- **Workspace bind-mount** — `/opt/griot-workspace` (host) → `/workspace` (container); was a blank named volume, hiding host-cloned repos from agents.
- **lefthook in-image build failure** — `"prepare": "lefthook install --force"` requires a `.git` dir absent from the build context; dropped container-only via `npm pkg delete scripts.prepare` (postinstall patches + native builds preserved).
- **`@prism/*` workspace links broken since the v4.0.0 repo rename** — all six symlinks pointed at the dead `GriotApps/prism-plugin` path; healed with absolute junctions (surfaced by the Electron daemon-bundle build). A future root `npm install` re-heals npm-natively.

### Changed

- **`PASEO_PASSWORD` enabled** in the droplet compose (via Coolify env) — bcrypt-hashed bearer gate on direct `:6767` connections only; the relay path is governed by offer-link possession + Curve25519/NaCl E2EE (documented in the 2026-07-15 auth-map brainstorm ledger).
- **VSIX packaging** — `engines.vscode ^1.109.0` to match `@types/vscode` (`d204a56`).
- **Docs site** — daemon `surface-connectivity` droplet section updated from aspirational to production state, with the endpoint-format warning.

### Known issues

- **Phone pairing over relay stalls at "connecting"** — daemon-side relay control connection is verified healthy; the phone-side session handshake doesn't complete. Triage open (see 2026-07-17 handoff for suspects and starting greps).
- `scripts/bump-version.py --set X.Y.Z` silently no-ops if root `VERSION` already equals the target — don't hand-edit `VERSION` before running it.

## [4.1.0] - 2026-07-12

*(Entry backfilled at 4.2.0 — this release shipped without a changelog entry.)* Native fused-hybrid semantic layer: codebase-memory C-fork + pro fixes, GitNexus retained in the ensemble. All 10 tasks of the 2026-07-12 plan shipped (`.prism/shared/plans/2026-07-12-native-fused-hybrid-semantic-layer.md`, handoff `db312e7`).

## [4.0.0] - 2026-07-10

Milestone release: the **6-phase workflow** identity (Ideate → Research → Plan → Design → Implement → Validate) plus a first-class **Cowork sideload** path. The major version marks the workflow rebrand and the new plugin-distribution capability — there are no breaking changes to existing skills, agents, or commands.

### Added

- **`/prism-sideload` skill** — packages the plugin's tracked components (`.claude-plugin`, `skills`, `agents`, `commands`, `hooks`, `scripts`) via `git archive HEAD` into a lean, verified zip for Cowork's **Upload plugin** flow, bypassing Cowork's GitHub-sync stale-cache bug. Output lands in gitignored `.prism/local/sideload/`; the build asserts `plugin.json` matches `VERSION` and that there are **zero nested zips** (a nested zip blocks Cowork installs).
- **Cowork Sideload docs page** (`prism-docs/docs/plugin/cowork-sideload.md`, linked in the Part I sidebar) — explains why Cowork serves stale plugin content and how to sideload around it, with links to the tracking issues (#69020, #38185, #45810).

### Notes

- The **Ideate** and **Design** phases in the 6-phase description are **not yet implemented** — the naming establishes the workflow identity; behavior is unchanged from the 4-phase (Research → Plan → Implement → Validate) core.
- Dev-environment record (not a plugin change): the Claude CLI was migrated from a broken npm-global install to the native, nvm-independent standalone install — see `.prism/shared/docs/2026-07-09-claude-cli-nvm-migration.md`.
- VitePress footer synced to v4.0.0 by the post-bump discovery sweep.

## [3.9.6] - 2026-07-08

Second marketplace cache-bust for the `prism-v2-update.zip` untrack, paired with a workflow-description refresh. Anthropic's plugin backend re-indexed the 3.9.5 metadata but kept serving a **stale package** still containing the removed nested zip, which continued to block Cowork/Desktop installs. A fresh commit hash + version forces the backend to re-package the clean tree.

### Changed

- **Plugin descriptions: 4-phase → 6-phase** — `plugin.json` and `marketplace.json` descriptions updated from `4-phase (Research → Plan → Implement → Validate)` to `6-phase (Ideate → Research → Plan → Design → Implement → Validate)`. Text/metadata only — the **Ideate** and **Design** phases are not implemented yet.

### Fixed

- **Stale package still shipping the nested zip** — the backend re-indexed 3.9.5 metadata but continued serving a cached package containing the removed `prism-v2-update.zip`. A new commit hash + version (`3.9.5 → 3.9.6`) forces a clean re-package. Repo confirmed to have **zero tracked zips** (`git ls-files "*.zip"` is empty).

### Notes

- VitePress footer version straggler (`prism-docs/docs/.vitepress/config.ts`) synced to 3.9.6 by the post-bump discovery sweep.
- No functional code change beyond version strings and the two description edits.

## [3.9.5] - 2026-07-08

Marketplace cache-bust for the `prism-v2-update.zip` untrack fix. The 3.9.0 change removed the nested zip from git tracking, but the marketplace kept serving the cached 3.9.0 plugin tree (which still contained the tracked zip) because the version number never changed. Bumping to 3.9.5 forces the marketplace to re-fetch the now-clean tree, so nested zips no longer block Claude Cowork installs.

### Fixed

- **Nested zip blocked Claude Cowork installs** — `.prism/shared/docs/update/prism-v2-update.zip` was tracked by git and shipped inside the plugin tree; Cowork cannot install plugins that contain nested zips. Untracked via `git rm --cached` (file kept on disk, now covered by the existing `*.zip` rule in `.gitignore`) so it no longer enters the packaged tree.
- **Stale marketplace cache** — the untrack landed in 3.9.0 but the marketplace continued serving the cached 3.9.0 tree (still containing the zip) because the version was unchanged. Version bumped `3.9.0 → 3.9.5` to force a clean re-fetch.

### Notes

- Patch-level jump `3.9.0 → 3.9.5` (skipped `3.9.1`–`3.9.4`) to make the new version unmistakably distinct from any cached 3.9.0 copy.
- VitePress footer version straggler (`prism-docs/docs/.vitepress/config.ts`) caught and synced to 3.9.5 by the post-bump discovery sweep.

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
