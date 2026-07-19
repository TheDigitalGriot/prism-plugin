---
date: 2026-07-18
researcher: Claude
git_commit: a0923b51305a1d085965ffea80de2716f9407592
branch: main
topic: "Claude connector + artifact popout for Prism — Desktop connector mechanics, MCP Apps substrate, exposure inventory"
tags: [research, claude-connector, artifact-popout, mcp, mcp-apps, claude-desktop, cowork, broker, brainstorm-channel]
status: complete
last_updated: 2026-07-19
---

# Research: Claude Connector + Artifact Popout for Prism

## Research Question

Two features, research-first (per handoff `2026-07-17_04-33-12_v420-shipped-connector-artifact-kickoff.md`):

1. **Claude connector** — how do Claude Desktop / claude.ai connectors register, authenticate, and surface tools, and what can Prism expose? (HEAD START, verified 2026-07-17: brainstorm-channel already appears under the plugin's Connectors tab in Claude Desktop on 4.3.1 — the mission is "expand what Prism exposes," not "invent the plumbing.")
2. **Artifact popout** — is MCP Apps (`@modelcontextprotocol/ext-apps`) the right substrate for an artifact-style pop-out rendering surface?

## Summary

**MCP Apps is a confirmed, shipping substrate**: launched as the first official MCP extension on 2026-01-26, rendered today by Claude web, Claude Desktop, Cowork, and Claude iOS/Android — sandboxed iframe, two display modes (inline card + fullscreen via `ui/request-display-mode`), no allowlist required for use. **Claude Code CLI does not render MCP Apps**, so IDE-side rendering remains the province of Prism's own webview surfaces (VS Code panels / Electron windows). On the connector side, the broker (`:6780`) already registers 7 services — two of which (`code-intel`, `knowledge`) *are already MCP servers* spawned via the broker's `stdio-mcp` adapter — and exposes a unary `POST /call` HTTP endpoint, so fronting all broker services through one plugin-bundled MCP server is a thin bridge, not new plumbing.

## Prior Art in .prism/ (from prism-locator, 42+ research / 44 plans / 7 handoffs scanned)

| Path | Date | Relevance |
|---|---|---|
| `.prism/shared/handoffs/2026-07-17_04-33-12_v420-shipped-connector-artifact-kickoff.md` | 2026-07-17 | Mission kickoff — scope, suggested approach, parked pairing stall |
| `.prism/shared/plans/2026-06-13-prism-daemon-broker.md` | 2026-06-13 | Approved broker contract — registry, 4 adapter families, phases |
| `.prism/shared/research/2026-06-13-prism-vs-paseo-surface-architecture.md` | 2026-06-13 | Surface UI anatomy — CLI/VSCode/Electron/Mobile rendering stacks |
| `.prism/shared/docs/SURFACE-CONNECTIVITY-AND-TESTING.md` | 2026-07-03 | How each surface reaches broker :6780 / daemon :6767; WS + `/call` |
| `prism-docs/docs/daemon/broker.md` | current | Broker protocol spec (envelope, registry, control plane, health) |
| `prism-docs/docs/daemon/surface-connectivity.md` | current | Production state incl. droplet (Model B) + Griot relay |
| `prism-docs/docs/daemon/clients.md` | current | TS + Go daemon client contracts |
| `.prism/shared/plans/2026-06-13-desktop-daemon-manager.md` | 2026-06-13 | Desktop supervisor — surfaces sharing one daemon |
| `.prism/shared/research/2026-06-12-paseo-daemon-architecture-surface-impact.md` | 2026-06-12 | Daemon internals, adapter families |
| `.prism/shared/brainstorms/2026-06-12-code-intel-memory-layer.md` | 2026-06-12 | Locked broker decisions Q1–Q5 |
| `.prism/shared/research/2026-06-03-cl-plugin-structure-integration.md` | 2026-06-03 | Plugin-structure skill bundling history |

## Files Discovered (from codebase-locator + direct reads)

### Broker :6780
| Path | Description |
|---|---|
| `packages/prism-daemon/src/index.ts` | Daemon entry; PORT default 6780 (line 18); loads services.config.json |
| `packages/prism-daemon/src/broker.ts` | Broker class — HTTP+WS server, adapter routing, sessions |
| `packages/prism-daemon/src/registry.ts` | Registry state (snapshot, setStatus) |
| `packages/prism-daemon/src/router.ts` | Routes calls to adapters |
| `packages/prism-daemon/src/adapters/` | Adapter implementations: `websocket-paseo`, `stdio-mcp`, `rest`, `flask-http` |
| `packages/prism-daemon/src/protocol.ts` | `BrokerEnvelope`, `ServiceDescriptor`, `WSWelcome` types |
| `packages/prism-daemon/services.config.json` | The 7 default service descriptors |
| `packages/prism-daemon-client/` | Client SDK (ws + stdio transports) |

### Plugin MCP surface (what surfaces in Desktop today)
| Path | Description |
|---|---|
| `.claude-plugin/plugin.json` | v4.3.1 manifest — one `mcpServers` entry (`brainstorm-channel`, stdio via `bun`) + `channels: [{server: "brainstorm-channel"}]` |
| `skills/prism-brainstorm/scripts/brainstorm-channel.ts` | The MCP server behind the Connectors-tab surfacing (detail below) |
| `skills/prism-brainstorm/scripts/server.cjs` | Node HTTP server rendering the visual companion; writes canonical events file |
| `.mcp.json` (repo root) | Project-scope servers: codebase-memory-mcp (stdio), chrome-devtools |

### Webview / rendering surfaces
| Path | Description |
|---|---|
| `apps/prism-vscode/src/core/webview/WebviewProvider.ts` | Abstract webview base |
| `apps/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` | `createWebviewPanel` wrapper |
| `apps/prism-vscode/webview-ui/`, `webview-panel/`, `webview-office/` | Vite-built webview UIs |
| `apps/prism-electron/src/main.ts` | BrowserWindow creation (app shell) |
| `apps/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` | preload ↔ renderer IPC |
| `apps/prism-electron/src/daemon/daemon-manager.ts` | Spawns/supervises the broker subprocess |
| `skills/prism-brainstorm/scripts/frame-template.html` | Visual-companion HTML scaffold (component classes) |
| `skills/prism-brainstorm/references/griotwave.md`, `fidelity-engine.md` | Design tokens + lo/mid/hi fidelity spec |
| `packages/prism-ui/` | Shared React component library (webview-ui + mobile) |

## Component Analysis

### Broker :6780 — the exposure inventory

Wire protocol: one WS envelope (`{id, service, method, payload, caps?, stream?, ts}`), `hello`/`welcome` handshake where `welcome` ships the **live registry snapshot**; push frames `service_update`, `service_stream`, `permission_request`. Schemas are append-only. HTTP control plane: `GET /health`, `GET /services`, `POST /register`, `POST /deregister`, and **`POST /call`** — a unary service call over plain HTTP so surfaces never bundle `ws` (`prism-docs/docs/daemon/broker.md`).

The 7 registered services (`packages/prism-daemon/services.config.json`):

| Service | Adapter | Endpoint | Note |
|---|---|---|---|
| `agent-run` | `websocket-paseo` | `ws://127.0.0.1:6767` | Agent daemon (vendored paseo fork) |
| `code-intel` | `stdio-mcp` | spawn `codebase-memory-mcp` | **Already an MCP server** |
| `knowledge` | `stdio-mcp` | spawn `graphify-mcp` | **Already an MCP server** |
| `design-gen` | `rest` | `http://127.0.0.1:7457` (+ `:7456` chat/skills) | Routes: state/launch/stop/send |
| `3d-gen` | `flask-http` | local `:7520`, cloud `https://3d.prism.digitalgriot.studio` | VRAM gate ≥24 GB, try-local→cloud |
| `cinopsis` | `flask-http` | `http://127.0.0.1:5123` | video → structured |
| `notebooks` | `flask-http` | `http://127.0.0.1:8888` | Jupyter |

Capabilities in each `ServiceDescriptor` come from **SKILL.md discovery** (`SkillManifestEntry[]`) — services already self-describe. Health loop re-probes every 15 s and broadcasts `service_update`. The `stdio-mcp` adapter means the broker already *consumes* MCP servers as services; a connector exposing broker services to Claude Desktop is the inverse direction (MCP server fronting `POST /call`).

### brainstorm-channel — the pattern already surfacing in Desktop

`skills/prism-brainstorm/scripts/brainstorm-channel.ts` (spawned via `bun` at plugin load, per `plugin.json:9-20`):

- **Dual listener in one process**: MCP stdio transport + a `Bun.serve` HTTP listener on `127.0.0.1:52342` (`BRAINSTORM_CHANNEL_PORT` override). Browser clicks POST `/channel` → MCP notification → Claude wakes.
- **Wake-signal-only design** (B1a): the notification carries a minimal signal; the events file written by `server.cjs` is the canonical event log.
- **Session routing** (B1b): `/register`, `/unregister`, in-memory `sessionRegistry`; empty registry = fire unconditionally (single-session back-compat).
- **Passive mode** (B1d): a capability probe at startup; on failure (runtime < v2.1.80) wake notifications are suppressed but the events file still logs. `/status` exposes `passive` so the viewer can render an indicator.
- **As-built specifics**: declares `capabilities: {}` (not the `claude/channel` experimental capability documented in `skills/cl-plugin-structure/references/channel-patterns.md`) and emits `notifications/message/create` (the reference documents `notifications/claude/channel`). Meta keys sanitized to `/^[A-Za-z0-9_]+$/`. Whatever Desktop's Connectors tab keys on to surface this server on 4.3.1, it is not the `claude/channel` capability declaration — undetermined (Open Question 1).

### Webview surfaces (existing rendering stack)

Three independent rendering stacks (per `2026-06-13-prism-vs-paseo-surface-architecture.md`): VS Code webviews (Vite-built `webview-ui/`, panel + office variants, shared `packages/prism-ui` React components), Electron BrowserWindows (IPC bridge, bundled daemon supervisor), and the brainstorm visual companion (static `frame-template.html` + Griotwave tokens + Fidelity Engine, served by `server.cjs`, wake path via brainstorm-channel). The companion is architecturally the closest existing thing to an "artifact popout": model-generated HTML → local server → browser surface → interaction events back to Claude.

### Public infrastructure (relevant to remote-connector constraints)

Prism owns public, already-deployed infrastructure: the Griot relay (`prism.digitalgriot.studio` — Cloudflare Worker + Durable Object, E2EE) and the always-on droplet running the agent daemon under Coolify (`prism:main-daemon`, LIVE per v4.2.0). `3d-gen` already declares a public cloud endpoint (`https://3d.prism.digitalgriot.studio`). These are the assets that satisfy "publicly internet-reachable" if a remote connector path ever enters scope (`prism-docs/docs/daemon/surface-connectivity.md`).

## External Findings (claude-code-guide + web-search, 2026-07-18)

### Connectors: register / auth / surface

**VERIFIED**
- **Local MCP in Desktop**: stdio + HTTP transports; Desktop's "+" → Connectors shows connected servers and their tools. Plugins bundle local MCP servers that "run on your computer with the same permissions as any other program you run" (support.claude.com "Use plugins in Claude"). Desktop's **Customize** menu unifies plugins, skills, connectors.
- **Custom remote connectors** (Settings → Connectors, personal use, no review needed): **Streamable HTTP** required for new builds (HTTP+SSE legacy, being deprecated); `https://` mandatory; OAuth 2.1 + PKCE (S256) when accessing private data; DCR + CIMD + Anthropic-held static credentials supported; auth spec versions 2025-03-26 / 2025-06-18 / 2025-11-25; hosted-surface callback `https://claude.ai/api/mcp/auth_callback`; Claude Code uses port-agnostic loopback redirects.
- **Limits**: claude.ai/Desktop ≈150,000-char max tool result, 300 s timeout; Claude Code 25,000 tokens (`MAX_MCP_OUTPUT_TOKENS`), `MCP_TOOL_TIMEOUT`.
- **Directory submission** (public discoverability) requires a **Team/Enterprise org**, a 10-step in-app portal, security review, tool `title` + `readOnlyHint`/`destructiveHint` annotations, OAuth for authenticated services, privacy policy (missing = immediate rejection), and for MCP Apps a 3–5 PNG screenshot carousel (≥1000 px). Personal/custom connectors need none of this.
- **Cowork routing**: remote connectors reach external services **through Anthropic's cloud** — public reachability required; local stdio plugin servers run on the user's machine (Claude Code/Desktop) but cloud sessions load HTTP servers only.

**UNCERTAIN**
- No official doc explicitly describes a *plugin-bundled* MCP server appearing as a Desktop **Connectors-tab** entry (vs. the Customize plugin view) — the observed 4.3.1 behavior (HEAD START) is empirically true but undocumented. Related rough edges: anthropics/claude-code#23424 ("Local MCP Servers Still Not Working in Cowork Mode"); anthropics/claude-ai-mcp#236 (MCP App widgets not rendering in Cowork under `deploymentMode: "3p"`).

### MCP Apps: status + rendering surfaces

**VERIFIED**
- First official MCP extension, launched **2026-01-26**; stable spec `specification/2026-01-26/apps.mdx`; SDK `@modelcontextprotocol/ext-apps` (~v1.7.4). MCP-UI is now a separate community client library — not the same thing.
- **Rendering hosts**: Claude web, Claude Desktop (Windows since 2026-02-10, macOS at launch), **Cowork, Claude iOS/Android** (support.claude.com 2026-03-25), plus Goose, VS Code Copilot, ChatGPT, Cursor, others (client matrix). **Claude Code CLI: not a rendering host.**
- **Mechanics**: tool + HTML resource linked by `_meta.ui.resourceUri` (`ui://` scheme); sandboxed iframe; JSON-RPC over postMessage; single-file bundle (`vite-plugin-singlefile`); host CSS variables for theming; app-only tools (`visibility: ["app"]`); `getUiCapability()` for graceful degradation to text-only.
- **Display modes**: **inline card** and **fullscreen** (via `ui/request-display-mode`; native close button, composer stays available) — the literal "popout" affordance. Design guidelines at claude.com/docs/connectors/building/mcp-apps/design-guidelines.
- **No allowlist to render** for an installed connector's UI; Team/Enterprise admins can disable interactive-connector tool calls org-wide; desktop-extension enterprise policy flags exist separately.
- CSP: no network by default; `_meta.ui.csp` / `connectDomains` / `resourceDomains` / `frameDomains` declared on the resource's read-callback contents.

**UNCERTAIN**
- Whether Desktop renders App UIs from a **plugin-bundled local stdio** server identically to a remote connector — the launch material and directory docs center remote connectors; local-stdio rendering is implied by the local-MCP docs but not explicitly demonstrated. Empirical verification on 4.3.1 required (Open Question 2).

### Artifacts landscape (adjacent, for scope framing)

**VERIFIED**
- **MCP-integrated artifacts** (artifacts that call connected tools) — Pro/Max/Team/Enterprise, web + desktop.
- **Live Artifacts** in Cowork (launched 2026-04-21): persistent auto-refreshing dashboards fed by MCP connectors, "Live artifacts" sidebar tab.
- **Claude Code Artifacts** (beta 2026-06-18, Team/Enterprise): session output → self-contained shareable HTML on a claude.ai URL, 16 MiB cap, strict CSP (all assets inlined). Docs: code.claude.com/docs/en/artifacts.
- No public "Artifacts API" (programmatic creation outside chat) was found; MCP Apps is the sanctioned third-party path for interactive surfaces in-chat.

## Patterns Found

1. **Tool + UI resource** (MCP Apps): `registerAppTool` with `_meta.ui.resourceUri` + `registerAppResource` serving a single-file HTML bundle; text `content` fallback always present (mcp-apps skills; ext-apps examples: map-server, pdf-server, system-monitor-server).
2. **MCP server + local HTTP side-channel + browser UI** (`brainstorm-channel.ts:27-44` + `server.cjs`) — Prism's proven Desktop-visible seed; an MCP App collapses the "separate browser tab" leg of this pattern into the chat surface itself.
3. **Broker as MCP consumer** (`packages/prism-daemon/src/adapters/` `stdio-mcp`) — the mirror image of a connector fronting the broker; `POST /call` (`broker.md`) is the natural bridge for unary tool calls, `welcome` registry snapshot the natural source of dynamic tool listings.
4. **Try-local→cloud endpoint resolution** (`broker.init()`, `3d-gen`) — existing precedent for the local-vs-public duality the Cowork cloud-routing constraint imposes.
5. **Fidelity Engine + Griotwave tokens** (`frame-template.html`, `references/griotwave.md`) — an existing design system for model-generated UI; MCP Apps' host CSS variables (`--color-*`, `--font-*`) are the analogous theming layer on the Desktop side.

## Open Questions (for brainstorm)

1. **What does Desktop's Connectors tab key on** to surface brainstorm-channel on 4.3.1, given it declares `capabilities: {}` and uses `notifications/message/create`? (Empirical probe: does any stdio `mcpServers` entry surface, or is the `channels` binding involved?)
2. **Does a plugin-bundled local stdio MCP server's App UI render in Desktop chat?** The decisive architectural fact for the artifact popout; needs a minimal ext-apps spike on 4.3.1 to verify (no doc confirms or denies).
3. **Which broker services to expose, at what granularity** — all 7 via a generic bridge (dynamic tools from the registry snapshot) vs. curated per-service tools? `agent-run` exposure implies an agent-orchestration permission surface inside Desktop chat.
4. **Scope of surfaces**: Desktop/web only (MCP Apps), or parity popouts in VS Code/Electron webviews (which MCP Apps cannot reach, since Claude Code CLI doesn't render)? Same single-file HTML bundle could feed both hosts.
5. **Cowork/remote lane**: in or out of scope? If in — Streamable HTTP server, public reachability (relay/droplet assets exist), OAuth; if out — local stdio only, simpler.
6. **Runtime dependency**: brainstorm-channel spawns via `bun`; a new connector server adds `@modelcontextprotocol/ext-apps` + a Vite build. Node vs Bun, bundling, and `${CLAUDE_PLUGIN_DATA}` placement to decide.
7. **Directory ambitions**: personal/custom connector needs no review; the Anthropic directory requires Team/Enterprise + security review + screenshot carousel. Which tier is the target?
8. **Broker not running**: Desktop can spawn the connector server at plugin load, but broker :6780 is supervised by the Electron desktop or run manually — connector behavior when the broker is down (spawn it? degrade?) is undefined today.

## Sources

- MCP Apps launch: blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ · spec: github.com/modelcontextprotocol/ext-apps (specification/2026-01-26/apps.mdx) · client matrix: modelcontextprotocol.io/extensions/client-matrix · SDK: npmjs.com/package/@modelcontextprotocol/ext-apps
- Interactive connectors in Claude (surfaces + display modes): support.claude.com/en/articles/13454812 (2026-03-25)
- Building connectors: claude.com/docs/connectors/building · submission: claude.com/docs/connectors/building/submission · MCP Apps design guidelines: claude.com/docs/connectors/building/mcp-apps/design-guidelines
- Plugins in Claude (local MCP in plugins, Customize menu): support.claude.com/en/articles/13837440 · local MCP on Desktop: support.claude.com/en/articles/10949351
- Known issues: github.com/anthropics/claude-code/issues/23424 · github.com/anthropics/claude-ai-mcp/issues/236
- Artifacts: claude.com/blog/artifacts-in-claude-code (2026-06-18) · code.claude.com/docs/en/artifacts · Live Artifacts in Cowork (2026-04-21 coverage)
- Internal: prism-docs/docs/daemon/broker.md · surface-connectivity.md · clients.md · .prism/shared/plans/2026-06-13-prism-daemon-broker.md · .prism/shared/docs/SURFACE-CONNECTIVITY-AND-TESTING.md

---

## Follow-up [2026-07-19] — Spikes resolved + live-proven Desktop surface

Both requested verification spikes resolved **without building the ext-apps probe** — one via local recon, one via a parallel Cowork session's live result.

### Open Question 1 → RESOLVED (recon): what Desktop keys on
Evidence from Desktop's own state on this machine:
- `%APPDATA%/Claude/logs/mcp-info.json` lists Desktop's classic-config / Desktop-Extension MCP servers (Windows-MCP, Context7, blender, github, pencil, mcp-registry, Claude in Chrome). **brainstorm-channel is absent.**
- Classic servers each get an `mcp-server-<name>.log`; there is **no `mcp-server-brainstorm-channel.log`**. "brainstorm" appears only in `main.log` / `cowork_host_loop_debug.log` / `claude.ai-web*.log` — the plugin/cowork host path.
- `~/.claude/plugins/installed_plugins.json` shows `prism@prism-marketplace` **4.3.1** installed user-scope (updated 2026-07-18).

→ Desktop surfaces brainstorm-channel because it is an `mcpServers` entry in the **installed plugin's `plugin.json`**, discovered via the marketplace/plugin system — NOT via `claude_desktop_config.json`, and NOT because of the `channels` binding or a `claude/channel` capability. **Surfacing = being a plugin-declared MCP server.** (Explains why `capabilities: {}` never mattered.)

### Open Question 2 → RESOLVED (live, parallel session): rich UI + click-to-wake works in Desktop — via a DIFFERENT substrate than ext-apps
A parallel Cowork (Claude Desktop, cloud) session rendered the Griotwave visual companion **inline** and **responded to button clicks** — documented in [`prism-brainstorm-claude-desktop-surface.md`](./prism-brainstorm-claude-desktop-surface.md). The working mechanism is **Cowork's `show_widget` (inline render; wake via `sendPrompt()`) + `create_artifact` (sidebar gallery persist)** — NOT the `@modelcontextprotocol/ext-apps` `_meta.ui.resourceUri` iframe path this doc's main body assumed. The ext-apps probe is therefore **stood down** (it would test the wrong substrate).

### New key finding — three distinct render substrates, not one
| Substrate | Where it works | Wake hook | Plugin-shippable | Proven |
|---|---|---|---|---|
| Native localhost + Chrome companion | Claude Code CLI (local Chrome) | brainstorm-channel | yes (exists) | ✅ yes |
| Cowork `show_widget` / `create_artifact` | Cowork / Claude Desktop cloud session | `sendPrompt()` (widget only) | via plugin agent tools | ✅ **yes — live** |
| ext-apps MCP App (`ui://` iframe) | Claude Desktop + web + Cowork (MCP Apps) | tool call round-trip | yes (bundled MCP server) | ❌ no (unbuilt) |

**Scope implication:** the parallel session solved the **companion-render-on-Desktop** slice (proving surface + a reference adapter + a §5 surface-resolver). The **connector service-exposure** half (expose agent-run / design-gen / 3d-gen / code-intel / etc. to Desktop) remains open. The artifact-popout feature now carries an explicit **substrate fork**: Cowork widget tools vs ext-apps MCP App vs generalize the native companion vs a surface-resolved hybrid (the adapter doc already proposes hybrid).

**Minor gap noted:** the live Desktop render is missing the **Prism icon** in the header (otherwise "a thing of beauty"). Captured for companion-template polish.
