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

### `AgentRunClient` — brokered agent substrate (v3.7.0) {#agentrunclient}

`packages/prism-daemon-client/src/agent-run.ts` — a thin typed surface for driving one agent turn
through the broker's `agent-run` service: **create → send → stream timeline → cancel**. This is
"full-managed, **step 1**": Prism's orchestration (Spectrum, the 4-phase workflow, signal protocol,
Office) stays exactly where it is and merely swaps its execution call from in-process to brokered.

```ts
const agent = new AgentRunClient(daemonClient)        // transport-injected (DaemonClient shape)
const { agentId } = await agent.createAgent({ cwd, systemPrompt })   // Prism phase prompt stays Prism-owned
await agent.sendMessage(agentId, "implement STORY-001")
for await (const ev of agent.streamTimeline(agentId)) { /* assistant turns, tool calls, trailing signal */ }
await agent.cancel(agentId)
```

It is **gated OFF by default** (`agentsBrokered()` → flip with `PRISM_AGENTS_BROKERED=1`): the
proven in-process `PrismTask` loop remains the default until brokered parity is verified against the
real paseo daemon (step 2). Timeline frames carry the trailing `<spectrum-*>` / `<promise>` text that
Prism's signal parser reads.

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
