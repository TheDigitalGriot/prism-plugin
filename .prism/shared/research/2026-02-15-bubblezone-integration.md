# Research: BubbleZone Mouse Event Integration for Prism CLI

**Date**: 2026-02-15
**Researcher**: Claude (Prism Research Phase)
**Status**: Complete

## Research Question

How can we integrate BubbleZone (github.com/lrstanley/bubblezone) mouse event tracking into the prism-cli Go application to enable clickable UI elements (tabs, buttons, list items, etc.)?

## Summary

BubbleZone is a Go library that enables mouse click detection in Bubble Tea applications using zero-width ANSI markers. The prism-cli currently uses keyboard-only navigation across all UI elements. Integration requires: (1) initializing a global zone manager, (2) enabling mouse events in the Bubble Tea program, (3) wrapping clickable content with `zone.Mark()` during rendering, (4) calling `zone.Scan()` at the root View, and (5) handling `tea.MouseMsg` in Update methods to detect clicks via `zone.Get(id).InBounds(msg)`. The codebase has extensive keyboard navigation patterns (tabs, modals, lists) that can be enhanced with mouse support, and the Sidecar reference codebase provides production examples of hit-region-based mouse handling in similar Bubble Tea applications.

## Existing Knowledge

### Previous Research Documents

1. **`.prism/shared/research/2026-02-12-prism-cli-deep-dive.md`** (1,300 lines)
   - Comprehensive documentation of prism-cli architecture
   - Bubble Tea Elm architecture implementation
   - 4 main screens: Home, Research, Plans, Spectrum
   - Plugin system with 10 plugins
   - Modal/dialog overlay system
   - **No mouse handling currently implemented**

2. **`.prism/shared/research/2026-02-12-prism-cli-sidecar-crush-integration-architecture.md`** (1,150 lines)
   - Comparative analysis: Prism CLI vs Sidecar vs Crush
   - Sidecar has extensive mouse handling with hit regions
   - Modal system with focus management
   - **Sidecar reference implementation in `ref/sidecar/`** provides production mouse handling patterns

### Incomplete Work

**`.prism/shared/plans/2026-02-13-ide-theme-integration.md`** - IDE theme color integration plan (4 phases, uncompleted). Not directly related to mouse handling, but shows active development on TUI features.

## Files Discovered

### Core TUI Files

| File Path | Purpose | Lines |
|-----------|---------|-------|
| `cmd/prism-cli/main.go` | Entry point, Cobra CLI, tea.NewProgram() initialization | 157 |
| `cmd/prism-cli/app/model.go` | Model struct, AppState enum, plugin registry | 558 |
| `cmd/prism-cli/app/update.go` | Update() method, message routing, keyboard handling | 623 |
| `cmd/prism-cli/app/view.go` | View() method, overlay compositing | 235 |
| `cmd/prism-cli/app/shell.go` | App shell rendering (tabs, footer, sidebar) | 203+ |
| `cmd/prism-cli/app/sidebar.go` | Right sidebar with project info, files, quality gates | 441 |

### Plugin System

| File Path | Purpose | Lines |
|-----------|---------|-------|
| `cmd/prism-cli/plugin/plugin.go` | Plugin interface definition (10 methods) | 42+ |
| `cmd/prism-cli/plugin/registry.go` | Plugin lifecycle management, message broadcasting | 169 |
| `cmd/prism-cli/plugin/events.go` | Event bus for inter-plugin communication | 128 |
| `cmd/prism-cli/plugin/messages.go` | FocusPluginMsg, PluginResizeMsg | 15 |

### Plugin Implementations (10 plugins)

| File Path | Plugin | Purpose |
|-----------|--------|---------|
| `cmd/prism-cli/app/plugin_home.go` | HomePlugin | Dashboard with menu items |
| `cmd/prism-cli/app/plugin_spectrum.go` | SpectrumPlugin | Story execution monitoring |
| `cmd/prism-cli/app/plugin_research.go` | ResearchPlugin | Research document browser |
| `cmd/prism-cli/app/plugin_plans.go` | PlansPlugin | Implementation plan viewer |
| `cmd/prism-cli/app/plugin_files.go` | FilesPlugin | File browser with git status |
| `cmd/prism-cli/app/plugin_git.go` | GitPlugin | Git status and diff viewing |
| `cmd/prism-cli/app/plugin_agent.go` | AgentPlugin | Agent monitoring |
| `cmd/prism-cli/app/plugin_monitor.go` | MonitorPlugin | System monitoring |
| `cmd/prism-cli/app/plugin_workspaces.go` | WorkspacesPlugin | Workspace management |
| `cmd/prism-cli/app/plugin_onboarding.go` | OnboardingPlugin | Setup wizard |

### Modal/Dialog System

| File Path | Purpose | Lines |
|-----------|---------|-------|
| `cmd/prism-cli/modal/modal.go` | Modal struct, keyboard handling, focus management | 280+ |
| `cmd/prism-cli/modal/section.go` | Section interface, TextSection, ButtonsSection, etc. | 332+ |
| `cmd/prism-cli/modal/list.go` | Scrollable list section with selection | 240+ |
| `cmd/prism-cli/modal/input.go` | Input and textarea sections | 285+ |
| `cmd/prism-cli/dialog/dialog.go` | Dialog interface, Overlay stack manager | 107 |
| `cmd/prism-cli/dialog/confirm.go` | Confirmation dialog | 235 |
| `cmd/prism-cli/dialog/permissions.go` | Permission request dialog | 258 |

### Dependencies (go.mod)

| Dependency | Version | Purpose |
|------------|---------|---------|
| charmbracelet/bubbletea | v1.2.4 | TUI framework (tea.Model, tea.Msg, tea.Cmd) |
| charmbracelet/bubbles | v0.20.0 | UI components (list, textinput, textarea) |
| charmbracelet/lipgloss | v1.0.0 | Styling and layout |
| charmbracelet/harmonica | v0.2.0 | Spring physics animations |

**Note**: BubbleZone is NOT currently a dependency and would need to be added.

## Component Analysis

### 1. Current Bubble Tea Architecture

#### Model Structure (`cmd/prism-cli/app/model.go:87-128`)

The `Model` struct contains:
- **Plugin System**: `Registry *plugin.Registry` - manages 10 registered plugins
- **View System**: `ActiveView ActiveView` enum, `TabOrder []ActiveView` for tab bar ordering
- **Configuration**: Paths (PrismDir, StoriesPath, etc.), PrismStyle, MaxIterations
- **UI State**: Width/Height, ShowHelp, ForceSidebarOff, ActiveModal, Dialogs, Ready flags
- **Animation State**: `Prism *prism.Renderer` (3D prism), `Splash *splash.Model`, `Anim AnimState` (rays, shimmer)
- **Demo Mode**: `DemoMode bool` for testing

**Key Insight**: No mouse-related state currently exists. We'll need to add BubbleZone manager reference.

#### Message Routing (`cmd/prism-cli/app/update.go:48-183`)

The `Update()` method handles:
- `tea.KeyMsg` → `handleKeyPress()` (priority chain: splash → quit → dialog → modal → global keys → plugin)
- `tea.WindowSizeMsg` → Updates dimensions, resizes Prism, broadcasts to plugins
- `TickMsg` → Advances animations, broadcasts to all plugins
- `SplashDoneMsg`, `NavigateToViewMsg`, `OpenDialogMsg`, `OpenModalMsg` → State transitions
- `default` → Broadcasts to all plugins via `Registry.Broadcast()`

**Critical Finding**: **No `tea.MouseMsg` handler exists anywhere in the codebase.**

#### View Rendering (`cmd/prism-cli/app/view.go:15-67`)

Rendering pipeline:
1. Lifecycle guards: Splash fullscreen or Onboarding fullscreen
2. Calculate content width (subtract sidebar width if visible)
3. Get plugin content: `active.View(contentWidth, m.Height)`
4. Wrap in app shell: `renderAppShell()` (tabs + content + footer ± sidebar)
5. Composite modal overlay if `ActiveModal != nil`
6. Composite dialog overlay if `Dialogs.HasDialogs()`
7. Prepend `\x1b(B` charset reset

**Critical Finding**: **No `zone.Scan()` call exists.** This is where we'd need to intercept final output.

### 2. Plugin System Architecture

#### Plugin Interface (`cmd/prism-cli/plugin/plugin.go:7-42`)

All plugins implement:
```go
type Plugin interface {
    ID() string
    Name() string
    Icon() string
    Init(ctx *Context) error
    Start() tea.Cmd
    Stop()
    Update(msg tea.Msg) (Plugin, tea.Cmd)  // Receives all messages including future MouseMsg
    View(width, height int) string         // Renders content that could contain zones
    IsFocused() bool
    SetFocused(focused bool)
    KeyHints() []KeyHint
}
```

**Key Insight**: Plugin.Update() already receives `tea.Msg` generically. Adding MouseMsg handling requires no interface changes.

#### Registry Broadcasting (`cmd/prism-cli/plugin/registry.go:118-133`)

`Registry.Broadcast(msg)` sends messages to ALL plugins, not just the active one. Each plugin's Update is called, and the returned plugin instance replaces the old one in the registry's slice and map.

**Implication**: All plugins could receive MouseMsg events and check for their own zones, or we route only to the active plugin.

### 3. Keyboard Navigation Patterns

Extensive keyboard navigation patterns exist throughout the codebase:

#### Pattern: Arrow Key Navigation (`cmd/prism-cli/app/plugin_files.go:249-261`)

```go
case "j", "down":
    if p.state.SelectedIdx < len(p.state.FlatList)-1 {
        p.state.SelectedIdx++
        return p, p.loadPreview()
    }
case "k", "up":
    if p.state.SelectedIdx > 0 {
        p.state.SelectedIdx--
        return p, p.loadPreview()
    }
```

**Mouse Enhancement**: Could detect clicks on list items to set SelectedIdx directly.

#### Pattern: Tab/Shift+Tab Cycling (`cmd/prism-cli/modal/modal.go:125-131`)

```go
case "tab":
    m.cycleFocus(1)
case "shift+tab":
    m.cycleFocus(-1)

func (m *Modal) cycleFocus(delta int) {
    m.focusIdx = (m.focusIdx + delta + len(m.focusIDs)) % len(m.focusIDs)
}
```

**Mouse Enhancement**: Could click directly on buttons/inputs to focus them.

#### Pattern: Number Keys for Tab Switching (`cmd/prism-cli/app/update.go:305-342`)

```go
case "1":
    if len(m.TabOrder) >= 1 {
        return m.switchToTab(0)
    }
```

**Mouse Enhancement**: Click tabs directly in the tab bar to switch.

### 4. Modal Focus Management

#### Two-Pass Rendering (`cmd/prism-cli/modal/layout.go:15-165`)

1. **Pass 1**: Render each section, collect `focusIDs` list
2. **Pass 2**: Join content, apply scroll viewport, add scrollbar

**Key Pattern**: `focusIDs []string` is rebuilt on every render based on which sections are visible/enabled.

**BubbleZone Integration**: Each focusable element (button, input, list) could be wrapped with `zone.Mark(focusID, content)`.

#### Keyboard Routing (`cmd/prism-cli/modal/modal.go:118-167`)

- `esc` returns `"cancel"`
- `tab`/`shift+tab` cycles focus
- `up`/`down`/`j`/`k` scrolls modal content
- `enter` routes to `routeToFocusedSection()`
- Other keys route to the section owning `focusIDs[focusIdx]`

**Mouse Enhancement**: `tea.MouseMsg` could check `zone.Get(buttonID).InBounds(msg)` for all buttons, set focus, and trigger action.

## BubbleZone Integration Patterns

### 1. Core API Overview

**Global Manager Initialization** (before tea.NewProgram):
```go
import "github.com/lrstanley/bubblezone"

func main() {
    zone.NewGlobal()

    p := tea.NewProgram(
        initialModel,
        tea.WithAltScreen(),
        tea.WithMouseCellMotion(),  // Required for mouse events
    )
    p.Run()
}
```

**Zone Marking in View** (wrap clickable content):
```go
func (m model) View() string {
    button := lipgloss.NewStyle().Render("OK")
    markedButton := zone.Mark("confirm-button", button)

    content := lipgloss.JoinVertical(lipgloss.Left,
        "Are you sure?",
        markedButton,
    )

    return zone.Scan(m.style.Render(content))  // MUST scan at root
}
```

**Mouse Event Handling in Update**:
```go
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.MouseMsg:
        if msg.Action == tea.MouseActionRelease &&
           msg.Button == tea.MouseButtonLeft {
            if zone.Get("confirm-button").InBounds(msg) {
                // Handle click
                return m, confirmCmd()
            }
        }
    }
    return m, nil
}
```

### 2. Key BubbleZone Functions

| Function | Purpose | Called From |
|----------|---------|-------------|
| `zone.NewGlobal()` | Initialize global manager | main() before tea.NewProgram() |
| `zone.Mark(id, content)` | Wrap clickable area with zero-width markers | View methods (plugins, modals, shell) |
| `zone.Scan(output)` | Parse zones, register coordinates, strip markers | Root Model.View() only |
| `zone.Get(id)` | Retrieve zone info by ID | Update methods handling MouseMsg |
| `zone.Clear(id)` | Remove zone registration | Cleanup when components unmount |
| `zone.NewPrefix()` | Generate unique prefix for child components | Plugin/component constructors |

### 3. Mouse Event Types

**MouseAction** (from `tea.MouseMsg.Action`):
- `tea.MouseActionPress` - Button pressed down
- `tea.MouseActionRelease` - Button released (most common for clicks)
- `tea.MouseActionMotion` - Mouse moved (with or without button held)

**MouseButton** (from `tea.MouseMsg.Button`):
- `tea.MouseButtonLeft` - Left click
- `tea.MouseButtonRight` - Right click
- `tea.MouseButtonMiddle` - Middle click
- `tea.MouseButtonWheelUp` / `WheelDown` - Scroll events
- `tea.MouseButtonWheelLeft` / `WheelRight` - Horizontal scroll

**Common Pattern - Click Detection**:
```go
if msg.Action == tea.MouseActionRelease && msg.Button == tea.MouseButtonLeft {
    // Handle left click
}
```

### 4. ZoneInfo API

```go
type ZoneInfo struct {
    StartX int  // Top-left X (0-based)
    StartY int  // Top-left Y (0-based)
    EndX   int  // Bottom-right X (0-based)
    EndY   int  // Bottom-right Y (0-based)
}
```

**Methods**:
- `InBounds(msg tea.MouseMsg) bool` - Check if mouse event is within zone
- `Pos(msg tea.MouseMsg) (x, y int)` - Get relative coordinates within zone (0,0 = top-left)
- `IsZero() bool` - Check if zone has been registered yet

### 5. Best Practices

**Zone ID Uniqueness**:
- Use `zone.NewPrefix()` for reusable components to prevent ID collisions
- Descriptive IDs for debugging: `"sidebar-settings-button"` not `"btn1"`

**Width Calculations**:
- ALWAYS use `lipgloss.Width()` instead of `len()` for strings with zones
- Zone markers are zero-width ANSI sequences invisible to proper width functions

**Layout Constraints**:
- Avoid `MaxHeight()`/`MaxWidth()` on marked content (hard-trimming breaks markers)
- Keep zones within natural viewport boundaries

**Scan Location**:
- Only call `zone.Scan()` once in root model's View() method
- NEVER call zone.Scan() in child components

## Reference Implementation: Sidecar Mouse Handling

The Sidecar codebase (`ref/sidecar/`) provides production-quality mouse handling patterns we can model after.

### Hit Region Pattern (`ref/sidecar/internal/mouse/mouse.go:98-129`)

Sidecar uses a custom HitMap system (similar to BubbleZone but predates it):

```go
type HitMap struct {
    regions []Region
}

type Region struct {
    ID   string
    Rect Rect   // X1, Y1, X2, Y2
    Data any    // Stores index, path, or other context
}

// Add region during rendering
func (h *HitMap) Add(id string, rect Rect, data any) {
    h.regions = append(h.regions, Region{ID: id, Rect: rect, Data: data})
}

// Test click location (reverse order for z-index)
func (h *HitMap) Test(x, y int) *Region {
    for i := len(h.regions) - 1; i >= 0; i-- {
        if h.regions[i].Rect.Contains(x, y) {
            return &h.regions[i]
        }
    }
    return nil
}
```

**Key Insight**: BubbleZone provides this functionality automatically through zone.Mark/zone.Get. We can leverage Sidecar's **routing patterns** without reimplementing HitMap.

### Mouse Scroll Handling (`ref/sidecar/internal/plugins/gitstatus/mouse.go:210-263`)

```go
func (p *Plugin) handleMouseScroll(action mouse.MouseAction) (*Plugin, tea.Cmd) {
    if action.Region == nil {
        // Fallback: scroll based on X position
        if action.X < p.sidebarWidth+2 {
            return p.scrollSidebar(action.Delta)
        }
        return p.scrollDiffPane(action.Delta)
    }

    switch action.Region.ID {
    case regionSidebar:
        return p.scrollSidebar(action.Delta)
    case regionDiffPane:
        return p.scrollDiffPane(action.Delta)
    }
    return p, nil
}

func (p *Plugin) scrollSidebar(delta int) (*Plugin, tea.Cmd) {
    newCursor := p.cursor + delta  // Delta is typically -3 or +3
    newCursor = clamp(newCursor, 0, totalItems-1)
    if newCursor != p.cursor {
        p.cursor = newCursor
        p.ensureCursorVisible()
    }
    return p, nil
}
```

**Adaptation for Prism CLI**:
- Use `tea.MouseButtonWheelUp`/`WheelDown` instead of action.Delta
- Check `zone.Get("list-area").InBounds(msg)` to determine which pane to scroll
- Update cursor/scroll offset directly

### Double-Click Detection (`ref/sidecar/internal/mouse/mouse.go:104-129`)

```go
type Handler struct {
    lastClickTime   time.Time
    lastClickRegion string
}

func (h *Handler) HandleClick(x, y int) ClickResult {
    region := h.HitMap.Test(x, y)
    result := ClickResult{Region: region}

    if region != nil {
        now := time.Now()
        if region.ID == h.lastClickRegion &&
           now.Sub(h.lastClickTime) < 400*time.Millisecond {
            result.IsDoubleClick = true
            h.lastClickRegion = ""  // Reset
        } else {
            h.lastClickRegion = region.ID
            h.lastClickTime = now
        }
    }
    return result
}
```

**Use Case for Prism CLI**:
- Double-click list items to open/expand (e.g., files, stories)
- Single-click for selection, double-click for action

## Integration Strategy

### Phase 1: Core Setup (Foundation)

**Files to Modify**:
- `cmd/prism-cli/main.go` - Add `zone.NewGlobal()` before tea.NewProgram
- `cmd/prism-cli/main.go` - Add `tea.WithMouseCellMotion()` to program options
- `cmd/prism-cli/go.mod` - Add `github.com/lrstanley/bubblezone` dependency
- `cmd/prism-cli/app/view.go:66` - Wrap final output with `zone.Scan()`

**Verification**: No errors, mouse events start arriving in Update (can add debug logging).

### Phase 2: Tab Bar Clicks

**Files to Modify**:
- `cmd/prism-cli/app/shell.go:124-175` - Wrap each tab with `zone.Mark(tabID, renderedTab)`
- `cmd/prism-cli/app/update.go:48` - Add `case tea.MouseMsg:` before default case
- `cmd/prism-cli/app/update.go` - Check `zone.Get("tab-X").InBounds(msg)` and switch tabs

**Verification**: Clicking tabs switches active view.

### Phase 3: Modal Button Clicks

**Files to Modify**:
- `cmd/prism-cli/modal/section.go:138-238` - ButtonsSection: wrap each button with `zone.Mark(buttonID, content)`
- `cmd/prism-cli/modal/modal.go:118` - Add MouseMsg handler that checks button zones and returns action
- `cmd/prism-cli/app/update.go:237` - Route modal MouseMsg before keyboard handling

**Verification**: Clicking modal buttons triggers actions (confirm, cancel).

### Phase 4: List Item Clicks

**Files to Modify**:
- `cmd/prism-cli/modal/list.go:108-128` - Wrap each visible item with `zone.Mark(itemID, line)`
- `cmd/prism-cli/modal/list.go` - Handle MouseMsg to detect item clicks and update selection
- `cmd/prism-cli/app/plugin_files.go:319` - Similar for file tree items

**Verification**: Clicking list items selects them.

### Phase 5: Scroll Wheel Support

**Files to Modify**:
- All list-based components - Check MouseButtonWheelUp/WheelDown events
- Update scroll offset or cursor position
- Call existing scroll/navigation logic

**Verification**: Mouse wheel scrolls lists and file trees.

## Open Questions

### Technical Questions

1. **Zone ID Collision Prevention**: Should each plugin use `zone.NewPrefix()` to namespace their zone IDs, or use a convention like `"pluginID:elementID"`?

2. **Mouse Event Routing**: Should we broadcast MouseMsg to all plugins (allowing any plugin to check zones), or only route to the active plugin?

3. **Double-Click Implementation**: Should we add double-click detection to Modal/List components, or is single-click selection sufficient for v1?

4. **Hover States**: Should we implement hover highlighting (MouseActionMotion) for buttons/tabs, or keep it simple with click-only?

5. **Scroll Region Detection**: For scroll events, should we rely on zone.Get().InBounds() to determine which pane to scroll, or use X/Y position fallback like Sidecar?

### UX Questions

6. **Keyboard + Mouse Hybrid**: When a user clicks a list item, should we also move keyboard focus to match, or keep them independent?

7. **Visual Feedback**: Should clickable elements have different styling (underline, color change) to indicate they're mouse-interactive, or rely on existing focus styles?

8. **Accessibility**: Should mouse clicks on focusable elements (buttons, inputs) update the modal's focusIdx to maintain keyboard navigation consistency?

### Performance Questions

9. **Zone Registration Overhead**: With potentially dozens of zones (list items, buttons, tabs), does `zone.Scan()` on every render have measurable performance impact?

10. **Zone Cleanup**: Should we explicitly call `zone.Clear(id)` when components unmount, or rely on the next render to replace zones?

## Related Files & References

### Documentation

- [BubbleZone GitHub Repository](https://github.com/lrstanley/bubblezone)
- [BubbleZone pkg.go.dev API](https://pkg.go.dev/github.com/lrstanley/bubblezone)
- [BubbleZone List Example](https://github.com/lrstanley/bubblezone/blob/master/examples/list-default/main.go)
- [Bubble Tea Mouse Events](https://github.com/charmbracelet/bubbletea/blob/main/mouse.go)

### Reference Codebases

- `ref/sidecar/internal/mouse/` - HitMap and Handler implementations
- `ref/sidecar/internal/plugins/workspace/mouse.go:454-680` - Region-based click routing
- `ref/sidecar/internal/plugins/filebrowser/mouse.go:245-362` - File browser mouse handling with double-click

### Prism CLI Key Files

- `cmd/prism-cli/app/model.go` - Add zone manager reference
- `cmd/prism-cli/app/update.go:48` - Add MouseMsg handler
- `cmd/prism-cli/app/view.go:66` - Add zone.Scan() call
- `cmd/prism-cli/app/shell.go:124-175` - Tab bar zone marking
- `cmd/prism-cli/modal/modal.go:118` - Modal MouseMsg routing
- `cmd/prism-cli/modal/section.go` - Button/list zone marking

## Next Steps

This research phase is complete. The findings document:

1. **Current State**: No mouse handling exists; all navigation is keyboard-only
2. **BubbleZone API**: Comprehensive understanding of zone.Mark/Scan/Get patterns
3. **Integration Points**: Identified 5 phases: setup, tabs, modals, lists, scroll
4. **Reference Patterns**: Sidecar provides production mouse handling examples
5. **Open Questions**: 10 questions to resolve during planning

**Recommended Next Phase**: Create an implementation plan that:
- Resolves the 10 open questions
- Defines precise file changes for each phase
- Establishes success criteria (automated + manual verification)
- Considers risks (breaking keyboard navigation, performance)

**Command to Proceed**:
```bash
/prism-plan
```

Or if you want to start implementing immediately with default assumptions:
```bash
/prism-implement
```
