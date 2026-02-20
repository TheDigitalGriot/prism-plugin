# Prism CLI + Sidecar + Crush Integration Architecture

> **Research Question**: How can Prism CLI integrate Sidecar's plugin architecture and Crush's agentic UI components to create a unified terminal dashboard?
>
> **Date**: 2026-02-12
> **Status**: Complete — Ready for Planning Phase

---

## Executive Summary

This research documents the architectural patterns of three Charmbracelet Bubble Tea applications:

1. **Prism CLI** (cmd/prism-cli/) — Current 4-screen autonomous execution monitor (Home, Research, Plans, Spectrum)
2. **Sidecar** (ref/sidecar/) — Multi-plugin development dashboard with 6 plugins (TD Monitor, Git Status, File Browser, Conversations, Workspace, Notes)
3. **Crush** (ref/crush/) — Agentic coding shell with multi-model LLM support, LSP integration, permission dialogs, and SQLite session persistence

The integration goal is to adopt Sidecar's plugin system and Crush's agentic UI components into Prism CLI while preserving its existing Spectrum execution workflow. Key findings:

- **Plugin Architecture**: Sidecar's 13-method Plugin interface with Registry, lifecycle management, graceful degradation, and message broadcasting
- **Modal System**: Sidecar's declarative builder with composable sections, focus management, scrolling, and hit region registration
- **State Machine**: Crush's enum-based state transitions with side effects (onboarding → landing → chat)
- **Session Persistence**: Crush's SQLite + pub/sub pattern for conversation state across restarts
- **Permission Workflow**: Crush's three-button approval (Allow/Session/Deny) with diff preview

Integration opportunities identified: tab-based plugin navigation, modal overlays for settings/help, permission dialogs for tool execution, and unified conversation history across AI sessions.

---

## Table of Contents

1. [Prism CLI Current Architecture](#1-prism-cli-current-architecture)
2. [Sidecar Plugin System](#2-sidecar-plugin-system)
3. [Crush Agentic UI](#3-crush-agentic-ui)
4. [Integration Patterns](#4-integration-patterns)
5. [Component Comparison Table](#5-component-comparison-table)
6. [Open Questions](#6-open-questions)

---

## 1. Prism CLI Current Architecture

### File Structure

**Core Application** (cmd/prism-cli/app/):
```
app/
├── model.go          # Model struct, AnimState, 180 lines
├── update.go         # Update handler, 701 lines, 25 message types
├── view.go           # View router, shared helpers
├── view_home.go      # Home screen (3 menu items)
├── view_research.go  # Research file browser (list + viewport)
├── view_plans.go     # Plans file browser (list + viewport + decompose)
├── view_spectrum.go  # Spectrum execution dashboard (6 sub-panels)
├── views.go          # ActiveView enum, per-view state structs
├── messages.go       # Message type definitions
└── commands.go       # Async Bubble Tea commands
```

**Supporting Packages**:
- **domain/** — Story/Plan structs, signal parsing, progress tracking
- **claude/** — Claude CLI runner, streaming output parser, event definitions
- **styles/** — Theme colors, gradient rendering
- **prism/** — 3D prism renderer using FauxGL

**Total**: ~2,500 lines Go code (app/ + domain/ + claude/)

### Model Structure

The `Model` struct at `model.go:102-180` contains:

**View System**:
- `ActiveView` (enum: Home/Research/Plans/Spectrum)
- `PrismDir` (root `.prism/` path)

**Per-View State**:
- `Home` (SelectedIndex, MenuItems)
- `Research` (Files, SelectedIdx, Viewing, Viewport)
- `Plans` (Files, SelectedIdx, Viewing, Viewport)
- `Epic` (Epics, SelectedIndex, IsLegacy)

**Execution State**:
- `State` (enum: Idle/Running/Paused/Complete/MaxIterations/Error)
- `CurrentStoryID`, `CurrentStoryTitle`, `Iteration`, `ConsecutiveErrs`

**UI Components**:
- `Spinner` (braille dots)
- `Progress` (gradient bar)
- `StoryPaginator`, `LogPaginator` (12 stories/page, 6 logs/page)

**Animation State** (`AnimState` struct, 67 lines):
- **Progress bar spring** (freq 6.0, damp 0.7) — snappy with slight overshoot
- **Story pop spring** (freq 8.0, damp 0.5) — bouncy completion animation
- **Log slide-in spring** (freq 5.0, damp 0.8) — smooth entry from right
- **Pulse/shimmer phases** — sine waves for icon brightness modulation
- **Ray spring** (freq 4.0, damp 0.3) — very bouncy, random re-targeting

### Navigation Patterns

**Screen Switching**:
```
Home (menu) ──[1/enter]──▶ Research (list) ──[enter]──▶ Research (viewer)
            ──[2/enter]──▶ Plans (list) ──[enter]──▶ Plans (viewer)
            ──[3/enter]──▶ Spectrum (idle) ──[enter]──▶ Spectrum (running)

All screens ──[esc]──▶ Home (except Spectrum during execution)
```

**Message Routing** (`update.go:54-573`):
- `tea.KeyMsg` → `handleKeyPress()` (global, then view-specific delegation)
- `tea.WindowSizeMsg` → inline (resizes Prism renderer, viewports)
- `TickMsg` (100ms) → inline animation updates
- `InitCompleteMsg` → stories loaded, populate model
- `claude.ClaudeFinishedMsg` → parse signal, reload stories
- `SignalDetectedMsg` → `handleSignal()` (Complete/Continue/Retry/Blocked/Error)

**View Rendering** (`view.go:14-31`):
```go
switch m.ActiveView {
case ViewHome:     return m.renderHomeView()
case ViewResearch: return m.renderResearchView()
case ViewPlans:    return m.renderPlansView()
case ViewSpectrum: return m.renderSpectrumView()
}
```

### Spectrum Execution Dashboard

The most complex screen, composing 6 sub-panels (`view_spectrum.go:14-38`):

1. **Epic Selector** (conditional, `>1` epic) — tabs with completion counts
2. **Header** — "PRISM TUI" | "Iteration: X/Y" | "[?] help"
3. **Progress Bar** — 3D prism + ASCII logo + gradient bar + stats
4. **Story List** (40% width) — paginated, animated icons (✓▸⊘○), status styles
5. **Activity Panel** (60% width) — current tool, recent activities, spinner
6. **Log Panel** — paginated, slide-in animation, level-colored badges
7. **Status Bar** — state icon | elapsed time | control hints

**Key rendering patterns**:
- `lipgloss.JoinVertical(lipgloss.Left, sections...)` — vertical stacking
- `lipgloss.JoinHorizontal(lipgloss.Top, ...)` — side-by-side panels
- `styles.PanelStyle` — rounded border with padding
- Shared helpers: `renderPrismLogo()`, `renderSpectrumProgressBar()`, `formatLogEntry()`

### Strengths

- ✅ Clean Elm Architecture (Model-Update-View)
- ✅ Organic spring-based animations (Harmonica)
- ✅ Real-time streaming via channel-based Claude CLI integration
- ✅ 3D prism renderer with half-block ANSI encoding
- ✅ Signal protocol for autonomous iteration control

### Limitations for Integration

- ❌ Monolithic `Model` struct (all state in one place)
- ❌ Single-view-at-a-time (no overlays or modals)
- ❌ View switching via direct field assignment (`m.ActiveView = X`)
- ❌ No plugin abstraction layer
- ❌ Hardcoded view delegation in `Update()`
- ❌ No inter-component communication pattern (everything accesses `Model` directly)

---

## 2. Sidecar Plugin System

### Architecture Overview

Sidecar implements a **plugin-based architecture** where each feature (Git Status, File Browser, TD Monitor, Workspace, Conversations, Notes) is an isolated plugin implementing a 13-method interface.

**Core files**:
- `plugin/plugin.go` (19 lines) — Plugin interface definition
- `plugin/registry.go` (174 lines) — Lifecycle management, panic recovery, graceful degradation
- `plugin/context.go` (28 lines) — Shared resources (WorkDir, Config, EventBus, Logger, Keymap, Epoch)
- `app/update.go:415-430` — Message broadcasting to all plugins

### Plugin Interface

```go
type Plugin interface {
    // Metadata
    ID() string
    Name() string
    Icon() string

    // Lifecycle
    Init(ctx *Context) error
    Start() tea.Cmd
    Stop()

    // Bubble Tea
    Update(msg tea.Msg) (Plugin, tea.Cmd)
    View(width, height int) string

    // Focus
    IsFocused() bool
    SetFocused(bool)

    // Integration
    Commands() []Command
    FocusContext() string
}
```

**Optional interfaces**:
- `TextInputConsumer` — reports whether alphanumeric keys should be treated as text input (e.g., commit message editor)
- `DiagnosticProvider` — exposes health checks for diagnostics modal

### Plugin Context

Shared resources passed to `Init()`:

```go
type Context struct {
    WorkDir     string              // Current working directory
    ProjectRoot string              // Git repo root
    ConfigDir   string              // ~/.config/sidecar
    Config      *config.Config      // Global config
    Adapters    map[string]Adapter  // AI session adapters
    EventBus    *event.Dispatcher   // Pub/sub for inter-plugin events
    Logger      *slog.Logger        // Structured logging
    Keymap      BindingRegistrar    // Dynamic keybinding registration
    Epoch       uint64              // Project switch counter (invalidates stale async messages)
}
```

### Lifecycle Management

**Registration** (`registry.go:27-43`):
```go
func (r *Registry) Register(p Plugin) error {
    if err := r.safeInit(p); err != nil {
        r.unavailable[p.ID()] = err.Error()
        r.ctx.Logger.Debug("plugin unavailable", "id", p.ID(), "reason", err)
        return nil // Silent degradation
    }
    r.plugins = append(r.plugins, p)
    return nil
}
```

**Key features**:
- Panic recovery via `defer` + `recover()`
- Failed plugins marked unavailable, do not crash app
- Thread-safe with read/write mutexes

**Project Reinit** (`registry.go:141-174`):
```go
func (r *Registry) Reinit(newWorkDir, newProjectRoot string) []tea.Cmd {
    // Stop all plugins in reverse order
    for i := len(r.plugins) - 1; i >= 0; i-- {
        r.safeStop(r.plugins[i])
    }

    // Update context
    r.ctx.WorkDir = newWorkDir
    r.ctx.ProjectRoot = newProjectRoot
    r.ctx.Epoch++ // Invalidate pending async messages

    // Reinitialize all plugins
    for _, p := range r.plugins {
        r.safeInit(p)
    }

    // Collect start commands
    cmds := make([]tea.Cmd, 0, len(r.plugins))
    for _, p := range r.plugins {
        if cmd := r.safeStart(p); cmd != nil {
            cmds = append(cmds, cmd)
        }
    }
    return cmds
}
```

### Message Broadcasting

**Pattern** (`app/update.go:415-430`):
```go
// Forward messages to ALL plugins (not just active)
plugins := m.registry.Plugins()
for i, p := range plugins {
    newPlugin, cmd := p.Update(msg)
    plugins[i] = newPlugin
    if cmd != nil {
        cmds = append(cmds, cmd)
    }
}
return m, tea.Batch(cmds...)
```

**Key aspects**:
- All plugins receive all messages
- Plugins filter messages themselves
- Enables inter-plugin communication (e.g., `NavigateToFileMsg` from Git Status to File Browser)
- Commands from all plugins collected and batched

### Epoch-Based Staleness Detection

**Pattern** (`plugin/plugin.go:76-88`):
```go
type EpochMessage interface {
    GetEpoch() uint64
}

func IsStale(ctx *Context, msg EpochMessage) bool {
    return ctx != nil && msg.GetEpoch() != ctx.Epoch
}
```

**Usage in plugins** (`gitstatus/plugin.go:447-449`):
```go
case DiffLoadedMsg:
    if plugin.IsStale(p.ctx, msg) {
        return p, nil // Ignore stale message from previous project
    }
    p.diffContent = msg.Content
    // ...
```

**Key aspects**:
- Async messages embed `Epoch uint64` field
- Epoch incremented on project switch
- Prevents bugs from async operations completing after context change

### Plugin State Isolation

**Example: Workspace Plugin** (`workspace/plugin.go:100-321`):
```go
type Plugin struct {
    ctx     *plugin.Context
    focused bool
    width   int
    height  int

    // Worktree state (isolated from other plugins)
    worktrees       []*Worktree
    agents          map[string]*Agent
    managedSessions map[string]bool

    // View state
    viewMode    ViewMode
    activePane  FocusPane
    selectedIdx int
    // ... ~300 fields
}
```

**Key aspects**:
- Each plugin maintains isolated state struct
- Shared context accessed via `p.ctx` field
- No direct plugin-to-plugin references
- State reinitialized in `Init()` for clean project switches

### Inter-Plugin Communication

**Example: Git Status → File Browser** (`gitstatus/plugin.go:1136-1144`):
```go
func (p *Plugin) openInFileBrowser(path string) tea.Cmd {
    return tea.Batch(
        app.FocusPlugin("file-browser"),
        func() tea.Msg {
            return filebrowser.NavigateToFileMsg{Path: path}
        },
    )
}
```

**Pattern**:
- Plugins send custom messages via `tea.Cmd` functions
- App-level messages (like `FocusPlugin`) handled by root model
- Plugin-specific messages (like `NavigateToFileMsg`) filtered by target plugin

### Modal System

Sidecar's modal package (`modal/modal.go`, 8 files, ~1,200 lines) implements a **declarative builder API** for composable dialogs.

**Construction**:
```go
modal.New("Confirm Action",
    modal.WithWidth(60),
    modal.WithVariant(modal.VariantDanger),
).
    AddSection(modal.Text("Are you sure?")).
    AddSection(modal.Spacer()).
    AddSection(modal.Buttons(
        modal.Btn(" Yes ", "yes"),
        modal.Btn(" No ", "no"),
    ))
```

**Section types**:
- `Text(s)` — word-wrapped static text
- `Spacer()` — blank line
- `When(conditionFn, section)` — conditional rendering
- `Custom(renderFn, updateFn)` — escape hatch
- `Buttons(btns...)` — horizontal button row
- `Checkbox(id, label, &checked)` — toggleable checkbox
- `Input(id, &textinputModel)` — text input field
- `Textarea(id, &textareaModel, height)` — multi-line editor
- `List(id, items, &selectedIdx)` — scrollable list

**Focus management**:
- Tab/Shift+Tab cycle through focusable elements
- `scrollToFocused()` auto-scrolls viewport
- Per-element hit regions for mouse clicks

**Rendering pipeline** (`layout.go:44-209`):
1. Width clamping (min 30, max screenW-4)
2. Viewport height budget (screenH - header - footer)
3. First render pass (measure content height)
4. Scrollbar decision + second pass (if content > viewport)
5. Focus position caching
6. Content assembly + viewport slicing
7. Scrollbar rendering (proportional thumb)
8. Background fill (ANSI reset artifact fix)
9. Frame assembly (title + viewport + hints + footer)
10. Modal box style (rounded border, centered)
11. Hit region registration (backdrop → body → focusables)

**Key features**:
- Two-pass rendering for scrollbar width adjustment
- Layered hit regions (last = highest priority)
- Pointer-based state binding (checkbox, input, list)
- Action string protocol for semantic responses

### Strengths

- ✅ Modular architecture (add plugins without core changes)
- ✅ Graceful degradation (failed plugins don't crash app)
- ✅ Thread-safe lifecycle management
- ✅ Epoch-based async message invalidation
- ✅ Declarative modal builder with rich components
- ✅ Inter-plugin communication via message broadcast

### Limitations

- ❌ Plugins can't directly access other plugins' state
- ❌ Message broadcasting has performance cost (all plugins process all messages)
- ❌ No built-in plugin dependency management
- ❌ Modal system is complex (~1,200 lines)

---

## 3. Crush Agentic UI

### Architecture Overview

Crush is a **multi-model agentic coding shell** with state machine-based UI transitions, permission dialogs for tool execution, SQLite session persistence, and LSP/MCP integration.

**Core files**:
- `ui/model/ui.go` (3,331 lines) — Main UI model, state machine, layout management
- `ui/dialog/permissions.go` (791 lines) — Permission approval workflow with diff preview
- `session/session.go` (100 lines) — SQLite session persistence + pub/sub
- `pubsub/broker.go` (112 lines) — Generic event bus

**Total**: ~18,000 lines Go code (internal/)

### State Machine Pattern

**States** (`ui.go:78-86`):
```go
type uiState uint8

const (
    uiOnboarding uiState = iota // Model/provider selection
    uiInitialize                // Project initialization prompt
    uiLanding                   // Working dir, model info, LSP/MCP status
    uiChat                      // Main chat interface
)
```

**Transitions** (`ui.go:341-350`):
```go
func (m *UI) setState(state uiState, focus uiFocusState) {
    if state == uiLanding {
        m.isCompact = false // Force wide mode on landing
    }
    m.state = state
    m.focus = focus
    m.updateLayoutAndSize() // Trigger layout recalculation
}
```

**State-driven rendering** (`ui.go:1837-1881`):
```go
switch m.state {
case uiOnboarding:
    m.drawHeader(scr, layout.header)
    // Dialogs render on top

case uiInitialize:
    m.drawHeader(scr, layout.header)
    main := uv.NewStyledString(m.initializeView())
    main.Draw(scr, layout.main)

case uiLanding:
    m.drawHeader(scr, layout.header)
    main := uv.NewStyledString(m.landingView())
    main.Draw(scr, layout.main)
    editor := uv.NewStyledString(m.renderEditorView(scr.Bounds().Dx()))
    editor.Draw(scr, layout.editor)

case uiChat:
    if m.isCompact {
        m.drawHeader(scr, layout.header)
    } else {
        m.drawSidebar(scr, layout.sidebar)
    }
    m.chat.Draw(scr, layout.main)
    // ... chat-specific elements
}
```

**Key aspects**:
- Typed enum states
- Combined with focus state (`uiFocusNone`, `uiFocusEditor`, `uiFocusMain`)
- Side effects handled in transition method
- Update routing by state (`ui.go:1994-2005`)

### Modal Overlay System

**Stack-based** (`dialog/dialog.go:51-213`):
```go
type Overlay struct {
    dialogs []Dialog
}

type Dialog interface {
    ID() string
    HandleMsg(msg tea.Msg) Action
    Draw(scr uv.Screen, area uv.Rectangle) *tea.Cursor
}

func (d *Overlay) OpenDialog(dialog Dialog) {
    d.dialogs = append(d.dialogs, dialog)
}

func (d *Overlay) CloseFrontDialog() {
    if len(d.dialogs) == 0 { return }
    d.removeDialog(len(d.dialogs) - 1)
}

// Only top dialog receives input
func (d *Overlay) Update(msg tea.Msg) tea.Msg {
    if len(d.dialogs) == 0 { return nil }
    idx := len(d.dialogs) - 1
    return d.dialogs[idx].HandleMsg(msg)
}

// All dialogs render in order (z-index layering)
func (d *Overlay) Draw(scr uv.Screen, area uv.Rectangle) *tea.Cursor {
    var cur *tea.Cursor
    for _, dialog := range d.dialogs {
        cur = dialog.Draw(scr, area)
    }
    return cur
}
```

**Key aspects**:
- Last-in, first-out stack
- Top dialog captures all input
- Dialogs render bottom-to-top for z-index layering
- Interface allows polymorphism (permissions, commands, sessions, models, OAuth, etc.)

### Permission Dialog Workflow

**Three-button approval** (`dialog/permissions.go:56-791`):
```go
type PermissionAction string

const (
    PermissionAllow           PermissionAction = "allow"           // Once
    PermissionAllowForSession PermissionAction = "allow_session"  // Persistent
    PermissionDeny            PermissionAction = "deny"
)

type Permissions struct {
    permission     permission.PermissionRequest
    selectedOption int // 0: Allow, 1: Allow for session, 2: Deny

    // Diff view state
    diffSplitMode        *bool
    defaultDiffSplitMode bool
    diffXOffset          int
    unifiedDiffContent   string
    splitDiffContent     string

    viewport      viewport.Model
    viewportDirty bool
}
```

**Tool-specific rendering** (`permissions.go:524-547`):
```go
func (p *Permissions) renderContent(width int) string {
    switch p.permission.ToolName {
    case tools.BashToolName:
        return p.renderBashContent(width)
    case tools.EditToolName:
        return p.renderEditContent(width)
    case tools.WriteToolName:
        return p.renderWriteContent(width)
    // ... more tool types
    default:
        return p.renderDefaultContent(width)
    }
}
```

**Diff modes** (`permissions.go:582-609`):
- Unified mode: traditional `+`/`-` line diffs
- Split mode: side-by-side before/after columns
- Toggle with `s`/`u` keys
- Caches both renders, toggles between
- Horizontal scrolling for wide diffs

**Key aspects**:
- Preview before approval (diffs, bash commands, file writes)
- Session-wide permission persistence
- Syntax highlighting for diffs
- Fullscreen toggle for large diffs
- Returns action messages to caller

### Session Persistence

**SQLite storage** (`session/session.go:31-100`):
```go
type Session struct {
    ID               string
    Title            string
    MessageCount     int64
    PromptTokens     int64
    CompletionTokens int64
    Cost             float64
    Todos            []Todo
    CreatedAt        int64
    UpdatedAt        int64
}

type service struct {
    *pubsub.Broker[Session] // Embedded pub/sub
    db *sql.DB
    q  *db.Queries
}

func (s *service) Create(ctx context.Context, title string) (Session, error) {
    dbSession, err := s.q.CreateSession(ctx, db.CreateSessionParams{
        ID:    uuid.New().String(),
        Title: title,
    })
    if err != nil { return Session{}, err }
    session := s.fromDBItem(dbSession)
    s.Publish(pubsub.CreatedEvent, session) // Notify subscribers
    return session, nil
}
```

**UI integration** (`ui.go:395-422`):
```go
case loadSessionMsg:
    m.setState(uiChat, m.focus)
    m.session = msg.session
    m.sessionFiles = msg.files
    cmds = append(cmds, m.startLSPs(msg.lspFilePaths()))

    msgs, err := m.com.App.Messages.List(context.Background(), m.session.ID)
    if err != nil {
        cmds = append(cmds, util.ReportError(err))
        break
    }
    if cmd := m.setSessionMessages(msgs); cmd != nil {
        cmds = append(cmds, cmd)
    }

    // Restore history
    m.historyReset()
    cmds = append(cmds, m.loadPromptHistory())
    m.updateLayoutAndSize()
```

**Key aspects**:
- Session metadata (tokens, cost, todos) in one table
- Messages linked by session ID
- Pub/sub notifications on lifecycle events
- Atomic load: session + messages + files
- History and LSP state restored per session

### Event Pub/Sub

**Generic broker** (`pubsub/broker.go:10-112`):
```go
type Broker[T any] struct {
    subs      map[chan Event[T]]struct{}
    mu        sync.RWMutex
    done      chan struct{}
    maxEvents int
}

type Event[T any] struct {
    Type    EventType // "created", "updated", "deleted"
    Payload T
}

// Buffered channel with auto-cleanup
func (b *Broker[T]) Subscribe(ctx context.Context) <-chan Event[T] {
    sub := make(chan Event[T], 64) // 64-item buffer
    b.subs[sub] = struct{}{}

    go func() {
        <-ctx.Done()
        delete(b.subs, sub)
        close(sub)
    }()

    return sub
}

// Non-blocking publish (drops events for slow subscribers)
func (b *Broker[T]) Publish(t EventType, payload T) {
    event := Event[T]{Type: t, Payload: payload}
    for sub := range b.subs {
        select {
        case sub <- event:
        default: // Channel full, skip event
        }
    }
}
```

**Key aspects**:
- Generic `Broker[T any]`
- Buffered channels (64 events)
- Non-blocking publish (prevents publisher stalls)
- Auto-cleanup via context cancellation
- Embedded in services (sessions, messages)

### Strengths

- ✅ State machine with side effects for complex workflows
- ✅ Stack-based modal overlay system
- ✅ Three-button permission approval with diff preview
- ✅ SQLite persistence for session state across restarts
- ✅ Generic pub/sub for cross-service communication
- ✅ Multi-model LLM support with seamless switching

### Limitations

- ❌ Large monolithic files (`ui.go` 3,331 lines)
- ❌ Complex state machine (4 states × 3 focus states = 12 combinations)
- ❌ Dialog system uses screen-space rendering (not lipgloss)
- ❌ No plugin abstraction (all features in one model)

---

## 4. Integration Patterns

### Pattern 1: Plugin-Based Prism CLI

**Adopt Sidecar's plugin architecture** to replace the monolithic Model struct.

**Current** (`model.go:102-180`):
```go
type Model struct {
    ActiveView ActiveView // Enum: Home/Research/Plans/Spectrum
    Home       HomeState
    Research   ResearchState
    Plans      PlansState
    Epic       EpicState
    // ... all state in one struct
}
```

**Proposed** (plugin-based):
```go
type Model struct {
    registry *plugin.Registry
    activePluginID string

    // Shared state
    prismDir    string
    storiesPath string
    projectDir  string

    // Prism-specific chrome
    logo   *prism.Renderer
    width  int
    height int
}

// Plugins
type HomePlugin struct { /* menu state */ }
type ResearchPlugin struct { /* file browser state */ }
type PlansPlugin struct { /* file browser + decompose state */ }
type SpectrumPlugin struct { /* execution state */ }
```

**Benefits**:
- Add new screens without modifying core `Model`
- Failed plugins don't crash app
- Clean separation of concerns
- Inter-plugin communication via messages

**Integration points**:
- `plugin/plugin.go:6-19` — Plugin interface
- `plugin/registry.go:27-174` — Lifecycle management
- `plugin/context.go:17-28` — Shared resources

### Pattern 2: Modal Overlays for Settings/Help

**Adopt Sidecar's modal system** for transient overlays.

**Use cases**:
- Help dialog (`?` key)
- Settings/preferences
- Epic selection (replace current tab bar)
- File decompose confirmation
- Error messages

**Integration**:
```go
type Model struct {
    registry *plugin.Registry
    modal    *modal.Modal // Single active modal

    // Or stack-based like Crush
    dialogs  *dialog.Overlay
}

// Example: Help modal
helpModal := modal.New("Keyboard Shortcuts",
    modal.WithWidth(70),
).
    AddSection(modal.Text("Navigation:")).
    AddSection(modal.Text("  j/k — Move cursor")).
    AddSection(modal.Text("  enter — Select item")).
    AddSection(modal.Spacer()).
    AddSection(modal.Buttons(
        modal.Btn(" Close ", "close"),
    ))
```

**Benefits**:
- Reusable dialog builder
- Focus management built-in
- Scrolling for long content
- Mouse support

**Integration points**:
- `modal/modal.go:37-49` — Construction API
- `modal/section.go:13-23` — Section interface
- `modal/layout.go:44-209` — Rendering pipeline

### Pattern 3: Permission Dialogs for Tool Execution

**Adopt Crush's permission workflow** for Spectrum story execution.

**Current**: Tools execute immediately via Claude CLI (with `--dangerously-skip-permissions`)

**Proposed**: Intercept tool calls, show approval dialog

```go
case ToolCallRequestMsg:
    // Parse tool request from Claude output
    permDialog := dialog.NewPermissions(msg.ToolName, msg.Args)

    // Show modal
    m.dialogs.OpenDialog(permDialog)

    // Wait for user action
    case ActionPermissionResponse:
        switch msg.Action {
        case PermissionAllow:
            // Execute once
        case PermissionAllowForSession:
            // Store in session allow-list
        case PermissionDeny:
            // Send denial to Claude
        }
```

**Benefits**:
- User control over agent actions
- Diff preview before file edits
- Command preview before bash execution
- Session-wide permission persistence

**Integration points**:
- `dialog/permissions.go:56-791` — Permission dialog
- `dialog/dialog.go:51-213` — Overlay system

### Pattern 4: Session Persistence for Story Progress

**Adopt Crush's SQLite pattern** for story execution history.

**Current**: `stories.json` file + `progress.md` markdown

**Proposed**: SQLite tables
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    plan_name TEXT,
    stories_path TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE iterations (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    iteration_number INTEGER,
    story_id TEXT,
    status TEXT, -- running/complete/error
    output TEXT,
    signal TEXT, -- continue/retry/blocked/error
    created_at INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    title TEXT,
    status TEXT, -- pending/in_progress/complete
    priority INTEGER,
    blocked_by TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**Benefits**:
- Query past iterations
- Filter by story/epic
- Accumulate learnings in structured format
- Pub/sub notifications on story completion

**Integration points**:
- `session/session.go:31-100` — Session service
- `pubsub/broker.go:10-112` — Event bus

### Pattern 5: Tab-Based Plugin Navigation

**Replace view switching with tab bar** (Sidecar app shell pattern).

**Current** (`view_home.go:13-67`):
```
PRISM logo
─────────
> [1] Research      Browse and create research documents
  [2] Plans         View and decompose implementation plans
  [3] Spectrum      Execute stories autonomously

  j/k navigate   enter select   q quit
```

**Proposed** (tab bar):
```
╭──────────────────────────────────────────────────────────────────────────────╮
│ Sidecar / prism-plugin [feat/spectrum-migration]                        14:32│
│                                                                              │
│ [1 Home] [2 Research] [3 Plans] [4 Spectrum] [5 Git] [6 Conversations]     │
╰──────────────────────────────────────────────────────────────────────────────╯

(Active plugin content)

╰──────────────────────────────────────────────────────────────────────────────╯
s stage · c commit · P push · ? palette · @ projects · r refresh
```

**Benefits**:
- Standard TUI navigation pattern
- Persistent tab bar (no intermediate Home screen)
- Project/branch display in header
- Footer shows active plugin commands

**Integration points**:
- `app/view.go:33-99` — Application shell layout
- `app/model.go:195-217` — Header rendering

### Pattern 6: Unified Conversation History

**Aggregate AI session adapters** (Sidecar conversations plugin pattern).

**Proposed**: Multi-adapter conversation browser

**Adapters**:
1. **Claude Code** — `~/.claude/conversations/*.jsonl`
2. **Spectrum logs** — `.prism/shared/spectrum/progress.md` + iteration history
3. **Ralph sessions** — `.prism/shared/ralph/sessions/*.json`

**UI**:
```
╭─────────────────────────────────╦──────────────────────────────────────────╮
│ CONVERSATIONS                   ║ Session: Spectrum Iteration 42           ║
│ ────────────────────────────    ║ ──────────────────────────────────────── ║
│ [All] [Claude] [Spectrum]       ║                                          ║
│                                 ║ You:                                     ║
│ ● Today (5)                     ║ Execute the next story from stories.json ║
│   Spectrum Iteration 42         ║                                          ║
│   Claude Code • 2h ago          ║ Assistant:                               ║
│   125K tokens • $0.89           ║ I'll execute STORY-013 from the plan...  ║
│                                 ║                                          ║
│   Feature Implementation        ║ [Tool] Read stories.json                 ║
│   Claude Code • 5h ago          ║ Reading: .prism/stories/stories.json     ║
│   45K tokens • $0.34            ║                                          ║
╰─────────────────────────────────╩──────────────────────────────────────────╯
```

**Benefits**:
- Search across all sessions
- Resume previous work
- Token usage analytics
- Export conversations

**Integration points**:
- `plugins/conversations/plugin.go` — Conversation browser
- `adapter/adapter.go` — Adapter interface
- `adapter/search.go` — Cross-adapter search

---

## 5. Component Comparison Table

| Feature | Prism CLI | Sidecar | Crush |
|---------|-----------|---------|-------|
| **Architecture** | Monolithic Model | Plugin-based | State machine |
| **Screen count** | 4 (Home, Research, Plans, Spectrum) | 6 plugins | 4 states (Onboarding, Initialize, Landing, Chat) |
| **Navigation** | Enum + direct assignment | Tab bar + plugin switching | State transitions |
| **Overlays** | None | Modal system (declarative builder) | Stack-based dialogs |
| **Persistence** | File-based (stories.json, progress.md) | Per-plugin state files | SQLite (sessions, messages) |
| **Communication** | Direct field access | Message broadcast + pub/sub | Pub/sub + Bubble Tea messages |
| **Animation** | Harmonica springs (6 subsystems) | Limited (pulsing, shimmer) | Limited (spinner, progress) |
| **Focus management** | Per-view key handlers | Plugin `IsFocused()` + `FocusContext()` | State-based + dialog capture |
| **Tool execution** | Direct via Claude CLI | N/A | Permission dialogs with diff preview |
| **Session history** | progress.md file | Adapter-based conversation history | SQLite sessions + messages |
| **Error handling** | Inline retry logic | Plugin panic recovery | Error state + backoff |
| **Inter-component** | Shared Model access | Message broadcast | State machine transitions |
| **Extensibility** | Hardcoded views | Add plugins without core changes | Add dialogs without core changes |
| **Complexity** | ~2,500 lines | ~20,000 lines (6 plugins) | ~18,000 lines |

---

## 6. Open Questions

### Technical

1. **Plugin state serialization**: How should plugin state be persisted across restarts? Per-plugin JSON files (Sidecar) vs. SQLite (Crush)?

2. **Message broadcast performance**: Does broadcasting all messages to all plugins create performance issues for complex plugins (e.g., Spectrum with streaming Claude output)?

3. **Modal vs. dialog**: Should we adopt Sidecar's lipgloss-based modal builder or Crush's screen-space dialog system? Lipgloss integrates better with existing Prism CLI styles.

4. **Animation integration**: Prism CLI has extensive spring-based animations (progress bar, story pop, log slide-in). How do these integrate with plugin lifecycle? Should animations be per-plugin or centralized?

5. **3D prism placement**: Where does the 3D prism renderer fit in a plugin architecture? Shared chrome? Per-plugin decoration? Removed entirely?

6. **Epoch pattern adoption**: Should Prism CLI adopt Sidecar's epoch-based async message invalidation for story execution? Current implementation has no project-switching concept.

7. **Permission granularity**: What level of tool permission control? Per-tool-type (bash, edit, read)? Per-file-pattern? Per-story?

### UX

8. **Navigation model**: Should Home screen be removed entirely (direct to tab bar)? Or kept as landing page with plugin grid?

9. **Epic switching**: Current tab bar on Spectrum screen. Move to global header? Plugin-specific control? Modal selector?

10. **Spectrum execution monitoring**: Current 6-panel dashboard is complex. Should it be split into multiple plugins (stories plugin, activity plugin, logs plugin)? Or keep as monolithic Spectrum plugin?

11. **Help system**: Global help modal vs. per-plugin help vs. command palette?

12. **Settings/preferences**: Where do settings live? Global modal? Dedicated settings plugin? Per-plugin settings sections?

### Architecture

13. **Plugin dependencies**: Should plugins declare dependencies (e.g., Spectrum depends on Stories, Plans depends on Research)? Or remain fully isolated?

14. **Shared components**: Which components should be shared across plugins? Prism logo? Progress bar? Paginator? Viewport?

15. **Plugin initialization order**: Does registration order matter? Should some plugins (e.g., Git) initialize before others (e.g., Workspace)?

16. **Message namespacing**: Should plugin messages be namespaced (e.g., `spectrum.StoryStartedMsg`) to avoid collisions? Or rely on unique message types?

---

## File Reference Index

### Prism CLI Core

| File | Lines | Purpose |
|------|-------|---------|
| `cmd/prism-cli/app/model.go` | 264 | Model struct, AnimState, initialization |
| `cmd/prism-cli/app/update.go` | 701 | Update handler, message routing, state transitions |
| `cmd/prism-cli/app/view.go` | 127 | View router, shared helpers |
| `cmd/prism-cli/app/view_home.go` | 127 | Home screen renderer |
| `cmd/prism-cli/app/view_research.go` | 97 | Research file browser |
| `cmd/prism-cli/app/view_plans.go` | 104 | Plans file browser + decompose |
| `cmd/prism-cli/app/view_spectrum.go` | 487 | Spectrum execution dashboard |
| `cmd/prism-cli/app/views.go` | 77 | ActiveView enum, per-view state structs |
| `cmd/prism-cli/app/messages.go` | 159 | Message type definitions |
| `cmd/prism-cli/app/commands.go` | 274 | Async Bubble Tea commands |

### Sidecar Plugin System

| File | Lines | Purpose |
|------|-------|---------|
| `ref/sidecar/internal/plugin/plugin.go` | 88 | Plugin interface, optional interfaces, messages |
| `ref/sidecar/internal/plugin/registry.go` | 174 | Lifecycle management, panic recovery, reinit |
| `ref/sidecar/internal/plugin/context.go` | 28 | Shared plugin resources |
| `ref/sidecar/internal/modal/modal.go` | 258 | Modal construction, key/mouse handling |
| `ref/sidecar/internal/modal/layout.go` | 369 | Rendering pipeline, scrollbar, hit regions |
| `ref/sidecar/internal/modal/section.go` | 416 | Section interface, Text, Spacer, When, Custom, Buttons, Checkbox |
| `ref/sidecar/internal/modal/input.go` | 294 | Input, Textarea sections |
| `ref/sidecar/internal/modal/list.go` | 243 | List section with scrolling |
| `ref/sidecar/internal/app/update.go` | 430 | Message broadcasting to plugins |

### Crush Agentic UI

| File | Lines | Purpose |
|------|-------|---------|
| `ref/crush/internal/ui/model/ui.go` | 3,331 | Main UI model, state machine, layout |
| `ref/crush/internal/ui/model/onboarding.go` | 115 | Onboarding state |
| `ref/crush/internal/ui/model/landing.go` | 50 | Landing state |
| `ref/crush/internal/ui/model/chat.go` | 861 | Chat model, animation, mouse handling |
| `ref/crush/internal/ui/dialog/dialog.go` | 213 | Overlay stack, Dialog interface |
| `ref/crush/internal/ui/dialog/permissions.go` | 791 | Permission approval workflow |
| `ref/crush/internal/session/session.go` | 100 | SQLite session persistence |
| `ref/crush/internal/pubsub/broker.go` | 112 | Generic event bus |

---

## Next Steps

1. **Create integration plan** in `.prism/shared/plans/2026-02-12-sidecar-crush-integration.md`
2. **Design plugin adapter layer** for Prism CLI
3. **Prototype modal system** integration
4. **Evaluate SQLite migration** for story persistence
5. **Map existing screens to plugins** (Home → HomePlugin, Research → ResearchPlugin, etc.)
6. **Identify shared components** (logo, progress bar, styles)
7. **Design inter-plugin messages** (story completion, epic selection, file navigation)
8. **Plan gradual migration path** (keep existing screens working during plugin migration)

---

*Research completed: 2026-02-12*
*Agent IDs: a137c8a (thoughts-locator), ac5d1c4 (codebase-locator/prism), ad6f6b6 (codebase-locator/sidecar), a84dd52 (codebase-locator/crush), a7b7cfb (codebase-analyzer/prism-model), a2b0cbe (codebase-analyzer/prism-view), abc283d (pattern-finder/sidecar), a8d072e (pattern-finder/crush), a7cedad (analyzer/sidecar-modal)*
