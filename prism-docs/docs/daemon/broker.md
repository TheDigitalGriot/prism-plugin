---
title: Broker Core
description: The wire protocol, service registry, control plane, and health loop of the Prism daemon-broker.
outline: [2, 3]
---

# Broker Core

`packages/prism-daemon` — the broker process. Default bind `127.0.0.1:6780`
(override with `PRISM_DAEMON_HOST` / `PRISM_DAEMON_PORT`). Runs via `tsx` in dev, or as a
single esbuilt `.cjs` bundle when supervised by the desktop.

## Wire protocol

All surfaces speak one WebSocket envelope:

```ts
interface BrokerEnvelope {
  id: string        // request correlation id
  service: string   // e.g. "code-intel"
  method: string    // e.g. "search"
  payload: unknown
  caps?: string[]   // capability gating
  stream?: boolean
  ts: number
}
```

### Handshake

```
client → { type: "hello", clientId, version, caps? }
server → { type: "welcome", brokerVersion, sessionId, services }   // ships the live registry
```

The `welcome` frame carries the full service registry snapshot, so a client knows what's
available the moment it connects.

### Push frames

- `service_update` — a service changed status (registry mutation, health flip).
- `service_stream` — a streamed result chunk for a `stream: true` call.
- `permission_request` — a service is requesting user permission (round-tripped to the client).

Schemas are **append-only** — add fields, never remove or narrow — so old clients keep working
against new brokers.

## Service registry

Each service is a `ServiceDescriptor`:

```ts
interface ServiceDescriptor {
  id: string
  name: string
  status: "stopped" | "starting" | "ready" | "error"
  adapterType: "websocket" | "websocket-paseo" | "rest" | "stdio-mcp" | "flask-http"
  endpoint: { local?: string; cloud?: string }
  capabilities: SkillManifestEntry[]   // from SKILL.md discovery
  healthProbe: string
  gate?: { kind: "vram"; min: number }
  routes?: Record<string, { verb: string; url: string }>
  lastProbe?: number
}
```

Readiness is established when a service answers its discovery endpoint — design-gen proves this
via `GET /api/skills`; Flask services via `GET /skills`.

The 7 default services are declared in `services.config.json`: `agent-run`, `code-intel`,
`design-gen`, `knowledge`, `3d-gen`, `cinopsis`, `notebooks`.

## HTTP control plane

Alongside the WebSocket, the broker exposes a small HTTP API:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ ok, version, serviceCount, ready }` — liveness + version (used by the desktop supervisor) |
| `GET` | `/services` | the live registry snapshot |
| `POST` | `/register` | dynamically add a service (`{ id, adapterType, endpoint, healthProbe }`) → probe → broadcast |
| `POST` | `/deregister` | remove a service (`{ id }`) → broadcast |
| `POST` | `/call` | a unary service call over plain HTTP (`{ service, method, payload }`) — so surfaces never bundle `ws` |

`PRISM_DAEMON_CONFIG` overrides the config path so a bundled broker can locate its
`services.config.json`.

## try-local → cloud

A service can declare both a `local` and a `cloud` endpoint plus a `gate` (e.g. VRAM minimum).
At boot, `broker.init()` resolves each endpoint: it probes `local` within an
`AbortSignal.timeout`, and falls back to `cloud` (RunPod / HF) when local is unreachable or the
gate isn't met (`PRISM_VRAM_GB` env override, else `nvidia-smi`). The resolution is cached in the
descriptor. This is the core 3D-gen UX: GGUF models run locally on small VRAM; 24 GB models route
to the cloud.

## Health loop

`broker.startHealthLoop()` re-probes services every 15 s; a status change broadcasts a
`service_update` to all connected clients (LAN and relay alike). A backend going down flips its
status to `error` and the surfaces' indicators update live.
