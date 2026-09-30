# Channel Patterns Reference

Channels are MCP servers that push external events into a Claude Code session. They run locally as subprocesses over stdio transport. This reference covers architecture, implementation, security, and integration with other plugin primitives.

**Requires:** Claude Code v2.1.80+, claude.ai login. Console/API key auth not supported. Team/Enterprise orgs must explicitly enable channels.

## Architecture

```
External System ──► Your Channel Server (local) ──stdio──► Claude Code
     (API poll,         (MCP server with               (receives <channel>
      webhook,           claude/channel                  tags in context)
      socket)            capability)
```

Channels are **not** hosted services. They run on the same machine as Claude Code, spawned as a subprocess. The channel server connects to external systems (polling APIs, listening on local HTTP ports) and forwards events to Claude via MCP notifications.

## Three Capability Tiers

Every channel is an MCP server. What it can do depends on which capabilities it declares:

| Tier | Capabilities Declared | What It Enables |
|---|---|---|
| **One-way** | `claude/channel` | Push events into Claude's context. Claude can read but not respond. |
| **Two-way** | `claude/channel` + `tools` | Above + Claude can call a reply tool to send messages back. |
| **Permission relay** | `claude/channel` + `tools` + `claude/channel/permission` | Above + remote tool approval (approve/deny Bash, Write, Edit from phone). Requires v2.1.81+. |

Choose the minimum tier needed. One-way is simplest and sufficient for CI alerts, monitoring, and log forwarding.

## Transport Modes -- Live-Push vs Passive Bus (the headless / cloud axis)

The three tiers above describe *what a channel can do*. This section describes *how its events move* -- an orthogonal axis the tiers do not cover, and the one that decides whether a channel works when Claude runs **headless** (Cowork cloud, `claude -p`, CI) instead of in an interactive terminal. Get this wrong and a channel that is perfect on the desktop silently breaks in the cloud.

### Two transport modes

**Live-push (the tiers above).** `capabilities.experimental["claude/channel"]` + the `notifications/claude/channel` method. This requires a **live channel consumer** -- an interactive client attached to the session to receive the push. Under a headless `claude -p` run there is no consumer, so pushed notifications have nowhere to land: the channel's input half is inert, and any skill that *waits* on a pushed reply (or on `AskUserQuestion`) hangs with no TTY to answer. Excellent for phone-relay + real-time interactive wake; **interactive-only.**

**Passive bus (headless / cloud-safe).** The channel server declares only `capabilities: { tools: {} }` and moves events through the **filesystem** instead of the push-notification stream:

- **OUT** -- the server (or the driving skill) writes human-readable option cards as HTML to a per-session `$SCREEN_DIR` the cockpit renders.
- **IN** -- rulings/events are appended as JSONL to `$STATE_DIR/events`; the server's tools read that file. STATE_DIR resolution precedence: explicit arg -> env var -> newest session dir -> fallback.

Because nothing depends on a live notification listener, the **same server runs unchanged** in an interactive terminal, in Cowork cloud, and under headless `claude -p`. This is the transport `digital-griot-mcp` uses today, and it is why `prism-brainstorm` and `prism-gavel` already run headless.

### The Griot rule: bus is the substrate, push is an optional accelerator

Build every Griot channel on the **passive bus first** -- `capabilities: { tools: {} }` + the file bus is the load-bearing transport. Layer `experimental["claude/channel"]` push on top **only** for interactive surfaces that benefit from real-time wake / phone-relay, and **never let a skill's correctness depend on a pushed reply arriving.** A channel that gates progress on live push is a channel that breaks the moment it runs in the cloud.

- Reference server: `scripts/digital-griot-mcp/digital-griot-mcp.ts` (`capabilities:{tools:{}}`, `$STATE_DIR/events`, `gavel_state` / `gavel_decide` / `gavel_commit`).
- Reference consumers: `prism-brainstorm`, `prism-gavel`.

### Cloud -> local headless invocation contract

A passive-bus channel is only useful headless if the skill that drives it can actually be **launched** headless from the cloud. The proven, least-brittle pattern (control-tested):

A launcher `.ps1` reads the prompt from a file into a variable and runs claude as a detached process with output to a log:

```powershell
$p = Get-Content <task>-instructions.md -Raw
& claude.exe -p $p --agent claude --dangerously-skip-permissions --verbose *> run.log
```

Launched **detached** so it survives the caller returning, then **polled** -- never awaited in one call:

```powershell
Start-Process powershell -File launcher.ps1 -PassThru -WindowStyle Hidden
# then poll: launcher PID alive + claude-child CPU (climbing = working, ~5s flat = hung) + git/file progress
```

Three non-negotiables, each learned from a real failure:

1. **`--agent claude`** -- a device `claude -p` defaults to whatever agent is persisted (e.g. a digest-writer that ignores the task and just asks for a URL). Pin the general agent explicitly.
2. **Prompt as a VARIABLE arg read from a FILE** (`& claude -p $p`) -- NOT a `Start-Process -ArgumentList` array (truncates to the first word), NOT a single inline string (quoting breaks -> 0 bytes), NOT a stdin pipe (hangs idle on the unclosed stream).
3. **Detached + poll** -- the ~45s device/bridge timeout is **per-call, not per-task**. Launch, return, and poll across successive short calls until the process exits.

### The headless-hang caveat (why adoption matters)

Skills that call `AskUserQuestion` or spawn interactive subagents **hang** under headless `claude -p` -- no TTY to answer, so claude sits idle (~5s CPU, 0 output, 0 progress). This is exactly why the release-cycle skills hung headless. The passive-bus adoption **is** the fix: a skill running non-interactively must skip `AskUserQuestion`, emit its decision as a bus card to `$SCREEN_DIR`, and read the ruling from `$STATE_DIR/events` (or fall through to provided defaults) -- never block on an interactive prompt. Durable target: a Griot MCP verb `run_device_skill(skill, args, answers)` that owns the invocation, injects the answers, and polls.

## Server Constructor

All channels must use the `@modelcontextprotocol/sdk` npm package and declare `claude/channel` as an experimental capability.

### One-Way Channel (Minimum)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "ci-alerts",
  version: "1.0.0",
}, {
  capabilities: {
    experimental: {
      "claude/channel": {},
    },
  },
  instructions: "You will receive CI build notifications. When a build fails, summarize the error and suggest a fix. Do not take action unless the user asks.",
});

// Connect over stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Two-Way Channel (With Reply Tool)

```typescript
const server = new McpServer({
  name: "telegram-bridge",
  version: "1.0.0",
}, {
  capabilities: {
    experimental: {
      "claude/channel": {},
    },
    tools: {},
  },
  instructions: "You receive messages from the user's Telegram. Reply using the send_telegram tool when asked or when context warrants a response. Keep replies concise.",
});
```

### Permission Relay Channel

```typescript
const server = new McpServer({
  name: "telegram-bridge",
  version: "1.0.0",
}, {
  capabilities: {
    experimental: {
      "claude/channel": {},
      "claude/channel/permission": {},
    },
    tools: {},
  },
  instructions: "You receive messages and permission approval requests from Telegram. When a permission request arrives, forward it. Parse yes/no replies with the request ID to approve or deny.",
});
```

### Constructor Fields Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `capabilities.experimental['claude/channel']` | `{}` | Yes | Registers the notification listener. Always `{}`. |
| `capabilities.experimental['claude/channel/permission']` | `{}` | No | Opts in to permission relay. Requires v2.1.81+. |
| `capabilities.tools` | `{}` | Two-way only | Standard MCP tool capability. Enables reply tools. |
| `instructions` | `string` | Recommended | Added to Claude's system prompt. Describes expected events and reply behavior. |

## Sending Notifications (Events)

Push events into Claude's context using the `notifications/claude/channel` method:

```typescript
await server.notification({
  method: "notifications/claude/channel",
  params: {
    content: "Build failed on main: https://ci.example.com/run/1234",
    meta: {
      severity: "high",
      run_id: "1234",
    },
  },
});
```

### Notification Fields

| Field | Type | Description |
|---|---|---|
| `content` | `string` | Event body. Becomes the body of the `<channel>` tag in Claude's context. |
| `meta` | `Record<string, string>` | Optional. Each key/value becomes a tag attribute. Keys: letters, digits, underscores only. Hyphens and other chars are silently dropped. |

### How Events Appear in Claude's Context

Events arrive as XML tags with the `source` attribute set automatically from the server name:

```xml
<channel source="ci-alerts" severity="high" run_id="1234">
build failed on main: https://ci.example.com/run/1234
</channel>
```

## Exposing a Reply Tool (Two-Way)

A reply tool is a standard MCP tool -- nothing channel-specific about the registration. Three components needed:

### 1. Declare tools capability

Already shown above in the server constructor (`tools: {}`).

### 2. Register the tool

```typescript
import { z } from "zod";

server.tool(
  "send_telegram",
  "Send a message back to the user on Telegram",
  { message: z.string().describe("The message text to send") },
  async ({ message }) => {
    await telegramBot.sendMessage(ownerId, message);
    return { content: [{ type: "text", text: `Sent: ${message}` }] };
  }
);
```

### 3. Update instructions

Tell Claude when and how to use the tool:

```typescript
instructions: "Reply using the send_telegram tool when the user asks a question via Telegram or when you have results to share. Keep replies under 500 characters."
```

## Permission Relay Protocol

The most advanced tier. Allows approving or denying tool calls (Bash, Write, Edit) from a remote device. Does **not** cover project trust or MCP server consent dialogs.

### Outbound: Permission Request from Claude Code

Claude Code sends `notifications/claude/channel/permission_request`:

| Field | Type | Description |
|---|---|---|
| `request_id` | `string` | Five lowercase letters from `a-z` excluding `l` (avoids confusion with 1/I on phones). Include verbatim in prompts. |
| `tool_name` | `string` | Tool Claude wants to use (e.g., `Bash`, `Write`). |
| `description` | `string` | Human-readable summary. Same text as the local terminal dialog. |
| `input_preview` | `string` | Tool arguments as JSON, truncated to 200 chars. |

### Inbound: Your Server Sends Verdict

Send `notifications/claude/channel/permission`:

| Field | Type | Description |
|---|---|---|
| `request_id` | `string` | Echo of the ID from the request. |
| `behavior` | `'allow'` or `'deny'` | The verdict. |

### Race Condition Handling

Both the local terminal dialog and the remote channel stay live simultaneously. **Whichever answer arrives first is applied; the other is dropped.**

### Parsing User Replies

Use this regex to parse natural-language approval replies:

```typescript
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;
```

The `/i` flag handles phone autocorrect capitalization. Normalize the captured ID to lowercase before sending back. If the reply doesn't match, treat it as normal chat. If it matches but the ID is wrong or stale, Claude Code drops it silently and the local dialog stays open.

### Implementation Example

```typescript
// Listen for permission requests from Claude Code
server.onNotification("notifications/claude/channel/permission_request", async (params) => {
  const { request_id, tool_name, description, input_preview } = params;
  
  // Forward to user on their chat platform
  await sendToUser(
    `Claude wants to run ${tool_name}:\n${description}\n\nPreview: ${input_preview}\n\nReply "yes ${request_id}" or "no ${request_id}"`
  );
});

// When user replies, parse and send verdict
function handleUserMessage(text: string) {
  const match = text.match(/^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i);
  if (match) {
    const behavior = match[1].toLowerCase().startsWith("y") ? "allow" : "deny";
    const requestId = match[2].toLowerCase();
    
    server.notification({
      method: "notifications/claude/channel/permission",
      params: { request_id: requestId, behavior },
    });
    return; // consumed as permission reply
  }
  
  // Not a permission reply -- forward as normal channel message
  server.notification({
    method: "notifications/claude/channel",
    params: { content: text, meta: { type: "user_message" } },
  });
}
```

## Security: Prompt Injection Prevention

Channels forward external content into Claude's context. **Gate on sender identity before calling `server.notification()`.**

### Gate on Sender, Not Room

```typescript
const allowed = new Set(loadAllowlist());

// CORRECT: gate on sender identity
if (!allowed.has(message.from.id)) return; // drop silently

// WRONG: gate on room/chat ID
// In group chats, message.from.id !== message.chat.id
// Room-gating lets anyone in an allowlisted group inject
```

### Pairing Flows

Official channels use pairing flows for identity verification:

1. User DMs the bot on the chat platform
2. Bot replies with a one-time code
3. User approves the code in Claude Code
4. Platform user ID is added to the allowlist

This ensures only the authorized user can send messages that reach Claude's context.

### Content Sanitization

- Never trust message content from external sources without gating on sender
- Consider rate-limiting notifications to prevent context flooding
- Use the `meta` field to tag message provenance for Claude's awareness

## Channel + Hook Integration

Channels interact with hooks through two key events:

### Notification Event

The `Notification` hook event fires when Claude Code sends a notification. Channel events can trigger this, allowing hooks to react to incoming channel messages:

```json
{
  "Notification": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-channel-event.sh"
        }
      ]
    }
  ]
}
```

### PermissionRequest Event

The `PermissionRequest` hook event fires when a permission dialog appears. For channels with permission relay, this is the point where the request is forwarded to the remote device:

```json
{
  "PermissionRequest": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-permission-request.sh"
        }
      ]
    }
  ]
}
```

### Channel-Triggered Workflows

Combine channels with hooks for event-driven automation:

```
CI failure (external) ──► Channel server ──► Claude Code context
                                                    │
                                              Notification hook fires
                                                    │
                                              Script logs event to
                                              ${CLAUDE_PLUGIN_DATA}/events.log
```

## Channel + Skill Integration

Channel `instructions` serve a similar role to skill descriptions -- they shape Claude's behavior when events arrive. For complex channel-reactive behavior, pair a channel with a skill:

- **Channel `instructions`**: Brief (1-2 sentences) -- when to reply, tone, constraints
- **Skill**: Detailed knowledge loaded on demand -- how to diagnose CI failures, deployment runbooks, etc.

## Development & Testing

### Testing During Research Preview

Custom channels are not on the approved allowlist. Use the development flag:

```bash
# Plugin-wrapped channel
claude --dangerously-load-development-channels plugin:yourplugin@yourmarketplace

# Bare .mcp.json server entry
claude --dangerously-load-development-channels server:webhook
```

The bypass is **per-entry**. The `channelsEnabled` org policy still applies even with this flag.

### Packaging as a Plugin

1. Declare the MCP server in `.mcp.json` (or inline in `plugin.json` under `mcpServers`)
2. Add a `channels` entry in `plugin.json` referencing that server
3. Publish to a marketplace

Users install with `/plugin install`, enable per session with:

```bash
--channels plugin:<name>@<marketplace>
```

Still requires `--dangerously-load-development-channels` until submitted to and approved by the official marketplace (security review required).

### Team/Enterprise Deployment

Admins can add approved channel plugins to `allowedChannelPlugins` in the org policy, bypassing the per-session flag.

## Common Patterns

### CI/CD Alert Channel (One-Way)

Poll GitHub Actions API, forward build failures:

```typescript
async function pollBuilds() {
  const runs = await fetchWorkflowRuns(repo, { status: "failure" });
  for (const run of runs) {
    if (alreadyNotified(run.id)) continue;
    await server.notification({
      method: "notifications/claude/channel",
      params: {
        content: `Build #${run.run_number} failed on ${run.head_branch}: ${run.html_url}`,
        meta: { severity: "high", run_id: String(run.id), branch: run.head_branch },
      },
    });
    markNotified(run.id);
  }
}

setInterval(pollBuilds, 30_000); // poll every 30s
```

### Webhook Receiver Channel (One-Way)

Listen on a local HTTP port for webhook POSTs:

```typescript
import http from "node:http";

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    const body = await readBody(req);
    const payload = JSON.parse(body);
    
    await server.notification({
      method: "notifications/claude/channel",
      params: {
        content: JSON.stringify(payload, null, 2),
        meta: { type: payload.event_type || "webhook" },
      },
    });
    
    res.writeHead(200);
    res.end("ok");
  }
});

httpServer.listen(9876); // local port only
```

### Chat Bridge Channel (Two-Way + Permission Relay)

Full pattern combining all three tiers -- see official reference implementations:

- **Telegram**: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram
- **Discord**: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord
- **iMessage**: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/imessage
- **Fakechat** (demo): https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat

## Plugin Manifest Integration

Channels are declared in `plugin.json` and bound to an MCP server the plugin provides:

```json
{
  "mcpServers": {
    "ci-alerts": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/ci-alerts/index.js"],
      "env": {
        "GITHUB_TOKEN": "${user_config.github_token}"
      }
    }
  },
  "channels": [
    {
      "server": "ci-alerts",
      "userConfig": {
        "github_token": { "description": "GitHub PAT for API access", "sensitive": true },
        "repo_owner": { "description": "GitHub org or username", "sensitive": false }
      }
    }
  ]
}
```

The `server` field must match a key in `mcpServers`. Per-channel `userConfig` follows the same schema as the top-level `userConfig`.
