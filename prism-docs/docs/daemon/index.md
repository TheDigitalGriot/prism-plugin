---
title: Daemon Broker Overview
description: The sovereign, self-hosted multi-service daemon-broker every Prism surface speaks to.
outline: [2, 3]
---

# Daemon Broker

> Introduced in **v3.6.0 — The Daemon Arc.**

The **Prism daemon-broker** is one sovereign, self-hosted hub that fronts every backend
service — agents, code-intelligence, design generation, knowledge, 3D, video, notebooks —
behind a **single client protocol**. Every surface (CLI, VS Code, Electron, Mobile) speaks
the same wire envelope to it.

```
Surfaces:  CLI (Go) · VS Code (TS) · Electron (TS) · Mobile (Expo)
                            │
        in-process gRPC seam (grpc-handler, postMessage/IPC) ─┐
                            │                                 ├─ same {service,method,payload} envelope
        over-the-wire broker (WebSocket :6780 + HTTP /call) ──┘
                            │
   ┌──────────────┬─────────┼──────────────┬───────────────┐
 agent-run     code-intel  design-gen    knowledge       3d-gen / cinopsis / notebooks
 (paseo WS)    (stdio MCP) (REST relay)  (Flask HTTP)     (Flask HTTP, try-local→cloud)
                            │
              relay (E2EE, @prism/relay) → off-LAN clients via QR pairing
```

## Why a broker

Before v3.6.0, Prism surfaces coordinated through files and ran agents in-process. The broker
introduces a shared **runtime** so that:

- N heterogeneous backend protocols are normalized to **ONE** client protocol.
- Any surface — including the Go CLI and the mobile app — reaches any service the same way.
- New Griot tools (Synaptiq, Lucid, Cinopsis…) plug in as services, not bespoke integrations.

## Sovereignty invariant

Every donor (paseo, open-design, Graphify, codebase-memory-mcp) is **absorbed** into a
Prism-owned package — never a runtime dependency that traffic routes through. The broker is
built as **Fragment-template DNA**: broker + adapters + relay + clients can be lifted out for
every Griot tool.

## The pieces

| Component | Package / location | Page |
|---|---|---|
| Broker core | `packages/prism-daemon` | [Broker Core](/daemon/broker) |
| Adapters (4 families) | `packages/prism-daemon/src/adapters` | [Adapters](/daemon/adapters) |
| Surface clients (TS + Go) | `packages/prism-daemon-client`, `apps/prism-cli/daemon` | [Clients](/daemon/clients) |
| Desktop supervisor | `apps/prism-electron/src/daemon` | [Desktop Manager](/daemon/desktop-manager) |
| Seam bridge | `packages/prism-core` grpc-handler | [Seam Bridge](/daemon/seam-bridge) |
| E2EE relay | `packages/prism-relay` | [Relay](/daemon/relay) |

## Two seams, one shape

The broker's `BrokerEnvelope { id, service, method, payload, caps, stream, ts }` is the *same
`service.method` grammar* as Prism's in-process gRPC seam (`handleGrpcRequest`). The only
difference is transport — in-process `postMessage`/IPC vs. over-the-wire WebSocket. That
symmetry is what lets the [seam bridge](/daemon/seam-bridge) forward unhandled keys to the
broker transparently, and makes a future "full-managed" move a transport flip rather than a rewrite.
