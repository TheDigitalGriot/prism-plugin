# Prism CLI - Complete Documentation

> A Charmbracelet ecosystem terminal application for autonomous development workflow execution.
> Built with Bubble Tea, Lipgloss, Harmonica, and FauxGL.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Screen Reference](#screen-reference)
   - [Home Screen](#1-home-screen)
   - [Research Screen](#2-research-screen)
   - [Plans Screen](#3-plans-screen)
   - [Spectrum Dashboard](#4-spectrum-execution-dashboard)
5. [User Flow Diagrams](#user-flow-diagrams)
6. [Execution State Machine](#execution-state-machine)
7. [Animation System](#animation-system)
8. [3D Prism Rendering Pipeline](#3d-prism-rendering-pipeline)
9. [Domain Models](#domain-models)
10. [Claude CLI Integration](#claude-cli-integration)
11. [Keyboard Reference](#keyboard-reference)
12. [Styling Reference](#styling-reference)
13. [Configuration](#configuration)

---

## Overview

Prism CLI is a Go 1.22 terminal user interface that provides real-time monitoring and control of the Spectrum autonomous development workflow. It spawns Claude Code CLI sessions to execute stories from a `stories.json` file, displays streaming tool activity, tracks progress with spring-animated UI elements, and renders a 3D rotating prism logo using software rasterization.

### Key Features

- **4 screens**: Home menu, Research browser, Plans browser, Spectrum execution dashboard
- **Real-time execution monitoring**: Streaming Claude CLI output with tool activity extraction
- **3D animated prism logo**: FauxGL software rasterizer with half-block Unicode encoding
- **Spring physics animations**: Harmonica-driven progress bars, story pop effects, log slide-ins
- **Signal-based workflow control**: XML protocol for Continue, Retry, Blocked, Error, Complete
- **Multi-epic support**: Tab-based epic switching with independent story sets
- **Demo mode**: 36 pre-seeded stories with auto-progression for previewing animations

### Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                     Prism CLI v1.9.8                    │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Bubble Tea  │   Lipgloss   │  Harmonica   │  FauxGL    │
│  TUI         │   Styling    │  Spring      │  3D        │
│  Framework   │   & Layout   │  Physics     │  Rendering │
├──────────────┴──────────────┴──────────────┴────────────┤
│  Bubbles (spinner, viewport, paginator, progress)       │
├─────────────────────────────────────────────────────────┤
│  Cobra CLI Framework                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture

### Package Structure

```
cmd/prism-cli/
├── main.go                    # CLI entry point, Cobra commands, flag parsing
├── app/                       # Bubble Tea UI (Elm Architecture)
│   ├── model.go               # Model struct, AnimState, initialization
│   ├── update.go              # Update handler, message routing, state transitions
│   ├── view.go                # View router, shared helpers (logo, progress bar)
│   ├── commands.go            # Async Bubble Tea commands (load stories, files, epics)
│   ├── messages.go            # Message type definitions
│   ├── views.go               # View state types (ActiveView enum, FileEntry)
│   ├── view_home.go           # Home screen renderer + key handler
│   ├── view_research.go       # Research file browser + key handler
│   ├── view_plans.go          # Plans file browser + key handler
│   └── view_spectrum.go       # Spectrum dashboard (6 sub-panels) + key handler
├── domain/                    # Business logic (no UI dependencies)
│   ├── story.go               # Story/Plan structs, dependency resolution, CRUD
│   ├── signals.go             # Signal parsing (Complete, Continue, Retry, Blocked, Error)
│   ├── progress.go            # progress.md file management
│   ├── signals_test.go        # Signal detection tests
│   └── progress_test.go       # Progress path derivation tests
├── claude/                    # Claude CLI process management
│   ├── runner.go              # Process spawning, streaming output, lifecycle
│   ├── parser.go              # Real-time output parsing (phases, signals, gates)
│   └── events.go              # Stream-JSON event deserialization, tool formatting
├── prism/                     # 3D rendering engine
│   ├── prism.go               # FauxGL renderer, half-block ANSI encoding
│   ├── framebuffer/
│   │   └── buffer.go          # RGBA pixel buffer
│   ├── prism-test.obj         # Embedded 3D mesh (444 vertices, 360 faces)
│   └── prism-test.mtl         # Material definition
├── styles/                    # Visual theming
│   ├── theme.go               # Color palette, component styles, 7 prism variants
│   └── gradient.go            # Color interpolation, gradients, shimmer
├── testdata/
│   └── stories.json           # Test fixture
├── Makefile                   # Build targets
├── go.mod                     # Dependencies (Go 1.22)
└── build.sh                   # Single-platform build script
```

### Elm Architecture Pattern

The application follows the Elm Architecture (Model-Update-View):

```
                    ┌─────────────────────────┐
                    │        User Input        │
                    │   (keyboard, resize)     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     tea.Msg (message)    │
                    │  KeyMsg, TickMsg,        │
                    │  ClaudeFinishedMsg, etc. │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌──────────┐       ┌─────────────────────────┐       ┌──────────┐
│          │       │                         │       │          │
│  Model   │──────▶│     Update(msg)         │──────▶│  Model'  │
│  (state) │       │     (state machine)     │       │ (new)    │
│          │       │                         │       │          │
└──────────┘       └────────────┬────────────┘       └─────┬────┘
                                │                          │
                                ▼                          ▼
                   ┌──────────────────┐       ┌─────────────────────┐
                   │   tea.Cmd        │       │     View(model)     │
                   │  (side effects)  │       │   (render to        │
                   │  RunClaude,      │       │    terminal)        │
                   │  LoadStories     │       │                     │
                   └──────────────────┘       └─────────────────────┘
```

### Data Flow

```
stories.json           Claude CLI              Terminal
    │                      │                      │
    ▼                      ▼                      │
┌────────┐          ┌──────────┐                  │
│ domain │          │  claude/  │                  │
│ .Load  │          │  runner   │                  │
│ Stories│          │  .Start() │                  │
└───┬────┘          └────┬─────┘                  │
    │                    │                        │
    ▼                    ▼                        │
┌────────────────────────────────┐                │
│         app/update.go          │                │
│                                │                │
│  InitCompleteMsg ──▶ m.Stories │                │
│  ToolActivityMsg ──▶ m.Current │                │
│  ClaudeFinished  ──▶ Signal    │                │
│  TickMsg ──▶ Animate Springs   │                │
│                                │                │
└────────────────┬───────────────┘                │
                 │                                │
                 ▼                                ▼
         ┌───────────────┐              ┌──────────────┐
         │  app/view*.go │─────────────▶│   Rendered   │
         │  render()     │              │   Terminal   │
         └───────────────┘              └──────────────┘
```

---

## Getting Started

### Build

```bash
cd cmd/prism-cli

make build          # Build for current platform → bin/prism-cli
make build-all      # Cross-compile (windows/darwin/linux × amd64/arm64)
make test           # Run tests: go test -v ./...
make lint           # Run golangci-lint
make install        # Install to GOPATH/bin
```

### Run

```bash
# Direct with stories file
prism-cli .prism/stories/stories.json

# Auto-discover .prism/ in current directory
prism-cli

# Demo mode (no stories.json needed)
prism-cli --demo

# With options
prism-cli -f stories.json -n 100 -p 5 --prism-style braille
```

### CLI Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--file` | `-f` | `""` | Path to stories.json |
| `--max-iterations` | `-n` | `50` | Maximum iterations before stopping |
| `--pause` | `-p` | `2` | Seconds between iterations |
| `--demo` | | `false` | Run with simulated stories |
| `--prism-style` | | `gradient` | Animation style: `gradient` `simple` `braille` `ascii` |

---

## Screen Reference

### 1. Home Screen

The landing screen when no `stories.json` is provided. Features the 3D rotating prism alongside the ASCII logotype, with a menu for navigating to other screens.

#### UI Layout

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ▀▀▄▄▀▀▄▄▀▀    '||''|.  '||''|.   '||'  .|'''.|  '||    ||'               │
│  ▄▄▀▀▄▄▀▀▄▄     ||   ||  ||   ||   ||   ||..  '   |||  |||                │
│  ▀▀▄▄▀▀▄▄▀▀     ||...|'  ||''|'    ||    ''|||.   |'|..'||                │
│  ▄▄▀▀▄▄▀▀▄▄     ||       ||   |.   ||  .     '||  | '|' ||               │
│  ▀▀▄▄▀▀▄▄▀▀    .||.     .||.  '|' .||. |'....|'  .|. | .||.              │
│                                                                              │
│   [3D Prism]                   [Spectrum Gradient Logo]                      │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

  >  [1]  Research      Browse and create research documents

     [2]  Plans         View and decompose implementation plans

     [3]  Spectrum      Execute stories autonomously


      j/k navigate   enter select   q quit
```

#### Component Details

| Component | Rendering | Source |
|-----------|-----------|--------|
| 3D Prism | `prism.Renderer.String()` — FauxGL → half-block ANSI, 24×5 cells | `view_home.go:18` |
| ASCII Logo | 5-line logotype with 4-stop spectrum gradient (Blue→Teal→Green→Amber) | `view.go:38-43` |
| Top Section | Prism + Logo joined horizontally, wrapped in `PanelStyle` | `view_home.go:20-21` |
| Menu Items | Format: `[N]  Label        Description` | `view_home.go:48` |
| Selected Item | Prefix `>`, styled with `CurrentStyle` (bold purple `#7C3AED`) | `view_home.go:50-53` |
| Unselected Item | 5-space indent, styled with `DimStyle` (gray `#6B7280`) | `view_home.go:54-56` |
| Hints | 6-space indent, dim gray | `view_home.go:63` |

#### Key Bindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps around) |
| `k` / `↑` | Previous menu item (wraps around) |
| `Enter` / `Space` | Navigate to selected screen |
| `1` | Jump to Research |
| `2` | Jump to Plans |
| `3` | Jump to Spectrum |
| `q` / `Ctrl+C` | Quit |

---

### 2. Research Screen

A file browser for `.prism/shared/research/` markdown documents. Has two sub-modes: **list mode** and **viewer mode**.

#### UI Layout — List Mode

```
 PRISM  > Research                                                    ← HeaderStyle
────────────────────────────────────────────────────────────────────────

> 2026-02-12  tech-stack-evaluation                                    ← CurrentStyle
    Evaluated React vs Svelte vs Solid for frontend framework.         ← DimStyle (preview)
    Recommendation: React with Next.js for SSR support.                ← DimStyle (preview)
  2026-02-08  auth-patterns                                            ← PendingStyle
  2026-02-04  database-schema-design                                   ← PendingStyle
  2026-01-31  api-rate-limiting                                        ← PendingStyle

  j/k navigate   enter view   esc home
```

#### UI Layout — Viewer Mode

```
 PRISM  > Research                                                    ← HeaderStyle
────────────────────────────────────────────────────────────────────────
# Tech Stack Evaluation                                                │
                                                                       │
## Summary                                                             │ viewport.Model
Evaluated React vs Svelte vs Solid for frontend framework...           │ (scrollable)
                                                                       │
## Findings                                                            │
...                                                                    │
────────────────────────────────────────────────────────────────────────
  esc back   j/k scroll
```

#### Component Details

| Component | Rendering | Source |
|-----------|-----------|--------|
| Header | `TitleStyle("PRISM")` + `DimStyle(" > Research")` in `HeaderStyle` (white on purple) | `view_research.go:17-20` |
| File List | Format: `  YYYY-MM-DD  filename` (no .md extension) | `view_research.go:37` |
| Selected File | Prefix `"> "`, `CurrentStyle`, shows multi-line preview below | `view_research.go:39-46` |
| Unselected File | Prefix `"  "`, `PendingStyle` | `view_research.go:48` |
| Preview Lines | 4-space indent, `DimStyle` | `view_research.go:44` |
| Empty State | "No research files found." + path hint | `view_research.go:31-32` |
| Viewport | `viewport.Model`, height = `termHeight - 6` (min 10) | `view_research.go:24` |

#### Key Bindings — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file (clamped, no wrap) |
| `k` / `↑` | Previous file (clamped, no wrap) |
| `Enter` | Open file in scrollable viewport |
| `Esc` | Return to Home |

#### Key Bindings — Viewer Mode

| Key | Action |
|-----|--------|
| `Esc` / `Backspace` | Close viewer, return to list |
| `j` / `k` / `↑` / `↓` | Scroll viewport |
| `PgUp` / `PgDn` | Page scroll |

---

### 3. Plans Screen

Identical to Research screen but browses `.prism/shared/plans/` and adds a **decompose** command.

#### UI Layout — List Mode

```
 PRISM  > Plans                                                       ← HeaderStyle
────────────────────────────────────────────────────────────────────────

> 2026-02-11  user-authentication                                      ← CurrentStyle
    Implement OAuth2 + JWT auth with refresh tokens.                   ← DimStyle (preview)
    12 stories across 3 phases.                                        ← DimStyle (preview)
  2026-02-09  dashboard-redesign                                       ← PendingStyle
  2026-02-05  notification-system                                      ← PendingStyle

  j/k navigate   enter view   d decompose to epic   esc home
```

#### Additional Key Binding

| Key | Action |
|-----|--------|
| `d` | Decompose selected plan into an epic (creates `.prism/stories/<name>/stories.json`) |

---

### 4. Spectrum Execution Dashboard

The primary operational screen. Displays real-time execution progress with 6 sub-panels arranged vertically.

#### UI Layout — Full Dashboard

```
╭──────────────────────────────────────────────────────────────────────────────╮
│  user-auth (8/12)   dashboard (12/36)   notifications (0/9)   [tab] switch  │
╰──────────────────────────────────────────────────────────────────────────────╯
 PRISM TUI                                          Iteration: 3/50  [?] help
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ▀▀▄▄▀▀▄▄▀▀    '||''|.  '||''|.   '||'  .|'''.|  '||    ||'               │
│  ▄▄▀▀▄▄▀▀▄▄     ||   ||  ||   ||   ||   ||..  '   |||  |||                │
│  ▀▀▄▄▀▀▄▄▀▀     ||...|'  ||''|'    ||    ''|||.   |'|..'||                │
│  ▄▄▀▀▄▄▀▀▄▄     ||       ||   |.   ||  .     '||  | '|' ||               │
│  ▀▀▄▄▀▀▄▄▀▀    .||.     .||.  '|' .||. |'....|'  .|. | .||.              │
│                                                                              │
│  Plan: Feature Implementation  ████████████░░░░░░░░░░░░░░  12/36 (33%)      │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││ ▸ DEMO-013: Implement auto-expandi...   │
│ ✓ DEMO-002 Implement progr...  ││                                          │
│ ✓ DEMO-003 Add story compl...  ││ Status: ⣾ Working...                    │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ✓ DEMO-005 Implement log e...  ││ Editing: .../services/user.ts           │
│ ✓ DEMO-006 Add prism logo ...  ││                                          │
│ ✓ DEMO-007 Optimize animat...  ││ Recent:                                  │
│ ✓ DEMO-008 Test all animat...  ││   Reading: .../components/Auth.tsx       │
│ ✓ DEMO-009 Create TipTap R...  ││   Bash: npm run typecheck               │
│ ✓ DEMO-010 Build FormatToo...  ││   Grep: Searching: handleSubmit         │
│ ✓ DEMO-011 Implement markd...  ││   Edit: .../utils/validation.ts         │
│ ✓ DEMO-012 Create NoteCard...  ││   Read: package.json                    │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:32:05] INFO  Prism CLI v1.9.8                                          │
│ [14:32:05] INFO  Starting iteration 1                                      │
│ [14:32:15] OK    DEMO-009 completed (commit: abc123)                       │
│ [14:32:20] INFO  Starting iteration 2                                      │
│ [14:32:35] OK    Quality gates passed                                      │
│ [14:32:40] OK    DEMO-010 completed (commit: def456)                       │
│   ● ○                                                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
 ▸ RUNNING               Elapsed: 2m 15s               [q]uit [p]ause [/]skip
```

#### Panel Breakdown

**Panel 1: Epic Selector** (conditional — only shown when multiple epics exist)

```
╭──────────────────────────────────────────────────────────────╮
│  user-auth (8/12)   dashboard (12/36)   notifications (0/9)  │  [tab] switch epic
╰──────────────────────────────────────────────────────────────╯
```

- Selected epic: `CurrentStyle` (bold purple)
- Unselected: `DimStyle` (gray)
- Format: ` name (completed/total) `
- Width: `termWidth - 2`

**Panel 2: Header**

```
 PRISM TUI                                          Iteration: 3/50  [?] help
```

- Left: `TitleStyle("PRISM TUI")` (bold purple with padding)
- Right: Iteration counter + help hint in `DimStyle`
- Full width on purple background via `HeaderStyle`

**Panel 3: Progress Bar**

```
╭──────────────────────────────────────────────────────────────────────────────╮
│  [3D Prism Animation]    [PRISM ASCII Logotype with Gradient]               │
│  Plan: Feature Implementation  ████████████░░░░░░░░░░░░░░  12/36 (33%)      │
╰──────────────────────────────────────────────────────────────────────────────╯
```

- 3D prism (left) + ASCII logo (right) joined horizontally
- Progress bar: spectrum gradient `█` (filled) + `░` in `#374151` (empty)
- Bar width: `termWidth - 20` (min 20)
- Progress driven by spring-animated position (not raw percentage)
- Stats format: `completed/total (pct%)`

**Panel 4: Story List** (40% width)

```
╭─────────────────────────────────╮
│ STORIES                         │  ← StoriesTitleStyle (bold blue #3B82F6)
│ ────────────────────────────    │  ← HorizontalLine (dim ─)
│ ✓ STORY-001 Setup database...  │  ← CompleteStyle (green)
│ ✓ STORY-002 Implement API ...  │  ← CompleteStyle (green)
│ ▸ STORY-003 Write integrat...  │  ← CurrentStyle (bold purple), pulsing icon
│ ⊘ STORY-004 Deploy to stag...  │  ← BlockedStyle (italic amber)
│ ○ STORY-005 Final testing      │  ← PendingStyle (gray)
│                                 │
│                                 │  ← padded to StoriesPerPage (12) lines
│                                 │
│   ● ○ [a/s]                    │  ← pagination dots (if multiple pages)
╰─────────────────────────────────╯
```

Story icons with animated states:

| Status | Icon | Style | Animation |
|--------|------|-------|-----------|
| Complete (settling) | `●` | Green | Scale < 0.7 during pop |
| Complete (overshoot) | `✔` | Green | Scale > 1.1 during pop |
| Complete (final) | `✓` | Green | Pop animation finished |
| Active (bright) | `▶` | Bold purple | Pulse brightness > 0.8 |
| Active (dim) | `▸` | Bold purple | Pulse brightness ≤ 0.8 |
| Blocked | `⊘` | Italic amber | Static |
| Pending | `○` | Gray | Static |

**Panel 5: Activity Panel** (60% width)

```
╭──────────────────────────────────────────────╮
│ CURRENT ACTIVITY                             │  ← ActivityTitleStyle (bold teal #14B8A6)
│ ──────────────────────────────────────────── │
│ ▸ STORY-003: Write integration tests         │  ← CurrentStyle
│                                              │
│ Status: ⣾ Working...                        │  ← spinner + status text
│                                              │
│ Editing: .../services/auth.ts               │  ← HighlightStyle (cyan #06B6D4)
│                                              │
│ Recent:                                      │  ← DimStyle label
│   Reading: .../components/Login.tsx          │  ← DimStyle, 2-space indent
│   Bash: npm run typecheck                    │  ← DimStyle
│   Grep: Searching: handleAuth               │  ← DimStyle
│   Edit: .../utils/token.ts                   │  ← DimStyle
│   Read: package.json                         │  ← DimStyle
╰──────────────────────────────────────────────╯
```

State-dependent content:

| State | Activity Panel Content |
|-------|----------------------|
| Idle | "Press Enter to start execution" (dim) |
| Running | Story info + spinner + tool activity + recent activities |
| Paused | Story info + "Paused" status |
| Complete | "All stories complete!" (green) |
| MaxIterations | "Iteration limit reached" (amber) |
| Error | "Error occurred" (red) + error message |

**Panel 6: Log Panel**

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:32:05] INFO  Starting iteration 3                                      │
│ [14:32:15] OK    DEMO-009 completed                                        │
│ [14:32:20] WARN  Skip requested                                            │
│ [14:32:25] ERROR Quality gate failed: npm test                             │
│                                                                              │
│                                                                              │
│   ● ○                                                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Log level formatting:

| Level | Badge | Style |
|-------|-------|-------|
| Info | `INFO ` | Blue `#3B82F6` |
| Success | `OK   ` | Green `#10B981` |
| Warning | `WARN ` | Amber `#F59E0B` |
| Error | `ERROR` | Bold red `#EF4444` |
| Claude Output | `     ` | Gray `#6B7280` |

Format: `[HH:MM:SS] LEVEL MESSAGE` — timestamp in `DimStyle`

New log entries slide in from the right (offset 20 → 0) via spring animation.

**Panel 7: Status Bar**

```
 ▸ RUNNING               Elapsed: 2m 15s               [q]uit [p]ause [/]skip
```

Three columns with dynamic spacing:

| Left | Center | Right |
|------|--------|-------|
| State icon + state name | Elapsed time | Control hints |

State colors:

| State | Icon | Color |
|-------|------|-------|
| Running | `▸` | Green `#10B981` |
| Paused | `⏸` | Amber `#F59E0B` |
| Complete | `▸` | Green `#10B981` |
| MaxIterations | `⏸` | Amber `#F59E0B` |
| Error | `▸` | Red `#EF4444` |
| Idle | `▸` | Gray `#6B7280` |

#### Spectrum Key Bindings

| Key | Action | State Required |
|-----|--------|----------------|
| `a` | Stories previous page | Any |
| `s` | Stories next page | Any |
| `z` | Logs previous page | Any |
| `x` | Logs next page | Any |
| `Tab` | Next epic | Multi-epic only |
| `Shift+Tab` | Previous epic | Multi-epic only |
| `Enter` / `Space` | Start execution | Idle |
| `p` | Pause execution | Running |
| `p` / `Enter` / `Space` | Resume execution | Paused |
| `/` | Skip current story | Running |
| `Enter` / `Space` | Quit | Complete / MaxIterations / Error |

---

## User Flow Diagrams

### Complete Navigation Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION START                           │
│                                                                     │
│   stories.json found?                                               │
│       YES ──────────────────────────────────▶ Spectrum (Idle)       │
│       NO  ──────────────────────────────────▶ Home                  │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │                  │
              ┌──────────│      HOME        │──────────┐
              │          │  [1] [2] [3]     │          │
              │          │  j/k  enter      │          │
              │          └────────┬─────────┘          │
              │                   │                    │
         [1] │              [2]   │              [3]   │
              │                   │                    │
              ▼                   ▼                    ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │    RESEARCH      │ │     PLANS        │ │    SPECTRUM      │
   │    (List Mode)   │ │   (List Mode)    │ │    (Idle)        │
   │                  │ │                  │ │                  │
   │  j/k navigate    │ │  j/k navigate    │ │  [enter] start   │
   │  [enter] open    │ │  [enter] open    │ │                  │
   │  [esc] ← Home    │ │  [d] decompose   │ │                  │
   │                  │ │  [esc] ← Home    │ │                  │
   └───────┬──────────┘ └───────┬──────────┘ └────────┬─────────┘
           │                    │                      │
      [enter]              [enter]                [enter]
           │                    │                      │
           ▼                    ▼                      ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │    RESEARCH      │ │     PLANS        │ │    SPECTRUM      │
   │  (Viewer Mode)   │ │  (Viewer Mode)   │ │   (Running)      │
   │                  │ │                  │ │                  │
   │  j/k scroll      │ │  j/k scroll      │ │  [p] pause       │
   │  PgUp/PgDn       │ │  PgUp/PgDn       │ │  [/] skip        │
   │  [esc] ← List    │ │  [esc] ← List    │ │  a/s stories     │
   │                  │ │                  │ │  z/x logs         │
   └──────────────────┘ └──────────────────┘ │  [tab] epic       │
                                              └────────┬─────────┘
                                                       │
                                              [p] or [signal]
                                                       │
                                              ┌────────┴─────────┐
                                              │                  │
                                         ┌────▼────┐      ┌─────▼──────┐
                                         │ PAUSED  │      │ TERMINAL   │
                                         │         │      │ Complete / │
                                         │ [p] ──▶ │      │ Error /    │
                                         │ resume  │      │ MaxIter    │
                                         └─────────┘      │            │
                                                          │ [enter] ─▶ │
                                                          │   Quit     │
                                                          └────────────┘
```

### Back Navigation Logic

```
Current View          esc / backspace Action
─────────────────     ───────────────────────────────────────
Home                  (no effect)
Research (list)       → Home
Research (viewer)     → Research (list)
Plans (list)          → Home
Plans (viewer)        → Plans (list)
Spectrum (idle)       → Home
Spectrum (running)    → (blocked — cannot leave while running)
Spectrum (paused)     → (blocked — cannot leave while paused)
Spectrum (complete)   → Home
Spectrum (error)      → Home
```

### File Browser Flow (Research / Plans)

```
                    ┌───────────┐
                    │ LoadFiles │
                    │   Cmd()   │
                    └─────┬─────┘
                          │
                          ▼
          ┌───────────────────────────┐
          │   FilesLoadedMsg          │
          │   (populate file list)    │
          └───────────┬───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   LIST MODE   │
              │               │
              │  ┌──────────┐ │
              │  │ File A  ◀├─┤── j/k to select
              │  │ File B   │ │
              │  │ File C   │ │
              │  └──────────┘ │
              └───────┬───────┘
                      │ [enter]
                      ▼
          ┌───────────────────────────┐
          │   LoadFileContentCmd()    │
          │   (async file read)       │
          └───────────┬───────────────┘
                      │
                      ▼
          ┌───────────────────────────┐
          │   FileContentLoadedMsg    │
          │   (set Viewing = true)    │
          └───────────┬───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  VIEWER MODE  │
              │               │
              │  Scrollable   │
              │  viewport     │
              │  (markdown)   │
              │               │
              └───────┬───────┘
                      │ [esc]
                      ▼
              ┌───────────────┐
              │  LIST MODE    │
              │  (preserved   │
              │   selection)  │
              └───────────────┘
```

---

## Execution State Machine

### State Diagram

```
                                ┌──────────────┐
                                │              │
                                │    IDLE      │
                                │              │
                                └──────┬───────┘
                                       │
                                  [Enter pressed]
                                       │
                                       ▼
                                ┌──────────────┐
               ┌───────────────▶│              │◀──────────────────┐
               │                │   RUNNING    │                   │
               │      ┌────────▶│              │◀────────┐         │
               │      │         └──┬───┬───┬───┘         │         │
               │      │            │   │   │             │         │
               │   [resume]        │   │   │          [retry]   [continue]
               │      │            │   │   │          [blocked]    │
               │      │         [p]│   │   │[Claude      │         │
               │      │            │   │   │ finished]   │         │
               │      │            ▼   │   │             │         │
               │   ┌──────┐        │   │   ▼             │         │
               │   │      │        │   │ ┌────────────┐  │         │
               │   │PAUSED│◀───────┘   │ │Parse Signal│──┘         │
               │   │      │            │ └──────┬─────┘            │
               │   └──┬───┘            │        │                  │
               │      │                │   ┌────┴────────────┐     │
               │   [p/enter]           │   │     │     │     │     │
               │      │                │   ▼     ▼     ▼     ▼     │
               └──────┘                │ Error Retry Block Continue │
                                       │   │     │     │     │     │
                                       │   │     │     └─────┴─────┘
                                       │   │     │
                                       │   │  ┌──┴────────┐
                                       │   │  │ > 3       │
                                       │   │  │ retries?  │
                                [max   │   │  └──┬────┬───┘
                                iter]  │   │     │    │
                                       │   │   YES   NO
                                       │   │     │    │
                                       │   │     │    └──▶ Continue ──▶ RUNNING
                                       │   │     │
                            ┌──────────┘   │     │
                            │              │     │
                            ▼              ▼     ▼
                   ┌──────────────┐  ┌──────────────┐
                   │     MAX      │  │              │
                   │  ITERATIONS  │  │    ERROR     │
                   │              │  │              │
                   └──────┬───────┘  └──────┬───────┘
                          │                 │
                     [Enter]           [Enter]
                          │                 │
                          ▼                 ▼
                   ┌──────────────┐  ┌──────────────┐
                   │              │  │              │
                   │   COMPLETE   │  │     QUIT     │
                   │              │  │              │
                   └──────┬───────┘  └──────────────┘
                          │
                     [Enter]
                          │
                          ▼
                   ┌──────────────┐
                   │     QUIT     │
                   └──────────────┘
```

### State Descriptions

| State | String | Behavior |
|-------|--------|----------|
| `StateIdle` | `"IDLE"` | Waiting for user to press Enter to start |
| `StateRunning` | `"RUNNING"` | Claude CLI active, processing stories |
| `StatePaused` | `"PAUSED"` | Execution paused, can resume with `p` |
| `StateComplete` | `"COMPLETE"` | All stories finished successfully |
| `StateMaxIterations` | `"PAUSED"` | Iteration limit reached (soft stop) |
| `StateError` | `"ERROR"` | Fatal error, cannot continue |

### Signal Protocol

Signals are XML-like tags emitted in Claude's output text, parsed via regex:

| Signal | Tag | Priority | Action |
|--------|-----|----------|--------|
| Complete | `<promise>COMPLETE</promise>` | 1 (highest) | If 0 remaining → Complete; if remaining > 0 → override & continue |
| Error | `<spectrum-error reason="...">...</spectrum-error>` | 2 | Fatal → Error state |
| Retry | `<spectrum-retry reason="...">...</spectrum-retry>` | 3 | Increment error counter; retry if under limit (3) |
| Blocked | `<spectrum-blocked reason="...">...</spectrum-blocked>` | 4 | Log warning, skip to next unblocked story |
| Continue | `<spectrum-continue>...</spectrum-continue>` | 5 | Success, schedule next iteration after pause |
| None | (no match) | 6 | Assume continue |

### Iteration Lifecycle

```
┌─ Iteration N ──────────────────────────────────────────────────────┐
│                                                                     │
│  1. Check max iterations ─── exceeded? ──▶ StateMaxIterations      │
│                │                                                    │
│                ▼                                                    │
│  2. Increment counter, clear output                                │
│                │                                                    │
│                ▼                                                    │
│  3. RunClaudeStreamingCmd() ──▶ spawn `claude` CLI process         │
│     + ListenToOutput()        ├── stream stdout/stderr             │
│                               ├── parse JSON events                │
│                               └── emit ToolActivityMsg             │
│                │                                                    │
│                ▼                                                    │
│  4. ClaudeFinishedMsg received                                     │
│                │                                                    │
│          ┌─────┴─────┐                                              │
│       error?      success?                                          │
│          │            │                                             │
│          ▼            ▼                                             │
│  5a. Inc errors   5b. ParseSignal()                                │
│      backoff          ReloadStoriesCmd()                            │
│      retry            SignalDetectedMsg                             │
│                │                                                    │
│                ▼                                                    │
│  6. handleSignal() ──▶ determine next action                       │
│                │                                                    │
│          ┌─────┴──────────────────┐                                 │
│      continue?              terminal?                               │
│          │                      │                                   │
│          ▼                      ▼                                   │
│  7. Pause (N seconds)    Complete/Error                             │
│          │                                                          │
│          ▼                                                          │
│  8. StartNextIterationMsg ──▶ Loop to step 1                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Animation System

All animations are driven by a 100ms tick (`TickMsg`) and use Harmonica spring physics for organic motion.

### Spring Configuration

| Animation | Stiffness | Damping | FPS | Initial | Target | Character |
|-----------|-----------|---------|-----|---------|--------|-----------|
| Progress Bar | 6.0 | 0.7 | 60 | 0.0 | `ProgressPercent()` | Snappy, slight overshoot |
| Story Pop | 8.0 | 0.5 | 60 | 0.3 (start scale) | 1.0 (normal) | Very bouncy |
| Log Slide-In | 5.0 | 0.8 | 60 | 20.0 (x-offset) | 0.0 (settled) | Smooth, minimal overshoot |
| Ray Length | 4.0 | 0.3 | 60 | `{6,5,4,3}` | Random 4–8 | Bouncy, organic |

### Spring Behavior Visualization

```
                    Stiffness = 8.0, Damping = 0.5 (Story Pop)
Value
1.3 │              ╭─╮
1.2 │             ╱   ╲
1.1 │           ╱       ╲──── overshoot (icon: ✔)
1.0 │─────────╱───────────╲─────────────── settled (icon: ✓)
0.9 │       ╱               ╲
0.8 │      ╱                 ╲╱─╮
0.7 │─────╱──────────────────────╲───── compressed (icon: ●)
0.6 │   ╱
0.5 │  ╱
0.4 │ ╱
0.3 │╱ ← trigger (story completes)
    └──────────────────────────────────▶ Time
        0    100ms 200ms 300ms 400ms 500ms
```

### Animation Update Loop (per 100ms tick)

```
TickMsg received
    │
    ├── 1. Spinner.Update()              (advance frame)
    │
    ├── 2. Prism.Tick()                  (advance 3D rotation)
    │
    ├── 3. ProgressSpring.Update()       (pos, vel → target)
    │       └── smooth progress bar fill
    │
    ├── 4. StoryPopSpring.Update()       (per-story scale → 1.0)
    │       └── cleanup when |scale - 1.0| < 0.01
    │
    ├── 5. PulsePhase += 0.15            (sine wave, wraps at 2π)
    │       └── active story icon brightness
    │
    ├── 6. LogSlideSpring.Update()       (per-entry offset → 0.0)
    │       └── entries slide in from right
    │
    ├── 7. PrismTick++                   (every 3 ticks → PrismFrame++)
    │       └── cycle spectrum colors on text prism
    │
    ├── 8. RaySpring.Update()            (per-ray length → target)
    │       └── re-target randomly when settled
    │
    └── 9. ShimmerPhase += 0.08          (sine wave, wraps at 2π)
            └── prism body brightness oscillation
```

### Continuous Animations

| Animation | Increment/Tick | Full Cycle | Effect |
|-----------|----------------|------------|--------|
| Pulse | +0.15 rad | ~4.2 seconds | Active story icon brightness oscillation (0.2 → 1.0) |
| Shimmer | +0.08 rad | ~7.85 seconds | Prism body brightness modulation (0.85 → 1.0) |
| Prism Frame | +1 every 300ms | 1.2 seconds | 4-color spectrum rotation on text prism |
| 3D Rotation | 0.6 rad/sec Y-axis | ~10.5 seconds | Full rotation of 3D prism model |

---

## 3D Prism Rendering Pipeline

### Pipeline Overview

```
┌─────────────────┐
│  Embedded OBJ   │  444 vertices, 360 triangular faces
│  (go:embed)     │  Blender 4.2.16 LTS export
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FauxGL Loader  │  LoadOBJ() → Mesh
│  BiUnitCube()   │  Normalize to [-1, +1] cube
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Camera: eye(0,0,3) center(0,0,0) up(0,1,0)
│  Scene Setup    │  FOV: 50°  Aspect: w/h  Near: 0.1  Far: 100
│  Projection     │  Clear: RGB(0.05, 0.04, 0.08) dark purple-black
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Y-spin: angle = t × 0.6 rad/s
│  Model Transform│  X-tilt: 0.3 ± 0.15 × sin(angle × 0.7)
│  (animated)     │  Z-roll: ±0.1 × sin(angle × 0.5)
└────────┬────────┘  Matrix order: Rz × Ry × Rx
         │
         ▼
┌─────────────────┐  Key: dir(0.6, 0.5, 1) color(0.9, 0.92, 1.0) @0.85
│  Two-Light      │  Fill: dir(-0.4, -0.3, 0.5) color(1.0, 0.85, 0.7) @0.3
│  Lambertian     │
└────────┬────────┘  Fragment: Σ(color × intensity × max(0, N·L))
         │
         ▼
┌─────────────────┐
│  ctx.DrawMesh() │  Rasterize 360 triangles → pixel buffer
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Each terminal row = 2 pixel rows
│  Half-Block     │  Top pixel → foreground ANSI color
│  ANSI Encoding  │  Bottom pixel → background ANSI color
│                 │  Character: ▀ (U+2580)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Terminal Output │  ANSI 24-bit color: \x1b[38;2;R;G;Bm
│  (string)       │  Optimization: skip redundant color codes
└─────────────────┘
```

### Half-Block Encoding Detail

```
24 columns × 5 rows → 24×10 pixel framebuffer (2 pixels per row)

   Pixel Grid (10 rows high)        Terminal Output (5 rows high)
   ┌────────────────────────┐       ┌────────────────────────┐
   │ R₁ R₁ R₂ R₂ R₃ R₃ ...│ row 0 │                        │
   │ R₄ R₄ R₅ R₅ R₆ R₆ ...│ row 1 │ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ │ cell row 0
   ├────────────────────────┤       │ (fg=row0, bg=row1)     │
   │ R₇ R₇ R₈ R₈ R₉ R₉ ...│ row 2 ├────────────────────────┤
   │ Rₐ Rₐ Rᵦ Rᵦ Rᵧ Rᵧ ...│ row 3 │ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ │ cell row 1
   ├────────────────────────┤       │ (fg=row2, bg=row3)     │
   │ ...                    │ row 4 ├────────────────────────┤
   │ ...                    │ row 5 │ ...                    │ cell row 2
   ├────────────────────────┤       ├────────────────────────┤
   │ ...                    │ row 6 │ ...                    │ cell row 3
   │ ...                    │ row 7 │                        │
   ├────────────────────────┤       ├────────────────────────┤
   │ ...                    │ row 8 │ ...                    │ cell row 4
   │ ...                    │ row 9 │                        │
   └────────────────────────┘       └────────────────────────┘

   Per cell:
   \x1b[38;2;R₀;G₀;B₀m    ← foreground = top pixel color
   \x1b[48;2;R₁;G₁;B₁m    ← background = bottom pixel color
   ▀                        ← upper-half block character
```

### Resize Behavior

```
Terminal Width    Prism Columns    Formula
─────────────    ─────────────    ───────────────────────
< 80              20              min(max(width/4, 20), 40)
80                20              80/4 = 20
100               25              100/4 = 25
120               30              120/4 = 30
160               40              max = 40
200               40              clamped at 40

Prism rows: always 5 (fixed)
```

### Text Prism Fallback Variants

When the 3D renderer is unavailable (`m.Prism == nil`), a text-based prism is used:

```
Style: gradient (default, 1 line)
─◁◆▷▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
     └─ shimmer        └── spring-animated ray lengths with gradient

Style: simple (1 line)
-<>====

Style: braille (3 lines)
  ─⢀⣠⣤⣄⡀
━━⣾⣿⣿⣿⣷
  ⠈⠉⠛⠛⠛⠛⠛⠛

Style: ascii (5 lines)
        ╱╲
   ━━━╱  ╲
      ╱    ╲━━━
     ╱______╲══════
               ▬▬▬▬▬▬

Style: fancy (1 line)
─◁◆▷▬▬▬▬

Style: compact (1 line)
─◆▬▬
```

---

## Domain Models

### stories.json Schema

```json
{
  "plan": {
    "name": "Feature Implementation",
    "source": ".prism/shared/plans/2026-02-12-feature.md",
    "createdAt": "2026-02-12T14:00:00Z",
    "qualityGates": ["npm run typecheck", "npm run lint", "npm test"]
  },
  "stories": [
    {
      "id": "STORY-001",
      "title": "Setup database schema",
      "description": "Create initial migration files for PostgreSQL",
      "priority": 1,
      "status": "complete",
      "blockedBy": null,
      "files": [
        { "path": "db/migrations/001_initial.sql", "action": "create" },
        { "path": "db/schema.go", "action": "modify" }
      ],
      "steps": [
        { "description": "Design schema", "done": true },
        { "description": "Write migration", "done": true }
      ],
      "completedAt": "2026-02-12T14:30:00Z",
      "commitHash": "abc123"
    },
    {
      "id": "STORY-002",
      "title": "Implement API endpoints",
      "priority": 2,
      "status": "in_progress",
      "blockedBy": null,
      "files": [
        { "path": "api/handlers.go", "action": "create" }
      ],
      "steps": [
        { "description": "Define routes", "done": true },
        { "description": "Write handlers", "done": false }
      ]
    },
    {
      "id": "STORY-003",
      "title": "Write integration tests",
      "priority": 3,
      "status": "pending",
      "blockedBy": "STORY-002",
      "files": [
        { "path": "tests/api_test.go", "action": "create" }
      ],
      "steps": []
    }
  ]
}
```

### Story Status Lifecycle

```
                ┌─────────┐
                │ pending  │
                └────┬────┘
                     │
            GetNextStory()
           (priority-sorted,
            unblocked only)
                     │
                     ▼
              ┌────────────┐
              │ in_progress │
              └──────┬─────┘
                     │
          MarkStoryComplete()
            (sets status,
             records commit,
             marks all steps done)
                     │
                     ▼
              ┌────────────┐
              │  complete   │
              └────────────┘
```

### Dependency Resolution

```go
// Story selection: pick highest-priority unblocked pending story
func GetNextStory():
    candidates = stories.filter(s =>
        s.Status != "complete" &&
        !s.IsBlocked(stories)     // blockedBy story must be complete
    )
    sort(candidates, by: Priority ascending)  // lower number = higher priority
    return candidates[0]  // or nil if empty
```

### .prism/ Directory Convention

```
.prism/
├── stories/                              # Story files
│   ├── stories.json                      # Legacy flat layout
│   ├── epic-a/
│   │   └── stories.json                  # Epic-scoped
│   └── epic-b/
│       └── stories.json
├── shared/                               # Committed to repo
│   ├── research/
│   │   └── YYYY-MM-DD-topic.md
│   ├── plans/
│   │   └── YYYY-MM-DD-feature.md
│   ├── spectrum/
│   │   ├── progress.md                   # Legacy flat
│   │   ├── epic-a/
│   │   │   └── progress.md               # Epic-scoped
│   │   └── epic-b/
│   │       └── progress.md
│   ├── docs/
│   └── handoffs/
└── local/                                # Gitignored
```

**Progress file path derivation**:

| stories.json Location | progress.md Location |
|------------------------|---------------------|
| `.prism/stories/stories.json` | `.prism/shared/spectrum/progress.md` |
| `.prism/stories/<epic>/stories.json` | `.prism/shared/spectrum/<epic>/progress.md` |

---

## Claude CLI Integration

### Command Invocation

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  --output-format stream-json \
  --verbose \
  "Execute the next story from {storiesPath} using the /prism-spectrum workflow. \
   Progress file: {progressPath}"
```

### Streaming Pipeline

```
claude CLI (child process)
    │
    ├── stdout ──▶ goroutine 1 ──▶ streamOutput()
    │                                  │
    └── stderr ──▶ goroutine 2 ──▶ streamOutput()
                                       │
                              ┌────────┴────────┐
                              │  bufio.Scanner   │  1MB buffer
                              │  (line by line)  │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │ ParseStreamEvent │  JSON → StreamEvent
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │ ExtractTool      │  Tool-specific formatting
                              │ Activity()       │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │  output channel  │  buffered (100)
                              │  (tea.Msg)       │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │  Bubble Tea      │  ToolActivityMsg →
                              │  Update()        │  update UI in real-time
                              └─────────────────┘
```

### Tool Activity Formatting

| Tool | Display Format | Example |
|------|---------------|---------|
| Read | `Reading: .../shortened/path.ts` | `Reading: .../services/auth.ts` |
| Edit | `Editing: .../shortened/path.ts` | `Editing: .../components/Form.tsx` |
| Write | `Writing: .../shortened/path.ts` | `Writing: .../config/db.ts` |
| Bash | Command text (50 char max) | `npm run typecheck` |
| Glob | `Finding: pattern` | `Finding: **/*.test.ts` |
| Grep | `Searching: pattern` (40 char max) | `Searching: handleSubmit` |
| Task | Agent description (50 char max) | `Analyzing codebase structure...` |
| WebFetch | `Fetching: URL` | `Fetching: https://docs.example.com` |
| WebSearch | `Web search...` | `Web search...` |
| TodoWrite | `Updating tasks...` | `Updating tasks...` |

### Output Parser Event Detection

The `OutputParser` maintains a buffer of all output and fires events on:

| Event | Detection | Source |
|-------|-----------|--------|
| Story Announced | `<spectrum-story>ID: STORY-NNN` tag | `parser.go:52` |
| Phase Changed | Keywords: "research", "planning", "implementing", etc. | `parser.go:65` |
| Quality Gate Started | "Running quality gates", "npm run typecheck/lint/test" | `parser.go:75` |
| Commit Created | "commit", "git add" keywords | `parser.go:86` |
| Signal Detected | Full buffer regex scan for `<promise>` or `<spectrum-*>` | `parser.go:94` |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude process error | Increment `ConsecutiveErrs`, backoff = `errs × 2s`, retry |
| 3+ consecutive errors | Transition to `StateError`, stop execution |
| Signal: error | Immediate `StateError` |
| Signal: retry | Increment errors, retry if under limit |
| Signal: complete (but stories remain) | Override signal, log warning, continue |
| Max iterations reached | Transition to `StateMaxIterations` |

---

## Keyboard Reference

### Global Keys (All Screens)

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit application |
| `?` | Toggle help overlay |
| `Esc` / `Backspace` | Back (context-dependent) |

### Home Screen

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps) |
| `k` / `↑` | Previous menu item (wraps) |
| `Enter` / `Space` | Navigate to selected screen |
| `1` | Jump to Research |
| `2` | Jump to Plans |
| `3` | Jump to Spectrum |

### Research / Plans — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file |
| `k` / `↑` | Previous file |
| `Enter` | Open file in viewport |
| `d` | **Plans only**: Decompose plan to epic |
| `Esc` | Return to Home |

### Research / Plans — Viewer Mode

| Key | Action |
|-----|--------|
| `Esc` / `Backspace` | Close viewer, return to list |
| `j` / `k` / `↑` / `↓` | Scroll content |
| `PgUp` / `PgDn` | Page scroll |

### Spectrum Dashboard

| Key | State | Action |
|-----|-------|--------|
| `Enter` / `Space` | Idle | Start execution |
| `p` | Running | Pause |
| `p` / `Enter` / `Space` | Paused | Resume |
| `/` | Running | Skip current story |
| `a` | Any | Stories page previous |
| `s` | Any | Stories page next |
| `z` | Any | Logs page previous |
| `x` | Any | Logs page next |
| `Tab` | Any (multi-epic) | Next epic |
| `Shift+Tab` | Any (multi-epic) | Previous epic |
| `Enter` / `Space` | Complete / Error / MaxIter | Quit |

---

## Styling Reference

### Color Palette

| Name | Hex | Swatch | Usage |
|------|-----|--------|-------|
| Primary | `#7C3AED` | Purple | Titles, active items, header background |
| Success | `#10B981` | Green | Completed items, success logs |
| Warning | `#F59E0B` | Amber | Blocked items, warnings, paused state |
| Error | `#EF4444` | Red | Error messages, error state |
| Info | `#3B82F6` | Blue | Info logs, panel titles |
| Dim | `#6B7280` | Gray | Borders, pending items, hints |
| Background | `#1F2937` | Dark gray | Background elements |
| White | `#FFFFFF` | White | Header text |

### Spectrum Gradient (4-Stop)

```
#3B82F6 ───▶ #14B8A6 ───▶ #22C55E ───▶ #F59E0B
 Blue          Teal         Green        Amber
```

Used for: Progress bar fill, ASCII logo, prism rays, section titles.

### Component Styles

| Style | Properties |
|-------|------------|
| `TitleStyle` | Bold, FG: Purple `#7C3AED`, Padding(0,1) |
| `HeaderStyle` | Bold, FG: White, BG: Purple `#7C3AED`, Padding(0,1), MarginBottom(1) |
| `PanelStyle` | Border: Rounded (`╭╮╰╯─│`), BorderFG: Gray `#6B7280`, Padding(0,1) |
| `StoriesTitleStyle` | Bold, FG: Blue `#3B82F6` |
| `ActivityTitleStyle` | Bold, FG: Teal `#14B8A6` |
| `LogTitleStyle` | Bold, FG: Green `#22C55E` |
| `CompleteStyle` | FG: Green `#10B981` |
| `CurrentStyle` | Bold, FG: Purple `#7C3AED` |
| `PendingStyle` | FG: Gray `#6B7280` |
| `BlockedStyle` | Italic, FG: Amber `#F59E0B` |
| `HighlightStyle` | FG: Cyan `#06B6D4` |
| `DimStyle` | FG: Gray `#6B7280` |
| `ErrorStyle` | Bold, FG: Red `#EF4444` |
| `StatusBarStyle` | FG: Gray `#6B7280`, Padding(0,1) |

### Icons

| Icon | Character | Color | Usage |
|------|-----------|-------|-------|
| Check | `✓` | Green `#10B981` | Completed stories |
| Play | `▸` | Purple `#7C3AED` | Active story, running state |
| Pending | `○` | Gray `#6B7280` | Pending stories |
| Blocked | `⊘` | Amber `#F59E0B` | Blocked stories |
| Error | `✗` | Red `#EF4444` | Failed items |

### Gradient Rendering

The `GradientString()` function applies per-character color interpolation across N color stops using linear interpolation (`LerpColor`). Each character's position (0.0–1.0) maps to a point on the gradient, with smooth blending between adjacent stops.

```
Character position:  0.0 ────────────── 0.33 ──────────── 0.66 ──────────── 1.0
Color stops:         #3B82F6           #14B8A6           #22C55E           #F59E0B
                      Blue              Teal              Green              Amber
```

---

## Configuration

### Default Values

| Parameter | Default | Source |
|-----------|---------|--------|
| Max Iterations | 50 | `main.go:123` CLI flag |
| Pause Between Iterations | 2 seconds | `main.go:124` CLI flag |
| Max Consecutive Errors | 3 | `model.go:233` |
| Stories Per Page | 12 | `model.go:209, 241` |
| Logs Per Page | 6 | `model.go:216, 242` |
| Log Capacity | 1000 pre-allocated | `model.go:243` |
| Recent Activities Buffer | 10 max | `update.go:213-215` |
| Recent Activities Displayed | 5 | `view_spectrum.go:276` |
| Tick Interval | 100ms | `update.go:680` |
| Claude Timeout | 30 minutes | `runner.go:119` |
| Output Channel Buffer | 100 messages | `update.go:333` |
| 3D Prism Default Size | 24 cols × 5 rows | `model.go:246` |
| 3D Prism Min Width | 20 columns | `update.go:69` |
| 3D Prism Max Width | 40 columns | `update.go:71` |
| 3D Prism Width Formula | `termWidth / 4` | `update.go:67` |
| Scanner Buffer Size | 1 MB | `runner.go:207` |
| Version | 1.9.8 | `main.go:14` |

### Pagination Configuration

| Paginator | Items/Page | Style | Active Dot | Inactive Dot |
|-----------|-----------|-------|------------|--------------|
| Stories | 12 | Dots | `●` | `○` |
| Logs | 6 | Dots | `●` | `○` |

### Initial View Selection

```
stories.json provided → ViewSpectrum (direct to dashboard)
No stories.json but .prism/ exists → ViewHome (menu)
No .prism/ directory → Error: "Run init_prism.py first"
```

### Demo Mode

Activated with `--demo` flag. Provides:
- 36 pre-seeded stories (12 complete, 24 pending) across 3 pages
- 3 demo epics: `user-auth` (8/12), `dashboard` (12/36), `notifications` (0/9)
- 4 research files and 3 plan files with preview text
- Auto-completion timing: 2000–3500ms per story
- Activity cycling: 300–600ms random intervals
- 16 rotating fake tool activities

---

## Build & Cross-Compilation

### Makefile Targets

| Target | Command | Description |
|--------|---------|-------------|
| `build` | `go build -ldflags "-X main.version=$(VERSION)"` | Current platform |
| `build-all` | Cross-compile loop | 6 targets: {windows,darwin,linux} × {amd64,arm64} |
| `test` | `go test -v ./...` | Run all tests |
| `lint` | `golangci-lint run` | Static analysis |
| `clean` | `rm -rf bin/` | Remove artifacts |
| `install` | `go install` | Install to GOPATH/bin |
| `run` | `go run . $(ARGS)` | Development run |

### Version Injection

```bash
VERSION := $(shell git describe --tags --always --dirty)
LDFLAGS := -X main.version=$(VERSION)
```
