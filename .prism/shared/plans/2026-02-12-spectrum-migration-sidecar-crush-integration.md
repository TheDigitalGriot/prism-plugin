---
date: 2026-02-12
author: Claude
repository: prism-plugin
branch: feat/spectrum-migration
ticket: N/A
status: draft
research: .prism/shared/research/2026-02-12-prism-tui-sidecar-crush-integration-architecture.md
---

# Plan: Sidecar + Crush Integration into Prism TUI

## Overview

**Goal**: Transform Prism TUI from a 4-screen monolithic Bubble Tea app into a plugin-based dashboard integrating Sidecar's plugin architecture and Crush's agentic UI components — adding 20 new screens across 9 zones while preserving existing functionality.

**Research**: `.prism/shared/research/2026-02-12-prism-tui-sidecar-crush-integration-architecture.md`

**Complexity**: High

**Estimated Phases**: 10

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Home screen | Keep as tab + splash on startup | Dashboard overview accessible anytime |
| Spectrum | Monolithic plugin (not split) | Complex execution state stays cohesive |
| Scope | Full integration (8+ phases) | Build complete plugin-based dashboard |
| 3D Prism | App shell header | Persistent brand identity across all views |

## Success Criteria

### Automated (CI/Scripts)
- [ ] `cd cmd/prism-tui && make build` — Builds for current platform
- [ ] `cd cmd/prism-tui && make test` — All tests pass
- [ ] `cd cmd/prism-tui && make lint` — No lint errors
- [ ] `cd cmd/prism-tui && go vet ./...` — No vet issues
- [ ] Demo mode (`--demo`) renders all screens without panic

### Manual Verification
- [ ] Existing 4 screens (Home, Research, Plans, Spectrum) work identically to pre-migration
- [ ] Tab bar shows all registered plugins with number keys (1-9) to switch
- [ ] Splash screen appears on startup, transitions to Home after 2s or keypress
- [ ] Modal dialogs open/close with proper focus capture
- [ ] Permission dialog shows tool preview with Allow/Session/Deny buttons
- [ ] New screens (Files, Git, Agent, Monitor, Workspaces) render and accept input
- [ ] Spring animations continue working in Spectrum view
- [ ] 3D prism renders in app shell header across all views
- [ ] `esc` from any view returns to Home (when not in sub-state like file viewer)
- [ ] Window resize propagates to all plugins correctly

## What We're NOT Doing

- [ ] SQLite session persistence (file-based stays for now)
- [ ] Multi-model LLM switching (Crush feature, not needed)
- [ ] LSP integration (Crush feature, out of scope)
- [ ] Sidecar's adapter system for conversation importing
- [ ] Real-time collaborative features
- [ ] Inline editor / tmux PTY integration (Sidecar feature)
- [ ] MCP server integration (Crush feature)

---

## Phases

### Phase 1: App Shell & Navigation

**Goal**: Replace the monolithic `View()` router with a tab-bar-based app shell. Expand `ActiveView` from 4 to N views. Add persistent header with 3D prism. Keep all existing screens working.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/views.go` | Expand `ActiveView` enum to include all new views, add `ViewSplash` |
| `cmd/prism-tui/app/model.go` | Add `TabOrder []ActiveView` field, remove Home from model init default |
| `cmd/prism-tui/app/view.go` | Rewrite `View()` to render app shell (header + tab bar + active content + footer) |
| `cmd/prism-tui/app/view_home.go` | Adapt to render inside app shell (remove standalone prism/header, becomes dashboard content) |
| `cmd/prism-tui/app/view_spectrum.go` | Move header/prism rendering to app shell, spectrum becomes content-only |
| `cmd/prism-tui/app/update.go` | Add tab switching via number keys (1-9) and tab/shift+tab in global handler |
| `cmd/prism-tui/styles/theme.go` | Add `TabActiveStyle`, `TabInactiveStyle`, `AppHeaderStyle`, `FooterStyle` |

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/shell.go` | App shell renderer: `renderAppShell()`, `renderTabBar()`, `renderAppHeader()`, `renderAppFooter()` |

**Steps**:
1. [x] Add new `ActiveView` values to `views.go`: `ViewSplash`, `ViewFiles`, `ViewGit`, `ViewAgent`, `ViewChat`, `ViewMonitor`, `ViewWorkspaces`, `ViewOnboarding`
2. [x] Add tab-related styles in `styles/theme.go`: `TabActiveStyle` (bold, primary underline), `TabInactiveStyle` (dim), `AppHeaderStyle` (brand bar with prism), `FooterStyle` (key hints)
3. [x] Create `shell.go` with `renderAppShell()` that composes: app header (3D prism + project name) → tab bar → active view content → footer (context-sensitive key hints)
4. [x] Add `TabOrder []ActiveView` to `Model` struct in `model.go`, initialized with `[Home, Research, Plans, Spectrum]` in `NewModel()`
5. [x] Rewrite `View()` in `view.go` to call `m.renderAppShell()` which wraps the active view content
6. [x] Move 3D prism rendering from `view_home.go:17-25` and `view_spectrum.go:76-94` into `shell.go` app header
7. [x] Adapt `view_home.go` to render dashboard content only (cards with stats, not standalone prism)
8. [x] Adapt `view_spectrum.go` `renderHeader()` to omit "PRISM TUI" title (now in app shell)
9. [x] Add global tab switching in `update.go:handleKeyPress()`: `tab`/`shift+tab` cycle through tabs (number keys conflict removed from Home view)
10. [x] Update `NewDemoModel()` to use new shell structure

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
cd cmd/prism-tui && go run . --demo  # Visual check: tab bar, header prism, existing screens work
```

**Checkpoint**: ✅ Phase 1 complete — App shell renders with tab bar, all 4 existing screens work inside it

---

### Phase 2: Splash Screen

**Goal**: Add a startup splash screen with animated prism, project info, and auto-transition to Home tab after ~2 seconds or on keypress.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Add `SplashDone bool` field to Model |
| `cmd/prism-tui/app/update.go` | Handle `SplashDoneMsg`, forward keypresses during splash |
| `cmd/prism-tui/app/view.go` | Route `ViewSplash` before app shell |
| `cmd/prism-tui/app/messages.go` | Add `SplashDoneMsg` |

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/view_splash.go` | Splash screen renderer with centered prism, version, project info |

**Steps**:
1. [x] Add `SplashDoneMsg` to `messages.go`
2. [x] Create `view_splash.go` with `renderSplashView()`: centered 3D prism animation, "PRISM" logo gradient, version string, project dir, "Press any key..." hint
3. [x] Set initial `ActiveView` to `ViewSplash` in `NewModel()` (replaces `ViewHome` or `ViewSpectrum`)
4. [x] Add `splashTimerCmd()` that sends `SplashDoneMsg` after 2 seconds via `tea.Tick`
5. [x] In `Init()`, batch `splashTimerCmd()` with existing commands
6. [x] In `Update()`, handle `SplashDoneMsg`: set `ActiveView = ViewHome`, set `SplashDone = true`
7. [x] In `handleKeyPress()`, if `!m.SplashDone`, any key triggers transition to Home
8. [x] In `View()`, if `ActiveView == ViewSplash`, render splash fullscreen (no app shell)
9. [x] Add splash to demo mode

**Verification**:
```bash
cd cmd/prism-tui && go build ./... && go run . --demo
# Visual: splash appears, auto-transitions after 2s, any key skips to Home
```

**Checkpoint**: ✅ Phase 2 complete — Splash screen with auto-transition works

---

### Phase 3: Plugin Architecture

**Goal**: Port Sidecar's Plugin interface and Registry into Prism TUI. Convert existing 4 screens into plugins. Enable adding new plugins without modifying core Model.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/plugin/plugin.go` | Plugin interface (adapted from `ref/sidecar/internal/plugin/plugin.go`) |
| `cmd/prism-tui/plugin/context.go` | Plugin context: PrismDir, ProjectDir, Config, Width, Height |
| `cmd/prism-tui/plugin/registry.go` | Registry with Register, lifecycle, panic recovery, message broadcast |
| `cmd/prism-tui/plugin/messages.go` | Shared plugin messages: `FocusPluginMsg`, `ResizeMsg`, `NavigateMsg` |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Add `Registry *plugin.Registry`, remove per-view state fields (Home, Research, Plans, Epic) |
| `cmd/prism-tui/app/update.go` | Route messages through registry broadcast, delegate to active plugin |
| `cmd/prism-tui/app/view.go` | Call `registry.ActivePlugin().View(width, height)` for content area |
| `cmd/prism-tui/app/shell.go` | Get tab labels from `registry.Plugins()` |
| `cmd/prism-tui/app/view_home.go` | Refactor into `HomePlugin` struct implementing Plugin interface |
| `cmd/prism-tui/app/view_research.go` | Refactor into `ResearchPlugin` |
| `cmd/prism-tui/app/view_plans.go` | Refactor into `PlansPlugin` |
| `cmd/prism-tui/app/view_spectrum.go` | Refactor into `SpectrumPlugin` (keeps all execution state) |

**Steps**:
1. [x] Create `plugin/plugin.go` with Plugin interface (ID, Name, Icon, Init, Start, Stop, Update, View, IsFocused, SetFocused, KeyHints)
2. [x] Create `plugin/context.go` with Context struct: PrismDir, ProjectDir, StoriesPath, Width, Height, DemoMode, PrismStyle, MaxIterations, Pause
3. [x] Create `plugin/registry.go` with Register (panic recovery), Plugins, ActivePlugin, SetActive, Broadcast, Reinit, UpdateContext
4. [x] Create `plugin/messages.go` with `FocusPluginMsg{ID string}`, `PluginResizeMsg{W, H int}`
5. [x] Convert `view_home.go` → `plugin_home.go` HomePlugin: owns `HomeState`, renders menu, navigates via FocusPluginMsg
6. [x] Convert `view_research.go` → `plugin_research.go` ResearchPlugin: owns `ResearchState`, files, viewport
7. [x] Convert `view_plans.go` → `plugin_plans.go` PlansPlugin: owns `PlansState`, decompose logic
8. [x] Convert `view_spectrum.go` → `plugin_spectrum.go` SpectrumPlugin: owns all execution state, animations (SpectrumAnimState), stories, logs, Claude runner — moved ~60 fields from Model
9. [x] Update `model.go`: replaced per-view state with `Registry *plugin.Registry`, slimmed Model to shell + prism + global anim only
10. [x] Update `update.go`: broadcast messages to registry, delegate key handling to active plugin via delegateToActivePlugin()
11. [x] Update `view.go`/`shell.go`: get content from `m.Registry.ActivePlugin().View()`, tab labels from registry, key hints from active plugin
12. [x] Update `NewModel()` and `NewDemoModel()` to create and register plugins, removed old view_*.go files

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
cd cmd/prism-tui && go run . --demo
# Verify: all 4 screens render identically, tab switching works, no regressions
```

**Checkpoint**: ✅ Phase 3 complete — Plugin architecture works, existing 4 screens are now plugins

---

### Phase 4: Modal System

**Goal**: Port Sidecar's declarative modal builder into Prism TUI. Support text, buttons, checkbox, input, list sections. Modal captures focus when open.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/modal/modal.go` | Modal struct, builder API (New, AddSection, options), key/mouse handling |
| `cmd/prism-tui/modal/section.go` | Section interface + implementations: Text, Spacer, Buttons, Checkbox |
| `cmd/prism-tui/modal/input.go` | Input, Textarea sections using `bubbles/textinput` and `bubbles/textarea` |
| `cmd/prism-tui/modal/list.go` | Scrollable list section |
| `cmd/prism-tui/modal/layout.go` | Two-pass rendering pipeline, scrollbar, viewport slicing |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Add `ActiveModal *modal.Modal` field |
| `cmd/prism-tui/app/update.go` | If modal active, route all input to modal first |
| `cmd/prism-tui/app/view.go` | Overlay modal rendering on top of app shell |
| `cmd/prism-tui/styles/theme.go` | Add `ModalStyle`, `ModalBackdropStyle`, `ModalTitleStyle` |

**Steps**:
1. [x] Create `modal/section.go` with `Section` interface:
   ```go
   type Section interface {
       Render(width int, focused bool) string
       Update(msg tea.Msg) (Section, tea.Cmd)
       Focusable() bool
       Height() int
   }
   ```
   Implementations: `TextSection`, `SpacerSection`, `ButtonsSection`, `CheckboxSection`
2. [x] Create `modal/input.go`: `InputSection` (wraps bubbles/textinput), `TextareaSection` (wraps bubbles/textarea)
3. [x] Create `modal/list.go`: `ListSection` with scrollable items, selected index, truncation
4. [x] Create `modal/layout.go`: two-pass render (measure → scrollbar decision → final render), viewport slicing for tall content, scrollbar rendering
5. [x] Create `modal/modal.go`: builder API:
   ```go
   modal.New("Title", modal.WithWidth(60)).
       AddSection(modal.Text("content")).
       AddSection(modal.Buttons(modal.Btn("OK", "ok"), modal.Btn("Cancel", "cancel")))
   ```
   Key handling: tab/shift+tab cycle focus, enter activates buttons, esc closes
6. [x] Add modal styles to `styles/theme.go`
7. [x] Add `ActiveModal *modal.Modal` to Model struct
8. [x] In `update.go`, check `m.ActiveModal != nil` first — if yes, forward all messages to modal. On modal close/action, set `ActiveModal = nil` and process action.
9. [x] In `view.go`, if modal active, render it centered on top of app shell content
10. [x] Convert existing help (`?` key) to use modal system instead of `ShowHelp` bool

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
cd cmd/prism-tui && go run . --demo  # Press ? to open help modal
# Verify: modal appears centered, tab cycles focus, esc closes, backdrop dims content
```

**Checkpoint**: ✅ Phase 4 complete — Modal system works with help dialog

---

### Phase 5: Dialog & Permissions

**Goal**: Port Crush's stack-based dialog overlay and permission approval workflow. Dialogs stack on top of each other, top dialog captures input.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/dialog/dialog.go` | Dialog interface, Overlay struct (stack), render/update routing |
| `cmd/prism-tui/dialog/permissions.go` | Permission dialog: 3-button approval, tool preview, diff view |
| `cmd/prism-tui/dialog/confirm.go` | Simple yes/no confirmation dialog |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Add `Dialogs *dialog.Overlay` field |
| `cmd/prism-tui/app/update.go` | Route input through dialog overlay before modal/plugin |
| `cmd/prism-tui/app/view.go` | Render dialog stack on top of everything |
| `cmd/prism-tui/app/messages.go` | Add `PermissionRequestMsg`, `PermissionResponseMsg` |

**Steps**:
1. [x] Create `dialog/dialog.go`:
   ```go
   type Dialog interface {
       ID() string
       Update(msg tea.Msg) (Action, tea.Cmd)
       View(width, height int) string
   }
   type Overlay struct { dialogs []Dialog }
   func (o *Overlay) Open(d Dialog)
   func (o *Overlay) CloseFront()
   func (o *Overlay) HasDialogs() bool
   ```
2. [x] Create `dialog/confirm.go`: simple confirmation with title, message, two buttons
3. [x] Create `dialog/permissions.go`: tool name, preview content (bash command / file diff), 3 buttons (Allow / Allow Session / Deny), viewport for scrollable content
4. [x] Add `PermissionRequestMsg` and `PermissionResponseMsg` to `messages.go`
5. [x] Add `Dialogs *dialog.Overlay` to Model, init in `NewModel()`
6. [x] Update input routing in `update.go`: dialogs → modal → active plugin
7. [x] Render dialog overlay on top of everything in `view.go`
8. [x] Wire permission dialog into Spectrum plugin: when Claude requests tool execution, open permission dialog (future: integrate with Claude runner output parsing)

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
# Manual: demo mode shows confirm dialog on destructive actions
```

**Checkpoint**: ✅ Phase 5 complete — Dialog overlay and permission workflow functional

---

### Phase 6: New Screens — Files & Git

**Goal**: Add File Browser and Git Status plugins inspired by Sidecar's file-browser and git-status plugins.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/plugin_files.go` | FilesPlugin: tree-view file browser with preview pane |
| `cmd/prism-tui/app/plugin_git.go` | GitPlugin: git status, staged/unstaged diff viewer, branch info |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Register FilesPlugin and GitPlugin in NewModel |
| `cmd/prism-tui/app/views.go` | Ensure ViewFiles, ViewGit exist in enum |

**Steps**:
1. [x] Create `plugin_files.go` — `FilesPlugin` implementing Plugin interface:
   - Tree-view of project directory (respecting .gitignore)
   - j/k navigation, enter to expand/collapse dirs
   - Right pane: file preview (first 50 lines) using viewport
   - Search/filter with `/` key
   - Key hints: `j/k navigate  enter open  / filter  esc back`
2. [x] Create `plugin_git.go` — `GitPlugin` implementing Plugin interface:
   - Branch name + ahead/behind info in header
   - Staged / Modified / Untracked file lists
   - Enter on file → diff viewer (unified diff with syntax coloring)
   - Stage/unstage with `s` key, commit with `c` (opens modal with message input)
   - Uses `os/exec` to run git commands
3. [x] Register both plugins in `NewModel()` — added to TabOrder after Spectrum, added pluginIDToView/viewToPluginID mappings
4. [x] Add demo data for both plugins in `NewDemoModel()`

**Verification**:
```bash
cd cmd/prism-tui && go build ./...  # ✅ Passed
cd cmd/prism-tui && go test ./...   # ✅ Passed
cd cmd/prism-tui && go run . --demo  # Tab to Files and Git screens
# Verify: file tree renders, git status shows, navigation works
```

**Checkpoint**: ✅ Phase 6 complete — Files and Git plugins functional

---

### Phase 7: New Screens — Agent & Chat

**Goal**: Add Agent plugin with chat interface for interactive Claude sessions, inspired by Crush's chat UI (wide/compact modes).

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/plugin_agent.go` | AgentPlugin: chat interface with message history, input editor |
| `cmd/prism-tui/app/chat/renderer.go` | Message renderer: user/assistant bubbles, tool call display, markdown |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Register AgentPlugin |
| `cmd/prism-tui/app/views.go` | Ensure ViewAgent, ViewChat exist |

**Steps**:
1. [x] Create `chat/renderer.go`: message rendering functions:
   - User messages: right-aligned bubble with blue border
   - Assistant messages: left-aligned with content area
   - Tool calls: collapsible with icon + name + status
   - Markdown-lite rendering (bold, code blocks, lists)
2. [x] Create `plugin_agent.go` — `AgentPlugin`:
   - Two-pane layout: message history (scrollable viewport) + input area (textarea)
   - Wide mode: sidebar with conversation list + main chat
   - Compact mode: full-width chat only (toggle with `ctrl+b`)
   - Input sends to Claude CLI via streaming (`claude/runner.go` integration)
   - Permission requests open dialog overlay
   - Message history stored in-memory (file persistence in future phase)
   - Key hints: `enter send  ctrl+b toggle sidebar  / command palette`
3. [x] Register plugin in `NewModel()`
4. [x] Add demo messages in `NewDemoModel()`

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
cd cmd/prism-tui && go run . --demo  # Tab to Agent screen
# Verify: chat interface renders, messages display, input accepts text
```

**Checkpoint**: ✅ Phase 7 complete — Agent chat interface functional

---

### Phase 8: New Screens — Monitor & Workspaces

**Goal**: Add TD Monitor (technical debt / diagnostics) and Workspace plugins.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/plugin_monitor.go` | MonitorPlugin: system health, resource usage, execution history |
| `cmd/prism-tui/app/plugin_workspaces.go` | WorkspacesPlugin: project/epic switcher with preview |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Register MonitorPlugin and WorkspacesPlugin |

**Steps**:
1. [x] Create `plugin_monitor.go` — `MonitorPlugin`:
   - Health dashboard: Go runtime stats (goroutines, memory, GC)
   - Execution history: table of recent Spectrum iterations (story, duration, result)
   - Quality gates status: last lint/test/build results
   - Auto-refreshing (5s tick)
2. [x] Create `plugin_workspaces.go` — `WorkspacesPlugin`:
   - Scan for `.prism/` directories in parent/sibling dirs
   - List projects with name, branch, story progress
   - Enter to switch project (triggers Registry.Reinit)
   - Epic selector within current project
3. [x] Register both in `NewModel()`
4. [x] Demo data for both

**Verification**:
```bash
cd cmd/prism-tui && go build ./...   # ✅ Passed
cd cmd/prism-tui && go test ./...    # ✅ Passed
cd cmd/prism-tui && go run . --demo  # Tab to Monitor and Workspaces screens
```

**Checkpoint**: ✅ Phase 8 complete — Monitor and Workspaces plugins functional

---

### Phase 9: Onboarding Flow

**Goal**: Add first-run onboarding screen inspired by Crush's onboarding state machine. Detects missing configuration and guides user through setup.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/app/plugin_onboarding.go` | OnboardingPlugin: step-by-step setup wizard |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/app/model.go` | Add onboarding detection logic to NewModel |
| `cmd/prism-tui/app/update.go` | After onboarding complete, transition to Home |

**Steps**:
1. [x] Create `plugin_onboarding.go` — `OnboardingPlugin`:
   - Step 1: Detect project directory (auto or manual selection)
   - Step 2: Check for `.prism/` directory, offer to create
   - Step 3: Check for `claude` CLI availability
   - Step 4: Verify stories.json exists or offer to create from plan
   - Each step: description, status icon (✓/▸/○), action button
   - On completion: hide onboarding plugin from tab bar, navigate to Home
2. [x] In `NewModel()`, detect if onboarding needed (no `.prism/` dir, no stories, etc.)
3. [x] If onboarding needed, set initial view to onboarding and show as first tab
4. [x] After onboarding completes, remove from tab order. Added demo data in `NewDemoModel()`

**Verification**:
```bash
cd cmd/prism-tui && go build ./...  # ✅ Passed
cd cmd/prism-tui && go test ./...   # ✅ Passed
# Manual: run in a directory without .prism/ to trigger onboarding
```

**Checkpoint**: ✅ Phase 9 complete — Onboarding guides new users through setup

---

### Phase 10: Integration & Polish

**Goal**: Wire everything together. Add event bus for inter-plugin communication, spring animations for new components, command palette, and updated demo mode.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-tui/plugin/events.go` | Event bus: pub/sub for plugin-to-plugin communication |
| `cmd/prism-tui/app/command_palette.go` | Command palette modal: fuzzy search across all plugin commands |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-tui/plugin/context.go` | Add EventBus field to Context |
| `cmd/prism-tui/plugin/registry.go` | Wire event bus into broadcast |
| `cmd/prism-tui/app/model.go` | Add command palette state, update demo model with all plugins |
| `cmd/prism-tui/app/update.go` | Handle command palette open (`ctrl+p` or `:`) |
| `cmd/prism-tui/styles/theme.go` | Add styles for new components (palette, agent bubbles, etc.) |

**Steps**:
1. [ ] Create `plugin/events.go`: typed event bus with subscribe/publish:
   ```go
   type EventBus struct { ... }
   func (eb *EventBus) Publish(event Event)
   func (eb *EventBus) Subscribe(eventType string, handler func(Event))
   ```
   Events: `StoryCompleted`, `FileChanged`, `BranchChanged`, `EpicSwitched`
2. [ ] Add EventBus to `plugin/context.go` and initialize in registry
3. [ ] Create `command_palette.go`: modal with fuzzy-searchable list of all commands from all plugins, `ctrl+p` to open
4. [ ] Wire inter-plugin events:
   - Git plugin publishes `BranchChanged` → header updates
   - Spectrum plugin publishes `StoryCompleted` → Monitor plugin updates history
   - Files plugin publishes `FileChanged` → Git plugin refreshes
5. [ ] Add spring animations for new elements:
   - Tab switch slide animation (horizontal spring)
   - Dialog open/close scale animation
   - Splash fade-out animation
6. [ ] Update `NewDemoModel()` with all plugins, demo data for Files/Git/Agent/Monitor/Workspaces
7. [ ] Final style pass: consistent colors, spacing, and typography across all plugins
8. [ ] Add `--plugin` CLI flag to enable/disable specific plugins

**Verification**:
```bash
cd cmd/prism-tui && go build ./...
cd cmd/prism-tui && go test ./...
cd cmd/prism-tui && go run . --demo
# Full walkthrough: splash → home → tab through all screens → command palette → modals → back
```

**Checkpoint**: ⬜ Phase 10 complete — Full integration with event bus, command palette, polish

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Plugin refactor breaks Spectrum execution | Medium | Critical | Spectrum plugin gets most thorough testing; extract state without changing behavior |
| Animation performance with more plugins | Low | Medium | Only active plugin renders; background plugins skip animation ticks |
| Modal/dialog z-order conflicts | Medium | Low | Clear precedence: dialogs > modals > content; only one layer accepts input |
| Large Model struct refactor (Phase 3) | High | High | Incremental extraction — one plugin at a time, test after each |
| Git commands blocking UI | Medium | Medium | Run all git ops via `tea.Cmd` (async); show spinner during operations |
| Windows terminal compatibility | Low | Low | Existing prism styles already handle Windows; test new components |

## Edge Cases

| Case | Handling |
|------|----------|
| Terminal < 80 columns wide | Collapse tab bar to icons only, stack panels vertically |
| No `.prism/` directory | Trigger onboarding flow instead of crash |
| No `git` binary available | Git plugin shows "git not found" message, marks self unavailable |
| No `claude` CLI | Agent plugin shows setup instructions, Spectrum shows CLI required |
| Plugin panic during Init | Registry catches panic, marks plugin unavailable, logs error |
| Rapid tab switching | Debounce via tick; don't reload data if already cached |
| Modal open during Spectrum execution | Modal captures input but execution continues in background |
| Window resize during modal | Modal recalculates width/height on `WindowSizeMsg` |

## Rollback Plan

Each phase is a separate set of commits. To rollback any phase:
```bash
git log --oneline  # Find last good commit before phase
git revert HEAD~N..HEAD  # Revert phase commits
```

The plugin architecture (Phase 3) is the most critical — if issues arise:
1. Keep the `plugin/` package but don't use Registry in Model
2. Maintain direct view switching as fallback
3. Wrap existing view functions as thin Plugin adapters

## Dependencies

**Must complete in order**:
- Phase 1 (App Shell) before Phase 2 (Splash) — splash needs shell to transition to
- Phase 1 before Phase 3 (Plugins) — shell provides structure plugins render into
- Phase 3 before Phases 6-9 (New Screens) — new screens are plugins
- Phase 4 (Modals) before Phase 5 (Dialogs) — dialogs build on modal patterns
- Phase 4 before Phase 10 (Command Palette) — palette is a modal

**Can parallelize**:
- Phase 4 (Modals) and Phase 3 (Plugins) — independent subsystems
- Phase 6, 7, 8, 9 (New Screens) — once Phase 3 is done, all can develop in parallel

```
Phase 1 (Shell) ──┬──▶ Phase 2 (Splash)
                  │
                  ├──▶ Phase 3 (Plugins) ──┬──▶ Phase 6 (Files/Git)
                  │                        ├──▶ Phase 7 (Agent/Chat)
                  │                        ├──▶ Phase 8 (Monitor/Workspaces)
                  │                        └──▶ Phase 9 (Onboarding)
                  │
                  └──▶ Phase 4 (Modals) ──▶ Phase 5 (Dialogs)
                                          └──▶ Phase 10 (Polish)
```

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: App Shell & Navigation | ✅ Complete | 2026-02-12 | 2026-02-12 | App shell with tab bar implemented, all 4 screens work |
| Phase 2: Splash Screen | ✅ Complete | 2026-02-12 | 2026-02-12 | Splash screen with animated prism, auto-transition after 2s or keypress |
| Phase 3: Plugin Architecture | ✅ Complete | 2026-02-12 | 2026-02-12 | Plugin interface, Registry, 4 plugins (Home, Research, Plans, Spectrum), Model slimmed from ~60 to ~15 fields |
| Phase 4: Modal System | ✅ Complete | 2026-02-12 | 2026-02-12 | Modal system with Section interface, Input/Textarea/List sections, layout engine, builder API, help modal converted |
| Phase 5: Dialog & Permissions | ✅ Complete | 2026-02-12 | 2026-02-12 | Dialog overlay with stack, ConfirmDialog, PermissionDialog (3-button approval), input routing precedence, demo key binding (P) in Spectrum |
| Phase 6: Files & Git | ✅ Complete | 2026-02-13 | 2026-02-13 | FilesPlugin with tree-view file browser (expand/collapse, preview, filter), GitPlugin with status viewer (staged/modified/untracked, diff viewer, stage/unstage, commit modal) |
| Phase 7: Agent & Chat | ✅ Complete | 2026-02-13 | 2026-02-13 | AgentPlugin with chat interface (wide/compact modes, textarea input, message renderer, demo messages), registered in NewModel |
| Phase 8: Monitor & Workspaces | ✅ Complete | 2026-02-13 | 2026-02-13 | MonitorPlugin with health dashboard (Go runtime stats, execution history, quality gates), WorkspacesPlugin with project scanner (epic selector, project switching), both registered in NewModel with demo data |
| Phase 9: Onboarding | ✅ Complete | 2026-02-13 | 2026-02-13 | OnboardingPlugin with 4-step wizard (project dir, .prism/ structure, claude CLI, stories.json), auto-detection in NewModel, removes from tab bar on completion, demo data with all steps complete |
| Phase 10: Integration & Polish | ⬜ Not started | | | |

---

## Session Notes

[Space for implementation notes, discoveries, blockers]
