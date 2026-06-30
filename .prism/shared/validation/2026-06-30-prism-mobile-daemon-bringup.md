# Validation — prism-mobile agent daemon bring-up (Model A) + always-on droplet reconciliation

**Date:** 2026-06-30
**Surface:** `prism-mobile` (vendored paseo fork v0.1.69 = the `:6767` agent daemon)
**Working copy:** `apps/prism-mobile`
**Goal:** Bring the daemon up locally (Model A) and confirm the broker's `agent-run` service flips `error → ready`. Reconcile with the previously-staged always-on droplet (Model B) work.
**Outcome:** ✅ **RESOLVED** — daemon `:6767` + broker `:6780` up; two independent bugs found and fixed; `prism-cli daemon ls` now renders and **`agent-run` shows `ready`**. Goal met. See §6 for root causes + fixes.

---

## 1. TL;DR

| Item | Result |
|---|---|
| Node 22.20.0 override (vs machine default 24.11.1) | ✅ Works (nvm-windows symlink swap, machine-global) |
| Native modules under Node 22 (`better-sqlite3`, `node-pty`, `sherpa-onnx`) | ✅ Loaded cleanly — **no ABI mismatch** |
| `npm run build:daemon` (highlight → relay → server → cli) | ✅ Exit 0 |
| Daemon `npm run start` → `:6767` | ✅ Listening (PID 53032), `/ws` initialized, relay control connected |
| Broker `:6780` (`@prism/daemon`) | ✅ Listening (PID 26112), 7 services registered |
| Broker ready services (after fix) | `agent-run`, `code-intel`, `design-gen` |
| `prism-cli daemon ls` | ✅ Renders (after CLI `SetReadLimit` fix + rebuild) |
| `agent-run` error → ready | ✅ **CONFIRMED ready** (`lastProbe.ok=true`, after adapter fix) |

---

## 2. The two hosting models (context)

Per `PRISM-STATE-2026-06-18.md` §4. This task is the **rehearsal for Model B**.

- **Model A (this run):** broker + daemon on *this machine*. The Cloudflare relay bridges off-LAN clients (phone → CF Worker → laptop daemon). **Needs the laptop on.**
- **Model B (the always-on goal):** the *same* daemon container hosted on the DO droplet `digitalgriot-server-tor1` via Coolify, laptop-independent. Assets staged in `apps/prism-mobile/deploy/`.

**Standing decision (2026-06-14):** *"set up first, then go sovereign."* Prove the daemon locally (change nothing), then push to the droplet. The cosmetic rename (`PaseoWebSocketAdapter → AgentDaemonAdapter`, `websocket-paseo → websocket-agent`, 5 files / 41 tests) stays **deferred** and untouched.

---

## 3. Live status of the previously-staged droplet/relay (re-verified 2026-06-30)

The relay + droplet/Coolify infra was set up in prior Cowork sessions (`local_c4e11dc2` 2026-05-13, `local_59354482` 2026-06-06). Re-probed live today:

| Piece | Documented state | Live probe (2026-06-30) | Verdict |
|---|---|---|---|
| **Cloudflare relay** | "LIVE at `prism.digitalgriot.studio/relay/*` (Version 7e120f80)" | `GET /relay/ws` → **HTTP 400** (Worker answering, rejects non-WS GET) | ✅ Still live |
| **DO droplet `tor1` (159.203.62.10) + Coolify** | provisioned | bare IP `/` → **HTTP 404** (proxy/Traefik answering) | ✅ Box up & reachable |
| **Always-on daemon container *on* the droplet** | "**deferred** … re-verify before relying on it" | apex `/` → **HTTP 522** (CF cannot reach an origin app) | ⚠️ Not serving — the deferred piece |

**Interpretation:** the relay is a Cloudflare *Worker* (edge-hosted, no origin), so it answers even with the droplet app down — `400` is a healthy "wrong protocol" reject. The apex `522` means the CF proxy is configured but **no origin daemon is answering**. Net: relay = live, droplet infra = live, **daemon-on-droplet = never finished** (= Model B, the gap this rehearsal feeds).

---

## 4. What was done locally (reproducible sequence)

All from `apps/prism-mobile`:

```bash
# 1. Node 22 (CRITICAL — native modules built for node-22 ABI; machine default is 24.11.1)
nvm use 22.20.0                 # → v22.20.0, npm 10.9.3

# 2. Deps already present (node_modules/ exists; .npmrc has legacy-peer-deps=true)
#    (npm install --legacy-peer-deps only if node_modules missing)

# 3. Build the daemon chain (MANDATORY — relay/highlight ship dist/ only)
npm run build:daemon           # highlight → relay → server → cli (tsc); exit 0

# 4. Start the daemon (binds 127.0.0.1:6767)
npm run start                  # = node dist/scripts/supervisor-entrypoint.js

# --- broker, from repo root ---
npx tsx packages/prism-daemon/src/index.ts   # binds ws://127.0.0.1:6780

# --- verify ---
apps/prism-cli/bin/prism-cli.exe daemon ls   # ❌ welcome too big (see §6)
```

### Daemon startup log (healthy — `~/.thedigitalgriot/daemon.log` + stdout)
```
[DaemonRunner] Starting daemon worker (IPC restart and crash restart enabled)
… "msg":"Loaded daemon keypair"  filePath: C:\Users\digit\.thedigitalgriot\daemon-keypair.json
… "msg":"Agent storage initialized"            ← better-sqlite3 OK
… "msg":"Bootstrap complete, ready to start listening"
… host:127.0.0.1 port:6767 authRequired:false  "msg":"Server listening on http://127.0.0.1:6767"
… "msg":"WebSocket server initialized on /ws"
… "msg":"Sherpa offline recognizer initialized"  ← sherpa-onnx native OK
… "msg":"Sherpa offline TTS initialized"
… "msg":"relay_control_connected"               ← local relay transport connected
```

---

## 5. Environment notes / gotchas

- **`PASEO_HOME` is `~/.thedigitalgriot/`, NOT `~/.paseo/`.** The fork rebranded the home dir. Live logs/keypair/state live in `~/.thedigitalgriot/`. The stale `~/.paseo/` (with a `paseo.pid` from May 13) is upstream leftover — ignore it.
- **Node-version split (from `PRISM-STATE` §7):** `prism-design-engine` pins Node ~24; the prism-mobile daemon needs Node 22. Machine default was switched to **24.11.1** for design-engine, so prism-mobile **must** `nvm use 22` locally. nvm-windows swaps a global symlink, so the switch is **machine-wide** and persists across shells (any node process launched afterward also gets 22 — re-switch if you go back to design-engine work).
- **The droplet is unaffected by the local node dance.** `deploy/Dockerfile` pins `FROM node:22-bookworm` and rebuilds native modules fresh via node-gyp (`python3 make g++` in the image), so the container ABI is correct by construction.
- **`dist/` already existed (Jun 19) but `build:daemon` is still mandatory** — the server build wipes `dist/` and recompiles; relay/highlight ship only `dist/`, so `dev:server` would crash on `@thedigitalgriot/relay/dist/e2ee.js` without a build.

---

## 6. RESOLVED — two independent bugs (root-caused via systematic-debugging)

The single visible symptom (`prism-cli daemon ls` failing) masked **two unrelated** bugs. My initial hypothesis — "agent-run's hello payload bloats the welcome" — was **disproven by evidence** (agent-run was `error` with empty capabilities; the bloat came from elsewhere). Both are now fixed and verified.

### Problem A — `agent-run` stuck in `error` (the real error→ready blocker)
**Root cause: a two-layer protocol mismatch in `PaseoWebSocketAdapter`** (`packages/prism-daemon/src/adapters/paseo-websocket.ts`), proven by dialing the live daemon directly:
- **A1 — wrong path.** Adapter dialed `ws://127.0.0.1:6767` (bare). The daemon mounts its WS on **`/ws`** (`new WebSocketServer({ path: "/ws" })`, websocket-server.ts:587). Bare root → **HTTP 400** at the upgrade (~14 ms fast-fail — matches the live `lastProbe.ok=false, latencyMs:14`).
- **A2 — wrong handshake signal.** Even at `/ws`, the adapter waited for `{type:"welcome"}`. The real daemon **never sends `welcome`**; it completes the hello with
  `{type:"session", message:{type:"status", payload:{status:"server_info", version:"0.1.69", serverId}}}`
  (captured live). → adapter never resolves `connect()` → 5 s timeout → `probe.ok=false`. The adapter's header-comment "paseo wire" handshake was fiction.

**Fix (applied):** `paseo-websocket.ts` — (1) `ensurePaseoWsPath()` normalizes a path-less endpoint to `/ws`; (2) `detectHandshake()` accepts the `server_info` session frame as connection-complete (keeps the `welcome` branch for any clean-dialect daemon). Both in `@prism/daemon` (sovereign) — **no `Paseo*` identifier renamed**, so the "set up first, then go sovereign" decision holds.
**Verified:** `GET /services` → `agent-run … ready, lastProbe.ok=true, latency=15ms`; broker boot log → `ready services: agent-run, code-intel, design-gen`. New regression test added (`paseo-websocket.test.ts`: realistic mock = `/ws`-only + `server_info`) — 5/5 pass.

### Problem B — `prism-cli daemon ls` could not read the welcome
```
Error: await welcome: … websocket: message too big: read limited at 32769 bytes
```
**Root cause:** the broker welcome embeds the full registry snapshot verbatim (`services: this.registry.snapshot()`, broker.ts:329). With `code-intel` (14 tools) + `design-gen` (155 methods) capability manifests, `/services` = **45,599 bytes**. The Go CLI uses `coder/websocket`, whose `wsjson.Read` enforces a **default 32,768-byte** read limit (`32769` = limit+1); `Dial()` set no override (`client.go`). Unrelated to agent-run.

**Fix (applied):** `apps/prism-cli/daemon/client.go` — `conn.SetReadLimit(1 << 20)` right after dial, before reading the welcome. Rebuilt the binary (`make build` → v3.7.5-dirty).
**Verified:** `prism-cli daemon ls` renders the full 7-service table with `agent-run = ready`.
**Droplet relevance:** RUNBOOK's final verify step is this exact command, so this fix is required for Model B acceptance too.

### Live `prism-cli daemon ls` (after both fixes)
```
Prism daemon-broker 0.1.0  ·  7 service(s)  ·  session 0cb07e0e
  ready     agent-run     Agent Orchestration (Prism agent daemon, paseo-derived)
  ready     code-intel    Code Intelligence (codebase-memory-mcp)  (14 method(s))
  ready     design-gen    Design Generation (prism-design-engine via design-studio)  (155 method(s))
  error     knowledge     Knowledge / STORE (Graphify → Synaptiq)        ← backend not running
  error     3d-gen        3D Generation (Lucid / ComfyUI)                ← backend not running
  error     cinopsis      Cinopsis (video → structured)                  ← backend not running
  error     notebooks     Notebooks (Jupyter)                            ← backend not running
```

### Files changed
- `packages/prism-daemon/src/adapters/paseo-websocket.ts` — path normalization + `server_info` handshake (Problem A)
- `packages/prism-daemon/src/adapters/paseo-websocket.test.ts` — regression test (realistic `/ws` + `server_info` mock)
- `apps/prism-cli/daemon/client.go` — `SetReadLimit(1<<20)` (Problem B); binary rebuilt
- Typecheck `@prism/daemon` green; adapter tests 5/5; Go build clean.

### Recommended follow-ups (not applied)
- Consider trimming the broker welcome (omit capability manifests; clients can fetch via a method) so the snapshot stays small as services grow — defense in depth alongside the CLI limit bump.
- Carry both fixes into the droplet image verification (Model B).

---

## 7. Key files / endpoints

- Daemon (server): `apps/prism-mobile/packages/server` → `dist/scripts/supervisor-entrypoint.js` → `127.0.0.1:6767` (`/ws`)
- Broker: `packages/prism-daemon/src/index.ts` → `ws://127.0.0.1:6780` (env: `PRISM_DAEMON_HOST`, `PRISM_DAEMON_PORT`, `PRISM_DAEMON_CONFIG`)
- Service registry: `packages/prism-daemon/services.config.json` — `agent-run` = `{ adapterType: "websocket-paseo", endpoint.local: "ws://127.0.0.1:6767", healthProbe: "hello" }`
- CLI: `apps/prism-cli/bin/prism-cli.exe daemon ls`
- Droplet deploy assets: `apps/prism-mobile/deploy/` (`Dockerfile` node:22-bookworm, `docker-compose.yml` Coolify, `.env.example`, `RUNBOOK.md`)
- Relay (Cloudflare Worker): `apps/prism-mobile/packages/relay/wrangler.toml` → `prism.digitalgriot.studio/relay/*`
- Prior state of record: `PRISM-STATE-2026-06-18.md` (§3 sovereignty decision, §4 hosting models, §7 surface tests + node split)

---

## 8. Process state at time of writing

- Daemon `:6767` — **running** (PID 53032, started via `nohup npm run start &` under Node 22; untouched since bring-up).
- Broker `:6780` — **running**, restarted once via `tsx` to load the fixed adapter (no build step for the broker).
- ⚠️ **Do NOT** `kill` the `:6767` daemon casually — per `apps/prism-mobile/CLAUDE.md` it manages agents and restarting it can kill an agent's own process. (Both were started by this session and can be stopped intentionally when done.)
