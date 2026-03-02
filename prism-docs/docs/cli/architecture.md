---
title: CLI Architecture
description: Package structure, Elm Architecture pattern, and data flow for the Prism CLI dashboard.
outline: [2, 3]
---

# CLI Architecture

## Package Structure

```
cmd/prism-cli/
├── main.go                         # CLI entry point, Cobra commands, flag parsing, uninstaller (340 lines)
├── Makefile                        # Build targets (67 lines)
├── go.mod                          # Dependencies (Go 1.23.0)
├── build.sh                        # Single-platform build script
│
├── app/                            # Bubble Tea UI — Elm Architecture (27 files, ~14,000 lines)
│   ├── model.go                    # Model struct, AnimState, NewModel/NewDemoModel
│   ├── update.go                   # Update handler, message routing, state transitions
│   ├── view.go                     # View router, modal overlay compositing
│   ├── views.go                    # ActiveView enum (13 views), FileEntry, ResearchState, PlansState, EpicInfo
│   ├── view_splash.go              # Splash screen thin wrapper
│   ├── shell.go                    # App shell: tab bar + sidebar + footer layout, breadcrumbs
│   ├── sidebar.go                  # Sidebar component: logo, execution info, files, gates, epics
│   ├── footer.go                   # Two-tier footer: key hints + powerline status bar
│   ├── commands.go                 # Async Bubble Tea commands (LoadStories, DiscoverEpics, etc.)
│   ├── command_palette.go          # Command palette: fuzzy search, modal builder
│   ├── content_search.go           # Project-wide content search via ripgrep (F-5)
│   ├── file_finder.go              # Fuzzy file search overlay with scoring algorithm (F-4)
│   ├── messages.go                 # All message type definitions (~35 message types)
│   │
│   ├── plugin_home.go              # Home screen plugin (menu, 214 lines)
│   ├── plugin_research.go          # Research file browser plugin (230 lines)
│   ├── plugin_plans.go             # Plans file browser plugin + decompose (245 lines)
│   ├── plugin_spectrum.go          # Spectrum dashboard plugin (1,218 lines — LARGEST)
│   ├── plugin_files.go             # File tree browser plugin, two-pane + tabs + edit + blame (1,407 lines)
│   ├── plugin_git.go               # Git integration plugin: status, diff, stage, commit, push, pull, stash (1,530 lines)
│   ├── plugin_agent.go             # Agent chat plugin: conversations, adapters, analytics (1,051 lines)
│   ├── plugin_monitor.go           # System monitor plugin: health, history, gates, agents (917 lines)
│   ├── plugin_browser.go           # Browser verification plugin: sessions, history, artifacts (726 lines)
│   ├── plugin_workspaces.go        # Multi-project workspace + worktree + kanban manager (1,981 lines)
│   ├── plugin_onboarding.go        # First-run setup wizard + legacy migration (685 lines)
│   │
│   ├── adapter/                    # AI agent conversation scanning
│   │   ├── adapter.go              # Adapter interface, Session struct (35 lines)
│   │   ├── claude.go               # ClaudeAdapter: scans ~/.claude/projects/ .jsonl files (334 lines)
│   │   └── claude_test.go          # Adapter tests
│   │
│   └── chat/
│       └── renderer.go             # Chat message rendering (user/assistant/tool)
│
├── plugin/                         # Plugin system framework (5 files, 397 lines)
│   ├── plugin.go                   # Plugin interface (11 methods)
│   ├── registry.go                 # Plugin registry: register, activate, broadcast, reinit
│   ├── context.go                  # Shared plugin context struct (16 fields)
│   ├── events.go                   # EventBus + 11 concrete event types
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
├── state/                          # Per-project persisted UI state (2 files, 113 lines)
│   ├── state.go                    # Store: Load/Save to ~/.config/prism-cli/state/<hash>.json
│   └── state_test.go               # State persistence tests
│
├── watcher/                        # Real-time file change detection (2 files, 235 lines)
│   ├── watcher.go                  # fsnotify wrapper: debouncing, filtering, EventBus integration
│   └── watcher_test.go             # Watcher tests
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
├── registry/                       # Global workspace registry (2 files, 222 lines)
│   ├── registry.go                 # ~/.prism/workspaces.json: register, load, prune, cross-process locking
│   └── registry_test.go            # Registry tests
│
├── terminal/                       # Terminal environment detection (2 files, 999 lines)
│   ├── detect.go                   # Terminal, shell, color profile, Nerd Font, git branch detection
│   └── theme.go                    # IDE theme color extraction (accent, foreground, editor bg)
│
├── splash/                         # Procedural splash animation (2 files, 883 lines)
│   ├── splash.go                   # Icosahedron mesh, beam particles, spectral wave, ANSI render
│   └── mesh_data.go                # Embedded mesh: 444 vertices, 360 faces
│
├── markdown/                       # Markdown rendering (2 files)
│   ├── renderer.go                 # Glamour wrapper: Render(), RenderDark(), Available()
│   └── renderer_test.go            # Renderer tests
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

## Elm Architecture Pattern

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

## Data Flow

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
