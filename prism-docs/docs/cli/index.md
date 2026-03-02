---
title: CLI Dashboard Overview
description: Prism CLI — a Go 1.23 full-screen TUI with 11 screens, 3D prism renderer, spring animations, and real-time Spectrum execution monitoring.
outline: [2, 3]
---

# Part II — CLI Dashboard

Prism CLI is a Go 1.23 terminal user interface that provides real-time monitoring and control of the Spectrum autonomous development workflow. It spawns Claude Code CLI sessions to execute stories from a `stories.json` file, displays streaming tool activity, tracks progress with spring-animated UI elements, and renders a procedural 3D splash screen using software rasterization.

## Key Features

- **13 views**: Splash, Onboarding, Home menu, Research browser, Plans browser, Spectrum execution dashboard, Files browser, Git integration, Agent chat, Monitor dashboard, Browser verification, Workspaces manager
- **Plugin architecture**: 11 composable plugins with shared context, event bus, epoch-based staleness, and lifecycle management
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
- **File watcher**: fsnotify-based real-time file change detection with debouncing and EventBus integration
- **Persisted UI state**: Per-project state persistence (open tabs, expanded dirs, diff mode) across sessions
- **Fuzzy file finder**: Project-wide fuzzy file search overlay with scoring algorithm
- **Content search**: Ripgrep-powered project-wide content search with result navigation
- **Conversation browser**: Multi-adapter session scanning (Claude Code `.jsonl` files)
- **Uninstaller**: `--uninstall` flag for clean removal of binary, PATH entries, and global config
- **Demo mode**: 36 pre-seeded stories with auto-progression for previewing animations

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Prism CLI v2.3.0                             │
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

## Codebase Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~27,000 |
| Production Code | ~25,211 lines |
| Test Code | ~1,800 lines (18 test files) |
| Go Files | 85 |
| Packages | 19 |
| Direct Dependencies | 8 |
