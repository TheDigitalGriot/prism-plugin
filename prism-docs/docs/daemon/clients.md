---
title: Surface Clients
description: The TypeScript and Go clients every Prism surface uses to reach the daemon-broker.
outline: [2, 3]
---

# Surface Clients

Paseo could ship one daemon-client because every paseo surface is TypeScript. Prism needs
**two** — because the CLI is Go — both speaking the same wire envelope.

## `@prism/daemon-client` (TypeScript)

`packages/prism-daemon-client` — the client for VS Code, Electron, mobile-web. A `DaemonClient`
with `connect` / `call` / `stream` / `onServiceUpdate` / `getServices`. It carries its **own**
minimal protocol mirror (`src/protocol.ts`) so it has no runtime dependency on the broker package;
`@prism/daemon` is only a dev-dependency, used by a conformance test that guarantees the two
protocol definitions stay in lockstep.

```ts
const client = new DaemonClient("ws://127.0.0.1:6780")
await client.connect()
const services = client.getServices()          // from the welcome handshake
const result  = await client.call("code-intel", "search", { q: "Broker" })
for await (const ev of client.stream("agent-run", "timeline", { agentId })) { /* … */ }
client.onServiceUpdate((s) => updateIndicator(s))
```

## Go client (`apps/prism-cli/daemon`)

`apps/prism-cli/daemon/client.go` — a hand-written `coder/websocket` client (dependency-free,
no Node runtime). It speaks the same `hello → welcome` handshake and `request/response`
envelope, reading the live registry off the welcome frame. Cross-language conformance is proven:
the Go client reads the service registry off the live TypeScript daemon.

```go
client, err := daemon.Dial(ctx, "ws://127.0.0.1:6780")
// client.Services []ServiceDescriptor, client.BrokerVersion, client.SessionID
raw, err := client.Call("code-intel", "search", map[string]any{"q": "Broker"})
```

## `prism daemon ls`

A Cobra subcommand on the Go CLI that dials the broker and prints the live registry:

```
$ prism-cli daemon ls
Prism daemon-broker 0.1.0  ·  7 service(s)  ·  session 8995c546

  error     agent-run     Agent Orchestration (Prism agent daemon, paseo-derived)
  ready     code-intel    Code Intelligence (codebase-memory-mcp)  (14 method(s))
  error     design-gen    Design Generation (prism-design-engine via design-studio)
  error     knowledge     Knowledge / STORE (Graphify → Synaptiq)
  error     3d-gen        3D Generation (Lucid / ComfyUI)
  error     cinopsis      Cinopsis (video → structured)
  error     notebooks     Notebooks (Jupyter)
```

Status badges are colored (ready/running = green, starting = amber, error = red, else dim).
The bare `prism-cli` still launches the TUI; `daemon` is a subcommand group with `--url`
(default `ws://127.0.0.1:6780`).
