---
title: Hooks Reference
description: 7 lifecycle hooks for context management, worktree automation, and agent tracking
outline: [2, 3]
---

# Hooks Reference

Prism uses 7 lifecycle hooks configured in `hooks/hooks.json`. All hooks are `command` type — **zero LLM cost**. They execute shell commands that receive event JSON on stdin.

## Hook Events

| Hook Event | Matcher | Script | Purpose |
|------------|---------|--------|---------|
| **PreCompact** | (all) | `pre-compact.py` | Save workflow state before context compression |
| **PostCompact** | (all) | `post-compact.py` | Restore state after context compression |
| **PostToolUse** | Write\|Edit\|Bash | `log-observation.py` | Track file modifications for session continuity |
| **WorktreeCreate** | (all) | `worktree-setup.sh` | Auto-setup dependencies, config, `.prism/` symlink |
| **WorktreeRemove** | (all) | `worktree-cleanup.sh` | Safety checks before worktree deletion |
| **SubagentStart** | (all) | `log-agent.py` | Log agent dispatch for cost tracking |
| **SubagentStop** | (all) | `log-agent.py` | Log agent completion with duration and tokens |

## Hook Configuration

All hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. The configuration lives in `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreCompact": [{ "matcher": "", "hooks": [{ "type": "command", "command": "python ${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.py" }] }],
    "PostCompact": [{ "matcher": "", "hooks": [{ "type": "command", "command": "python ${CLAUDE_PLUGIN_ROOT}/scripts/post-compact.py" }] }],
    "PostToolUse": [{ "matcher": "Write|Edit|Bash", "hooks": [{ "type": "command", "command": "python ${CLAUDE_PLUGIN_ROOT}/scripts/log-observation.py" }] }],
    "WorktreeCreate": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.sh" }] }],
    "WorktreeRemove": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-cleanup.sh" }] }],
    "SubagentStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "python ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py" }] }],
    "SubagentStop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "python ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py" }] }]
  }
}
```

## Context Management Hooks

### PreCompact / PostCompact

When Claude Code compresses conversation context, these hooks preserve workflow state:

- **PreCompact** runs `pre-compact.py` which snapshots the current phase, active story, recent files, and observations to `.prism/local/compact-snapshot.json`
- **PostCompact** runs `post-compact.py` which reads the snapshot and injects structured recovery context via `hookSpecificOutput.additionalContext`

This enables the compaction survival protocol documented in `CLAUDE.md` — the agent recovers from files rather than asking the user what it was doing.

**v3.2.0 — `prism-subagent` integration:** Both hooks now detect and resume in-flight subagent runs. `pre-compact.py` adds `get_active_subagent_run()` which scans `.prism/local/subagent/*/state.json` for the most recently updated state file with at least one non-complete task, then embeds the result into `compact-snapshot.json` as `active_subagent_run` with `state_path`, `plan_slug`, `current_task`, `pending_count`, `in_progress_count`, and `domain`. `post-compact.py` reads this field and surfaces an explicit recovery message naming the state file path, current task, pending count, and instructions to follow `skills/prism-subagent/references/state-schema.md` recovery protocol without re-extracting the plan. Result: a `prism-subagent` run that gets compacted mid-execution recovers automatically — no manual state restoration required.

### PostToolUse (Observational Context)

The `log-observation.py` script fires on every Write, Edit, or Bash tool use. It appends one-line entries to `.prism/local/observations.log` with timestamps and file paths. This creates a running session history that survives context compression.

## Worktree Lifecycle Hooks

### WorktreeCreate

The `worktree-setup.sh` script runs after a git worktree is created:

1. **Gitignore verification** — warns if the worktree directory isn't in `.gitignore`
2. **Dependency installation** — detects `package.json`, `Cargo.toml`, `go.mod`, or `requirements.txt` and runs the appropriate installer
3. **Config copy** — copies `.env`, `.env.local`, `.env.development.local` from the main worktree
4. **`.prism/shared` symlink** — symlinks the shared directory so research and plans are accessible

### WorktreeRemove

The `worktree-cleanup.sh` script runs before a worktree is removed:

1. **Uncommitted changes check** — warns if there are uncommitted modifications
2. **Unpushed commits check** — warns if the branch has commits not pushed to remote
3. **Symlink cleanup** — removes the `.prism/shared` symlink (without deleting the target)

## Agent Tracking Hooks

### SubagentStart / SubagentStop

Both events use the same `log-agent.py` script. It distinguishes start from stop by checking for `duration_ms` in the event payload. Each event appends one JSON line to `.prism/local/agent-log.jsonl`:

```json
{"timestamp":"2026-04-06T12:00:00+00:00","event":"start","agent":"codebase-locator","type":"agent","model":"haiku"}
{"timestamp":"2026-04-06T12:00:03+00:00","event":"stop","agent":"codebase-locator","type":"agent","model":"haiku","duration_ms":3200,"status":"complete"}
```

This enables cost analysis and debugging of agent dispatch patterns across Spectrum runs.

## Cross-Platform Compatibility

- Python scripts use `pathlib` for path handling (Windows, macOS, Linux)
- Bash scripts use `#!/usr/bin/env bash` for portability
- All scripts exit cleanly on missing input (no crashes if stdin is empty)

## See Also

- [Scripts & Automation](/plugin/scripts) — detailed script descriptions
- [Behavioral Principles](/plugin/behavioral-principles) — how hooks support compaction survival
- [Directory Structure](/plugin/directory-structure) — where hook artifacts are stored
