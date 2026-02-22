# Prism CLI - Complete Documentation

> A Charmbracelet ecosystem terminal application for autonomous development workflow execution.
> Built with Bubble Tea, Lipgloss, Harmonica, FauxGL, and a plugin architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Plugin System](#plugin-system)
5. [Screen Reference](#screen-reference)
   - [Splash Screen](#1-splash-screen)
   - [Onboarding Screen](#2-onboarding-screen)
   - [Home Screen](#3-home-screen)
   - [Research Screen](#4-research-screen)
   - [Plans Screen](#5-plans-screen)
   - [Spectrum Dashboard](#6-spectrum-execution-dashboard)
   - [Files Screen](#7-files-screen)
   - [Git Screen](#8-git-screen)
   - [Agent Screen](#9-agent-screen)
   - [Monitor Screen](#10-monitor-screen)
   - [Workspaces Screen](#11-workspaces-screen)
6. [App Shell](#app-shell)
   - [Tab Bar](#tab-bar)
   - [Sidebar](#sidebar)
   - [Footer](#footer)
7. [Modal & Dialog Systems](#modal--dialog-systems)
8. [User Flow Diagrams](#user-flow-diagrams)
9. [Execution State Machine](#execution-state-machine)
10. [Animation System](#animation-system)
11. [3D Prism Rendering Pipeline](#3d-prism-rendering-pipeline)
12. [Splash Screen Rendering Pipeline](#splash-screen-rendering-pipeline)
13. [Domain Models](#domain-models)
14. [Claude CLI Integration](#claude-cli-integration)
15. [Terminal Detection](#terminal-detection)
16. [Diff System](#diff-system)
17. [Keyboard Reference](#keyboard-reference)
18. [Styling Reference](#styling-reference)
19. [Vertical Layout & Height Budget](#vertical-layout--height-budget)
20. [Configuration](#configuration)

---

## Overview

Prism CLI is a Go 1.23 terminal user interface that provides real-time monitoring and control of the Spectrum autonomous development workflow. It spawns Claude Code CLI sessions to execute stories from a `stories.json` file, displays streaming tool activity, tracks progress with spring-animated UI elements, and renders a procedural 3D splash screen using software rasterization.

### Key Features

- **12 views**: Splash, Onboarding, Home menu, Research browser, Plans browser, Spectrum execution dashboard, Files browser, Git integration, Agent chat, Monitor dashboard, Workspaces manager
- **Plugin architecture**: 10 composable plugins with shared context, event bus, and lifecycle management
- **Real-time execution monitoring**: Streaming Claude CLI output with tool activity extraction
- **Procedural splash screen**: Icosahedron mesh, beam particles, spectral wave field, and ANSI true-color rendering
- **3D animated prism logo**: FauxGL software rasterizer with half-block Unicode encoding
- **Spring physics animations**: Harmonica-driven progress bars, story pop effects, log slide-ins
- **Signal-based workflow control**: XML protocol for Continue, Retry, Blocked, Error, Complete
- **Multi-epic support**: Tab-based epic switching with independent story sets
- **App shell**: Powerline tab bar, context-aware sidebar, two-tier status footer
- **Terminal detection**: Auto-detects IDE (VS Code, Cursor, Windsurf), theme colors, Nerd Font support
- **Diff rendering**: Unified and side-by-side views with syntax highlighting and word-level diffs
- **Modal & dialog system**: Layered overlays with focus cycling, permission prompts, command palette
- **Demo mode**: 36 pre-seeded stories with auto-progression for previewing animations

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Prism CLI v1.9.8                             │
├──────────────┬──────────────┬──────────────┬────────────┬───────────┤
│  Bubble Tea  │   Lipgloss   │  Harmonica   │  FauxGL    │  Termenv  │
│  TUI         │   Styling    │  Spring      │  3D        │  Terminal │
│  Framework   │   & Layout   │  Physics     │  Rendering │  Detect   │
├──────────────┴──────────────┴──────────────┴────────────┴───────────┤
│  Bubbles (spinner, viewport, paginator, progress, textarea)         │
├─────────────────────────────────────────────────────────────────────┤
│  Bubblezone (mouse click zones)  │  Chroma (syntax highlighting)    │
├──────────────────────────────────┴──────────────────────────────────┤
│  Cobra CLI Framework                                                │
├─────────────────────────────────────────────────────────────────────┤
│  Go 1.23.0                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Codebase Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~19,934 |
| Production Code | ~18,834 lines |
| Test Code | ~1,100 lines (9 test files) |
| Go Files | 67 |
| Packages | 15 |
| Direct Dependencies | 8 |

---

## Architecture

### Package Structure

```
cmd/prism-cli/
├── main.go                         # CLI entry point, Cobra commands, flag parsing (160 lines)
├── Makefile                        # Build targets (67 lines)
├── go.mod                          # Dependencies (Go 1.23.0)
├── build.sh                        # Single-platform build script
│
├── app/                            # Bubble Tea UI — Elm Architecture (22 files, 9,891 lines)
│   ├── model.go                    # Model struct, AnimState, NewModel/NewDemoModel
│   ├── update.go                   # Update handler, message routing, state transitions
│   ├── view.go                     # View router, modal overlay compositing
│   ├── views.go                    # ActiveView enum, FileEntry, ResearchState, PlansState, EpicInfo
│   ├── view_splash.go              # Splash screen thin wrapper
│   ├── shell.go                    # App shell: tab bar + sidebar + footer layout, breadcrumbs
│   ├── sidebar.go                  # Sidebar component: logo, execution info, files, gates, epics
│   ├── footer.go                   # Two-tier footer: key hints + powerline status bar
│   ├── commands.go                 # Async Bubble Tea commands (LoadStories, DiscoverEpics, etc.)
│   ├── command_palette.go          # Command palette: fuzzy search, modal builder
│   ├── messages.go                 # All message type definitions
│   │
│   ├── plugin_home.go              # Home screen plugin (menu)
│   ├── plugin_research.go          # Research file browser plugin
│   ├── plugin_plans.go             # Plans file browser plugin (+ decompose)
│   ├── plugin_spectrum.go          # Spectrum dashboard plugin (1,218 lines — LARGEST)
│   ├── plugin_files.go             # File tree browser plugin (two-pane)
│   ├── plugin_git.go               # Git integration plugin (status, diff, stage, commit)
│   ├── plugin_agent.go             # Agent chat plugin (messages + input)
│   ├── plugin_monitor.go           # System monitor plugin (health, history, gates)
│   ├── plugin_workspaces.go        # Multi-project workspace manager (1,080 lines)
│   ├── plugin_onboarding.go        # First-run setup wizard
│   │
│   └── chat/
│       └── renderer.go             # Chat message rendering (user/assistant/tool)
│
├── plugin/                         # Plugin system framework (5 files, 397 lines)
│   ├── plugin.go                   # Plugin interface (10 methods)
│   ├── registry.go                 # Plugin registry: register, activate, broadcast
│   ├── context.go                  # Shared plugin context struct
│   ├── events.go                   # EventBus + concrete event types
│   └── messages.go                 # Inter-plugin messages (FocusPluginMsg, PluginResizeMsg)
│
├── domain/                         # Business logic — no UI dependencies (6 files, 850 lines)
│   ├── story.go                    # Story/Plan/File/Step structs, dependency resolution, CRUD
│   ├── signals.go                  # Signal parsing (Complete, Continue, Retry, Blocked, Error)
│   ├── progress.go                 # progress.md file management
│   ├── story_test.go               # Story dependency/selection tests
│   ├── signals_test.go             # Signal detection tests
│   └── progress_test.go            # Progress path derivation tests
│
├── claude/                         # Claude CLI process management (3 files, 728 lines)
│   ├── runner.go                   # Process spawning, streaming output, lifecycle
│   ├── parser.go                   # Real-time output parsing (phases, signals, gates)
│   └── events.go                   # Stream-JSON event deserialization, tool formatting
│
├── styles/                         # Visual theming (5 files, 1,455 lines)
│   ├── theme.go                    # Color palette, component styles, prism variants, theme overrides
│   ├── gradient.go                 # Gradient interpolation, braille canvas, shimmer
│   ├── powerline.go                # Powerline segments, icons (Nerd Font + ASCII fallback)
│   ├── borders.go                  # Gradient border rendering, ANSI-aware truncation
│   └── borders_test.go             # Border rendering tests
│
├── modal/                          # Modal dialog system (5 files, 1,452 lines)
│   ├── modal.go                    # Base modal: focus cycling, key/mouse handling, rendering
│   ├── input.go                    # InputSection (text input) + TextareaSection
│   ├── list.go                     # ListSection (scrollable selection)
│   ├── layout.go                   # Two-pass layout pipeline, viewport, scrollbar
│   └── section.go                  # Section interface + Text, Spacer, Buttons, Checkbox, When
│
├── dialog/                         # Dialog overlay system (3 files, 638 lines)
│   ├── dialog.go                   # Dialog interface, Action enum, Overlay stack
│   ├── confirm.go                  # Confirmation dialog (Confirm/Cancel)
│   └── permissions.go              # Permission dialog (Allow/Allow Session/Deny)
│
├── diff/                           # Diff parsing & rendering (5 files, 1,753 lines)
│   ├── parser.go                   # Unified diff parser, word-level diff computation
│   ├── renderer.go                 # Unified + side-by-side rendering with word highlights
│   ├── highlight.go                # Chroma syntax highlighting integration
│   ├── parser_test.go              # Parser tests
│   └── renderer_test.go            # Renderer tests
│
├── ui/                             # Reusable UI primitives (6 files, 399 lines)
│   ├── pane.go                     # Two-pane layout calculator
│   ├── scrollbar.go                # Vertical scrollbar renderer
│   ├── divider.go                  # Vertical divider renderer
│   ├── pane_test.go                # Pane tests
│   ├── scrollbar_test.go           # Scrollbar tests
│   └── divider_test.go             # Divider tests
│
├── terminal/                       # Terminal environment detection (2 files, 999 lines)
│   ├── detect.go                   # Terminal, shell, color profile, Nerd Font, git branch detection
│   └── theme.go                    # IDE theme color extraction (accent, foreground, editor bg)
│
├── splash/                         # Procedural splash animation (2 files, 883 lines)
│   ├── splash.go                   # Icosahedron mesh, beam particles, spectral wave, ANSI render
│   └── mesh_data.go                # Embedded mesh: 444 vertices, 360 faces
│
├── prism/                          # 3D prism rendering engine
│   ├── prism.go                    # FauxGL renderer, half-block ANSI encoding (266 lines)
│   ├── framebuffer/
│   │   └── buffer.go               # RGBA pixel buffer (63 lines)
│   ├── prism-test.obj              # Embedded 3D mesh (444 vertices, 360 faces)
│   └── prism-test.mtl              # Material definition
│
└── testdata/
    └── stories.json                # Test fixture (75 lines)
```

### Elm Architecture Pattern

The application follows the Elm Architecture (Model-Update-View), extended with a plugin system:

```
                    ┌─────────────────────────┐
                    │        User Input        │
                    │   (keyboard, mouse,      │
                    │    resize, tick)          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     tea.Msg (message)    │
                    │  KeyMsg, TickMsg,        │
                    │  PluginResizeMsg, etc.   │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌──────────┐       ┌─────────────────────────┐       ┌──────────┐
│          │       │     Update(msg)         │       │          │
│  Model   │──────▶│  Priority chain:        │──────▶│  Model'  │
│  (state) │       │  1. Type switch          │       │ (new)    │
│          │       │  2. Key priority chain   │       │          │
└──────────┘       │  3. Plugin broadcast     │       └─────┬────┘
                   └────────────┬────────────┘             │
                                │                          ▼
                   ┌──────────────────┐       ┌──────────────────────┐
                   │   tea.Cmd        │       │     View(model)      │
                   │  (side effects)  │       │  1. Splash/Onboard   │
                   │  RunClaude,      │       │  2. Plugin content    │
                   │  LoadStories,    │       │  3. App shell wrap    │
                   │  Broadcast       │       │  4. Modal overlay     │
                   └──────────────────┘       │  5. Dialog overlay    │
                                              └──────────────────────┘
```

### Data Flow

```
stories.json           Claude CLI              Terminal Detection
    │                      │                      │
    ▼                      ▼                      ▼
┌────────┐          ┌──────────┐          ┌──────────────┐
│ domain │          │  claude/  │          │  terminal/   │
│ .Load  │          │  runner   │          │  detect      │
│ Stories│          │  .Start() │          │  .Detect()   │
└───┬────┘          └────┬─────┘          └──────┬───────┘
    │                    │                        │
    ▼                    ▼                        ▼
┌────────────────────────────────────────────────────┐
│              app/update.go                         │
│                                                    │
│  WindowSizeMsg ──▶ Resize + Broadcast              │
│  TickMsg ──▶ Animate + Broadcast                   │
│  SplashDoneMsg ──▶ View transition                 │
│  KeyMsg ──▶ Priority chain → Plugin delegate       │
│  default ──▶ Broadcast to all plugins              │
│                                                    │
│  Plugin Registry manages 10 plugins:               │
│  Home, Research, Plans, Spectrum, Files,           │
│  Git, Agent, Monitor, Workspaces, Onboarding       │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
         ┌───────────────────┐              ┌──────────────┐
         │  app/view.go      │              │              │
         │  + shell.go       │─────────────▶│   Rendered   │
         │  + sidebar.go     │              │   Terminal   │
         │  + footer.go      │              │              │
         └───────────────────┘              └──────────────┘
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
make run ARGS=..    # Development run
make clean          # Remove bin/ and go clean
make help           # Display help text
```

### Run

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

### CLI Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--file` | `-f` | `""` | Path to stories.json |
| `--max-iterations` | `-n` | `50` | Maximum iterations before stopping |
| `--pause` | `-p` | `2` | Seconds between iterations |
| `--demo` | | `false` | Run with simulated stories |
| `--onboarding` | | `false` | Force onboarding flow (for testing/refining the setup wizard) |
| `--prism-style` | | `gradient` | Animation style: `gradient` `simple` `braille` `ascii` |

Auto-generated: `--version`, `--help`/`-h`

### Initial View Selection

```
--demo flag set           → ViewSplash → Home (demo mode)
stories.json provided     → ViewSplash → Home or Onboarding
No stories.json, .prism/  → ViewSplash → Onboarding (if needed) → Home
No .prism/ directory      → Error: "Run init_prism.py first"
```

The splash screen always displays first (5-second timer or any keypress to skip). After splash, the app transitions to Onboarding if `.prism/` doesn't exist or `stories.json` is missing, otherwise to Home.

---

## Plugin System

### Plugin Interface

Every screen in the TUI is implemented as a plugin conforming to `plugin.Plugin` (10 methods):

| Method | Signature | Purpose |
|--------|-----------|---------|
| `ID()` | `string` | Unique identifier (e.g. `"home"`, `"spectrum"`) |
| `Name()` | `string` | Human-readable name for tab display |
| `Icon()` | `string` | Emoji/symbol for tab bar |
| `Init(ctx *Context)` | `error` | Initialization with shared context |
| `Start()` | `tea.Cmd` | Called when first activated |
| `Stop()` | `void` | Called on deactivation |
| `Update(msg tea.Msg)` | `(Plugin, tea.Cmd)` | Bubble Tea message handler |
| `View(width, height int)` | `string` | Render content for given dimensions |
| `IsFocused()` | `bool` | Whether this plugin is the active view |
| `SetFocused(bool)` | `void` | Sets focus state |
| `KeyHints()` | `[]KeyHint` | Footer key-hint list |

### Plugin Context

Shared state passed to all plugins during `Init()`:

| Field | Type | Description |
|-------|------|-------------|
| `PrismDir` | `string` | Path to `.prism/` directory |
| `ProjectDir` | `string` | Project root directory |
| `StoriesPath` | `string` | Path to active `stories.json` |
| `Width` | `int` | Terminal width |
| `Height` | `int` | Terminal height |
| `DemoMode` | `bool` | Whether running in demo mode |
| `PrismStyle` | `string` | Prism rendering style |
| `MaxIterations` | `int` | Max Spectrum iterations |
| `Pause` | `int` | Seconds between iterations |
| `HasNerdFont` | `bool` | Terminal supports Nerd Font glyphs |
| `EventBus` | `*EventBus` | Inter-plugin pub/sub communication |

### Plugin Registry

The registry manages plugin lifecycle:

1. **Registration** (`Register`): Validates ID uniqueness, calls `Init(ctx)` with panic recovery, first plugin is auto-activated
2. **Activation** (`SetActive`): Unfocuses previous, focuses new plugin
3. **Broadcast** (`Broadcast`): Routes messages to ALL plugins, collects commands
4. **Reinit** (`Reinit`): Stops all plugins, re-initializes with current context (used on project switch)

### Event Bus

Inter-plugin pub/sub communication with these event types:

| Event | Type String | Fields |
|-------|-------------|--------|
| `StoryCompletedEvent` | `"story.completed"` | StoryID, StoryName, Result, Duration |
| `FileChangedEvent` | `"file.changed"` | FilePath, Action |
| `BranchChangedEvent` | `"branch.changed"` | BranchName, Ahead, Behind |
| `EpicSwitchedEvent` | `"epic.switched"` | EpicName, StoriesPath |
| `ProjectSwitchedEvent` | `"project.switched"` | ProjectDir, PrismDir, StoriesPath |

### Registered Plugins (in order)

| # | Plugin ID | Plugin Name | Source File | Lines |
|---|-----------|-------------|-------------|-------|
| 1 | `home` | Home | `plugin_home.go` | 214 |
| 2 | `research` | Research | `plugin_research.go` | 224 |
| 3 | `plans` | Plans | `plugin_plans.go` | 239 |
| 4 | `spectrum` | Spectrum | `plugin_spectrum.go` | 1,218 |
| 5 | `files` | Files | `plugin_files.go` | 735 |
| 6 | `git` | Git | `plugin_git.go` | 884 |
| 7 | `agent` | Agent | `plugin_agent.go` | 390 |
| 8 | `monitor` | Monitor | `plugin_monitor.go` | 547 |
| 9 | `workspaces` | Workspaces | `plugin_workspaces.go` | 1,082 |
| 10 | `onboarding` | Onboarding | `plugin_onboarding.go` | 501 |

### Tab Order

The tab bar displays 9 tabs (excluding Splash and Onboarding):

```
[1] Home  [2] Research  [3] Plans  [4] Spectrum  [5] Files  [6] Git  [7] Agent  [8] Monitor  [9] Workspaces
```

---

## Screen Reference

### 1. Splash Screen

Full-screen procedural animation displayed for 5 seconds on startup (or until any key is pressed). Features a rotating icosahedron mesh, beam particle system, spectral wave field, and centered "P R I S M" title.

#### UI Layout

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║        ·  .  ,  :  -  =  +  *  #  %  @                                     ║
║     (spectral wave field fills background                                    ║
║      using ASCII density ramp)                                               ║
║                                                                              ║
║              ████████                     ═══════                            ║
║            ██████████████                  ═══════════                       ║
║          ████████████████████               ═══════════════                  ║
║            ██████████████    (beam particles with glow)                      ║
║              ████████                                                        ║
║          (icosahedron mesh                                                   ║
║           with lighting)                                                     ║
║                                                                              ║
║                         P  R  I  S  M                                       ║
║                    ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                                  ║
║                     spectrum gradient bar                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Rendering Pipeline

1. Project 444 mesh vertices through Y/X/Z rotation + perspective
2. Rasterize 360 triangles with barycentric interpolation + back-face culling
3. Build beam light grid from particles with Gaussian glow falloff
4. Compute title layout ("P R I S M", gradient bar, subtitle)
5. Per-cell: combine wave field, beam particles, mesh overlay, halo dimming
6. Stamp title text in near-white (232, 232, 240)
7. Stamp gradient bar using 4-stop spectrum gradient
8. Convert cell grid to ANSI true-color string

#### IDE Boost Mode

When running in an IDE terminal (`BoostColors=true`), color parameters are intensified for better visibility against IDE backgrounds.

---

### 2. Onboarding Screen

A full-screen setup wizard displayed after the splash when `.prism/` directory or `stories.json` is missing. Walks through 4 steps to initialize the project.

#### Four Steps

| Step | Title | Description | Auto-detect |
|------|-------|-------------|-------------|
| 1 | Project Directory | Detect or select project directory | Yes — `os.Getwd()` |
| 2 | .prism/ Directory | Check/create .prism/ directory structure | Yes — `os.Stat` |
| 3 | Claude CLI | Verify claude CLI is installed | Yes — `exec.LookPath` |
| 4 | Stories File | Verify/create stories.json | Yes — `os.Stat` |

#### UI Layout

```
  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██
  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██
  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██

  Welcome to Prism CLI! Let's set up your project.

  ✓  Project Directory     Detected: /Users/demo/project
  ▶  .prism/ Directory     Check for .prism/ directory structure
  ○  Claude CLI            Verify claude CLI is installed
  ○  Stories File          Verify stories.json exists

  Step 2 of 4

  enter execute   j/k navigate
```

#### Key Bindings

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Execute current step action |
| `j` / `↓` | Next step |
| `k` / `↑` | Previous step |

Steps auto-advance when already satisfied. On completion, emits `OnboardingCompleteMsg` to transition to Home.

---

### 3. Home Screen

The landing screen after splash/onboarding. Features a static ASCII PRISM logo with a 4-stop spectrum gradient and a 3-item navigation menu.

#### UI Layout

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  '||''|.  '||''|.   '||'  .|'''.|  '||    ||'                              │
│   ||   ||  ||   ||   ||   ||..  '   |||  |||                               │
│   ||...|'  ||''|'    ||    ''|||.   |'|..'||                               │
│   ||       ||   |.   ||  .     '||  | '|' ||                              │
│  .||.     .||.  '|' .||. |'....|'  .|. | .||.                             │
│                                                                              │
│  [Spectrum Gradient — Blue → Teal → Green → Amber]                          │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

  >  [1]  Research      Browse and create research documents

     [2]  Plans         View and decompose implementation plans

     [3]  Spectrum      Execute stories autonomously


      j/k navigate   enter select   q quit
```

#### Key Bindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps around) |
| `k` / `↑` | Previous menu item (wraps around) |
| `Enter` / `Space` | Navigate to selected screen |
| `1` | Jump to Research |
| `2` | Jump to Plans |
| `3` | Jump to Spectrum |

#### Mouse Support

- Scroll wheel cycles menu items
- Left-click on a menu item navigates to it (zone IDs: `home:menu-0`, `home:menu-1`, `home:menu-2`)

---

### 4. Research Screen

A file browser for `.prism/shared/research/` markdown documents. Two sub-modes: **list mode** and **viewer mode**.

#### UI Layout — List Mode

```
 PRISM  > Research                                                    ← Breadcrumb
────────────────────────────────────────────────────────────────────────
> 2026-02-12  tech-stack-evaluation                                    ← CurrentStyle
    Evaluated React vs Svelte vs Solid for frontend framework.         ← DimStyle (preview)
    Recommendation: React with Next.js for SSR support.                ← DimStyle (preview)
  2026-02-08  auth-patterns                                            ← PendingStyle
  2026-02-04  database-schema-design                                   ← PendingStyle

  j/k navigate   enter view   esc home
```

#### UI Layout — Viewer Mode

```
 PRISM  > Research                                                    ← Breadcrumb
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

#### Key Bindings — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file (clamped, no wrap) |
| `k` / `↑` | Previous file (clamped, no wrap) |
| `Enter` | Open file in scrollable viewport |
| `Esc` / `Backspace` | Return to Home |

#### Key Bindings — Viewer Mode

| Key | Action |
|-----|--------|
| `Esc` / `Backspace` | Close viewer, return to list |
| `j` / `k` / `↑` / `↓` | Scroll viewport |
| `PgUp` / `PgDn` | Page scroll |

---

### 5. Plans Screen

Identical to Research screen but browses `.prism/shared/plans/` and adds a **decompose** command.

#### Additional Key Binding

| Key | Action |
|-----|--------|
| `d` | Decompose selected plan into an epic (creates `.prism/stories/<name>/stories.json`) |

---

### 6. Spectrum Execution Dashboard

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

- Selected epic: `CurrentStyle` (bold purple)
- Unselected: `DimStyle` (gray)
- Format: ` name (completed/total) `

**Panel 2: Header**

- Left: `TitleStyle("PRISM TUI")`
- Right: Iteration counter + help hint in `DimStyle`

**Panel 3: Progress Bar**

- 3D prism (left) + ASCII logo (right) joined horizontally
- Progress bar: spectrum gradient `█` (filled) + `░` in `#374151` (empty)
- Bar width: `termWidth - 20` (min 20)
- Progress driven by spring-animated position (not raw percentage)

**Panel 4: Story List** (40% width)

Story icons with animated states:

| Status | Icon | Style | Animation |
|--------|------|-------|-----------|-
| Complete (settling) | `●` | Green | Scale < 0.7 during pop |
| Complete (overshoot) | `✔` | Green | Scale > 1.1 during pop |
| Complete (final) | `✓` | Green | Pop animation finished |
| Active (bright) | `▶` | Bold purple | Pulse brightness > 0.8 |
| Active (dim) | `▸` | Bold purple | Pulse brightness ≤ 0.8 |
| Blocked | `⊘` | Italic amber | Static |
| Pending | `○` | Gray | Static |

**Panel 5: Activity Panel** (60% width)

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

Log level formatting:

| Level | Badge | Style |
|-------|-------|-------|
| Info | `INFO ` | Blue `#3B82F6` |
| Success | `OK   ` | Green `#10B981` |
| Warning | `WARN ` | Amber `#F59E0B` |
| Error | `ERROR` | Bold red `#EF4444` |
| Claude Output | `     ` | Gray `#6B7280` |

Format: `[HH:MM:SS] LEVEL MESSAGE` — New entries slide in from the right via spring animation.

**Panel 7: Status Bar**

Three columns: State icon + name | Elapsed time | Control hints

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
| `Space` | Pause execution | Running |
| `/` | Skip current story | Running |
| `Enter` / `Space` | Resume execution | Paused |
| `Enter` / `Space` | Quit | Complete / MaxIterations / Error |

---

### 7. Files Screen

A two-pane file tree browser with preview. Left pane shows an expandable directory tree with git status badges; right pane shows file content with line numbers, syntax highlighting, multi-tab support, inline editing, and git blame annotations.

#### Features

- **Git status badges** (F-2): Modified (M/yellow), Added (A/green), Deleted (D/red), Untracked (?/gray) indicators on tree items
- **Multi-tab support** (F-3): Open multiple files in tabs, switch with `h`/`l`, close with `x`, max 10 tabs
- **Syntax highlighting** (F-1): Chroma-based highlighting for 100+ languages
- **Inline file editing** (F-6): `e` opens a full textarea editor, `Ctrl+S` saves, `Esc` cancels
- **Git blame view** (F-7): `b` toggles blame annotations (short hash, author, relative age) alongside code

#### UI Layout

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ FILES                            ││ [main.go] [view.go] [model.go]            │
│ ──────────────────────────────  ││ main.go [go]                              │
│ ▼ prism-plugin/                 ││ ──────────────────────────────────────    │
│   ▼ cmd/                        ││   1 │ package main                        │
│     ▼ prism-cli/                ││   2 │                                      │
│       ▶ app/                    ││   3 │ import (                             │
│       ▶ claude/                 ││   4 │   "fmt"                              │
│     > README.md             M   ││   5 │   "os"                               │
│   ▶ .prism/                     ││   6 │ )                                    │
│   > go.mod                  M   ││                                            │
│                                  ││                                            │
│                        ▐ (scroll)││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯

Blame mode (`b` in preview pane):
╭──────────────── 70% ──────────────────────────────────────╮
│ abcdef12 JohnDoe   3d │    1 │ package main               │
│ abcdef12 JohnDoe   3d │    2 │                             │
│ 1234abcd Alice     2mo │    3 │ import (                    │
│ 1234abcd Alice     2mo │    4 │   "fmt"                     │
╰───────────────────────────────────────────────────────────╯
```

#### Key Bindings

**Tree Pane (left):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down, load preview |
| `k` / `↑` | Move cursor up, load preview |
| `Enter` / `Space` | Toggle directory expand/collapse, or open in tab |
| `x` | Close active tab |
| `/` | Enter filter mode (filename search) |
| `Tab` | Switch to preview pane |
| `Esc` / `Backspace` | Focus Home |

**Preview Pane (right):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll preview down |
| `k` / `↑` | Scroll preview up |
| `h` / `←` | Previous tab |
| `l` / `→` | Next tab |
| `b` | Toggle git blame annotations |
| `e` | Enter edit mode |
| `x` | Close active tab |
| `Esc` | Switch back to tree pane |

**Edit Mode** (`e` from preview pane):

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save file to disk |
| `Esc` | Cancel editing, discard changes |

**Filter Mode:** Captures all keystrokes for search query. `Esc` cancels, `Enter` applies, `Backspace` deletes.

---

### 8. Git Screen

A full-featured two-pane git integration view with staging, commit, push/pull, branch management, stash, discard, conflict resolution, and commit detail inspection.

#### Features

| ID | Feature | Description |
|----|---------|-------------|
| G-1 | Push Menu | Push to remote with branch selection via modal (`P`) |
| G-2 | Pull Menu | Pull from remote with branch selection via modal (`L`) |
| G-3 | Branch Picker | Load and switch branches via modal (`b`) |
| G-4 | Stash Management | Stash push/pop/list/apply/drop via modal (`S`) |
| G-5 | Conflict Resolution | Detect UU/AA/DD/AU/UA/DU/UD conflict markers; display "Conflicts" section at top of sidebar with `!` icon; `s` stages conflict files as resolved |
| G-6 | File Watcher | Auto-refresh on EventBus `"file.changed"` events; sets `needsRefresh` flag |
| G-7 | Commit Detail | `Enter` on a commit in the sidebar loads its full diff in the right pane |
| G-8 | Discard Changes | `d` on modified/untracked file opens confirmation dialog, then runs `git checkout --` or `rm` |

#### UI Layout

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ GIT                              ││ DIFF                                      │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│  main ↑0 ↓0                    ││ diff --git a/model.go b/model.go          │
│                                  ││ @@ -25,6 +25,8 @@                         │
│ ── Conflicts (2) ───────────    ││  25  type Model struct {                   │
│   ! package.json                 ││  26    Width  int                          │
│   ! config.go                    ││+ 27    Height int                          │
│                                  ││+ 28    Ready  bool                         │
│ ── Staged ──────────────────    ││  29  }                                     │
│   ● model.go                    ││                                            │
│   ● view.go                     ││                                            │
│                                  ││                                            │
│ ── Modified ────────────────    ││                                            │
│   ● sidebar.go                  ││ [CONFLICT] package.json                    │
│   ● footer.go                   ││  (staged = mark as resolved)               │
│                                  ││                                            │
│ ── Untracked ───────────────    ││                                            │
│   ● README.md                   ││                                            │
│                                  ││                                            │
│ ── Recent Commits ──────────    ││                                            │
│   dff2646 minor TUI fixes       ││                                            │
│   66277bc continue sidecar...   ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

Sidebar sections appear in order: Conflicts (if any), Staged, Modified, Untracked, Recent Commits. The diff pane shows unified or side-by-side diffs with syntax highlighting, word-level change detection, and dual-gutter line numbers.

#### Key Bindings

**Sidebar (left pane):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down through files/commits |
| `k` / `↑` | Move cursor up through files/commits |
| `s` | Stage/unstage file (or mark conflict as resolved) |
| `c` | Open commit modal |
| `d` | Discard changes for file at cursor (G-8) |
| `P` | Open push modal (G-1) |
| `L` | Open pull modal (G-2) |
| `b` | Open branch picker (G-3) |
| `S` | Open stash menu (G-4) |
| `r` | Refresh git status + commits |
| `Enter` | Load diff for file, or view commit detail (G-7) |
| `Tab` | Switch to diff pane |
| `Esc` / `Backspace` | Focus Home (or exit commit detail view) |

**Diff Pane (right pane):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll diff down |
| `k` / `↑` | Scroll diff up |
| `v` | Toggle unified/side-by-side diff view |
| `Tab` / `Esc` | Switch back to sidebar |

---

### 9. Agent Screen

A chat interface with message history and text input. Supports wide mode (sidebar + chat) and compact mode (chat only).

#### UI Layout — Wide Mode

```
╭──────── 1/3 ────────╮╭─────────────── 2/3 ──────────────────────────────────╮
│ CONVERSATIONS        ││                                                       │
│ ────────────────    ││   How do I implement authentication?                  │
│ > Current Session    ││                          ┌──────────────────────────┐ │
│                      ││                          │ Use OAuth2 + JWT auth.  │ │
│                      ││                          │ Here's the approach:    │ │
│                      ││                          │ ...                     │ │
│                      ││                          └──────────────────────────┘ │
│                      ││ ┌──────────────────────────────────────────────────┐  │
│                      ││ │ Type a message... (Ctrl+Enter to send)          │  │
│                      ││ └──────────────────────────────────────────────────┘  │
╰──────────────────────╯╰──────────────────────────────────────────────────────╯
```

#### Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle wide/compact mode |
| `Ctrl+Enter` | Send message |
| `Esc` / `Backspace` | Focus Home |

---

### 10. Monitor Screen

Three-panel system health dashboard with multi-panel focus navigation, quality gate execution, output inspection, execution history detail, and agent health tracking.

#### Features

| ID | Feature | Description |
|----|---------|-------------|
| M-1 | Multi-Panel Focus | `Tab`/`Shift+Tab` cycles focus: Health → History → Gates → Health. Focused panel gets purple highlight border. `j`/`k` navigate within focused panel |
| M-2 | Quality Gate Execution | `Enter` runs selected gate; `R` runs all gates. Gate status: pass/fail/pending/running/unknown |
| M-3 | Gate Output Modal | `o` opens modal showing full command output for selected gate |
| M-4 | History Detail Modal | `Enter` on a history entry opens a detail modal with story info, duration, result, and timestamp |
| M-5 | Agent Health | Subscribes to EventBus `"agent.status"` events. Shows active agents in health panel with status icons (● active, ◉ thinking, ○ waiting, ⏸ paused), agent type, and worktree basename |

#### UI Layout

```
╭──────── 1/3 ────────╮╭──────── 1/3 ─────────╮╭──────── 1/3 ────────────────╮
│ SYSTEM HEALTH        ││ EXECUTION HISTORY     ││ QUALITY GATES               │
│ ────────────────    ││ ──────────────────    ││ ───────────────────────    │
│                      ││                       ││                             │
│ Goroutines: 12       ││ ✓ STORY-001  15s  2m ││ ● Lint       pass           │
│ Memory: 24MB / 48MB  ││ ✓ STORY-002  22s  5m ││ ● Tests      pass           │
│ GC Count: 8          ││ ✗ STORY-003  10s  8m ││ ● Build      pass           │
│ GC Pause: 1.2ms      ││ ✓ STORY-004  18s 12m ││                             │
│                      ││ ⊘ STORY-005  5s  15m ││                             │
│ Status: ● Healthy    ││                       ││                             │
│                      ││                       ││                             │
│ ── Agents ────────  ││                       ││                             │
│ ● implement (feat…)  ││                       ││                             │
│ ◉ research  (fix…)   ││                       ││                             │
╰──────────────────────╯╰───────────────────────╯╰─────────────────────────────╯

  Last refresh: 14:32:05
```

Auto-refreshes every 5 seconds. Subscribes to `"story.completed"` and `"agent.status"` EventBus events. When terminal width is narrow, panels stack vertically instead of side-by-side.

#### Key Bindings

| Key | Panel | Action |
|-----|-------|--------|
| `Tab` | Any | Cycle focus forward: Health → History → Gates |
| `Shift+Tab` | Any | Cycle focus backward |
| `r` | Any | Manual refresh (system stats) |
| `R` | Gates | Run all quality gates (M-2) |
| `j` / `↓` | History | Navigate execution entries (wraps) |
| `k` / `↑` | History | Navigate execution entries (wraps) |
| `Enter` | History | Open history detail modal (M-4) |
| `j` / `↓` | Gates | Navigate quality gates (wraps) |
| `k` / `↑` | Gates | Navigate quality gates (wraps) |
| `Enter` | Gates | Run selected gate (M-2) |
| `o` | Gates | View gate output modal (M-3) |
| `Esc` / `Backspace` | Any | Focus Home |

---

### 11. Workspaces Screen

A multi-project workspace manager with three view modes: **Projects** (`.prism/` scanning), **Worktrees** (git worktree management), and **Kanban** (agent status board). Two-pane layout with tabbed preview (Info/Stories/Progress).

#### Features

| ID | Feature | Description |
|----|---------|-------------|
| W-1 | Worktree List | `w` toggles to worktree view showing `git worktree list --porcelain` output with path, branch, HEAD hash, bare/main/prunable flags |
| W-2 | Create Worktree | `n` in worktree view opens modal to create a new worktree (branch name + path input) |
| W-3 | Delete Worktree | `d` in worktree view opens confirmation dialog; cannot delete main worktree; optional branch deletion |
| W-4 | Kanban Board | `v` toggles to kanban view showing worktrees grouped by agent status in 5 vertical columns (Active, Thinking, Waiting, Done, Paused). Subscribes to EventBus `"agent.status"` events |

#### UI Layout — Projects View

```
╭───────────── 40% ───────────────╮╭──────────────── 60% ──────────────────────╮
│ WORKSPACES                       ││  [Info]  Stories  Progress                 │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│ ● prism-plugin                  ││ Project: prism-plugin                      │
│   main ↑0 ↓0                    ││ Path: ~/Developer/prism-plugin             │
│                                  ││ Branch: main                               │
│ ○ sidecar                       ││                                            │
│   feat/new-feature               ││ Progress: ████████████░░░░  67%           │
│                                  ││                                            │
│ ○ client-app                    ││ Epics: 3                                   │
│   main                           ││   user-auth (8/12)                         │
│                                  ││   dashboard (12/36)                        │
│                                  ││   notifications (0/9)                      │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

#### UI Layout — Worktrees View

```
╭───────────── 40% ───────────────╮╭──────────────── 60% ──────────────────────╮
│ WORKTREES                        ││ Worktree Detail                            │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│ > ~/Developer/prism-plugin       ││ Path: ~/Developer/prism-plugin             │
│   main [main]                    ││ Branch: main                               │
│                                  ││ HEAD: d6b2723                              │
│   ~/Developer/prism-plugin-fix   ││ Type: Main worktree                        │
│   fix/auth-bug                   ││                                            │
│                                  ││                                            │
│   ~/Developer/prism-plugin-feat  ││                                            │
│   feat/kanban                    ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

#### UI Layout — Kanban Board View

```
╭────────────────────────────────────────────────────────────────────────────╮
│ KANBAN                                                                      │
│ ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│ ── Active ─────────  ── Thinking ──────  ── Waiting ───────               │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│ │ ● feat/kanban    │  │ ◉ fix/auth-bug  │  │ ○ feat/ui-theme │             │
│ │   implement      │  │   research      │  │   (no agent)    │             │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│ ── Done ───────────  ── Paused ────────                                   │
│ ┌─────────────────┐  (empty)                                               │
│ │ ✓ fix/css-bug    │                                                        │
│ │   validate       │                                                        │
│ └─────────────────┘                                                        │
╰────────────────────────────────────────────────────────────────────────────╯
```

Cards show status icon (● active, ◉ thinking, ○ waiting, ✓ done, ⏸ paused), branch name, and agent type. Columns are rendered vertically with h/l navigation between columns and j/k within.

#### Key Bindings

**Projects View** (left pane):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate projects |
| `Enter` | Enter epics view (if project has epics) |
| `w` | Switch to worktrees view (W-1) |
| `Tab` | Switch to preview pane |
| `r` | Rescan projects |
| `Esc` | Focus Home |

**Epics View** (left pane, within a project):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate epics |
| `Enter` | Switch to selected epic |
| `Tab` | Switch to preview pane |
| `Esc` | Return to projects view |

**Worktrees View** (left pane):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate worktrees |
| `n` | Create new worktree (W-2) |
| `d` | Delete selected worktree (W-3) |
| `Enter` | Switch to worktree directory |
| `v` | Switch to kanban view (W-4) |
| `w` | Switch to projects view |
| `Tab` | Switch to preview pane |
| `r` | Refresh worktree list |
| `Esc` | Focus Home |

**Kanban View:**

| Key | Action |
|-----|--------|
| `h` / `←` | Move to previous column |
| `l` / `→` | Move to next column |
| `j` / `↓` | Move down within column |
| `k` / `↑` | Move up within column |
| `Enter` | Select card, show detail in preview pane |
| `v` | Switch to list (worktrees) view |
| `w` | Switch to projects view |

**Preview Pane** (right):

| Key | Action |
|-----|--------|
| `[` / `]` | Switch tabs (Info/Stories/Progress) |
| `j`/`k` | Scroll content |
| `Tab` | Toggle sidebar/preview focus |
| `Esc` | Return to sidebar |

Scans parent directory siblings for `.prism/` directories to discover projects.

---

## App Shell

For all non-splash, non-onboarding views, content is wrapped in an "app shell" consisting of a tab bar, optional sidebar, and two-tier footer.

### Tab Bar

Two rendering modes depending on terminal width:

**Powerline Tab Bar** (3 lines, when terminal is wide enough):

```
 ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲ ╲╲╲╲
  ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲╲╲╲
   ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲╲╲
```

- Active tab: white text on `Primary` (#7C3AED) background
- Inactive tabs: dim text on `#2c2d3a` background
- Diagonal slant separators create a distinctive visual edge
- Mouse clickable via `bubblezone` (zone IDs: `tab-0` through `tab-8`)

**Compact Tab Bar** (1 line, narrow terminals):

```
 1:Home │ 2:Research │ 3:Plans │ 4:Spectrum │ 5:Files │ 6:Git
─────────────────────────────────────────────────────────────────
```

### Sidebar

Fixed width: **38 characters**. Auto-shown when terminal width >= **120** characters. Toggled with `Ctrl+D`.

```
  ╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
 ╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╭────────────────────────────────────╮
│  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██│
│  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██│
│  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██│
│  ──────────────────────────────── │
│                                    │
│  ▸ RUNNING                         │
│    Iteration 3/50                  │
│    67% (8/12)                      │
│                                    │
│  ├─ MODIFIED FILES ───────────    │
│    model.go              +12 -3   │
│    view.go               +45 -8   │
│    sidebar.go             mod      │
│                                    │
│  ├─ QUALITY GATES ────────────    │
│    ● Lint                 pass     │
│    ● Tests                pass     │
│    ● Build                pass     │
│                                    │
│  ├─ EPICS ────────────────────    │
│    ● user-auth           8/12     │
│    ○ dashboard          12/36     │
│    ○ notifications       0/9      │
╰────────────────────────────────────╯
```

**Sidebar sections:**

1. **Branded header**: 3-line gradient PRISM block logo
2. **Execution info**: State icon, iteration counter, story progress
3. **Modified Files**: From Git plugin (staged + modified files with diff stats)
4. **Quality Gates**: From Monitor plugin (pass/fail status icons)
5. **Epics**: From Spectrum plugin (active/inactive indicators with progress)

### Footer

Two-tier footer spanning full terminal width.

**Tier 1: Key Hints** (context-aware)

```
[1-9] switch tabs  [tab/shift+tab] cycle  [j/k] navigate  [ctrl+d] details  [?] help  [q] quit  ╲╲╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

Key hints include view-specific hints from the active plugin's `KeyHints()` method. Right edge has decorative slash pattern matching sidebar width.

**Tier 2: Powerline Status Bar**

```
 IMPLEMENT ╲ ⚡ Spectrum ╲  main ╲ STORY-003 ╲                ╱ v1.9.8 ╱ 3✓ 0✗ ╱ 8/12 ╱ iter 3 ╱ 🕒 2m 15s
```

Left segments:
1. Workflow phase pill (Research=Blue, Plan=Teal, Implement=Green, Validate=Amber)
2. Active plugin icon + name
3. Git branch name (from Git plugin)
4. Current story ID (from Spectrum plugin, when width >= 100)

Right segments:
1. Version (`v1.9.8`)
2. Quality gate counts (pass/fail, when width >= 80)
3. Story progress (completed/total)
4. Iteration counter (when width >= 90)
5. Elapsed time (when Spectrum is running)

---

## Modal & Dialog Systems

### Modal System

Modals are centered overlays with dimmed background. The compositing pipeline works row-by-row: rows within the modal's Y range use `compositeRow()` to insert modal content into a dimmed background; rows above/below are fully dimmed.

**Section types available:**
- `TextSection` — Static text, word-wrapped
- `SpacerSection` — Blank line
- `ButtonsSection` — Row of buttons (Normal/Primary/Danger variants)
- `InputSection` — Single-line text input
- `TextareaSection` — Multi-line text input
- `ListSection` — Scrollable selection list
- `CheckboxSection` — Toggleable checkbox
- `WhenSection` — Conditional section

**Modal variants:** Default (purple border), Danger (red), Warning (amber), Info (blue)

**Focus cycling:** Tab/Shift+Tab cycles through focusable elements using modular arithmetic.

### Command Palette

Activated with `Ctrl+P` or `:`. Provides fuzzy search across all plugin commands.

```
╭────────────────────── Command Palette ──────────────────────╮
│  [Search: sp                                               ]│
│                                                              │
│  > [Spectrum] Focus — Open Spectrum dashboard               │
│    [Spectrum] Start — Begin story execution                  │
│    [Spectrum] Stop — Stop execution                          │
│    [Spectrum] Next Story — Go to next story page             │
│    [Spectrum] Switch Epic — Switch to next epic              │
│                                                              │
│  ↑/↓ navigate • enter execute • esc close                   │
╰──────────────────────────────────────────────────────────────╯
```

### Dialog System

Dialogs are layered above modals in z-order. Two dialog types:

**Confirmation Dialog:**
- Two buttons: Confirm + Cancel
- Quick keys: `y` for confirm, `n` for cancel
- Variant-colored border

**Permission Dialog:**
- Three buttons: Allow + Allow Session + Deny
- Scrollable preview area (max 8 lines)
- Quick keys: `a` for allow, `s` for allow session, `d`/`n` for deny
- Amber border with "Permission Required" title

---

## User Flow Diagrams

### Complete Navigation Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION START                           │
│                                                                     │
│   Always ─────────────────────────────────────▶ Splash (5s/key)    │
│                                                    │                │
│                                    ┌───────────────┴──────────┐    │
│                                    │                          │    │
│                             NeedsOnboarding?            No     │    │
│                                    │                          │    │
│                                    ▼                          ▼    │
│                              Onboarding              Home          │
│                                    │                                │
│                              [complete]                             │
│                                    │                                │
│                                    ▼                                │
│                                  Home                               │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │                  │
              ┌──────────│      HOME        │──────────────────┐
              │          │  [1] [2] [3]     │                  │
              │          │  j/k  enter      │                  │
              │          └──────┬─┬─────────┘                  │
              │                 │ │                             │
         [1] │           [2]  │ │   [3]                       │
              │                │ │                             │
              ▼                ▼ ▼                             ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐
   │  RESEARCH    │ │    PLANS     │ │         SPECTRUM              │
   │  (List)      │ │  (List)      │ │  (Idle → Running → Complete) │
   └──────┬───────┘ └──────┬───────┘ └──────────────────────────────┘
          │                │
     [enter]          [enter]
          │                │
          ▼                ▼
   ┌──────────────┐ ┌──────────────┐
   │  RESEARCH    │ │    PLANS     │
   │  (Viewer)    │ │  (Viewer)    │
   └──────────────┘ └──────────────┘

Tab / Number keys switch between all 9 tabs:
  [1]Home [2]Research [3]Plans [4]Spectrum [5]Files [6]Git [7]Agent [8]Monitor [9]Workspaces

Additional full-screen overlays (not in tab order):
  [Ctrl+P] or [:] → Command Palette
  [?] → Help Modal
  [c] in Git → Commit Modal
```

### Back Navigation Logic

```
Current View          esc / backspace Action
─────────────────     ───────────────────────────────────────
Splash                (any key skips to next view)
Onboarding            (no back — must complete or key through)
Home                  (no effect)
Research (list)       → Home
Research (viewer)     → Research (list)
Plans (list)          → Home
Plans (viewer)        → Plans (list)
Spectrum (idle)       → Home
Spectrum (running)    → (blocked — cannot leave while running)
Spectrum (paused)     → (blocked — cannot leave while paused)
Spectrum (complete)   → Home (via quit)
Files (tree)          → Home
Files (preview)       → Files (tree)
Git (sidebar)         → Home
Git (diff)            → Git (sidebar)
Agent                 → Home
Monitor               → Home
Workspaces (projects) → Home
Workspaces (epics)    → Workspaces (projects)
Workspaces (preview)  → Workspaces (sidebar)
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
                   │   COMPLETE   │  │     QUIT     │
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
| Error | `<spectrum-error reason="...\">...</spectrum-error>` | 2 | Fatal → Error state |
| Retry | `<spectrum-retry reason="...\">...</spectrum-retry>` | 3 | Increment error counter; retry if under limit (3) |
| Blocked | `<spectrum-blocked reason="...\">...</spectrum-blocked>` | 4 | Log warning, skip to next unblocked story |
| Continue | `<spectrum-continue>...</spectrum-continue>` | 5 | Success, schedule next iteration after pause |
| None | (no match) | 6 | Assume continue |

### Iteration Lifecycle

```
┌─ Iteration N ──────────────────────────────────────────────────────┐
│                                                                     │
│  1. Check max iterations ─── exceeded? ──▶ StateMaxIterations      │
│                │                                                    │
│                ▼                                                    │
│  2. Increment counter, create output channel                       │
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
|-----------|-----------|---------|-----|---------|--------|-----------|-
| Progress Bar | 6.0 | 0.7 | 60 | 0.0 | `ProgressPercent()` | Snappy, slight overshoot |
| Story Pop | 8.0 | 0.5 | 60 | 0.3 (start scale) | 1.0 (normal) | Very bouncy |
| Log Slide-In | 5.0 | 0.8 | 60 | 20.0 (x-offset) | 0.0 (settled) | Smooth, minimal overshoot |
| Ray Length | 4.0 | 0.3 | 60 | `{6,5,4,3}` | Random 4–8 | Bouncy, organic |

### Animation Update Loop (per 100ms tick)

```
TickMsg received
    │
    ├── 1. Splash.Tick()                 (if splash active — advance mesh/particles)
    │
    ├── 2. Prism.Tick()                  (advance 3D rotation)
    │
    ├── 3. PrismTick++ → PrismFrame      (every 3 ticks → cycle 4 spectrum colors)
    │
    ├── 4. ShimmerPhase += 0.08          (sine wave, wraps at 2π)
    │       └── prism body brightness oscillation
    │
    ├── 5. RayLengths lerp toward targets (linear 0.1 rate, re-target randomly)
    │
    └── 6. Broadcast to all plugins:
            ├── Spectrum:
            │   ├── Spinner.Update()              (advance frame)
            │   ├── ProgressSpring.Update()       (pos, vel → target)
            │   ├── StoryPopSpring.Update()       (per-story scale → 1.0)
            │   │       └── cleanup when |scale - 1.0| < 0.01
            │   ├── PulsePhase += 0.15            (sine wave, wraps at 2π)
            │   │       └── active story icon brightness
            │   ├── LogSlideSpring.Update()       (per-entry offset → 0.0)
            │   └── RaySpring.Update()            (per-ray length → target)
            └── All other plugins (no-op for most)
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
Style: gradient (default, 1 line) — Spring-animated ray lengths with gradient
─◁◆▷▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

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

## Splash Screen Rendering Pipeline

The splash screen (`splash/splash.go`) is a fully procedural animation rendered to ANSI true-color.

### Components

| Component | Parameters | Description |
|-----------|-----------|-------------|
| Icosahedron mesh | 444 verts, 360 faces, pos(0.36, 0.50), scale 0.11 | Rotating 3D wireframe mesh |
| Beam particles | 200 particles, 4 rays, width 0.015 | Horizontal light beam |
| Spectral wave field | freq 34.0/26.0, speed 1.0 | Background wave pattern |
| Title | "P R I S M" | Centered text in near-white |
| Gradient bar | 4-stop spectrum gradient | Horizontal bar below title |

### Spectral Gradient (used throughout)

```
#3B82F6 ───▶ #14B8A6 ───▶ #22C55E ───▶ #F59E0B
 Blue          Teal         Green        Amber
```

### ASCII Density Ramp

```
{ ' ', '.', ',', ':', '-', '=', '+', '*', '#', '%', '@' }
```

11 characters from empty to full density, used for wave field and mesh rendering.

### Rendering Phases

1. Rotate and project 444 mesh vertices (Y/X/Z rotation + perspective distance 3.5)
2. Rasterize 360 triangles with barycentric interpolation + back-face culling
3. Build beam light grid from particle positions with Gaussian glow
4. Compute layout for title, bar, and subtitle (centered)
5. Per-cell compositing: wave field + beam particles + mesh overlay + halo dimming
6. Stamp title (232, 232, 240 near-white)
7. Stamp gradient bar
8. Stamp subtitle with atmospheric offset
9. Convert to ANSI string (batch same-color runs, reset per line)

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
│   ├── validation/
│   ├── docs/
│   ├── handoffs/
│   ├── prs/
│   └── ref/
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

**Streaming mode** (used during execution):

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  --output-format stream-json \
  --verbose \
  "Execute the next story from {storiesPath} using the /prism-spectrum workflow. \
   Progress file: {progressPath}"
```

**Non-streaming mode** (fallback):

```bash
claude \
  --dangerously-skip-permissions \
  --print \
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
|------|---------------|---------|-
| Read | `Reading: .../shortened/path.ts` | `Reading: .../services/auth.ts` |
| Edit | `Editing: .../shortened/path.ts` | `Editing: .../components/Form.tsx` |
| Write | `Writing: .../shortened/path.ts` | `Writing: .../config/db.ts` |
| Bash | `Running: command` (50 char max) | `Running: npm run typecheck` |
| Glob | `Finding: pattern` | `Finding: **/*.test.ts` |
| Grep | `Searching: pattern` (40 char max) | `Searching: handleSubmit` |
| Task | `Agent: description` (50 char max) | `Agent: Analyzing codebase...` |
| WebFetch | `Fetching: URL` (50 char max) | `Fetching: https://docs.example.com` |
| WebSearch | `Web search...` | `Web search...` |
| TodoWrite | `Updating tasks...` | `Updating tasks...` |
| AskUserQuestion | `Asking question...` | `Asking question...` |

### Output Parser Event Detection

The `OutputParser` maintains a buffer of all output and fires events on:

| Event | Detection | Source |
|-------|-----------|--------|
| Story Announced | `<spectrum-story>ID: STORY-NNN` tag | `parser.go:52` |
| Phase Changed | Keywords: "research", "implementing", "quality gate", etc. | `parser.go:65` |
| Quality Gate Started | "Running quality gates", "npm run typecheck/lint/test" | `parser.go:75` |
| Commit Created | "git commit", "[STORY-" keywords | `parser.go:86` |
| Signal Detected | Full buffer regex scan for `<promise>` or `<spectrum-*>` | `parser.go:94` |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude process error | Increment `ConsecutiveErrs`, backoff = `errs × 2s`, retry |
| 3+ consecutive errors | Transition to `StateError`, stop execution |
| Signal: error | Immediate `StateError` |
| Signal: retry | Increment errors, retry if under limit (3) |
| Signal: complete (but stories remain) | Override signal, log warning, continue |
| Max iterations reached | Transition to `StateMaxIterations` |
| Claude timeout | 30 minutes per session |

### Process Termination

- **Windows**: `taskkill /F /T /PID <pid>` (tree kill)
- **Unix**: `cmd.Process.Kill()` (direct kill)

---

## Terminal Detection

The terminal detection system (`terminal/`) automatically identifies the user's environment and adapts the UI accordingly.

### Detection Capabilities

| Detection | Method | Fallback |
|-----------|--------|----------|
| Terminal type | Environment variables (priority-ordered) | `"Terminal"` |
| Shell | `PSModulePath`/`COMSPEC` (Windows), `$SHELL` (Unix) | `"unknown"` |
| Color profile | `COLORTERM` env, `termenv` profile | `"TrueColor"` |
| Background color | OSC 11, settings.json, theme file, lookup table | `#0A0910` |
| Nerd Font | IDE settings.json `fontFamily` contains "Nerd" | `false` |
| Git branch | `.git/HEAD` parsing | `""` |
| Accent color | IDE color customizations, theme file, lookup table | `#607088` |
| Editor background | IDE color customizations, theme file, lookup table | `#2c2d3a` |

### Supported Terminals

| Terminal | Detection Method |
|----------|-----------------|
| Cursor | `CURSOR_TRACE_ID` / `CURSOR_EXTENSION_HOST_ROLE` |
| Windsurf | `WINDSURF_PID` |
| VS Code | `VSCODE_PID` / `TERM_PROGRAM=vscode` |
| Windows Terminal | `WT_SESSION` |
| WezTerm | `WEZTERM_PANE` |
| iTerm2 | `ITERM_SESSION_ID` / `TERM_PROGRAM=iTerm.app` |
| Alacritty | `ALACRITTY_WINDOW_ID` |
| Kitty | `KITTY_WINDOW_ID` |
| Hyper | `TERM_PROGRAM=Hyper` |
| Terminal.app | `TERM_PROGRAM=Apple_Terminal` |
| ConEmu | `ConEmuPID` |

### Theme Adaptation

For IDE terminals (VS Code, Cursor, Windsurf), the system:

1. Reads `settings.json` (platform-specific path, JSONC-comment-stripped)
2. Extracts `workbench.colorTheme` and `colorCustomizations`
3. Finds matching theme extension files for accent/background colors
4. Falls back to a lookup table of 19 known themes
5. Applies `styles.ApplyTheme(accentHex)` to override Primary color and rebuild cached styles
6. Applies `styles.ApplySecondary(editorBgHex)` to match inactive tab backgrounds
7. Computes atmosphere color for splash screen blending

---

## Diff System

The diff system (`diff/`) provides parsing and rendering of unified diffs with syntax highlighting.

### Features

- **Unified and side-by-side** view modes
- **Word-level diffs** for consecutive add/remove pairs
- **Syntax highlighting** via Chroma (monokai theme)
- **Line numbers** with dual-gutter (old + new)
- **Horizontal scrolling** and **word wrapping** modes

### Diff Colors

| Element | Color | Background |
|---------|-------|------------|
| Added line | Green `#10B981` | Dark green `#1a3a2a` |
| Removed line | Red `#EF4444` | Dark red `#3a1a1a` |
| Context line | Gray `#6B7280` | — |
| Word diff (add) | Green, Bold | Dark green `#1a3a2a` |
| Word diff (remove) | Red, Bold | Dark red `#3a1a1a` |
| Hunk header | Blue `#3B82F6`, Bold | — |
| Line numbers | Gray `#6B7280` | — |

---

## Keyboard Reference

### Global Keys (All Screens)

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit application |
| `?` | Toggle help modal |
| `Ctrl+P` / `:` | Open command palette |
| `Ctrl+D` | Toggle sidebar |
| `1`–`9` | Switch to tab N |
| `Tab` | Next tab (unless Spectrum has multiple epics) |
| `Shift+Tab` | Previous tab (unless Spectrum has multiple epics) |

### Input Priority Chain

When a key is pressed, it is processed in this strict order:

1. **Splash skip** — Any key during splash ends it immediately
2. **Onboarding passthrough** — All keys go to onboarding plugin
3. **Quit** — `q` / `Ctrl+C` always quit
4. **Dialog** — If a dialog is open, keys route to dialog
5. **Modal** — If a modal is open, keys route to modal
6. **Global keys** — Help, command palette, sidebar toggle, tab switching
7. **Active plugin** — Remaining keys delegated to the focused plugin

### Home Screen

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps) |
| `k` / `↑` | Previous menu item (wraps) |
| `Enter` / `Space` | Navigate to selected screen |
| `1`–`3` | Jump to Research / Plans / Spectrum |

### Research / Plans — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file |
| `k` / `↑` | Previous file |
| `Enter` | Open file in viewport |
| `d` | **Plans only**: Decompose plan to epic |
| `Esc` / `Backspace` | Return to Home |

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
| `Space` | Running | Pause |
| `/` | Running | Skip current story |
| `Enter` / `Space` | Paused | Resume |
| `a` / `s` | Any | Stories page prev/next |
| `z` / `x` | Any | Logs page prev/next |
| `Tab` / `Shift+Tab` | Multi-epic | Switch epic |
| `Enter` / `Space` | Terminal state | Quit |

### Files Screen

| Key | Pane | Action |
|-----|------|--------|
| `j` / `k` | Tree | Navigate files |
| `Enter` / `Space` | Tree | Toggle expand / open in tab |
| `x` | Tree/Preview | Close active tab |
| `/` | Tree | Enter filter mode |
| `Tab` | Any | Toggle tree/preview pane |
| `j` / `k` | Preview | Scroll content |
| `h` / `l` | Preview | Previous / next tab |
| `b` | Preview | Toggle git blame annotations |
| `e` | Preview | Enter edit mode |
| `Ctrl+S` | Edit mode | Save file |
| `Esc` | Edit mode | Cancel edit |
| `Esc` | Tree | Focus Home |
| `Esc` | Preview | Focus tree pane |

### Git Screen

| Key | Pane | Action |
|-----|------|--------|
| `Tab` | Any | Toggle sidebar/diff pane |
| `s` | Sidebar | Stage/unstage file (or resolve conflict) |
| `c` | Any | Open commit modal |
| `d` | Sidebar | Discard changes (G-8) |
| `P` | Any | Push modal (G-1) |
| `L` | Any | Pull modal (G-2) |
| `b` | Any | Branch picker (G-3) |
| `S` | Any | Stash menu (G-4) |
| `r` | Any | Refresh status + commits |
| `v` | Diff | Toggle unified/side-by-side |
| `j` / `k` | Both | Navigate / scroll |
| `Enter` | Sidebar | Load diff for file, or commit detail (G-7) |
| `Esc` | Sidebar | Focus Home (or exit commit detail) |
| `Esc` | Diff | Focus sidebar |

### Agent Screen

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle wide/compact mode |
| `Ctrl+Enter` | Send message |
| `Esc` | Focus Home |

### Monitor Screen

| Key | Panel | Action |
|-----|-------|--------|
| `Tab` | Any | Cycle focus: Health → History → Gates |
| `Shift+Tab` | Any | Cycle focus backward |
| `r` | Any | Manual refresh |
| `R` | Gates | Run all quality gates (M-2) |
| `j` / `k` | History/Gates | Navigate entries (wraps) |
| `Enter` | History | Open detail modal (M-4) |
| `Enter` | Gates | Run selected gate (M-2) |
| `o` | Gates | View gate output (M-3) |
| `Esc` | Any | Focus Home |

### Workspaces Screen

| Key | Mode | Action |
|-----|------|--------|
| `j` / `k` | Projects/Epics/Worktrees | Navigate items |
| `Enter` | Projects | Enter epics view |
| `Enter` | Epics | Switch to selected epic |
| `Enter` | Worktrees | Switch to worktree directory |
| `w` | Any sidebar | Toggle to projects view |
| `v` | List/Kanban | Toggle worktrees list ↔ kanban board |
| `n` | Worktrees | Create new worktree (W-2) |
| `d` | Worktrees | Delete selected worktree (W-3) |
| `h` / `l` | Kanban | Navigate columns |
| `j` / `k` | Kanban | Navigate cards within column |
| `Enter` | Kanban | Select card, show detail |
| `[` / `]` | Preview | Switch tabs (Info/Stories/Progress) |
| `j` / `k` | Preview | Scroll content |
| `Tab` | Any | Toggle sidebar/preview |
| `r` | Sidebar | Rescan / refresh |
| `Esc` | Projects | Focus Home |
| `Esc` | Epics | Return to projects |

---

## Styling Reference

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#7C3AED` | Purple — Titles, active items, header bg, focused borders |
| Secondary | `#2c2d3a` | Editor bg — Inactive elements, tab bar inactive bg |
| Success | `#10B981` | Green — Completed items, success logs |
| Warning | `#F59E0B` | Amber — Blocked items, warnings, paused state |
| Error | `#EF4444` | Red — Error messages, error state |
| Info | `#3B82F6` | Blue — Info logs, panel titles |
| Dim | `#6B7280` | Gray — Borders, pending items, hints |
| Background | `#1F2937` | Dark gray — Background elements, modal bg |
| White | `#FFFFFF` | White — Header text |
| BorderNormal | `#4B5563` | Inactive borders |
| BorderActive | `= Primary` | Focused borders |
| Highlight | `#06B6D4` | Cyan — Current activity, highlighted text |

### Spectrum Gradient (4-Stop)

```
#3B82F6 ───▶ #14B8A6 ───▶ #22C55E ───▶ #F59E0B
 Blue          Teal         Green        Amber
```

Used for: Progress bar fill, ASCII logo, prism rays, sidebar logo, gradient bar.

### Workflow Phase Colors

| Phase | Color | Hex |
|-------|-------|-----|
| Research | Blue | `#3B82F6` |
| Plan | Teal | `#14B8A6` |
| Implement | Green | `#22C55E` |
| Validate | Amber | `#F59E0B` |
| Idle | Gray | `#4B5563` |

### Component Styles

| Style | Properties |
|-------|------------|
| `TitleStyle` | Bold, FG: Purple `#7C3AED`, Padding(0,1) |
| `HeaderStyle` | Bold, FG: White, BG: Purple `#7C3AED`, Padding(0,1), MarginBottom(1) |
| `PanelStyle` | Border: Rounded, BorderFG: Gray `#6B7280`, Padding(0,1) |
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
| `SidebarStyle` | Border: Rounded, BorderFG: Purple `#7C3AED`, Padding(0,1) |
| `SidebarBrandStyle` | Bold, FG: Purple `#7C3AED` |
| `SidebarTitleStyle` | FG: White `#FFFFFF` |
| `AppHeaderStyle` | Bold, FG: White, BG: Purple `#7C3AED`, Padding(0,1) |
| `FooterStyle` | FG: Gray `#6B7280`, Padding(0,1) |

### Icons

| Icon | Character | Color | Usage |
|------|-----------|-------|-------|
| Check | `✓` | Green `#10B981` | Completed stories |
| Play | `▸` | Purple `#7C3AED` | Active story, running state |
| Pending | `○` | Gray `#6B7280` | Pending stories |
| Blocked | `⊘` | Amber `#F59E0B` | Blocked stories |
| Error | `✗` | Red `#EF4444` | Failed items |

### Nerd Font Icons

When Nerd Font is detected, the following glyphs are used for tab bar, sidebar, and footer:

| Context | Nerd Font | ASCII Fallback |
|---------|-----------|----------------|
| Separator (right) | `\uE0BC` | `▶` |
| Separator (left) | `\uE0BA` | `◀` |
| Home | `\uF015` | `1` |
| Search | `\uF002` | `2` |
| List | `\uF03A` | `3` |
| Bolt | `\uF0E7` | `4` |
| Folder | `\uF07B` | `5` |
| Git Branch | `\uE0A0` | `6` |
| User | `\uF007` | `7` |
| Chart | `\uF080` | `8` |
| Grid | `\uF009` | `9` |

### Theme Override System

When running in an IDE terminal, detected accent and editor background colors override the defaults:

- `ApplyTheme(accentHex)` — Overrides `Primary`, rebuilds TitleStyle, HeaderStyle, CurrentStyle, ProgressBarStyle, SidebarStyle, SidebarBrandStyle, PlayIcon, AppHeaderStyle, TabBorderColor
- `ApplySecondary(editorBgHex)` — Overrides `Secondary` and `TabBarInactiveBg`

---

## Vertical Layout & Height Budget

### Critical: lipgloss v1.1.0 `Height()` Semantic

**`Height(h)` sets the INNER (content) height, not the outer frame height.**

Despite the v1 migration guide claiming Width/Height are "outer dimensions including borders and padding," the actual implementation in lipgloss v1.1.0 applies `Height()` to content BEFORE `applyBorder()`:

```go
// lipgloss v1.1.0 style.go Render() order of operations:
// 1. alignTextVertical(str, verticalAlign, height, nil)  ← pads content to `height` lines
// 2. alignTextHorizontal(str, horizontalAlign, width, st)
// 3. s.applyBorder(str)                                   ← adds 2 lines (top + bottom border)
// 4. MaxHeight truncation (AFTER border)
```

This means for any style with `Border(lipgloss.RoundedBorder())`:

| Code | Inner Lines | Outer Lines |
|------|-------------|-------------|
| `style.Height(h).Render(content)` | `h` | `h + 2` |
| `style.Height(h - 2).Render(content)` | `h - 2` | `h` |

**Rule: To get a bordered panel of exactly `h` outer lines, use `Height(h - 2)`.**

Additionally, `alignTextVertical` does NOT truncate — if content exceeds the Height setting, the content is returned as-is, and the border wraps around the full content. Use `MaxHeight()` if truncation is needed.

### App Shell Chrome Heights

```
Terminal Height (m.Height)
├── Tab Bar:  3 lines (PowerlineTabHeight) or 2 lines (CompactTabHeight)
├── Content:  m.Height - tabBarHeight - FooterHeight  (via contentHeight())
└── Footer:   3 lines (FooterHeight)
    ├── Tier 1: Key hints (BorderTop + content = 2 lines)
    └── Tier 2: Powerline status bar (1 line)
```

Constants in `shell.go`:
```go
const (
    FooterHeight       = 3  // key hints border+content (2) + powerline bar (1)
    PowerlineTabHeight = 3  // 3-line diagonal slant tab bar
    CompactTabHeight   = 2  // 1-line tabs + separator rule
)
```

### Per-Plugin Height Budgets

Each plugin receives `(width, height)` where `height = contentHeight()`. The plugin must render exactly `height` visual lines.

**Spectrum** (`plugin_spectrum.go`):
```
height
├── header (measured):         3 lines (PanelStyle border around 1-line content)
├── progressBar (measured):    3 lines (PanelStyle border around 1-line content)
├── mainPanels (dynamic):      dynamicHeight * 60%
│   ├── storyList:             PanelStyle.Height(h-2) → outer = h
│   └── activityPanel:         PanelStyle.Height(h-2) → outer = h
├── logPanel (dynamic):        dynamicHeight - mainPanelHeight
│   └── PanelStyle.Height(h-2) → outer = h
└── statusBar:                 1 line (no border)

fixedHeight = epicHeight + headerHeight + progressHeight + 1
dynamicHeight = height - fixedHeight
```

**Monitor** (`plugin_monitor.go`):
```
height
├── breadcrumb:     1 line (renderBreadcrumb)
├── blank:          1 line
├── 3 panels:       contentHeight = height - 4  (JoinHorizontal)
│   ├── healthPanel:    Height(cH-2) → outer = cH
│   ├── historyPanel:   Height(cH-2) → outer = cH
│   └── gatesPanel:     Height(cH-2) → outer = cH
├── blank:          1 line
└── footer:         1 line
```

**Agent** (`plugin_agent.go`):
```
height
├── breadcrumb:      1 line
├── blank:           1 line
└── wideMode/compact:  height - 2
    ├── sidebar:       Height(h-2) → outer = h  (pad content to h-2 lines)
    └── chatArea:      h lines total
        ├── historyBordered:  Height(historyH) inner → outer = historyH + 2
        ├── blank:            1 line
        └── inputBordered:    5 lines (3 content + 2 border, no Height set)
        historyH = h - 8  →  (h-8+2) + 1 + 5 = h
```

### Panel Height Pattern (Correct)

When creating bordered panels that must fill a specific outer height:

```go
// CORRECT: outer = height lines
styles.PanelStyle.Width(width).Height(height - 2).Render(content)

// WRONG: outer = height + 2 lines (overflows!)
styles.PanelStyle.Width(width).Height(height).Render(content)
```

For manual border styles (not using PanelStyle):
```go
// CORRECT:
lipgloss.NewStyle().
    Border(lipgloss.RoundedBorder()).
    Width(width).
    Height(height - 2).  // inner = height-2, outer = height
    Render(content)

// Pad content to fill inner area:
for len(lines) < height-2 {
    lines = append(lines, "")
}
```

### Resize Handler Consistency

The `PluginResizeMsg.Height` carries `contentHeight()` (total content area). Plugin resize handlers must subtract the same overhead as their `View()` method to derive the viewport height:

```go
// Agent example:
// View: breadcrumb(2) + history_border(2) + blank(1) + input(5) = 10
case plugin.PluginResizeMsg:
    viewportHeight := msg.Height - 10
```

---

## Configuration

### Default Values

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
| Version | 1.9.8 | `main.go:14` |

### Pagination Configuration

| Paginator | Items/Page | Style | Active Dot | Inactive Dot |
|-----------|-----------|-------|------------|--------------|-
| Stories | 12 | Dots | `●` | `○` |
| Logs | 6 | Dots | `●` | `○` |

### Responsive Breakpoints

| Terminal Width | Behavior |
|---------------|----------|
| < 120 | No sidebar, compact tab bar if needed |
| >= 120 | Sidebar auto-shown (toggleable with Ctrl+D) |
| >= 80 | Footer shows quality gate counts |
| >= 90 | Footer shows iteration counter |
| >= 100 | Footer shows current story ID |

### Demo Mode

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

---

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
4. `github.com/charmbracelet/lipgloss v1.1.0` — Terminal styling
5. `github.com/charmbracelet/x/ansi v0.8.0` — ANSI utilities
6. `github.com/fogleman/fauxgl v0.0.0` — 3D rendering
7. `github.com/muesli/termenv v0.16.0` — Terminal environment detection
8. `github.com/spf13/cobra v1.8.1` — CLI framework

**Notable indirect:** Chroma (syntax highlighting), bubblezone (mouse zones), clipboard, colorprofile, cellbuf
