# Prism Daemon-Broker — Implementation Plan

**Date:** 2026-06-13
**Status:** Approved structure — ready for implementation
**Spec:** `.prism/shared/designs/2026-06-12-daemon-broker-design.md`
**Ledger:** `.prism/shared/brainstorms/2026-06-12-code-intel-memory-layer.md` (Q1–Q5 locked)
**Worklist:** `.prism/shared/handoffs/2026-06-12-daemon-memory-arc-worklist.md`

## Goal
Build the Prism Daemon — a thin broker/registry-spine + per-service adapters — incrementally, so each phase is independently testable and the **first adapter proves the whole contract**. Sovereign, self-hosted, local-first.

## Locked Decisions (do not re-litigate)
Q1 code-intel = brokered service · Q2 daemon = multi-service broker (N protocols → one) · Q3 memory = layer both (codebasemem + Graphify→Synaptiq) · Q4 fork Graphify (MIT) · Q5 thin broker + per-service relays. **Go-CLI client = hand-written Go WS client (Option A).**

## Structural Impact (graph-informed)
- **Blast Radius: LOW** — greenfield. New `packages/prism-daemon` + `packages/prism-daemon-client` are auto-workspaced by the existing root `"packages/*"` glob (no root `package.json` edit needed).
- **Integration seams (the only existing code touched):** `apps/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` (design-gen migration — *uncommitted idea_init changes, predates the graph index; re-index after Phase 3*), `apps/prism-mobile/packages/relay` (reuse, no edit), `packages/prism-ui` ProtoBus (Phase 8 client wiring).
- **Dead code candidates:** none.

## Overall Success Criteria

#### Automated Verification
- [ ] `npm run typecheck` passes for `@prism/daemon` + `@prism/daemon-client`.
- [ ] `npm run build` produces `dist/` for both packages.
- [ ] `npm test -w @prism/daemon` green (per-phase unit/integration tests below).
- [ ] `go build ./...` + `go test ./...` pass in `apps/prism-cli` (Go WS client).
- [ ] A conformance test asserts the TS client and Go client receive an identical registry snapshot from a running broker.

#### Manual Verification
- [ ] Broker boots; a surface connects and `WSWelcome` lists the live service registry.
- [ ] At least one service per adapter family is reachable end-to-end (agent-run, design-gen, code-intel, one Flask service).
- [ ] A remote client pairs via QR over the self-hosted relay; LAN client still connects directly.
- [ ] Killing a backend flips its `status` to `error` and clients receive `service_update`.

## What We're NOT Doing
- NOT building Graphify/Synaptiq internals (Synaptiq design phase — parked); the adapter just brokers to it.
- NOT building the 3D-gen pipeline or Cinopsis internals (Lucid/Cinopsis own those); we broker to them.
- NOT refactoring paseo's daemon — it stays a backend behind `WebSocketAdapter`.
- NOT executing the Graphify fork (Q4, pending user go) or modifying the frozen `~/Developer/paseo` baseline.
- NOT standing up cloud infra (RunPod/HF) — config points at it; accounts are out of scope.
- NOT the Fragment extraction itself — we keep module boundaries clean to *enable* it later.
- NOT the v0.1.95 mobile refresh (separate plan).

---

## Phase 1 — Broker core (`packages/prism-daemon`)
**Goal:** A daemon that boots, accepts WS connections, completes the hello/welcome handshake, and serves an (initially empty) registry. Everything else depends on this, so it's first.

**Files (create):**
- `packages/prism-daemon/package.json` (`@prism/daemon`), `tsconfig.json`
- `src/protocol.ts` — `BrokerEnvelope`, `WSHello`, `WSWelcome`, push types (`service_update`, `<service>_stream`, `permission_request`), `BinaryMuxFrame` (re-export paseo's)
- `src/registry.ts` — `ServiceDescriptor`, `Registry` (Map + `snapshot()`, `upsert()`, `remove()`)
- `src/session.ts` — per-client session, `subscriptions`, `supports(cap)`
- `src/router.ts` — route `envelope.service` → adapter (returns `SERVICE_NOT_FOUND` until Phase 2)
- `src/broker.ts` — HTTP+WS server bootstrap, handshake (`WSHello` → `WSWelcome { brokerVersion, sessionId, services: registry.snapshot(), capabilities }`)
- `src/index.ts` — entry; loads `services.config.json` (empty array initially)
- `services.config.json` — `[]`

**Steps:**
1. Scaffold the package (auto-workspaced via `packages/*`).
2. Define `protocol.ts` (append-only schemas; reuse paseo envelope/mux types where importable from `apps/prism-mobile/packages/server`).
3. Implement `registry.ts` + `session.ts`.
4. Implement `broker.ts`: on WS connect → await `WSHello` → reply `WSWelcome` with registry snapshot + `sessionId`; store client caps for `supports()`.
5. Router stub routes unknown services to a typed `SERVICE_NOT_FOUND` error.

#### Automated Verification
- [ ] `npm run typecheck -w @prism/daemon` + `npm run build -w @prism/daemon` pass.
- [ ] Unit test: a `WSHello` yields a `WSWelcome` with `sessionId` and `services: []`.
- [ ] Unit test: an envelope for an unknown service returns `SERVICE_NOT_FOUND`.

#### Manual Verification
- [ ] `npx tsx packages/prism-daemon/src/index.ts` boots on `127.0.0.1` *(verified: prints `broker listening on ws://… — 0 service(s)`)*; `wscat -c ws://127.0.0.1:6780`, send `{"type":"hello","clientId":"me","version":"0"}` → receive `WSWelcome` with empty registry.

> **Deviation (flagged):** runs via `tsx` (repo `noEmit` convention) rather than `node dist/index.js`. Broker self-port defaults to **6780** (distinct from paseo :6767).

**Checkpoint:** [x] **Phase 1 complete** — automated verified 2026-06-13 (typecheck clean · 2/2 vitest pass · boot smoke prints listening line).

---

## Phase 2 — Adapter interface + `WebSocketAdapter` (agent-run / paseo)
**Goal:** Define the `Adapter` contract and implement the first one. Proves the end-to-end path: client → broker → adapter → backend → stream back.

**Files:**
- create `src/adapters/types.ts` — `Adapter`, `ProbeResult`, `StreamEvent`, `AdapterType`
- create `src/adapters/websocket.ts` — `WebSocketAdapter` wrapping paseo's daemon-client
- modify `services.config.json` — add `agent-run` (`adapterType: "websocket"`, `endpoint.local: "ws://127.0.0.1:6767"`, `healthProbe: "hello"`)
- modify `src/router.ts` — dispatch `agent-run` → adapter `call`/`stream`

**Steps:**
1. Define the `Adapter` interface (`connect/probe/describe/call/stream/disconnect`).
2. Implement `WebSocketAdapter`: connect to paseo `:6767`, `probe()` via paseo hello/welcome, map methods (`ls/run/attach/send/stop`) onto `call`/`stream`.
3. Router resolves the descriptor → adapter; broker probes `agent-run` on boot → `status: ready` if paseo is up, else `stopped`.

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Unit test: router dispatches `service:"agent-run"` to a mock adapter's `call`/`stream`.
- [ ] Integration test (skipped if paseo not running): `probe()` returns `ready` with a manifest.

#### Manual Verification
- [x] *Proven against a mock backend (automated):* client → broker → `agent-run` adapter → echo result; `stream` yields all frames in order.
- [ ] *Live paseo (pending paseo-dialect — see deviation):* `{service:"agent-run", method:"ls"}` against `:6767`.

> **Deviation (flagged):** `WebSocketAdapter` speaks a clean generic dialect (hello/welcome · request/response · stream). The Adapter contract is **proven end-to-end against a mock**. Talking to the *live* paseo daemon needs a thin paseo-dialect translation (a per-service relay, same shape as design-studio `:7457`) — **tracked follow-up** (worklist §I).

**Checkpoint:** [x] **Phase 2 complete** — automated verified 2026-06-13 (typecheck clean · 7/7 vitest: adapter probe/call/stream + dead-endpoint + client→broker→adapter round-trip).

---

## Phase 3 — `RestAdapter` (design-gen) + DesignEngineHost migration
**Goal:** Formalize the in-flight `design-studio :7457` relay as a broker adapter and migrate the VS Code panel's 6 messages to broker calls — non-breaking. Highest integration value; coordinate with the concurrent idea_init session.

**Files:**
- create `src/adapters/rest.ts` — `RestAdapter` (`probe` = `GET /api/skills`; `call` = POST `/api/chat`, `/status`, `/launch`, `/stop`; `stream` = SSE if present)
- modify `services.config.json` — add `design-gen` (`adapterType: "rest"`, `endpoint.local: "http://127.0.0.1:7457"`, `healthProbe: "GET /api/skills"`)
- modify `apps/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` — re-point the 6 `DesignEngineHost` handlers from direct relay calls to broker envelopes (table below)

**Message mapping (preserve the 6 webview message types; swap the backend call):**
| Webview message | Broker call |
|---|---|
| `requestDesignEngineState` | `registry.query("design-gen")` + `design-gen.state` |
| `launchDesignEngine` | `design-gen.launch` |
| `stopDesignEngine` | `design-gen.stop` |
| `sendDesignPrompt` | `design-gen.chat { brief, design_system, type }` |
| `openDesignArtifact` | client-side (`openExternal`/`showDocument`) — unchanged |
| `openFile` | client-side (`showDocument`) — unchanged |

**Steps:**
1. Implement `RestAdapter`.
2. Register `design-gen`; readiness via `GET /api/skills`.
3. Migrate `PrismPanelProvider` handlers to the broker client; **rebase on idea_init's uncommitted edits first** (read their version, preserve their 6 handlers, swap the transport).

#### Automated Verification
- [ ] typecheck + build pass for `@prism/daemon` and `apps/prism-vscode`.
- [ ] Unit test: `RestAdapter.probe()` parses a mocked `/api/skills` 200 → `ready`.
- [ ] Unit test: each of the 6 messages maps to the expected broker call (mock broker client).

#### Manual Verification
- [ ] Launch the design engine from the VS Code Design panel **through the broker**; `/api/skills` flips status to `ready`; sending a prompt drops an artifact bundle in `.prism/shared/designs/`.

---

## Phase 4 — `StdioMcpAdapter` (code-intel / codebase-memory-mcp)
**Goal:** Broker the code-intel service over stdio-MCP.

**Files:**
- create `src/adapters/stdio-mcp.ts` — spawn `codebase-memory-mcp`, MCP `initialize`, `tools/list` (→ `describe`), `tools/call` (→ `call`)
- modify `services.config.json` — add `code-intel` (`adapterType: "stdio-mcp"`, `spawnCmd: "codebase-memory-mcp"`, `healthProbe: "tools/list"`)

**Steps:**
1. Implement `StdioMcpAdapter`: spawn process, MCP handshake, map tools (`search_graph`, `trace_path`, `index_repository`, …) to broker methods; `describe()` from `tools/list`.
2. Register `code-intel`; readiness = `tools/list` responds.

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Unit test: MCP request/response framing over a mock stdio pipe.
- [ ] Integration test (skipped if binary absent): `tools/list` returns the tool set.

#### Manual Verification
- [x] **Proven against the LIVE `codebase-memory-mcp` binary** (smoke, 2026-06-13): `probe.ok:true`, real toolset returned (`index_repository`, `search_graph`, `query_graph`, `trace_path`, `get_graph_schema`, `detect_changes`, `manage_adr`, …). No dialect, no Windows spawn issue.
- [ ] Through a client envelope: `{service:"code-intel", method:"search_graph", payload:{...}}` → graph results (covered by the broker-dispatch path proven in Phase 2).

**Checkpoint:** [x] **Phase 4 complete** — automated verified 2026-06-13 (typecheck clean · 11/11 vitest · **live-binary smoke green**). Unlike paseo, code-intel needs no dialect — MCP is standard.

---

## Phase 5 — `FlaskHttpAdapter` (knowledge / 3d-gen / cinopsis / notebooks)
**Goal:** ONE parameterized adapter covering all four Python/Flask services.

**Files:**
- create `src/adapters/flask-http.ts` — generic Flask HTTP adapter, parameterized `{ port, skillsEndpoint, spawnCmd? }`; `probe` = configured discovery GET; `call` = POST; `stream` = SSE/chunked
- modify `services.config.json` — add `knowledge` (Graphify), `3d-gen` (Lucid), `cinopsis`, `notebooks` entries (each `flask-http` + its port + discovery endpoint)

**Steps:**
1. Implement `FlaskHttpAdapter` (optional `spawnCmd`; probe; call; stream).
2. Register the 4 services from config, each instantiating the same adapter class with different params.

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Unit test: one config drives `probe`/`call` against a mock Flask server.
- [ ] Unit test: 4 distinct configs instantiate 4 working descriptors from the single adapter class.

#### Manual Verification
- [x] *Proven against a mock Flask backend (automated):* probe parses the skills manifest; `call` POSTs to `/{method}` and returns JSON; **one adapter class instantiates for all four services**.
- [ ] With a live Flask service (Cinopsis/Graphify/etc.) on its port: `{service:"cinopsis", method:...}` routes; `status: ready` when its discovery endpoint answers.

**Checkpoint:** [x] **Phase 5 complete** — automated verified 2026-06-13 (typecheck clean · 15/15 vitest). ONE adapter → four services; broker registry now carries 6 services across 3 protocol families.

---

## Phase 6 — try-local→cloud (`resolveEndpoint` + gates)
**Goal:** Local-first execution with a cloud fallback gated by capability (e.g., VRAM).

**Files:**
- create `src/resolve.ts` — `resolveEndpoint(desc)`, `ServiceGate`, `passesGate`, `probeWithin(url, probe, ms)` using `AbortSignal.timeout`
- modify `src/router.ts` — call `resolveEndpoint` before the adapter call; cache `descriptor.lastProbe`
- modify `services.config.json` — add `endpoint.cloud` + `gate` where relevant (e.g., `3d-gen` `gate:{kind:"vram",min:24}`, `endpoint.cloud:"<RunPod url>"`)

**Steps:**
1. Implement `resolveEndpoint`: if `local` + `passesGate` + `probeWithin(1500ms)` → local; else if `cloud` → cloud; else `GATE_FAILED`/`SERVICE_UNAVAILABLE`.
2. Implement `passesGate` (vram via `nvidia-smi` parse or config override; binary via `which`; custom fn).
3. Router caches `lastProbe { at, ok, latencyMs, via }`.

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Unit tests: local-pass→local; gate-miss→cloud; no-cloud→`GATE_FAILED`; local-timeout→cloud.

#### Manual Verification
- [x] **Live boot smoke (2026-06-13):** `tsx src/index.ts` → `broker listening … — 6 service(s)` then `ready services: code-intel` (init resolved + probed all 6; the live codebase-memory-mcp auto-came-up; the other 5 gracefully not-ready). Full pipeline confirmed.
- [x] *Gate-fall-back (automated):* `init({gate:()=>false})` → `lastProbe.via === "cloud"`.

**Checkpoint:** [x] **Phase 6 complete** — automated verified 2026-06-13 (typecheck clean · 25/25 vitest · live boot smoke green). `broker.init()` is the boot-readiness pass; `resolveEndpoint` + VRAM gate wired.

---

## Phase 7 — Relay (reuse paseo's, self-hosted)
**Goal:** Remote access over the sovereign E2EE relay; LAN stays direct.

**Files:**
- create `src/relay-client.ts` — `createDaemonChannel` from `apps/prism-mobile/packages/relay`, dial `prism.digitalgriot.studio/relay`
- modify `src/broker.ts` — accept relay-bridged sessions (same handshake/envelope)
- create `src/pairing.ts` — emit QR with the broker public key

**Steps:**
1. Import the relay package; open an outbound daemon channel to `prism.digitalgriot.studio`.
2. Broker accepts both direct WS (LAN) and relay-bridged sessions identically.
3. Pairing: print a QR (broker pubkey); client scans → connects via relay.

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Handshake-parity test over the relay channel (mirror paseo's `dist-handshake-parity` test).

#### Manual Verification
- [ ] Pair a remote client via QR over the relay; an envelope round-trips E2EE; a LAN client connects directly in parallel.

---

## Phase 8 — Surface clients (`prism-daemon-client` TS + Go WS client)
**Goal:** A shared TS client for the TS surfaces, and a hand-written Go WS client for the CLI (Option A).

**Files:**
- create `packages/prism-daemon-client/` — TS client: transport-pluggable (direct WS + relay), `connect()`→welcome, `call`, `stream`, `onServiceUpdate`, registry cache
- create `apps/prism-cli/daemon/client.go` — Go WS client (`gorilla/websocket`), `BrokerEnvelope` JSON, `Call`/`Stream`, registry + `service_update`
- modify one TS surface (VS Code) to consume `prism-daemon-client`; modify `apps/prism-cli` to add a `daemon ls`/`daemon call` command path

**Steps:**
1. Build `prism-daemon-client` (TS): hello/welcome, call/stream, registry subscription.
2. Build the Go WS client: connect, hello, decode welcome+registry, call/stream, handle `service_update`.
3. Wire VS Code to list services + call one (e.g., `code-intel`); add CLI `prism daemon ls`.

#### Automated Verification
- [ ] `npm run typecheck`/`build` for `@prism/daemon-client`.
- [ ] `go build ./...` + `go test ./...` in `apps/prism-cli`.
- [ ] Conformance test: TS client and Go client receive an identical `services` snapshot from a running broker.

#### Manual Verification
- [ ] `prism daemon ls` (CLI) lists the broker's services; the VS Code panel shows the live registry and can invoke a service.

---

## Phase 9 — Dynamic registration + health loop
**Goal:** Services can self-register; the broker keeps the registry honest.

**Files:**
- modify `src/broker.ts` — `POST /register` + `POST /deregister`; health-check interval
- modify `src/registry.ts` — register/deregister + per-service health scheduling

**Steps:**
1. `POST /register { id, adapterType, endpoint, manifest }` → upsert → probe → broadcast `service_update`.
2. Health loop: periodic `probe` per service; on status change → `service_update`; on fail → `error`/`stopped`.
3. Demonstrate `design-studio` self-registering dynamically (instead of static config).

#### Automated Verification
- [ ] typecheck + build pass.
- [ ] Unit test: `register` → `probe` → `service_update` broadcast to subscribed sessions.
- [ ] Unit test: health-fail → `status: error` → broadcast.

#### Manual Verification
- [x] *Proven (automated, real HTTP + WS):* `POST /register` → service builds/probes/`ready` + connected client receives `service_update`; `POST /deregister` → removed + `service_update(stopped)`; `GET /services` snapshot; `runHealthCheck()` flips a downed backend to `error` and broadcasts.

**Checkpoint:** [x] **Phase 9 complete** — automated verified 2026-06-13 (typecheck clean · 29/29 vitest). HTTP control plane (`/register` `/deregister` `/services`) + `service_update` broadcast + health loop (`startHealthLoop`, unref'd).

---

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|---|---|---|
| TS↔Go protocol drift | Med | Append-only rule + a single `protocol.ts` as source of truth + the Phase 8 conformance test |
| design-gen migration collides with idea_init's uncommitted `PrismPanelProvider` edits | Med | Phase 3 step 3: read + rebase on their version first; keep the 6 message types stable |
| paseo relay/server live in `apps/prism-mobile/packages/*`, not a shared package | Med | Import directly for now; note a future "extract relay to `packages/`" refactor (don't block on it) |
| Graph index stale re: tonight's uncommitted changes | Low | Re-index after Phase 3 |
| VRAM gate detection on Windows | Low | `nvidia-smi` parse with a config override fallback |

## Edge Cases
- Service in config but backend down → `status: stopped`, client offered "launch".
- Capability mismatch across clients → `session.supports()` gates per-client at serialization.
- Relay down but LAN up → direct connection still works.
- 6-month-old mobile client + new broker → append-only schema guarantees parse.
- `codebase-memory-mcp` not on PATH → `code-intel` `status: error`, graceful.

## Next
After approval → `/prism-implement` (phase by phase) or `/prism-subagent` (subagent-driven, given 9 independent phases). Phase 3 requires coordination with the concurrent idea_init session before its `PrismPanelProvider` edits are committed.
