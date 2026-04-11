---
title: Scripts & Automation
description: The automation scripts that power Prism's autonomous execution, installation, and subagent-driven plan extraction.
outline: [2, 3]
---

# Scripts & Automation

## `scripts/spectrum.sh` (518 lines)

The Spectrum iterative executor — the main autonomous execution loop that spawns fresh Claude Code sessions per story. In v2.5.1, all deterministic operations (story selection, status updates, schema validation, progress logging, lockfile management) were moved from the AI skill into this bash script for reliability.

```
┌─────────────────────────────────────────────────────────┐
│  spectrum.sh Loop (v2.5.1)                               │
│                                                          │
│  0. validate_schema() — verify stories.json structure    │
│  1. acquire_lock() — PID-based lockfile with stale check │
│  2. select_next_story() — jq: incomplete + unblocked     │
│  3. If no story remaining → EXIT SUCCESS                 │
│  4. If max iterations → EXIT LIMIT                       │
│  5. Spawn: claude --dangerously-skip-permissions         │
│            --print "/prism-spectrum"                      │
│            (includes pre-selected story ID in prompt)     │
│  6. Parse signal from output:                            │
│     • <promise>COMPLETE</promise> → check remaining      │
│     • <spectrum-continue> → verify + next iteration      │
│     • <spectrum-continue><concerns> → log + continue ¹   │
│     • <spectrum-retry reason="..."> → increment err      │
│     • <spectrum-blocked reason="..."> → skip story       │
│     • <spectrum-needs-context> → log questions + skip ¹  │
│     • <spectrum-error reason="..."> → stop               │
│  ¹ New in v3.0.1: concerns + needs-context signals       │
│  7. update_story_status() — atomic jq update + validate  │
│  8. append_progress() — timestamped logging              │
│  9. If 3+ consecutive errors → EXIT ERROR                │
│ 10. Sleep $SPECTRUM_PAUSE seconds                        │
│ 11. → Loop to step 2                                     │
│ 12. release_lock() — on EXIT trap                        │
└─────────────────────────────────────────────────────────┘
```

**Key functions (v2.5.1):**

| Function | Description |
|----------|-------------|
| `validate_schema()` | Validates `.epic.name`, `.stories` array, per-story required fields |
| `select_next_story()` | jq query: incomplete + unblocked stories sorted by priority |
| `update_story_status()` | Atomic jq update with temp file + JSON validation before `mv` |
| `append_progress()` | Timestamped iteration logging to `progress.md` |
| `acquire_lock()` / `release_lock()` | Lockfile at `.prism/local/spectrum.lock` with stale PID detection |

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECTRUM_MAX_ITERATIONS` | 50 | Maximum iterations before stopping |
| `SPECTRUM_VERBOSE` | (unset) | Enable verbose output |
| `SPECTRUM_PAUSE` | 2 | Seconds between iterations |

**Prerequisites:** `claude` CLI and `jq` must be installed.

## `scripts/prism-cli-install.sh` (280 lines)

Cross-platform bash installer for the prism-cli binary:
- Detects platform (darwin/linux/windows) and architecture (amd64/arm64)
- Three methods: `auto` (try download, fall back to source), `download`, `source`
- Downloads from `github.com/TheDigitalGriot/prism-plugin/releases`
- Configures PATH in `~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, and PowerShell `$PROFILE`
- Initializes `~/.prism/workspaces.json` registry

## `scripts/prism-cli-install.ps1` (181 lines)

Native PowerShell installer for Windows:
- Downloads `prism-cli-windows-amd64.exe` from GitHub releases
- Configures PATH in PowerShell `$PROFILE`
- Same auto/source/download method pattern as bash version

## `skills/prism/scripts/init_prism.py` (185 lines)

Initializes the `.prism/` directory structure in any project:
- Creates 15 directories: `stories/`, `shared/{research,plans,validation,handoffs,prs,spectrum,ref,docs,contracts,designs,assets}`, `shared/validation/baselines/`, `local/{ref,docs}`
  - `shared/designs/` — Figma / Pencil.dev design files
  - `shared/assets/` — AI-generated images, videos, 3D models
- Adds `.prism/local/` to `.gitignore`
- Creates `README.md` in `.prism/shared/`
- Optionally adds Prism section to `CLAUDE.md`
- Wrapped by the `/prism-init` skill (v3.0.3)

### Hook Scripts (v3.0.1, extended v3.2.0)

| Script | Type | Hook Event | Description |
|--------|------|------------|-------------|
| `pre-compact.py` | Python | PreCompact | Snapshots workflow state to `.prism/local/compact-snapshot.json`. **v3.2.0:** also detects in-flight `prism-subagent` runs via `get_active_subagent_run()` and embeds them as `active_subagent_run` in the snapshot |
| `post-compact.py` | Python | PostCompact | Restores state after context compression. **v3.2.0:** surfaces a recovery message naming the active subagent state file path, current task, pending count, and instructions to read `state-schema.md` recovery protocol without re-extracting the plan |
| `log-observation.py` | Python | PostToolUse (Write\|Edit\|Bash) | Tracks file modifications for session continuity |
| `worktree-setup.sh` | Bash | WorktreeCreate | Auto-setup: gitignore check, deps install, config copy, `.prism/shared` symlink |
| `worktree-cleanup.sh` | Bash | WorktreeRemove | Warns on uncommitted changes, removes `.prism/shared` symlink |
| `log-agent.py` | Python | SubagentStart/Stop | Logs agent dispatches to `.prism/local/agent-log.jsonl` |

### Other Scripts

| Script | Type | Description |
|--------|------|-------------|
| `visual-regression.sh` | Bash | Screenshots via playwright-cli, diffs against baselines with pixelmatch |
| `bump-version.py` | Python | Bumps semver across all JSON/source files |
| `extract-tasks.py` | Python | **v3.2.0** — Deterministic Prism plan markdown → `state.json` extractor for `prism-subagent`. ~280 lines. Auto-classifies tasks into 9 review classes, auto-detects domain (r3f/electron/fullstack/experiment/mixed), assigns per-task model ladder, atomic writes. Replaces ~3000 tokens of LLM extraction per run with regex parsing. Exit code 3 → controller falls back to LLM extraction. Verified against 4 real plans + 3 fixture plans, 100% extraction success |
