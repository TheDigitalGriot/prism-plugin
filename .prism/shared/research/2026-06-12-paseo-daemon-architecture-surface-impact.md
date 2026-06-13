---
date: 2026-06-12
researcher: Claude (prism-research)
topic: "Paseo .sh-style EAS mobile daemon architecture & its impact on Prism CLI/VSCode/Electron surfaces"
status: complete
last_updated: 2026-06-12
tags: [paseo, daemon, websocket, expo, eas, mobile, architecture, cli, vscode, electron, relay]
sources:
  fork: "C:/Users/digit/Developer/paseo"            # tested baseline, last commit 2026-05-13, v0.1.69 — DO NOT MODIFY
  fresh_upstream: "C:/Users/digit/Developer/paseo-upstream"  # cloned 2026-06-12 from getpaseo/paseo, v0.1.95
---

# Paseo Daemon Architecture & Prism Surface Impact

## Research Question

1. How does the paseo fork (`~/Developer/paseo`) implement its ".sh-style EAS mobile daemon" architecture?
2. How would those paseo-influenced patterns affect the existing Prism **CLI**, **VSCode**, and **Electron** surfaces?
3. What, if anything, has changed in upstream paseo since the fork was taken (~1 month ago)?

> Scope note: This is a documentary map of what exists in paseo and how it structurally corresponds to Prism's surfaces. It does not prescribe whether Prism should adopt the model — those are your calls.

## Summary

Paseo is a **daemon-centric, hub-and-spoke** system: a single local Node.js **daemon** (`packages/server`, default `127.0.0.1:6767`) owns all agent lifecycle and state, and every surface — **CLI** (Commander), **Electron desktop**, and **Expo mobile/web** — is a **thin client** that speaks one binary-multiplexed **WebSocket protocol** to it. The mobile app, desktop app, and web app are a **single Expo codebase** compiled to four targets (iOS, Android, browser-web, Electron-web) via Metro platform-extension resolution. "EAS mobile" is the Expo Application Services build/submit pipeline that ships that one codebase to the App Store / Play Store. The ".sh style" is a thin shell layer (`scripts/dev.sh` + Windows `scripts/dev.ps1`) that resolves a home dir + ports and co-supervises `daemon + metro`.

The fork (`~/Developer/paseo`) is already **partially rebranded into Prism mobile** — `packages/app/app.config.js` declares `name: "Prism"`, `slug: "prism-mobile"`, `scheme: "prism"`, `com.thedigitalgriot.prism`, and its own EAS project — so it is effectively the **prism-mobile seed**, not a vanilla paseo mirror.

The core architectural consequence for Prism's three existing surfaces: paseo's model replaces Prism's current **file-coordination** (surfaces independently read `stories.json` / `.prism/shared/`) with **runtime-coordination** (surfaces subscribe to a daemon over a wire protocol). Each surface's impact is mapped in Part 2.

---

# Part 1 — How Paseo Does It

## 1.1 The daemon-centric model (hub-and-spoke)

From [docs/architecture.md](../../../../paseo/docs/architecture.md):

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Mobile App │    │     CLI     │    │ Desktop App │
│   (Expo)    │    │ (Commander) │    │ (Electron)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │  WebSocket        │  WebSocket       │  Managed subprocess
       │  (direct/relay)   │  (direct)        │  + WebSocket
       └───────────┬───────┴──────────────────┘
              ┌─────▼─────┐
              │   Daemon  │  packages/server  (Node.js, :6767)
              └─────┬─────┘
        ┌───────────┼───────────┐
   ┌────▼───┐  ┌────▼───┐  ┌────▼─────┐
   │ Claude │  │ Codex  │  │ OpenCode │   provider adapters
   └────────┘  └────────┘  └──────────┘
```

The daemon is the **single source of truth**. Clients never touch agent processes directly — they observe and command through the daemon. "Your code never leaves your machine" because the daemon runs locally and clients are views over it.

Daemon responsibilities (`packages/server`):
- Spawn/manage agent processes (Claude Code, Codex, OpenCode)
- Expose the WebSocket API to clients
- Stream agent output in real time via an append-only **timeline** model
- Host an **MCP server** so agents can spawn/control sub-agents
- Optionally dial **outbound** to a relay for remote access

Key daemon modules ([docs/architecture.md](../../../../paseo/docs/architecture.md) §`packages/server`):

| Module | Responsibility |
|---|---|
| `bootstrap.ts` | Daemon init: HTTP server, WS server, agent manager, storage, relay |
| `server/websocket-server.ts` | Connection mgmt, hello/welcome handshake, binary multiplexing |
| `session.ts` | Per-client session state, timeline subscriptions, terminal ops, `session.supports(cap)` |
| `agent/agent-manager.ts` | Agent lifecycle state machine, timeline tracking, subscribers |
| `agent/agent-storage.ts` | File-backed JSON at `$PASEO_HOME/agents/` |
| `agent/mcp-server.ts` | MCP server for sub-agent creation/permissions/timeouts |
| `providers/` | Claude (Agent SDK), Codex (AppServer), OpenCode adapters |
| `relay-transport.ts` | Outbound relay connection with E2E encryption |
| `client/daemon-client.ts` | **Shared client library** used by CLI + app (see 1.3) |

State lives at `$PASEO_HOME/` — `agents/{cwd-with-dashes}/{agent-id}.json`, `projects/projects.json`, `projects/workspaces.json`, `daemon.log`.

## 1.2 The ".sh-style" orchestration layer

There is **no compiled supervisor** — daemon startup is shell orchestration with per-OS variants.

- [paseo.json](../../../../paseo/paseo.json) declares the daemon as a long-lived **service**: `scripts.daemon.command = "PASEO_LISTEN=0.0.0.0:$PASEO_PORT ./scripts/dev-daemon.sh"`.
- [scripts/dev.sh](../../../../paseo/scripts/dev.sh): sources `dev-home.sh` → `configure_dev_paseo_home`, then uses **`concurrently`** to co-launch two named services: `daemon` (`./scripts/dev-daemon.sh`) and `metro` (`expo start`). Uses **`portless`** to assign URLs/ports for daemon + app.
- [scripts/dev-daemon.sh](../../../../paseo/scripts/dev-daemon.sh): sets `PASEO_CORS_ORIGINS`, `PASEO_NODE_INSPECT`, then `exec npm run dev:server` (the `@thedigitalgriot/server` workspace).
- [scripts/dev.ps1](../../../../paseo/scripts/dev.ps1): the **Windows-native equivalent**. Derives `PASEO_HOME` (stable per-worktree name, else a temp dir with exit-cleanup), pre-builds the daemon's `highlight` + `relay` dependencies (they ship only `dist/`), then `concurrently` runs `npm run dev:server` + `expo start` on `localhost:6767`.

Takeaway: "paseo .sh style" = **a thin shell layer that (a) resolves a per-environment home dir, (b) assigns ports, and (c) co-supervises daemon + client process(es)** — with a bash variant and a PowerShell variant rather than one cross-platform binary. The Windows path is first-class (relevant: Prism is Windows-centric).

## 1.3 The shared daemon-client (what makes thin clients possible)

`packages/server/src/client/` is the **reusable connection library** consumed by *both* the CLI and the Expo app. It is large (`daemon-client.ts` ≈ 143 KB) and split into transport layers:

| File | Role |
|---|---|
| `daemon-client.ts` | High-level client API (connect, subscribe, command/response) |
| `daemon-client-transport.ts` | Transport abstraction |
| `daemon-client-websocket-transport.ts` | Direct WebSocket transport |
| `daemon-client-relay-e2ee-transport.ts` | Encrypted relay transport |
| `daemon-client-transport-types.ts` / `-utils.ts` | Shared transport types/helpers |
| `terminal-stream-router.ts` | Routes binary terminal channel |
| `daemon-client-runtime-metrics.ts` | Client-side metrics |

This is the linchpin of the architecture: a surface becomes a "thin client" simply by importing this library and rendering the timeline it streams. Transport is pluggable (direct WS vs E2EE relay) behind one API.

## 1.4 WebSocket protocol + compatibility discipline

All clients speak one **binary-multiplexed** protocol ([docs/architecture.md](../../../../paseo/docs/architecture.md) §WebSocket protocol):

- **Handshake**: `WSHelloMessage { id, clientId, version, timestamp }` → `WSWelcomeMessage { clientId, daemonVersion, sessionId, capabilities }`.
- **Push message types**: `agent_update`, `agent_stream`, `workspace_update`, `agent_permission_request`, plus command/response pairs (fetch/list/create).
- **Binary multiplexing** (`BinaryMuxFrame`): channel 0 = control, channel 1 = terminal data, framed as `1-byte channel ID + 1-byte flags + payload`.

**Compatibility is a hard rule** (from both [CLAUDE.md](../../../../paseo/CLAUDE.md) and [docs/architecture.md](../../../../paseo/docs/architecture.md)):
- Schemas are **append-only**: add fields, never remove, never make optional→required, never narrow types.
- New wire enum values are gated at serialization with `session.supports(CLIENT_CAPS.someCapability)`.
- `Session` stores client capabilities from the `hello` handshake and rehydrates on reconnect, so the wire boundary asks one question: `session.supports(...)`.
- Design test: *"does a 6-month-old client still parse this, and does a 6-month-old daemon still send something this client accepts?"*

This discipline exists because **old mobile clients talk to newly-updated daemons** (users update desktop/daemon first, keep the old app for a while).

## 1.5 Agent providers + lifecycle

Each provider implements a common `AgentClient` interface; the daemon normalizes everything:

| Provider | Wraps | Session format |
|---|---|---|
| Claude | Anthropic Agent SDK | `~/.claude/projects/{cwd}/{session-id}.jsonl` |
| Codex | CodexAppServer | `~/.codex/sessions/{date}/rollout-{ts}-{id}.jsonl` |
| OpenCode | OpenCode CLI | provider-managed |

Lifecycle: `initializing → idle → running → idle (loop) / error → closed`. The `AgentManager` keeps ≤200 timeline items/agent, append-only with **epochs** (new run = new epoch), broadcast to all subscribers. Tool calls normalize to a `ToolCallDetail` union (shell/read/edit/write/search…). Permission requests flow round-trip: **agent → server → client → user decision → server → agent**. Providers handle their own auth — paseo manages no API keys.

## 1.6 The relay (remote access without open ports)

`packages/relay` ([docs/architecture.md](../../../../paseo/docs/architecture.md) §relay, `packages/relay/src/`):
- ECDH key exchange + AES-256-GCM (`crypto.ts`, `e2ee.ts`, `encrypted-channel.ts`).
- Relay server is **zero-knowledge** — routes encrypted bytes, can't read content (`cloudflare-adapter.ts` runs it on Cloudflare Workers).
- Symmetric `createClientChannel` / `createDaemonChannel`.
- **Pairing via QR code** transfers the daemon's public key to the client (this is why the CLI/app show a QR on start).

This is how a phone on cellular reaches a daemon behind a home firewall without port-forwarding.

## 1.7 One Expo codebase → four targets (platform gating)

`packages/app` is a single React Native / Expo project that renders on **iOS, Android, browser-web, and Electron-web**. Two mechanisms ([CLAUDE.md](../../../../paseo/CLAUDE.md) §Platform gating):

1. **Metro file-extension resolution** (compile-time, preferred): `foo.web.ts` / `foo.native.ts` / `foo.electron.tsx`. Electron is the Metro **web** platform but desktop build sets `PASEO_WEB_PLATFORM=electron`, so Metro prefers `.electron.*` then falls back to `.web.*`. Unused platform code is never bundled.
2. **Four runtime gates**: `isWeb` (DOM APIs), `isNative` (haptics/push/camera), `getIsElectron()` (desktop bridge: file dialogs, titlebar, daemon mgmt, updates), `useIsCompactFormFactor()` (phone vs tablet/desktop **layout**, decoupled from platform).

Navigation is **Expo Router** (`/h/[serverId]/agents`, `/h/[serverId]/workspace/[workspaceId]`). `DaemonRegistryContext` holds saved daemon connections; `SessionContext` wraps the daemon client for the active session; a `Stream` model handles timeline compaction, gap detection, and sequence-based dedup.

## 1.8 The EAS mobile pipeline (the "EAS" in "EAS mobile daemon")

App identity is variant-driven by `APP_VARIANT` in [packages/app/app.config.js](../../../../paseo/packages/app/app.config.js) — *already Prism-branded in the fork*:

| Variant | App name | Package ID | EAS channel |
|---|---|---|---|
| `production` | Prism | `com.thedigitalgriot.prism` | `production` |
| `development` | Prism Debug | `com.thedigitalgriot.prism.debug` | `development` |

[packages/app/eas.json](../../../../paseo/packages/app/eas.json) defines build profiles `development` (dev client, internal dist), `production` (store), and `production-apk` (internal APK). [packages/app/.eas/workflows/release-mobile.yml](../../../../paseo/packages/app/.eas/workflows/release-mobile.yml) is an **EAS Workflow** that runs **on Expo's servers** on `v*` tag push (excluding rc/beta): build iOS + Android → submit to both stores → fastlane "submit for App Store review."

Two build paths ([docs/android.md](../../../../paseo/docs/android.md)):
- **Local**: `npm run android:development|production` → `expo prebuild` + `expo run:android`.
- **Cloud (EAS)**: stable tags trigger `release-mobile.yml` (Expo) + `.github/workflows/android-apk-release.yml` (GitHub APK asset). Beta tags trigger only the GitHub APK workflow.

Notable mobile config: `newArchEnabled: true`, React Compiler + typed routes experiments, `expo-camera` (QR pairing), `expo-notifications`, `expo-audio` (voice), `usesCleartextTraffic: true` (so a release build can reach a `http://localhost`/LAN daemon).

## Files Discovered (paseo)

| Path | What it is |
|---|---|
| [docs/architecture.md](../../../../paseo/docs/architecture.md) | System design, package layering, WS protocol, lifecycle, data flow |
| [CLAUDE.md](../../../../paseo/CLAUDE.md) | Repo map, platform gating rules, WS compatibility rules |
| [paseo.json](../../../../paseo/paseo.json) | Worktree setup + service script declarations (daemon as service) |
| [scripts/dev.sh](../../../../paseo/scripts/dev.sh) · [dev-daemon.sh](../../../../paseo/scripts/dev-daemon.sh) · [dev.ps1](../../../../paseo/scripts/dev.ps1) | `.sh`/`.ps1` daemon+metro orchestration |
| `packages/server/src/client/` | Shared daemon-client library (transport-pluggable) |
| `packages/server/src/{server,agent,providers,services,terminal}` | Daemon internals |
| `packages/cli/src/{cli.ts,commands/}` | Commander CLI (agent/daemon/permit/provider/worktree/loop/chat/speech/terminal/schedule) |
| `packages/desktop/src/daemon/` | Electron daemon mgmt (`daemon-manager.ts` ≈20KB, `local-transport.ts`, `node-entrypoint-launcher.ts`, `runtime-paths.ts`) |
| `packages/relay/src/` | E2EE relay (`crypto.ts`, `e2ee.ts`, `encrypted-channel.ts`, `cloudflare-adapter.ts`) |
| [packages/app/app.config.js](../../../../paseo/packages/app/app.config.js) · [eas.json](../../../../paseo/packages/app/eas.json) · [.eas/workflows/release-mobile.yml](../../../../paseo/packages/app/.eas/workflows/release-mobile.yml) | Expo + EAS mobile pipeline (Prism-branded) |

---

# Part 2 — Surface Impact Analysis (CLI / VSCode / Electron)

## 2.1 Where Prism is today (the baseline being changed)

Prism's three surfaces currently **coordinate through files, not a runtime**:

- **CLI** (`apps/prism-cli/`, Go/Bubble Tea): packages include `domain/` (story parsing), `state/`, `watcher/` (file watching), `claude/` (Claude runner), `agentbus/`, `app/adapter`, `app/chat`, `prism/` (3D renderer). It reads `stories.json` + `.prism/shared/` and watches files.
- **VSCode** (`apps/prism-vscode/src/`): `core/`, `hosts/`, `providers/`, `office/`, `prism/`, `extension.ts`; model config in [claude-sdk.ts](apps/prism-vscode/src/core/api/claude-sdk.ts). Per memory, `grpc-handler.ts` is already **transport-agnostic** (`handleGrpcRequest(postMessage, request)`).
- **Electron** (`apps/prism-electron/`): Forge + Vite shell (`forge.config.ts`, `vite.*.config.mts`, `webview-ui/`) that re-aliases the VSCode `src/` via `@prism-core/* → ../prism-vscode/src/*`.

So today: VSCode extension is the source of truth; Electron reuses its `src`; CLI is an independent Go process reading the same files. **No shared live runtime, no wire protocol, no mobile.** Paseo's influence is precisely to introduce that shared runtime (a daemon) and a wire protocol so a **mobile** surface (and the others) can be thin clients.

## 2.2 Structural correspondence (paseo concept → Prism today)

| Paseo concept | Nearest Prism analog today | Gap to close for the paseo model |
|---|---|---|
| Daemon (`packages/server`, :6767) | *None* — file coordination via `stories.json`/`.prism/` | Stand up a Prism daemon owning story/agent/run state |
| `agent-manager` + timeline | CLI `domain/` + `state/` + `watcher/`; `agentbus/` | Promote story/agent state into a daemon-owned, subscribable timeline |
| Shared `daemon-client.ts` | VSCode `core/` + `grpc-handler.ts` (transport-agnostic seam) | A shared client lib all surfaces import |
| WebSocket protocol + `session.supports()` | VSCode `grpc-handler` postMessage seam | A versioned wire schema with capability gating |
| Provider adapters (Claude/Codex/OpenCode) | CLI `claude/`; VSCode `providers/` + `claude-sdk.ts` | Generalize to a provider interface behind the daemon |
| Relay (E2EE, QR pairing) | *None* | Needed only if mobile must reach the dev box remotely |
| One Expo app, 4 targets | 3 separate codebases (Go TUI, VSCode TS, Electron TS) | The mobile app is a *new* Expo surface, not a port of the others |
| EAS build/submit pipeline | CLI/VSIX/Electron/Tauri/NSIS release in `prism-release` | Add EAS workflows alongside existing release artifacts |

## 2.3 CLI surface (Go)

What paseo's model implies for `apps/prism-cli/`:
- Paseo's CLI is a **thin WebSocket client** of the daemon (`packages/cli` imports the same `daemon-client`). Prism's CLI is currently a **standalone reader** of `stories.json` (`domain/`, `state/`, `watcher/`).
- Adopting the model means the Go CLI gains a **daemon-client mode**: instead of (or in addition to) watching files, it connects to the Prism daemon and renders a streamed timeline. The existing `agentbus/`, `watcher/`, and `claude/` packages are the closest existing seams.
- Cross-language wrinkle: paseo's `daemon-client` is TypeScript; Prism's CLI is **Go**. The shared-library reuse paseo enjoys (CLI + app share one TS client) does **not** transfer for free — a Go client would re-implement the wire protocol, OR the CLI would shell out to a Node client. This is the single biggest structural difference between paseo's surfaces and Prism's.
- Paseo CLI command surface to mirror for parity (`packages/cli/src/commands/`): `agent`, `daemon`, `permit`, `provider`, `worktree`, `loop`, `chat`, `terminal`, `schedule`, plus `onboard`/`open`. Prism already has CLI verbs around stories/spectrum; the daemon model adds `daemon start/stop/status/pair` and live `attach`/`send`.

## 2.4 VSCode surface (TypeScript)

- This is the **most natural fit** for paseo's client because it is already TypeScript and already has a **transport-agnostic seam** (`grpc-handler.ts`, `handleGrpcRequest(postMessage, request)`), plus `hosts/` and `providers/` abstractions that mirror paseo's `DaemonRegistryContext` and provider adapters.
- Under the paseo model, the VSCode extension becomes a **daemon client**: `core/` would host (or import) the shared client; `providers/` maps to paseo `providers/`; `hosts/` maps to paseo's multi-daemon `DaemonRegistryContext` ("hosts" = daemons). The extension would subscribe to the daemon timeline rather than driving the Claude SDK in-process via [claude-sdk.ts](apps/prism-vscode/src/core/api/claude-sdk.ts).
- Because VSCode and Electron already **share `src/`**, moving the live-agent logic behind a daemon client changes both surfaces at once (see 2.5).

## 2.5 Electron surface

- Paseo's desktop (`packages/desktop`) is an **Electron wrapper that spawns and supervises its own daemon subprocess** (`daemon/daemon-manager.ts`, `node-entrypoint-launcher.ts`, `runtime-paths.ts`, `local-transport.ts`) and then loads the **same web build** the browser uses. It is explicitly "Electron = web platform + `PASEO_WEB_PLATFORM=electron`."
- Prism's Electron app is a Forge+Vite shell re-aliasing the VSCode `src/`. The paseo-influenced shape would add a **daemon-manager** responsibility to Prism Electron's `src/` (spawn the Prism daemon, manage its lifecycle, expose a `getIsElectron()`-style bridge for desktop-only features), and have the renderer talk to that daemon over the same client the VSCode webview uses.
- This is the surface where paseo's "**managed desktop**" deployment model (Electron owns the daemon process) lands most directly, and where the `daemon-manager.ts` (~20KB) is the reference implementation for process supervision, crash restart, and runtime path resolution on Windows/macOS/Linux.

## 2.6 The new surface: mobile (Expo)

- Mobile is **not** a port of any existing Prism surface — it is paseo's `packages/app` reskinned as `prism-mobile` (already done in the fork's `app.config.js`). It rides the same daemon + wire protocol as the others.
- Its presence is what *forces* the daemon/protocol discipline on the other three: once a phone is a client, the "old client ↔ new daemon" compatibility rules (1.4) and the relay (1.6, for off-LAN access) become load-bearing rather than optional.

---

# Part 3 — Fresh Upstream vs Fork Comparison

**Method (non-invasive):** cloned `getpaseo/paseo` → `~/Developer/paseo-upstream` (the fork was only **read**, never fetched/modified). The fork's fork-point commit (`aeb64a63…`, parent of the rebrand commit `06875d3`) is **absent from upstream history**, confirming upstream **squash-merges** PRs (so a SHA-range diff isn't possible; compared by version + date + tracked-file paths + CHANGELOG instead).

| Dimension | Fork (`~/Developer/paseo`) | Fresh upstream (`~/Developer/paseo-upstream`) |
|---|---|---|
| Version | **0.1.69** | **0.1.95** (+26 releases) |
| Last commit | 2026-05-13 | 2026-06-12 (today) |
| Commits in window | baseline | **584 commits** since 2026-05-13 |
| Branding | Prism (`com.thedigitalgriot.prism`) | paseo (`sh.paseo`) |
| Packages | app, cli, desktop, relay, server, website, highlight, expo-two-way-audio | same set |

**What upstream added (selected, path-diff + CHANGELOG 0.1.70→0.1.95):**
- **New test infra:** an entire `packages/app/e2e/` Playwright suite (~40 specs + helpers) — did not exist in the fork.
- **New native module:** `packages/app/modules/paseo-hardware-keyboard/` (iOS Swift Expo module).
- **PWA support:** `packages/app/public/` (`manifest.json`, `pwa-icon-192/512`, `apple-touch-icon`, `robots.txt`).
- **Protocol/architecture docs (new):** `docs/rpc-namespacing.md`, `docs/service-proxy.md`, `docs/timeline-sync.md`, `docs/agent-lifecycle.md`, `docs/floating-panels.md`, `docs/hover.md`, `docs/i18n.md`, `docs/refactors/session-decomposition-plan.md` — signal that the **RPC/session layer was actively reworked** upstream.
- **App-package reorg:** much of `packages/app/src/components/*` was **relocated** (e.g., into `src/agent-stream/`), so the fork's component layout and upstream's now diverge substantially.
- **New EAS workflow:** `packages/app/.eas/workflows/resubmit-ios-review.yml`.
- **Feature highlights (CHANGELOG):** i18n in 6 languages; PR-panel→chat attachments; drag-and-drop file attachments; reusable terminal profiles; "open in Antigravity"/multi-editor; multiple desktop windows; in-tab browser pop-ups; "command center from mobile"; Claude Fable 5 + Skills autocomplete in prompts; OMP provider + ACP catalog refresh; several **Windows-specific fixes** (Explorer opens workspace, editor shim shortcuts, worktree first-push).

**Interpretation for your purposes:** upstream has moved fast and reorganized the app package and RPC layer. The fork remains a clean, stable, ~1-month-old snapshot — appropriate to keep frozen as the tested baseline. Any future rebase of Prism-mobile onto newer upstream would be non-trivial precisely because of the `src/components → src/agent-stream` reorg and the new RPC namespacing/service-proxy layers (i.e., not just the rebrand string swap).

---

## Open Questions

- [ ] Cross-language client: does the Prism **Go CLI** re-implement the daemon wire protocol, shell out to a Node client, or stay file-based while only TS surfaces become daemon clients?
- [ ] Is the Prism daemon a **fork of paseo's `packages/server`** (TS, reuse `daemon-client`/relay/providers wholesale) or a **new daemon** wrapping Prism's existing Go `domain/`+`agentbus`?
- [ ] Does Prism-mobile need the **relay** (off-LAN phone access) in v1, or is LAN-only (`usesCleartextTraffic`) sufficient initially?
- [ ] How does the **Fragment** update (already scoped) define the daemon/surface contract — does it adopt paseo's `session.supports()` capability gating?
- [ ] Rebase policy for the frozen fork: keep `prism-mobile` pinned to the 2026-05-13 snapshot, or schedule a one-time rebase onto a tagged upstream release given the 584-commit drift?

## Appendix — Artifacts produced

- **Fresh upstream clone:** `C:/Users/digit/Developer/paseo-upstream` (getpaseo/paseo @ v0.1.95, `04a985bf`, cloned 2026-06-12). The fork at `C:/Users/digit/Developer/paseo` was **not** modified.

---

## Follow-up Research [2026-06-12] — prism-mobile rename breakage post-mortem

**Context:** A third paseo-derived copy exists at `C:/Users/digit/Developer/prism-mobile` (v0.1.65-beta.2). It is a standalone `git init` directory with **no commits and no remote** (scratch state). It was an earlier, more aggressive rebrand attempt that broke; the `paseo` fork (v0.1.69) is the recovery that worked. Source of truth for this post-mortem: `prism-mobile/.prompt/handoff.md` and `prism-mobile/npm-install-log.txt`.

### What prism-mobile did (the attempt that broke)
- Folder renamed to `prism-mobile`; root `package.json` `name` → `prism`.
- **All 8 packages renamed `@getpaseo/* → @thedigitalgriot/prism-*`** — touching cross-workspace deps, vitest aliases, `runtime-paths.ts`, `supervisor-entrypoint.ts`, bin scripts.
- Expo identity set to Prism (name/slug `prism-mobile`/scheme `prism`/bundle IDs `com.thedigitalgriot.prism[.debug]`).

### What the `paseo` fork did instead (the recovery that works)
- **Folder stays `paseo`; root package stays `paseo`; every package directory name unchanged.**
- Only the npm **scope** swapped: `@getpaseo/* → @thedigitalgriot/*` (dirs `server`/`app`/`cli`/… untouched).
- "Prism" identity lives **only in `packages/app/app.config.js`** (variant name, slug, scheme, bundle ID, EAS projectId) — the user-facing layer, decoupled from npm/folder structure.

### Concrete failure modes captured (for the plan's risk register)
| Symptom | Evidence | Root cause |
|---|---|---|
| "path routing" breakage on rename | handoff §"All 8 packages renamed → prism-*" | Deep package/root/folder rename breaks cross-workspace resolution; shallow scope-only swap avoids it |
| `lefthook install --force` → `fatal: not a git repository … exit 128` | npm-install-log.txt L114-124 | Root `prepare` script runs lefthook with no `.git` present (EAS archive / pre-commit copy) |
| EAS `npm ci` → `Missing: react@19.2.5 from lock file` | handoff §"Current blocker" | Lockfile built on local npm 11 / Node 24; EAS Build runs npm 10 / Node 22; `react@19.1.0` overrides resolve differently |
| peer-dep conflict | handoff §npm install | `@anthropic-ai/claude-agent-sdk` peer-deps zod 4 vs paseo zod 3 → needs `.npmrc legacy-peer-deps=true` |

### Environment facts (from handoff, carry into plan)
- Apple Developer ACTIVE under `gbdevux@gmail.com`; Team `M6K8N36JN8` (GAVIN ANDRE BENNETT, Individual).
- Expo account `digitalgriot`; project `@digitalgriot/prism-mobile`; projectId `4e6ac688-b550-4441-b19a-bbb4459ad05b`.
- Registered devices: dg-iphone (`00008140-0004488A0206801C`), dg-ipad (`00008103-000A45361AA0801E`).
- iOS dist cert + provisioning profile already generated/cached by EAS.
- EAS profiles pin `node: 22.20.0` + `NPM_CONFIG_LEGACY_PEER_DEPS=true`.
- Parked future task: parallel Claude Agent SDK feature (do NOT add during refresh).

### Implication for the "one-time refresh to v0.1.95"
Mirror the **`paseo` fork's shallow recipe** on top of `paseo-upstream`, not prism-mobile's deep rename. Open decision for the plan: the proven-working folder name is literally `paseo`, but that name is occupied by the frozen baseline — the refreshed product needs a different folder, so the plan must verify folder-name sensitivity is fully covered by the shallow recipe (grep found **no absolute folder-name paths baked into tracked configs**, suggesting the break was the package/root rename depth, not the folder string itself).

