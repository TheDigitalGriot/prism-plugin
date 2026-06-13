---
title: Seam Bridge
description: How brokered services become reachable through Prism's existing in-process gRPC client.
outline: [2, 3]
---

# Seam Bridge

Prism has **two** seams where the UI asks the logic to do something, and they share one grammar:

| | In-process seam | Over-the-wire seam |
|---|---|---|
| Where | `grpc-handler` (`@prism/core`, Cline-derived) | `packages/prism-daemon` broker |
| Envelope | `{ service, method, message, request_id, is_streaming }` | `BrokerEnvelope { id, service, method, payload, stream }` |
| Dispatch | `service.method` → unary / stream registry | `service` → adapter → `method` |
| Transport | `postMessage` (VS Code) / IPC (Electron) | WebSocket (+ HTTP `/call`) |

Both are **`service.method` dispatch with unary + streaming + request-id correlation**. The
seam bridge exploits that symmetry.

## BrokerForwarder

`grpc-handler` gains an injectable forwarder. When a `service.method` key has **no local
handler**, the request is forwarded to the broker — and the result streams back through the
*same* `grpc_response` channel the webview already listens to:

```ts
export type BrokerForwarder = (
  request: { service: string; method: string; message: unknown; request_id: string; is_streaming: boolean },
  respond: StreamResponseFn,
) => Promise<boolean>   // true = handled, false = fall through to "unknown handler"

registerBrokerForwarder(fn | null)
```

The host installs the forwarder. The renderer's existing gRPC client dials `service.method` and
**never knows** whether the answer came from the local extension or the remote daemon — one phone
book, calls routed to either.

## Electron wiring

`ElectronIPCBridge` installs a forwarder for the brokered service set (`agent-run`, `code-intel`,
`design-gen`, `knowledge`, `3d-gen`, `cinopsis`, `notebooks`). Unary calls `POST` to the running
broker's `/call`; streaming declines (handled directly) for now.

## Why it matters

This is what makes "hybrid" not a dead end. Once brokered services are reachable through the
same envelope the webviews already speak, moving the agent loop behind the broker later becomes
a **transport flip** on calls the UI already makes — not a UI rewrite.

::: tip Deferred
The VS Code-side forwarder is a follow-up (the Electron side ships in v3.6.0). The grpc-handler
change itself is shared in `@prism/core`, so wiring VS Code is the same one-liner registration.
:::
