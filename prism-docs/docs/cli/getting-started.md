---
title: Getting Started
description: How to build, install, and run the Prism CLI dashboard.
outline: [2, 3]
---

# Getting Started

## Build

```bash
cd apps/prism-cli

make build          # Build for current platform → bin/prism-cli
make build-all      # Cross-compile (windows/darwin/linux × amd64/arm64)
make test           # Run tests: go test -v ./...
make lint           # Run golangci-lint
make install        # Install to GOPATH/bin
make run ARGS=..    # Development run
make clean          # Remove bin/ and go clean
make help           # Display help text
```

## Run

```bash
# Direct with stories file
prism-cli .prism/stories/stories.json

# Auto-discover .prism/ in current directory
prism-cli

# Demo mode (no stories.json needed)
prism-cli --demo

# Force onboarding flow (testing)
prism-cli --onboarding

# With options
prism-cli -f stories.json -n 100 -p 5 --prism-style braille
```

## CLI Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--file` | `-f` | `""` | Path to stories.json |
| `--max-iterations` | `-n` | `50` | Maximum iterations before stopping |
| `--pause` | `-p` | `2` | Seconds between iterations |
| `--demo` | | `false` | Run with simulated stories |
| `--onboarding` | | `false` | Force onboarding flow (for testing/refining the setup wizard) |
| `--prism-style` | | `gradient` | Animation style: `gradient` `simple` `braille` `ascii` |
| `--uninstall` | | `false` | Remove prism-cli binary, PATH entries, and global `~/.prism/` directory |

Auto-generated: `--version`, `--help`/`-h`

## Uninstall System

The `--uninstall` flag provides clean removal:
1. Prompts for `yes` confirmation via stdin
2. Removes binary from `~/.prism/bin/` (both `prism-cli` and `prism-cli.exe`)
3. Cleans shell profiles (`.zshrc`, `.bashrc`, `.bash_profile`) — removes lines containing `.prism/bin` or `# Prism CLI`
4. On Windows: cleans PowerShell profile (auto-detects `pwsh.exe` or `powershell.exe`)
5. Removes entire `~/.prism/` directory (global config, not per-project)
6. Does NOT touch per-project `.prism/` directories

## Initial View Selection

```
--demo flag set           → ViewSplash → Home (demo mode)
stories.json provided     → ViewSplash → Home or Onboarding
No stories.json, .prism/  → ViewSplash → Onboarding (if needed) → Home
No .prism/ directory      → ViewSplash → Onboarding (auto-set)
Legacy thoughts/ dir      → ViewSplash → Onboarding (legacy migration)
```

The splash screen always displays first (5-second timer or any keypress to skip). After splash, the app transitions to Onboarding if `.prism/` doesn't exist or `stories.json` is missing, otherwise to Home. Legacy `thoughts/` directories trigger the onboarding migration flow.

After TUI exits, the project is auto-registered in the global workspace registry (`~/.prism/workspaces.json`) via `registry.Register()`. The terminal G0 charset is also reset (`\x1b(B\x1b[0m`) to prevent DEC Special Graphics mode from persisting into the parent shell.
