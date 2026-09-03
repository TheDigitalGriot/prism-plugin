# Hook Events and Types Reference

## Hook Types

| Type | Field | Cost | Use When |
|---|---|---|---|
| `command` | `command` | **Free** (CPU only) | Deterministic rules: path matching, linting, syntax checks |
| `http` | `url` | **Free** (network only) | Webhook notifications to external services |
| `prompt` | `prompt` | **API cost per invocation** | Semantic judgment required, no codebase access needed |
| `agent` | `prompt` | **Highest cost** (multi-turn) | Verification requiring file reads or command execution |

**Critical rule:** Default to `command` type. Every `prompt`/`agent` hook fires an LLM call on every matched tool use — in a session with 40 Bash calls, a promiscuous prompt hook wastes ~40,000 tokens.

### Command Hook (preferred)

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/check.sh",
  "timeout": 30
}
```

Shell script receives event JSON on stdin. Exit `0` = pass (stdout → context); exit `2` = block (stderr → Claude as the reason). For allow/deny/**ask** decisions or rewriting the tool input, emit JSON on stdout instead — see **Hook Output Protocol** below.

### HTTP Hook

```json
{
  "type": "http",
  "url": "https://hooks.slack.com/services/${user_config.slack_webhook}"
}
```

POSTs event JSON to URL. Response body injected into context.

### Prompt Hook (use sparingly)

```json
{
  "type": "prompt",
  "prompt": "Evaluate whether this change follows security best practices. $ARGUMENTS",
  "timeout": 30
}
```

Single-turn LLM evaluation. `$ARGUMENTS` is replaced with event context.

### Agent Hook (use rarely)

```json
{
  "type": "agent",
  "prompt": "Verify this deployment config is valid by reading the referenced files and checking dependencies. $ARGUMENTS",
  "timeout": 60
}
```

Multi-turn subagent with tool access (up to 50 turns, 60s default timeout). Use only when verification requires reading files or running commands.

## Hook Output Protocol — exit codes vs structured JSON

A hook signals its verdict two ways. The house default (`command` type) usually just uses an **exit code**; escalate to **JSON on stdout** when the decision is semantic (allow-with-rewrite, or "ask the human").

**Exit codes (`command` hooks):**
- `0` — pass/allow. stdout is injected into Claude's context.
- `2` — block. stderr is surfaced to Claude as the reason (PreToolUse blocks the tool; Stop blocks the stop).
- other non-zero — non-blocking error (logged, doesn't block).

**Structured JSON (any hook type — preferred for decisions):**

*PreToolUse* — allow / deny / **ask**, optionally rewriting the tool input:
```json
{
  "hookSpecificOutput": {
    "permissionDecision": "allow",
    "updatedInput": { "command": "rm -rf ./build  # scoped" }
  },
  "systemMessage": "Scoped the rm to ./build before allowing."
}
```
`permissionDecision: "ask"` defers to the normal permission prompt — a clean way to put a human in the loop instead of a hard allow/deny.

*Stop / SubagentStop* — let Claude stop, or force it to keep working:
```json
{ "decision": "block", "reason": "Tests still failing — fix before stopping.", "systemMessage": "..." }
```

Exit codes can only pass/block; JSON can allow-with-rewrite or ask. Reach for JSON when a plain pass/fail isn't expressive enough. Validate hook scripts and `hooks.json` with the bundled `scripts/hook-linter.sh`, `scripts/validate-hook-schema.sh`, and dry-run them with `scripts/test-hook.sh`.

## Available Events

| Event | When It Fires |
|---|---|
| `SessionStart` | Session begins or resumes |
| `SessionEnd` | Session terminates |
| `UserPromptSubmit` | Prompt submitted, before Claude processes it |
| `PreToolUse` | Before a tool call executes (can block via non-zero exit) |
| `PermissionDenied` | When a tool call is denied by the auto mode classifier. Return `{retry: true}` to allow retry |
| `PostToolUse` | After a tool call succeeds |
| `PostToolUseFailure` | After a tool call fails |
| `PermissionRequest` | When a permission dialog appears (channel permission relay forwards these remotely) |
| `Stop` | When Claude finishes responding |
| `StopFailure` | Turn ends due to API error (output/exit code ignored) |
| `Notification` | When Claude Code sends a notification (including channel events) |
| `SubagentStart` | When a subagent is spawned |
| `SubagentStop` | When a subagent finishes |
| `TaskCreated` | When a task is created via TaskCreate |
| `TaskCompleted` | When a task is marked completed |
| `TeammateIdle` | When an agent team teammate is about to go idle |
| `InstructionsLoaded` | When CLAUDE.md or `.claude/rules/*.md` loads into context |
| `ConfigChange` | When a configuration file changes during session |
| `CwdChanged` | When working directory changes (e.g., `cd` command) |
| `FileChanged` | When a watched file changes on disk (`matcher` specifies filenames) |
| `WorktreeCreate` | When a worktree is being created |
| `WorktreeRemove` | When a worktree is being removed |
| `PreCompact` | Before context compaction |
| `PostCompact` | After context compaction completes |
| `Elicitation` | When MCP server requests user input during tool call |
| `ElicitationResult` | After user responds to MCP elicitation |

## Hook Efficiency Patterns

| Event | Recommended Type | Pattern |
|---|---|---|
| `SessionStart` | `command` | Dependency checks, state restoration |
| `PreToolUse` (Write/Edit) | `command` | Run linter or secret scanner deterministically |
| `PreToolUse` (Bash) | `command` | Pattern-match dangerous commands with `case` |
| `PostToolUse` (Bash) | `command` | Match specific script names, not all Bash calls |
| `SubagentStop` | `command` | Log subagent activity, enforce spawn limits |
| `PreCompact` | `command` | Write compaction snapshot to disk |
| `PostCompact` | `command` | Restore minimum orchestration state |
| `FileChanged` | `command` | Validate changed config files |
| `Stop` | `command` | **Never use `prompt` type** — fires on every response |

### Anti-Pattern: Promiscuous Prompt Hook

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "prompt",
    "prompt": "Check if this Bash command is safe..."
  }]
}
```

This fires an LLM call on every `ls`, `git status`, `npm install`. Fix: use a `command` hook with deterministic pattern matching.

### Fix: Deterministic Command Hook

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "INPUT=$(cat); CMD=$(echo \"$INPUT\" | jq -r '.tool_input.command // empty'); case \"$CMD\" in *rm\\ -rf*|*drop\\ table*|*--force*) echo 'Destructive command blocked'; exit 1;; esac"
  }]
}
```

Zero LLM cost. Only blocks genuinely dangerous patterns.

## Channel-Related Hook Events

Two hook events are directly relevant to channels. Use these to build event-driven workflows around incoming channel messages and permission relay.

### Notification Event + Channels

The `Notification` event fires when Claude Code processes notifications, including events pushed by channel servers. Use this to log, filter, or trigger side effects for incoming channel events.

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

**Efficiency note:** Use `command` type. Channel events can arrive frequently (CI builds, chat messages) -- a `prompt` hook here would fire an LLM call on every incoming message.

### PermissionRequest Event + Permission Relay

The `PermissionRequest` event fires when a tool approval dialog appears. For channels with the `claude/channel/permission` capability, this is the integration point where requests are forwarded to the remote device.

The permission relay flow:

1. Claude wants to use a tool (Bash, Write, Edit)
2. `PermissionRequest` hook fires locally
3. Claude Code sends `notifications/claude/channel/permission_request` to the channel server
4. Channel server forwards to user's phone/chat platform
5. User replies with verdict (e.g., "yes abcde" or "no abcde")
6. Channel server sends `notifications/claude/channel/permission` back
7. First verdict wins (local terminal or remote channel)

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

**Note:** Permission relay covers tool-use approvals only. It does **not** cover project trust dialogs or MCP server consent prompts.

For full channel implementation details, server code patterns, and security guidance: [references/channel-patterns.md](./channel-patterns.md)
