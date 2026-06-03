---
title: Scripts & Automation
description: The automation scripts that power Prism's autonomous execution, installation, and subagent-driven plan extraction.
outline: [2, 3]
---

# Scripts & Automation

## `scripts/spectrum.sh` (~580 lines)

The Spectrum iterative executor — the main autonomous execution loop that spawns fresh Claude Code sessions per story. In v2.5.1, all deterministic operations (story selection, status updates, schema validation, progress logging, lockfile management) were moved from the AI skill into this bash script for reliability. **v3.4.0** adds CSD-style supervision: deterministic worker shim paths, a validated signal vocabulary, and the `SPECTRUM_WORKER_STORY_ID` env var for the PreToolUse approval gate.

```
┌─────────────────────────────────────────────────────────┐
│  spectrum.sh Loop (v3.4.0)                               │
│                                                          │
│  0. validate_schema() — verify stories.json structure    │
│  1. acquire_lock() — PID-based lockfile with stale check │
│  2. ensure_shim_dir() — mkdir /tmp/claude-spectrum-workers│
│  3. select_next_story() — jq: incomplete + unblocked     │
│  4. If no story remaining → EXIT SUCCESS                 │
│  5. If max iterations → EXIT LIMIT                       │
│  6. Write shim: /tmp/claude-spectrum-workers/<story-id>  │
│     (deterministic path, reconstructable from ID alone)  │
│  7. Spawn via shim with SPECTRUM_WORKER_STORY_ID set:    │
│       <shim> --dangerously-skip-permissions --print      │
│       (story ID pre-selected, not picked by Claude)      │
│  8. Parse signal from output (validated vs VALID_SIGNALS)│
│     • <promise>COMPLETE</promise> → check remaining      │
│     • <spectrum-continue> → verify + next iteration      │
│     • <spectrum-continue><concerns> → log + continue     │
│     • <spectrum-retry reason="..."> → increment err      │
│     • <spectrum-blocked reason="..."> → skip story       │
│     • <spectrum-needs-context> → log questions + skip    │
│     • <spectrum-error reason="..."> → stop               │
│     • unknown <spectrum-*> tag → warn + treat as retry   │
│  9. update_story_status() — atomic jq update + validate  │
│ 10. append_progress() — timestamped logging              │
│ 11. If 3+ consecutive errors → EXIT ERROR                │
│ 12. Sleep $SPECTRUM_PAUSE seconds                        │
│ 13. → Loop to step 3                                     │
│ 14. release_lock() — on EXIT trap (+ shim cleanup)       │
└─────────────────────────────────────────────────────────┘
```

**Key functions (v3.4.0):**

| Function | Description |
|----------|-------------|
| `validate_schema()` | Validates `.epic.name`, `.stories` array, per-story required fields |
| `ensure_shim_dir()` | Creates `/tmp/claude-spectrum-workers/` for worker shim files |
| `select_next_story()` | jq query: incomplete + unblocked stories sorted by priority |
| `update_story_status()` | Atomic jq update with temp file + JSON validation before `mv` |
| `append_progress()` | Timestamped iteration logging to `progress.md` |
| `acquire_lock()` / `release_lock()` | Lockfile at `.prism/local/spectrum.lock` with stale PID detection; shim cleanup on release |
| `check_signals()` | Parses output for signals; validates against `VALID_SIGNALS`; unknown tags → warn + retry |

**Constants:**

| Constant | Value | Description |
|----------|-------|-------------|
| `SHIM_DIR` | `/tmp/claude-spectrum-workers` | Parent dir for deterministic per-worker shim files |
| `VALID_SIGNALS` | 6-element array | Canonical signal vocabulary — any other `<spectrum-*>` tag is flagged |

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECTRUM_MAX_ITERATIONS` | 50 | Maximum iterations before stopping |
| `SPECTRUM_VERBOSE` | (unset) | Enable verbose output |
| `SPECTRUM_PAUSE` | 2 | Seconds between iterations |
| `SPECTRUM_WORKER_STORY_ID` | (set per-run) | Story ID injected into worker environment — used by PreToolUse approval hook |

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

### Hook Scripts (v3.0.1, extended v3.2.0, extended v3.4.0)

| Script | Type | Hook Event | Description |
|--------|------|------------|-------------|
| `spectrum-approval.sh` | Bash | **PreToolUse** | **v3.4.0** — Approval gate for Spectrum workers. Fast-exits (0) if `SPECTRUM_WORKER_STORY_ID` is not set (zero overhead on non-Spectrum sessions). When set: writes `.request` file, polls 30s for `.approve`/`.deny`, auto-approves on timeout |
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
| `bump-version.py` | Python | Bumps semver across all JSON/source files. **v3.4.0:** post-bump discovery sweep searches for stale old-version strings (targeted search, not broad semver regex); `--strict` flag fails on any stale hits; `also_replace` parameter handles files stuck at older versions than the VERSION file |
| `extract-tasks.py` | Python | **v3.2.0** — Deterministic Prism plan markdown → `state.json` extractor for `prism-subagent`. ~280 lines. Auto-classifies tasks into 9 review classes, auto-detects domain (r3f/electron/fullstack/experiment/mixed), assigns per-task model ladder, atomic writes. Replaces ~3000 tokens of LLM extraction per run with regex parsing. Exit code 3 → controller falls back to LLM extraction. Verified against 4 real plans + 3 fixture plans, 100% extraction success |

### Test Scripts (v3.4.0)

| Script | Description |
|--------|-------------|
| `scripts/tests/test_porter_check.sh` | Invariant test for brainstorm engine CSS token drift. Runs `port-griotwave.cjs --check` and asserts exit 0. Exits gracefully (0 with skip notice) when griotwave tokens are unavailable — hard failure only when tokens are present and frame-template.html has drifted. Wired into the `prism-release` Step 1b validation gate. |
