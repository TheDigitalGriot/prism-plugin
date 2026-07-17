# MCP Server Patterns

MCP servers add tools/resources to Claude. A plugin declares them in `.mcp.json` at the plugin root (or inline under `mcpServers` in `plugin.json`). They auto-start when the plugin is enabled.

## Server types

| Type | Config key | When |
|------|-----------|------|
| **stdio** (local) | `command` + `args` | Default. Runs a local process with the user's permissions. Lowest latency, no network. |
| **SSE** (remote) | `url` (sse) | Server-sent-events stream from a hosted endpoint. |
| **HTTP** (remote) | `url` (http) | Request/response over HTTP(S). |
| **WebSocket** (remote) | `url` (ws/wss) | Bidirectional persistent connection. |

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/my-tools/index.js"],
      "env": { "DATA_DIR": "${CLAUDE_PLUGIN_DATA}/my-tools" }
    },
    "hosted-api": {
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer ${user_config.api_token}" }
    }
  }
}
```

Always reference bundled server code with `${CLAUDE_PLUGIN_ROOT}` and persisted state (node_modules, caches, db) with `${CLAUDE_PLUGIN_DATA}` — never hardcoded or relative paths.

## Tool naming

Plugin MCP tools are namespaced so they never collide across plugins:

```
mcp__plugin_<plugin-name>_<server-name>__<tool-name>
```

This matters when writing `allowed-tools` / `disallowedTools` filters or `PreToolUse` hook matchers against a specific MCP tool — match the full namespaced name.

## Authentication

- **Token / bearer** — simplest. Read the secret from `${user_config.<key>}` (prompted at enable-time via `userConfig` in `plugin.json`) or an env var; inject as a header. Never hardcode secrets in `.mcp.json` (it ships with the plugin).
- **OAuth 2.0** (SSE/HTTP) — for connectors that need a full auth-code flow: the server handles the OAuth dance and token refresh; the client stores the token out of band. Use for hosted services with per-user accounts. Keep tokens in `${CLAUDE_PLUGIN_DATA}`, not in the repo.
- **Scopes** — request the minimum scope the tools actually need; document it in the plugin README so users know what they're granting.

## Surface compatibility (Cowork)

- **Local stdio** → ✅ works in both Claude Code and Cowork (runs locally).
- **Remote connectors (SSE/HTTP/ws)** → ☁️ **Cowork routes these through Anthropic's cloud**, so the endpoint must be **publicly internet-reachable** — a `localhost`/LAN/firewalled server that works in Claude Code will silently fail to connect in Cowork. Design remote MCP servers for public reachability if you target both surfaces. (See the Components table + `cowork-compatibility.md`.)

## Channels vs MCP

A **channel** is an MCP server with the `claude/channel` capability that *pushes* events into Claude (alerts, remote permission approval) rather than only exposing pull-style tools. Bind it via `channels` in `plugin.json`. See `channel-patterns.md`.
