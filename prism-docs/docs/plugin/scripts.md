---
title: Scripts & Automation
description: The four automation scripts that power Prism's autonomous execution and installation.
outline: [2, 3]
---

# Scripts & Automation

## `scripts/spectrum.sh` (312 lines)

The Spectrum iterative executor — the main autonomous execution loop that spawns fresh Claude Code sessions per story.

```
┌─────────────────────────────────────────────────────┐
│  spectrum.sh Loop                                    │
│                                                      │
│  1. Load stories.json                                │
│  2. Count remaining stories                          │
│  3. If 0 remaining → EXIT SUCCESS                    │
│  4. If max iterations → EXIT LIMIT                   │
│  5. Spawn: claude --dangerously-skip-permissions     │
│            --print "/prism-spectrum"                  │
│  6. Parse signal from output:                        │
│     • <promise>COMPLETE</promise> → check remaining  │
│     • <spectrum-continue> → pause, next iteration    │
│     • <spectrum-retry reason="..."> → increment err  │
│     • <spectrum-blocked reason="..."> → skip story   │
│     • <spectrum-error reason="..."> → stop           │
│  7. If 3+ consecutive errors → EXIT ERROR            │
│  8. Sleep $SPECTRUM_PAUSE seconds                     │
│  9. → Loop to step 2                                 │
└─────────────────────────────────────────────────────┘
```

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

## `skills/prism/scripts/init_prism.py` (174 lines)

Initializes the `.prism/` directory structure in any project:
- Creates 11 directories: `stories/`, `shared/{research,plans,validation,handoffs,prs,spectrum,ref,docs}`, `local/{ref,docs}`
- Adds `.prism/local/` to `.gitignore`
- Creates `README.md` in `.prism/shared/`
- Optionally adds Prism section to `CLAUDE.md`
