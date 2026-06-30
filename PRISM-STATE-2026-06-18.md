# Prism — Verified State & Daemon Arc (snapshot 2026-06-18)

> Consolidated by Cowork from the daemon-arc docs + Claude Code transcripts + Cowork
> sessions, so future sessions inherit it instead of re-deriving. Lives at the GriotApps
> `prism-plugin` repo root. Companion to `GriotApps/CONTEXT.md`.

---

## 1. The daemon arc is DONE (v3.6.0, closed 2026-06-13)

The over-the-wire **broker** (`packages/prism-daemon`) on **`:6780`** (`POST /call` + `GET /health`)
fronts **7 services** via **4 adapter families**, with **TS + Go** surface clients. Green:
40/40 `@prism/daemon`, 4/4 daemon-client, 4/4 relay, 4/4 core-seam, 13/13 prism-electron, 2/2 Go.

- **Two seams, one shape.** In-process gRPC (`handleGrpcRequest`, postMessage/IPC) and the broker
  share the same `{service, method, payload}` envelope. The **seam-bridge** forwards unhandled keys
  to the broker, so "full-managed" later is a transport flip, not a rewrite.
- **Desktop supervises the broker** (`prism-electron` via `utilityProcess.fork`: adopt/spawn/
  health-poll/crash-restart/version-sync/kill-on-quit; `daemon:*` IPC; status dot).
- **`prism-cli daemon ls`** dials the broker over WS and prints the live registry.
- **Relay** extracted sovereignly to `packages/prism-relay` (`@prism/relay`, Curve25519 + NaCl box).
- Deferred: full-managed agent move, QR-pairing UI, live relay verification, VS Code-side forwarder.

## 2. The paseo lineage — FOUR copies (don't confuse them)

| Copy | Location | Version | State |
|---|---|---|---|
| Frozen baseline | `C:\Users\digit\Developer\paseo` | 0.1.69 (commit `06875d3`) | **DO NOT MODIFY** — canonical rebrand recipe |
| Upstream clone | `C:\Users\digit\Developer\paseo-upstream` | 0.1.95 | read-only comparison (real upstream now **0.1.97**, 2026-06-18) |
| Broken scratch | `C:\Users\digit\Developer\prism-mobile` | 0.1.65-beta.2 | deep-rename that failed; refresh plan replaces it |
| **Vendored (live)** | `prism-plugin/apps/prism-mobile` | 0.1.69 | the working seed — **the only one copied to GriotApps** |

`@thedigitalgriot/app` shows **3.6.0** (Prism brand bump); the paseo lineage underneath is **0.1.69**.
Refresh recipe (deferred): mirror the *shallow* fork (npm scope swap `@getpaseo/*→@thedigitalgriot/*`,
Prism identity only in `packages/app/app.config.js`), NOT a deep package rename.

## 3. §J audit — NO hidden paseo runtime dependency

Full-repo search found paseo references **only** in `.prism/shared/` docs + cosmetic naming
(`PaseoWebSocketAdapter`, `websocket-paseo`) + the vendored donor. **The one real link is
runtime-only:** the `agent-run` service → `ws://127.0.0.1:6767` = the vendored daemon
(`apps/prism-mobile/packages/server`). Nothing is imported; `agent-run` goes `ready` only if that
daemon runs — broker + the other 6 services are unaffected if it doesn't. Default agents still run
**in-process** (Claude Agent SDK); routing them through paseo is the deferred "full-managed" step.

**Decision (2026-06-14): set up first, then go sovereign.** For testing, change NOTHING. Baseline:
run the vendored daemon on `:6767`, confirm `agent-run` is `ready` via `prism-cli daemon ls`. The
cosmetic rename (`PaseoWebSocketAdapter→AgentDaemonAdapter`, `websocket-paseo→websocket-agent`,
5 files / 41 tests, reversible) stays deferred until Gavin says "do the sovereign rename."

## 4. Always-on daemon — hosting design (the DO/Coolify/Cloudflare thread)

**Goal:** the daemon stays available when the laptop is off. Two models exist in the history:

- **Model A (built today):** broker+daemon on the **laptop** (LAN); the E2EE relay
  (`@prism/relay`, re-homed to `prism.digitalgriot.studio` on Cloudflare) bridges off-LAN clients
  (phone → Cloudflare Worker → laptop daemon). **Needs the laptop on.** Relay *bridge* tested
  (30/30); live Cloudflare/DO verification flagged **deferred** (`relay.md`, broker plan Phase 7).
- **Model B (the always-on goal):** broker+daemon **hosted on the VPS** so it's laptop-independent.

**The "how" for Model B** (from Cowork session `local_c4e11dc2`, 2026-05-13 — uploads
`hetzner-coolify-setup.md` / `SELF-HOSTING.md` / `SECURITY.md`):
- A single **Coolify-managed VPS** runs **isolated containers**: the public API and the private
  Paseo/agent daemon. Hetzner CX22 was costed as the sweet spot for `~/.claude` disk persistence;
  the live box became the **DO droplet `digitalgriot-server-tor1` (159.203.62.10)** via Coolify.
- **Auth:** log in to Claude Max **once on the server** → credentials in `~/.claude/`; **mount that
  dir READ-ONLY into the daemon container** (a container breach can't alter the global token).
- **Cost:** continuous daemon polling / 24-7 background ops → Claude **Max 5x ($100)** or
  **20x ($200)** beats API pay-as-you-go.
- **Two-track infra** (Cowork session `local_59354482`, 2026-06-06): (1) **model-serving track** —
  R3F avatar / custom models on **DigitalOcean fronted by Cloudflare** under `digitalgriot.studio`
  (Flask + Gunicorn + systemd auto-start, GPU droplets for inference); (2) **daemon-relay track** —
  the Paseo fork: phone → Cloudflare Worker → daemon at `prism.digitalgriot.studio/relay/*`.

**Honest gap:** the always-on VPS daemon (Model B) is designed + intended ("we spent many nights
getting our Coolify/DO server set up so we OWN everything end to end") and the relay code ships,
but standing the broker/daemon itself up on the droplet for laptop-independent operation is the
**deferred** piece. The ecosystem-map claim that a daemon is "containerized LIVE on tor1 via Coolify"
should be re-verified against the actual droplet before relying on it.

## 5. Surfaces & how to test (Windows)

Default agents are in-process, so basic surface testing does NOT require `:6767`; only brokered
`agent-run` does. Broker (`:6780`) is needed for `prism-cli daemon ls` and the brokered services.

| Surface | Default agent path | Launch | Needs daemon? |
|---|---|---|---|
| prism-cli (Go) | own binary + `cmd_daemon.go` | `make build` then run | `daemon ls` needs `:6780` |
| prism-vscode | in-process `PrismTask` | `npm run watch` → F5 | only if `PRISM_AGENTS_BROKERED=1` |
| prism-electron | shared `PrismController`; supervises broker | `npm start` | brokered services only |
| prism-mobile | **is** the daemon (`packages/server`) | `npm run dev:win` | it is `:6767` |

Toolchains present: node 22.20, go 1.25.5, pnpm 10.25, git 2.52. No `node_modules` installed yet.

## 6. Source threads (for `session_info` / Claude Code recall)

| Thread | Where | Topic |
|---|---|---|
| `04cab8ee-…jsonl` | Claude Code (`~/.claude/projects/c--Users-digit-Developer-prism-plugin`) | daemon-arc sovereignty build |
| `2a1d4d4e`, `2901d4d0` | Claude Code, same dir | daemon-arc / worklist sessions |
| `local_c4e11dc2` | Cowork (2026-05-13) | **always-on VPS daemon: Coolify + ~/.claude mount + cost** |
| `local_59354482` | Cowork (2026-06-06) | **two-track infra: model-serving + daemon-relay** |
| `local_00791624` | Cowork (Sankofa Map) | ecosystem map (claims daemon live on tor1) |
| `.prism/shared/` | repo | research/plans/designs (daemon-broker, relay, capability-parity, mobile-refresh) |

---

## 7. Surface test results + design canon (added 2026-06-25)

| Surface | Status | Notes |
|---|---|---|
| prism-cli | green | TUI renders; `daemon ls` dials broker :6780 (code-intel ready; agent-run error until :6767). |
| prism-vscode | green (v3.6.5) | Looked "crashed" but wasn't: `engines.vscode ^1.109.0` was newer than Cursor 2.4.31 -> editor SILENTLY EXCLUDED it; restored to `^1.84.0`. Stale `.vite-port`/`.vite-panel-port` routed webviews at dead localhost -> blank; added TCP liveness-probe fallback (`viteDevServer.ts`). "Canceled: Canceled" = Cursor teardown red herring. Doc: `.prism/shared/research/2026-06-25-vscode-f5-extension-host-fixes.md`. |
| prism-electron | green | build:daemon ok; Office canvas renders; ADOPTS broker :6780 (/health 200). Immune to the stale-port bug (binds `MAIN_WINDOW_VITE_DEV_SERVER_URL` at build time). Forge needs a real TTY (detached shell -> exit 0). |
| prism-design-studio | green (v3.7.5) | First-ever run. Relay :7457 -> engine daemon :7456 (headless API, 155 skills). Needed **node 24** + `pnpm install` in `prism-design-engine`. `design-gen` broker -> ready. **UI is a separate Next.js app `apps/web` on :3000.** Rebranded Open Design -> Prism Design Studio (COSMETIC ONLY; `@open-design/*` / `OD_*` left intact = shallow-rebrand discipline). Themed to Griotwave. |
| prism-mobile | pending | = the :6767 agent daemon; converges with the always-on droplet work. |

**Design canon:** Griotwave is canonical — Neural `#3B82F6` primary, dark-first, glassmorphic, Void `#000` / Graphite `#0E0F11` substrate. Token adoption already ~95% (9,004 `var()` vs 506 raw hex, in ~8 CSS files) — "disjointed surfaces" = 5% drift, not a missing system. **Gotcha:** a persisted **localStorage accent overrides CSS + code defaults** (why theme edits can look ignored).

**Node-version split:** `prism-design-engine` pins node ~24 (better-sqlite3 ABI); the paseo/prism-mobile daemon was built under node 22. Global default was switched to 24.11.1 — use `nvm use 22` for prism-mobile local dev. The always-on Dockerfile pins `node:22-bookworm`, so the container is unaffected.

**Cloudflare relay:** LIVE at `prism.digitalgriot.studio/relay/*` (Version 7e120f80). Always-on daemon container assets staged in `apps/prism-mobile/deploy/`.