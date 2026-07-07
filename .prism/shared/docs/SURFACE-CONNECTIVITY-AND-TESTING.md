# Surface Connectivity & Testing — how every Prism surface reaches the agent substrate

> How each Prism surface (CLI · VS Code · Electron · Mobile) connects to the daemon/broker,
> and exactly how to bring the mobile app up on a physical device. Written 2026-07-03 (v3.8.0).

---

## 0. TL;DR

- Two long-running processes make up the substrate: the **agent daemon** on `:6767` (the vendored
  paseo fork = `apps/prism-mobile/packages/server`) and the **broker** on `:6780`
  (`packages/prism-daemon`).
- **Desktop/CLI surfaces** talk to the **broker** (`:6780`). The **mobile app** talks to the
  **agent daemon** (`:6767`) — directly on the LAN, or via the **Griot relay** from anywhere.
- The relay is **ours**: `prism.digitalgriot.studio/relay` (a Cloudflare Worker + Durable Object).
  Pairing offers encode *that* relay + the daemon's public key — never paseo's.
- "paseo" survives only as **internal names** (the `paseo` CLI binary, a `app.paseo.sh` placeholder).
  Deferred cosmetic rename — the wire is 100% Griot.

---

## 1. The substrate: daemon, broker, relay

```
                       ┌───────────────────────────── the machine ─────────────────────────────┐
                       │                                                                          │
  desktop surfaces ───▶│  Broker :6780  (packages/prism-daemon)                                   │
  (CLI/VSCode/Electron)│    WS + HTTP /call · registry/router/session · health loop               │
                       │        │  brokers 7 services via 4 adapter families                       │
                       │        ├─ agent-run  ──(websocket-paseo adapter)──▶  Agent daemon :6767 ──┼──┐
                       │        ├─ code-intel  (stdio MCP)                                          │  │
                       │        ├─ design-gen  (REST)                                               │  │
                       │        └─ knowledge / 3d-gen / cinopsis / notebooks                        │  │
                       │                                                                            │  │
  mobile app ─────────────────────────────────────────────────────────────▶  Agent daemon :6767 ◀─┘  │
   (LAN or relay)      │                                    (packages/server · /ws · agent lifecycle) │
                       └────────────────────────────────────────────────────────────────────────────┘
                                        │ dials OUT
                                        ▼
                         Griot relay  wss://prism.digitalgriot.studio/relay
                         (Cloudflare Worker + Durable Object, E2EE)
                                        ▲
                                        │ pairs via offer (serverId + daemon pubkey + relay endpoint)
                                   mobile app (off-LAN)
```

- **Agent daemon (`:6767`)** — manages agent processes (Claude Code / Codex / OpenCode), streams
  their output over a WebSocket at **`/ws`**, and dials OUT to the relay so off-LAN clients can reach
  it. `PASEO_HOME` = `~/.thedigitalgriot/` (keypair, config, `daemon.log`, agent state).
- **Broker (`:6780`)** — the sovereign multi-service hub the desktop surfaces speak to. It brokers
  `agent-run` **to the daemon** via the `websocket-paseo` adapter (`ws://127.0.0.1:6767/ws`).
- **Relay** — E2EE bridge (`@prism/relay`, Curve25519 + NaCl box) hosted on Cloudflare at
  `prism.digitalgriot.studio/relay`. The daemon is the "server" role; the phone pairs as a client.

---

## 2. Workflow architecture — per surface

Each surface reaches the agent substrate differently. Same `{service, method, payload}` envelope
underneath; different transport.

### 2.1 CLI (Go · Bubble Tea) — `apps/prism-cli`

```
prism-cli (Go TUI)
   │  own hand-written WebSocket client (coder/websocket)
   ▼
Broker :6780   ──▶  brokered services (agent-run, code-intel, design-gen, …)
```

- Connects **directly to the broker** over WS with a hand-written Go client
  (`apps/prism-cli/daemon/client.go`): `hello → welcome`, then `request/response`.
- `prism-cli daemon ls` prints the live service registry. Needs the broker (`:6780`) up.
- Does **not** talk to the agent daemon (`:6767`) itself — it sees `agent-run` only *through* the
  broker.

### 2.2 VS Code extension (TS/React) — `apps/prism-vscode`

```
Webview (React)  ──postMessage──▶  Extension host (PrismController)
                                        │  in-process gRPC seam (grpc-handler)
                                        │  unhandled service.method keys forward ↓
                                        ▼
                                   Broker :6780  (adopt-only; POST /call)
```

- Default agent work is **in-process** (`PrismTask`, the Cline-derived loop) — no daemon needed.
- The **seam-bridge forwarder** (`VscodeWebviewProvider`) forwards any *brokered* service
  (code-intel / design-gen / agent-run) to `POST :6780/call` **when the broker is running**
  (adopt-only; it never spawns the broker). Gate: `PRISM_AGENTS_BROKERED=1` for brokered agents.

### 2.3 Electron desktop (TS/React, reuses VS Code src) — `apps/prism-electron`

```
Renderer (React SPA, shared @prism-core/@prism-ui)
   │  gRPC-over-IPC (postMessage/IPC)
   ▼
Main process (ElectronPrismController)
   │  seam-bridge forwarder  ──▶  Broker :6780
   └─ SUPERVISES the broker (utilityProcess.fork): spawn/adopt · health-poll · crash-restart ·
      version-sync · kill-on-quit
```

- Same seam + forwarder as VS Code, but Electron **owns the broker's lifecycle** (spawns/adopts and
  supervises it), whereas VS Code only adopts a running one.
- Immune to the VS Code stale-dev-port class of bug — it binds the renderer URL at build time.

### 2.4 Mobile (vendored Expo) — `apps/prism-mobile`

```
Prism / Prism Debug (Expo app)
   │  WebSocket to the agent daemon's /ws  (hello → server_info → *_request/_response + push)
   ├── LAN:   ws://<machine-LAN-IP>:6767/ws        (daemon bound to 0.0.0.0)
   ├── local: ws://127.0.0.1:6767/ws               (iOS SIMULATOR only)
   └── relay: via prism.digitalgriot.studio/relay   (E2EE, off-LAN, paired by offer)
Agent daemon :6767  (this app IS packages/server — the mobile surface + the daemon are one repo)
```

- **The mobile surface *is* the daemon.** `apps/prism-mobile/packages/server` is the `:6767` agent
  daemon; `packages/app` is the Expo client. The app connects to the daemon over `/ws`.
- Unlike the desktop surfaces, mobile does **not** go through the broker — it speaks the daemon's
  own dialect directly (the same dialect the broker's `websocket-paseo` adapter uses).
- **Handshake (v3.8.0):** the daemon mounts WS on **`/ws`** and completes `hello` with a
  **`server_info`** status frame (not a `welcome`). A bare-host dial (no `/ws`) is rejected.

---

## 3. The three ways a client reaches the daemon

`:6767` is the join point. How a client dials it depends on where the client is:

| Client location | Address | Requirement |
|---|---|---|
| **iOS Simulator** (same machine) | `127.0.0.1:6767` | daemon on loopback (default) |
| **Physical device, same Wi-Fi** | `<machine-LAN-IP>:6767` (e.g. `192.168.2.216:6767`) | daemon bound `0.0.0.0` + firewall allows inbound |
| **Physical device, anywhere** | Griot **relay** (paired by offer) | daemon relay-connected; phone paired |

> **Why a phone can't use `127.0.0.1`:** on the phone, `127.0.0.1` is the *phone itself*. Loopback
> only works from the simulator. A real device needs the machine's LAN IP (and the daemon bound to
> `0.0.0.0`, not loopback-only) or the relay.

**Bind for LAN:** start the daemon with `PASEO_LISTEN=0.0.0.0:6767` (default is `127.0.0.1:6767`,
loopback-only). Confirm with `netstat -ano | grep 6767` → `0.0.0.0:6767 … LISTENING`.

---

## 4. Testing the mobile app — step by step

Prereqs: daemon healthy on `:6767` under **Node 22** (native ABI). Bring it up from
`apps/prism-mobile`:

```bash
nvm use 22.20.0
npm run build:daemon                                 # highlight → relay → server → cli
PASEO_LISTEN=0.0.0.0:6767 npm run start              # binds 0.0.0.0:6767, dials the Griot relay
```

### Option A — Relay pairing (uses the Griot relay; works anywhere)

1. Generate the offer (QR + link):
   ```bash
   npm run cli -- daemon pair        # prints a scannable QR + https://prism.digitalgriot.studio/#offer=…
   ```
   The offer encodes: `serverId`, the daemon's **public key**, and the **relay endpoint**
   (`prism.digitalgriot.studio:443/relay`) — all Griot.
2. In **Prism Debug** → pair/connect screen → **scan the QR** (in-app scanner) or paste the
   `#offer=…` link.
3. E2EE handshake over the relay → connected from any network.

### Option B — Direct LAN (same Wi-Fi; simplest)

1. Ensure the daemon is bound `0.0.0.0` (see §3) and note the machine LAN IP (`ipconfig` → IPv4).
2. In **Prism Debug** → **add host** → `<LAN-IP>:6767` (e.g. `192.168.2.216:6767`).
3. If it hangs: allow **node.exe / TCP 6767** inbound through Windows Firewall.

### Then — drive an agent (the actual test)

Open/create a workspace → start an agent (Claude Code / Codex / OpenCode) → send a message and watch
it stream. Timeline/turn frames pushing to the app = the full loop works.

---

## 5. The relay + pairing flow

```
Daemon ──(role=server)──▶  wss://prism.digitalgriot.studio/relay/ws?serverId=…&role=server
                                        │  Durable Object holds the channel
Phone  ──(offer: serverId+pubkey+relay)─▶  same DO channel ──▶  E2EE session to the daemon
```

- **Offer** (`daemon pair` / `generateLocalPairingOffer`): a base64 fragment
  `https://prism.digitalgriot.studio/#offer=<b64>` where `<b64>` decodes to
  `{ v, serverId, daemonPublicKeyB64, relay:{ endpoint } }`.
- **E2EE:** Curve25519 + NaCl box between the phone and the daemon; the relay only shuttles ciphertext.
- **Same daemon = same identity:** `serverId`/keypair live in `~/.thedigitalgriot/`, so re-pairing a
  device is stable across restarts.

---

## 6. Naming: "paseo" internals vs Prism links

The surface is a **vendored paseo fork**, absorbed sovereignly. What you'll still see named "paseo":

| Still "paseo" (internal) | Actually Griot/Prism (the wire) |
|---|---|
| CLI binary `paseo` (`npm run cli` → `paseo …`) | Relay `prism.digitalgriot.studio/relay` |
| App input placeholder `app.paseo.sh/#offer=…` | Offer link `https://prism.digitalgriot.studio/#offer=…` |
| `PASEO_HOME`, `PASEO_LISTEN`, `PASEO_*` env | `PASEO_HOME` = `~/.thedigitalgriot/` |
| `websocket-paseo` broker adapter id | Talks to *our* daemon at `:6767` |

**Standing decision:** *"set up first, then go sovereign."* The 5-file / 41-test cosmetic rename
(`PaseoWebSocketAdapter → AgentDaemonAdapter`, `websocket-paseo → websocket-agent`, `PASEO_* → PRISM_*`)
is deferred until explicitly greenlit. Nothing about the naming means paseo infrastructure is in the
path — verify any pairing offer's `relay.endpoint` reads `prism.digitalgriot.studio` (it does).

---

## 7. Always-on: the droplet (Model B)

The same daemon runs laptop-independently on the DO droplet via Coolify (`apps/prism-mobile/deploy/`):
`node:22-bookworm`, `PASEO_LISTEN=0.0.0.0:6767`, `PASEO_HOME=/data`, dialing the **same** Griot relay
(`PASEO_RELAY_ENDPOINT=wss://prism.digitalgriot.studio/relay`). The phone pairs to the droplet daemon
identically — the offer just carries the droplet's `serverId`. See
`apps/prism-mobile/deploy/RUNBOOK.md`.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Daemon crashes on start (`NODE_MODULE_VERSION`) | Native modules built for Node 22, running on 24 | `nvm use 22.20.0` before `npm run start` |
| `dev:server` crashes on `@thedigitalgriot/relay/dist/e2ee.js` | relay/highlight ship only `dist/` | run `npm run build:daemon` first |
| Phone can't reach `<LAN-IP>:6767` | daemon loopback-only, or firewall | `PASEO_LISTEN=0.0.0.0:6767`; allow node/6767 inbound |
| Phone can't reach via relay | daemon not relay-connected, or stale pair | check `relay_control_connected` in `daemon.log`; re-run `daemon pair` |
| `relay_control_disconnected (1006)` every ~15 min | Cloudflare Worker recycling the long-lived WS | benign — the daemon auto-reconnects; the DO preserves the channel |
| `agent-run` shows `error` in `prism-cli daemon ls` | adapter dialed bare URL / awaited `welcome` | fixed in v3.8.0 (`/ws` + `server_info`); ensure daemon is up |
| `prism-cli daemon ls` → "message too big" | broker welcome > 32 KiB Go read limit | fixed in v3.8.0 (`SetReadLimit(1 MiB)`); rebuild the CLI |
| Icon didn't change on device | icons bake into the binary | new EAS build (not `eas update`) |

---

## Reference

- Daemon: `apps/prism-mobile/packages/server` · logs `~/.thedigitalgriot/daemon.log`
- Broker: `packages/prism-daemon` · adapters `packages/prism-daemon/src/adapters/`
- Relay: `apps/prism-mobile/packages/relay` (`wrangler.toml` → `prism.digitalgriot.studio/relay/*`)
- Pairing: `packages/server/src/server/{pairing-offer,connection-offer,pairing-qr}.ts`;
  CLI `packages/cli/src/commands/daemon/pair.ts`
- Live docs: the daemon adapter dialect is documented at `daemon/adapters.md` (VitePress site)
