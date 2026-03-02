---
title: Configuration & Build
description: Default configuration values, pagination, responsive breakpoints, demo mode, and build cross-compilation.
outline: [2, 3]
---

# Configuration & Build

## Default Values

| Parameter | Default | Source |
|-----------|---------|--------|
| Max Iterations | 50 | `main.go:126` CLI flag |
| Pause Between Iterations | 2 seconds | `main.go:127` CLI flag |
| Max Consecutive Errors | 3 | `plugin_spectrum.go:148` |
| Stories Per Page | 12 | `plugin_spectrum.go:151` |
| Logs Per Page | 6 | `plugin_spectrum.go:152` |
| Log Capacity | 1000 pre-allocated | `plugin_spectrum.go:153` |
| Recent Output Buffer | 10 max | `plugin_spectrum.go:154` |
| Recent Activities Displayed | 5 | `plugin_spectrum.go` view |
| Tick Interval | 100ms | `update.go:490` |
| Splash Duration | 5 seconds | `update.go:497` |
| Claude Timeout | 30 minutes | `runner.go:78` |
| Output Channel Buffer | 100 messages | Spectrum plugin |
| 3D Prism Default Size | 24 cols × 5 rows | `model.go:150` |
| 3D Prism Min Width | 20 columns | `update.go:69` |
| 3D Prism Max Width | 40 columns | `update.go:71` |
| 3D Prism Width Formula | `termWidth / 4` | `update.go:67` |
| Scanner Buffer Size | 1 MB | `runner.go:207` |
| Sidebar Width | 38 characters | `sidebar.go:13` |
| Sidebar Breakpoint | 120 columns | `sidebar.go:16` |
| Monitor Auto-refresh | 5 seconds | `plugin_monitor.go` |
| Files Max Depth | 3 levels | `plugin_files.go` |
| Workspace Scan | Parent directory siblings | `plugin_workspaces.go` |
| Watcher Debounce | 500ms | `watcher.go` |
| Watcher Artifact Scan | 10 seconds | `plugin_browser.go` |
| State Storage | `~/.config/prism-cli/state/` | `state.go` |
| Workspace Registry | `~/.prism/workspaces.json` | `registry.go` |
| Version | 2.3.0 | `main.go:19` |

## Pagination Configuration

| Paginator | Items/Page | Style | Active Dot | Inactive Dot |
|-----------|-----------|-------|------------|--------------|
| Stories | 12 | Dots | `●` | `○` |
| Logs | 6 | Dots | `●` | `○` |

## Responsive Breakpoints

| Terminal Width | Behavior |
|---------------|----------|
| < 120 | No sidebar, compact tab bar if needed |
| >= 120 | Sidebar auto-shown (toggleable with Ctrl+D) |
| >= 80 | Footer shows quality gate counts |
| >= 90 | Footer shows iteration counter |
| >= 100 | Footer shows current story ID |

## Demo Mode

Activated with `--demo` flag. Provides:
- 36 pre-seeded stories (12 complete, 24 pending) across 3 pages
- 3 demo epics: `user-auth` (8/12), `dashboard` (12/36), `notifications` (0/9)
- 4 research files and 3 plan files with preview text
- Auto-completion timing: 2000–3500ms per story
- Activity cycling: 300–600ms random intervals
- 16 rotating fake tool activities
- Demo file tree with realistic preview content
- Demo git status with branch, staged/modified/untracked files
- Demo chat messages (user, assistant, tool calls)
- Demo execution history and quality gates
- Demo workspace projects

## Build & Cross-Compilation

### Makefile Targets

| Target | Command | Description |
|--------|---------|-------------|
| `build` | `go build -ldflags "-X main.version=$(VERSION)"` | Current platform |
| `build-all` | Cross-compile loop | 5 targets: {windows,darwin,linux} × {amd64,arm64} |
| `test` | `go test -v ./...` | Run all tests |
| `lint` | `golangci-lint run` | Static analysis |
| `clean` | `rm -rf bin/ && go clean` | Remove artifacts |
| `install` | `go install` | Install to GOPATH/bin |
| `run` | `go run . $(ARGS)` | Development run |
| `help` | Display targets | Help text |

### Version Injection

```bash
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X main.version=$(VERSION)
```

### Dependencies

**Direct (8):**
1. `github.com/charmbracelet/bubbles v0.20.0` — Bubble Tea components
2. `github.com/charmbracelet/bubbletea v1.3.4` — TUI framework
3. `github.com/charmbracelet/harmonica v0.2.0` — Spring physics
4. `github.com/charmbracelet/lipgloss v1.1.1-pre` — Terminal styling (unreleased commit)
5. `github.com/charmbracelet/x/ansi v0.8.0` — ANSI utilities
6. `github.com/fogleman/fauxgl v0.0.0` — 3D rendering
7. `github.com/muesli/termenv v0.16.0` — Terminal environment detection
8. `github.com/spf13/cobra v1.8.1` — CLI framework

**Notable indirect:** Chroma v2 (syntax highlighting), Glamour (markdown rendering), bubblezone (mouse zones), fsnotify v1.9.0 (file watcher), clipboard, colorprofile, cellbuf
