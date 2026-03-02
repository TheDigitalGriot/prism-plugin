---
title: Plugin System
description: The 11-plugin architecture with shared context, event bus, epoch-based staleness, and lifecycle management.
outline: [2, 3]
---

# Plugin System

## Plugin Interface

Every screen in the TUI is implemented as a plugin conforming to `plugin.Plugin` (11 methods):

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

## Plugin Context

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
| `WorkDir` | `string` | Working directory at startup |
| `GitRoot` | `string` | Git repository root directory |
| `ConfigDir` | `string` | User config directory (`~/.config/prism-cli`) |
| `Epoch` | `uint64` | Monotonic counter incremented on project switch (for staleness detection) |
| `HasLegacyDir` | `bool` | Whether a legacy `thoughts/` directory was detected |
| `LegacyDir` | `string` | Path to legacy `thoughts/` directory (for migration) |

## Epoch-Based Staleness

`Context.Epoch` is a critical architectural pattern. When the user switches projects (via Workspaces), `Registry.Reinit()` increments the epoch. All async `tea.Cmd` results carry the epoch at which they were dispatched. Handlers compare the message epoch against the current `Context.Epoch` — if they differ, the result is from a previous project and is silently discarded. This prevents stale file lists, story data, or Claude output from a previous project from corrupting the current view.

## Plugin Registry

The registry manages plugin lifecycle:

1. **Registration** (`Register`): Validates ID uniqueness, calls `Init(ctx)` with panic recovery, first plugin is auto-activated
2. **Activation** (`SetActive`): Unfocuses previous, focuses new plugin
3. **Broadcast** (`Broadcast`): Routes messages to ALL plugins, collects commands
4. **Reinit** (`Reinit`): Increments `Context.Epoch`, stops all plugins, re-initializes with current context (used on project switch)

## Event Bus

Thread-safe pub/sub communication (`sync.RWMutex`) with these event types:

| Event | Type String | Fields |
|-------|-------------|--------|
| `StoryCompletedEvent` | `"story.completed"` | StoryID, StoryTitle |
| `FileChangedEvent` | `"file.changed"` | FilePath, Action |
| `BranchChangedEvent` | `"branch.changed"` | Branch |
| `EpicSwitchedEvent` | `"epic.switched"` | EpicName, StoriesPath |
| `ProjectSwitchedEvent` | `"project.switched"` | ProjectDir, PrismDir, StoriesPath |
| `AgentStatusEvent` | `"agent.status"` | AgentID, Status, Model, Activity |
| `ConversationChangedEvent` | `"conversation.changed"` | FilePath, Action |
| `QualityGateResultEvent` | `"gate.result"` | Gate, Passed, Output |
| `WorktreeChangedEvent` | `"worktree.changed"` | Action, Path |
| `BrowserVerificationEvent` | `"browser.verification"` | URL, Status, ScreenshotPath, ConsoleErrors |
| `BrowserSessionEvent` | `"browser.session"` | SessionID, Action, URL |

## Registered Plugins (in order)

| # | Plugin ID | Plugin Name | Source File | Lines |
|---|-----------|-------------|-------------|-------|
| 1 | `home` | Home | `plugin_home.go` | 214 |
| 2 | `research` | Research | `plugin_research.go` | 230 |
| 3 | `plans` | Plans | `plugin_plans.go` | 245 |
| 4 | `spectrum` | Spectrum | `plugin_spectrum.go` | 1,218 |
| 5 | `files` | Files | `plugin_files.go` | 1,407 |
| 6 | `git` | Git | `plugin_git.go` | 1,530 |
| 7 | `agent` | Agent | `plugin_agent.go` | 1,051 |
| 8 | `monitor` | Monitor | `plugin_monitor.go` | 917 |
| 9 | `browser` | Browser | `plugin_browser.go` | 726 |
| 10 | `workspaces` | Workspaces | `plugin_workspaces.go` | 1,981 |
| 11 | `onboarding` | Onboarding | `plugin_onboarding.go` | 685 |

## Tab Order

The tab bar displays 10 tabs (excluding Splash and Onboarding):

```
[1] Home  [2] Research  [3] Plans  [4] Spectrum  [5] Files  [6] Git  [7] Agent  [8] Monitor  [9] Browser  [0] Workspaces
```
