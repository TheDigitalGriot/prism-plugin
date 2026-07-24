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


## Local stdio server hygiene (shelling out safely)

A local stdio MCP server speaks JSON-RPC over **stdin/stdout**. The moment it shells out to another tool (yt-dlp, ffmpeg, git, a packager), those pipes become a liability. These rules are load-bearing on Windows: skip one and the server hangs on every call and leaves orphaned processes behind. (Learned the hard way in Cinopsis; refs: python-sdk #671, CPython #19575, claude-code #41432.)

**1. stdout is sacred - it IS the protocol.** Never let tool code print to stdout; a single stray byte corrupts the JSON-RPC stream. Route the wrapped function's stdout to stderr:

```python
import contextlib, sys
with contextlib.redirect_stdout(sys.stderr):
    result = do_the_work()   # its prints go to stderr; stdout stays pure JSON-RPC
```

**2. Detach every child's stdin - `stdin=subprocess.DEVNULL`.** On Windows, `capture_output=True` redirects stdout/stderr, which ALSO makes the child inherit the server's **stdin pipe (the JSON-RPC channel)**. The child blocks reading it and hangs until the timeout (~60s) on every call. Pass `stdin` explicitly on EVERY `subprocess.run`/`Popen` in the server's path:

```python
subprocess.run(cmd, capture_output=True, env=clean_env(), timeout=60,
               stdin=subprocess.DEVNULL)   # <- the whole fix
```

(Node: `spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })`.)

**3. Sanitize the child environment.** The host/VM (e.g. Cowork) may inject proxy vars that hang network children. Strip them before handing env to the child; deny-by-default beats inherit-all:

```python
def clean_env():
    return {k: v for k, v in os.environ.items()
            if k.upper() not in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY")}
```

**4. Prefer the interpreter's own binaries.** When locating a bundled CLI, check the **running interpreter's own venv** (beside `sys.executable`) FIRST, before PATH or a per-user install - otherwise a stale global shadows the pinned version:

```python
exe = "yt-dlp.exe" if sys.platform == "win32" else "yt-dlp"
cand = Path(sys.executable).parent / exe          # venv Scripts/ or bin/
if cand.exists():
    return str(cand)
# ...then shutil.which(), then user-site, then the bare name as a last resort
```

**5. No-orphan launcher (Windows).** A self-bootstrapping launcher that spawns the real server should bind the child to a **Job Object with `KILL_ON_JOB_CLOSE`**, so when the host terminates the launcher the OS reaps the server too instead of orphaning it. Hold the job handle for the launcher's lifetime; make it best-effort so any failure falls back to a plain spawn. Verify by killing the launcher and confirming the server child dies.

**Anti-patterns (do NOT):**

- A **second stdin reader** as a shutdown watchdog - the transport already owns stdin; a second reader steals JSON-RPC bytes and corrupts the protocol. The clean shutdown signal is stdin-EOF, observed by the transport itself once rule 2 stops it blocking.
- A **pre-spawn process scan / global single-instance reaper** in the launcher - it adds latency right before spawn (risking the ~5s spawn timeout, #61524) and a global single-instance can kill a second legitimate host's server. Let each host own its instance; use rule 5 for lifetime management.

This applies to **every** local plugin that shells out (blender, ableton, github, cinopsis, and any future one) - bake it in once so no plugin re-learns it.
