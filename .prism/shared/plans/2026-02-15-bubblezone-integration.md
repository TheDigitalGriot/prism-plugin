# Plan: BubbleZone Mouse Event Integration for Prism TUI

**Date**: 2026-02-15
**Status**: Approved
**Research**: `.prism/shared/research/2026-02-15-bubblezone-integration.md`

## Goal

Add mouse event tracking to prism-tui via BubbleZone (`github.com/lrstanley/bubblezone`), enabling clickable tabs, modal buttons, list items, and scroll wheel support while preserving all existing keyboard navigation.

## Scope

### In Scope (v1)
- BubbleZone dependency and initialization
- Clickable tab bar
- Clickable modal buttons (ButtonsSection)
- Clickable modal list items (ListSection)
- Clickable dialog buttons (ConfirmDialog, PermissionDialog)
- Scroll wheel support in modals and lists
- Mouse + keyboard sync (clicking updates focusIdx/selectedIdx)

### Out of Scope (v2+)
- Hover highlighting / rollover effects
- Double-click detection
- Drag-to-resize sidebar
- Right-click context menus
- Mouse interaction during splash screen
- Per-plugin mouse.go files
- Clickable sidebar items
- Clickable home menu items (defer to after v1 validation)

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Zone IDs: `"tab-0"`, `"btn-confirm"`, `"list-item-3"` convention | Simple, no collisions at this scale |
| 2 | Route MouseMsg to active plugin only (not broadcast) | Only active plugin's zones are visible |
| 3 | `tea.WithMouseCellMotion()` not `WithMouseAllMotion()` | Reduces event volume; hover deferred |
| 4 | `zone.Scan()` at root View only | BubbleZone requirement |
| 5 | Click updates focusIdx/selectedIdx | Keeps keyboard + mouse in sync |
| 6 | No explicit `zone.Clear()` | Scan() replaces zones each frame |

## Phase 1: Foundation

**Goal**: Add BubbleZone dependency, initialize zone manager, enable mouse events, wire `zone.Scan()` into root View, add `tea.MouseMsg` routing skeleton.

### Steps

#### 1.1 Add dependency

```bash
cd cmd/prism-tui && go get github.com/lrstanley/bubblezone
```

#### 1.2 Initialize zone manager in `main.go`

Add import and `zone.NewGlobal()` before both `tea.NewProgram` calls. Add `tea.WithMouseCellMotion()` to both program constructors.

**File**: `cmd/prism-tui/main.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

At line 109 (production mode), change:
```go
p := tea.NewProgram(model, tea.WithAltScreen())
```
to:
```go
zone.NewGlobal()
p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
```

At line 146 (demo mode), change:
```go
p := tea.NewProgram(model, tea.WithAltScreen())
```
to:
```go
zone.NewGlobal()
p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
```

#### 1.3 Add `zone.Scan()` to root View

**File**: `cmd/prism-tui/app/view.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

At line 66, change:
```go
return "\x1b(B" + base
```
to:
```go
return "\x1b(B" + zone.Scan(base)
```

**Critical**: The `\x1b(B` charset reset MUST be outside `zone.Scan()` — it resets the terminal G0 charset and must not be inside the scanned content.

#### 1.4 Add `tea.MouseMsg` handler in Update

**File**: `cmd/prism-tui/app/update.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

In the `Update()` method, add a new case between `case tea.KeyMsg:` (line 52) and `case tea.WindowSizeMsg:` (line 55):

```go
case tea.MouseMsg:
    return m.handleMouseEvent(msg)
```

Add new method `handleMouseEvent`:

```go
// handleMouseEvent handles mouse clicks, scroll wheel, and motion events.
// Follows the same priority chain as keyboard: splash → dialog → modal → app-level → plugin.
func (m Model) handleMouseEvent(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
    // Ignore mouse during splash
    if !m.SplashDone {
        return m, nil
    }

    // Ignore mouse during onboarding
    if m.ActiveView == ViewOnboarding && !m.OnboardingDone {
        return m, nil
    }

    // Handle scroll wheel globally (doesn't need zone detection)
    if msg.Button == tea.MouseButtonWheelUp || msg.Button == tea.MouseButtonWheelDown {
        return m.handleScrollWheel(msg)
    }

    // Only process left-click release (standard click)
    if msg.Action != tea.MouseActionRelease || msg.Button != tea.MouseButtonLeft {
        return m, nil
    }

    // Priority 1: Dialog clicks
    if m.Dialogs.HasDialogs() {
        // TODO Phase 3: route to dialog
        return m, nil
    }

    // Priority 2: Modal clicks
    if m.ActiveModal != nil {
        // TODO Phase 3: route to modal
        return m, nil
    }

    // Priority 3: App-level zones (tabs)
    // TODO Phase 2: check tab zones

    // Priority 4: Delegate to active plugin
    return m.delegateToActivePlugin(msg)
}

// handleScrollWheel routes scroll wheel events to the appropriate component.
func (m Model) handleScrollWheel(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
    // Priority 1: Modal scroll
    if m.ActiveModal != nil {
        // TODO Phase 5: modal scroll
        return m, nil
    }

    // Priority 2: Dialog scroll
    if m.Dialogs.HasDialogs() {
        return m, nil
    }

    // Priority 3: Delegate to active plugin
    return m.delegateToActivePlugin(msg)
}
```

### Phase 1 Verification

- [x] `cd cmd/prism-tui && go build ./...` compiles without errors
- [x] `cd cmd/prism-tui && go test ./...` passes
- [ ] Run `prism-tui --demo` — UI renders identically to before (no visual changes)
- [ ] Mouse events arrive (add temporary log or check that clicking doesn't crash)

---

## Phase 2: Tab Bar Clicks

**Goal**: Wrap tab labels with `zone.Mark()` so clicking a tab switches the active view.

### Steps

#### 2.1 Mark tabs with zones in `shell.go`

**File**: `cmd/prism-tui/app/shell.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

In `renderBorderedTabBar()` at line 161, change:
```go
renderedTabs = append(renderedTabs, style.Render(label))
```
to:
```go
tabZoneID := fmt.Sprintf("tab-%d", i)
renderedTabs = append(renderedTabs, zone.Mark(tabZoneID, style.Render(label)))
```

In `renderCompactTabBar()` at lines 191-193, change the active/inactive rendering to also mark:
```go
if isActive {
    parts = append(parts, zone.Mark(fmt.Sprintf("tab-%d", i), styles.CurrentStyle.Bold(true).Render(label)))
} else {
    parts = append(parts, zone.Mark(fmt.Sprintf("tab-%d", i), styles.DimStyle.Render(label)))
}
```

#### 2.2 Detect tab clicks in handleMouseEvent

**File**: `cmd/prism-tui/app/update.go`

Replace the `// TODO Phase 2: check tab zones` comment with:
```go
for i := range m.TabOrder {
    zoneID := fmt.Sprintf("tab-%d", i)
    if info := zone.Get(zoneID); info != nil && info.InBounds(msg) {
        return m.switchToTab(i)
    }
}
```

### Phase 2 Verification

- [x] Build succeeds: `go build ./...`
- [x] Tests pass: `go test ./...`
- [ ] Manual: Run `prism-tui --demo`, click tabs — active view switches
- [ ] Manual: Keyboard tab switching (1-9, Tab, Shift+Tab) still works
- [ ] Manual: Both bordered and compact tab bars are clickable

---

## Phase 3: Modal/Dialog Mouse Support

**Goal**: Make modal buttons and dialog buttons clickable. Clicking a button triggers its action and updates focusIdx.

### Steps

#### 3.1 Add `HandleMouse()` to Modal

**File**: `cmd/prism-tui/modal/modal.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

Add method:
```go
// HandleMouse processes mouse click events.
// Returns the action ID if a zone was clicked, empty string otherwise.
func (m *Modal) HandleMouse(msg tea.MouseMsg) (action string, cmd tea.Cmd) {
    // Check each focusable element's zone
    for i, id := range m.focusIDs {
        zoneID := "modal-" + id
        if info := zone.Get(zoneID); info != nil && info.InBounds(msg) {
            // Update focus to match clicked element
            m.focusIdx = i

            // Route to the section that owns this focusable
            // Simulate an "enter" key press to trigger the action
            return m.routeToFocusedSection(tea.KeyMsg{Type: tea.KeyEnter})
        }
    }
    return "", nil
}
```

#### 3.2 Mark buttons with zones in ButtonsSection

**File**: `cmd/prism-tui/modal/section.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

In `ButtonsSection.Render()` at line 162, change:
```go
styled := renderButton(btn.Label, btn.Variant, isFocused)
parts = append(parts, styled)
```
to:
```go
styled := renderButton(btn.Label, btn.Variant, isFocused)
parts = append(parts, zone.Mark("modal-"+btn.ID, styled))
```

#### 3.3 Mark list items with zones in ListSection

**File**: `cmd/prism-tui/modal/list.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

In `ListSection.Render()`, after each item is styled (around line 130), wrap it:
```go
line = zone.Mark(fmt.Sprintf("modal-%s-%d", l.id, i), line)
```

Add mouse click handling in ListSection — add a new method:
```go
// HandleMouse checks if a list item was clicked and updates selection.
func (l *ListSection) HandleMouse(msg tea.MouseMsg) bool {
    for i := l.scrollOffset; i < l.scrollOffset+l.maxVisible && i < len(l.items); i++ {
        zoneID := fmt.Sprintf("modal-%s-%d", l.id, i)
        if info := zone.Get(zoneID); info != nil && info.InBounds(msg) {
            *l.selectedIdx = i
            return true
        }
    }
    return false
}
```

Update Modal.HandleMouse() to also check list items:
```go
// In HandleMouse, before the focusIDs loop, check list sections:
for _, section := range m.sections {
    if list, ok := section.(*ListSection); ok {
        if list.HandleMouse(msg) {
            // Update focus to the list
            m.SetFocus(list.id)
            return list.id, nil
        }
    }
}
```

#### 3.4 Add HandleMouse to Dialog system

**File**: `cmd/prism-tui/dialog/confirm.go`

Add import and method:
```go
zone "github.com/lrstanley/bubblezone"
```

Mark buttons in View():
- Wrap confirm button with `zone.Mark("dialog-confirm", ...)`
- Wrap cancel button with `zone.Mark("dialog-cancel", ...)`

Add HandleMouse method:
```go
func (d *ConfirmDialog) HandleMouse(msg tea.MouseMsg) Action {
    if info := zone.Get("dialog-confirm"); info != nil && info.InBounds(msg) {
        return ActionConfirm
    }
    if info := zone.Get("dialog-cancel"); info != nil && info.InBounds(msg) {
        return ActionCancel
    }
    return ActionNone
}
```

**File**: `cmd/prism-tui/dialog/permissions.go`

Similar pattern — mark Allow/Allow Session/Deny buttons with zones and add HandleMouse.

**File**: `cmd/prism-tui/dialog/dialog.go`

Add HandleMouse to Dialog interface:
```go
type Dialog interface {
    ID() string
    Update(msg tea.KeyMsg) (Action, tea.Cmd)
    HandleMouse(msg tea.MouseMsg) Action  // New
    View(width, height int) string
}
```

Add to Overlay:
```go
func (o *Overlay) HandleMouse(msg tea.MouseMsg) Action {
    if !o.HasDialogs() {
        return ActionNone
    }
    return o.dialogs[len(o.dialogs)-1].HandleMouse(msg)
}
```

#### 3.5 Wire modal/dialog mouse routing in Update

**File**: `cmd/prism-tui/app/update.go`

Replace `// TODO Phase 3: route to dialog`:
```go
action := m.Dialogs.HandleMouse(msg)
switch action {
case dialog.ActionCancel, dialog.ActionDeny:
    m.Dialogs.CloseFront()
    return m, nil
case dialog.ActionConfirm, dialog.ActionAllow, dialog.ActionAllowSession:
    m.Dialogs.CloseFront()
    return m, nil
}
return m, nil
```

Replace `// TODO Phase 3: route to modal`:
```go
action, cmd := m.ActiveModal.HandleMouse(msg)
if action == "cancel" {
    m.ActiveModal = nil
    m.CommandPalette = nil
    return m, cmd
} else if action != "" {
    // Button/list action
    if m.CommandPalette != nil {
        selectedCmd := m.CommandPalette.SelectedCommand()
        if selectedCmd != nil {
            m.ActiveModal = nil
            m.CommandPalette = nil
            return m.executeCommand(*selectedCmd)
        }
    }
    m.ActiveModal = nil
    return m, cmd
}
// Click didn't hit any zone — stay in modal
return m, nil
```

### Phase 3 Verification

- [x] Build succeeds: `go build ./...`
- [x] Tests pass: `go test ./...`
- [x] Vet passes: `go vet ./...`
- [ ] Manual: Open help modal (?), click "Close" button — modal closes
- [ ] Manual: Open command palette (Ctrl+P), click an item — navigates to plugin
- [ ] Manual: Keyboard modal navigation (Tab, Enter, Esc) still works
- [ ] Manual: After clicking a button, Tab still cycles correctly (focusIdx synced)

---

## Phase 4: Plugin List Item Clicks

**Goal**: Make list items in plugin views clickable for selection.

### Steps

#### 4.1 File browser click-to-select

**File**: `cmd/prism-tui/app/plugin_files.go`

Add import:
```go
zone "github.com/lrstanley/bubblezone"
```

In the View rendering where file tree items are rendered, wrap each item:
```go
zone.Mark(fmt.Sprintf("files:item-%d", i), renderedLine)
```

In the plugin's Update method, handle `tea.MouseMsg`:
```go
case tea.MouseMsg:
    if msg.Action == tea.MouseActionRelease && msg.Button == tea.MouseButtonLeft {
        for i := range p.state.FlatList {
            if info := zone.Get(fmt.Sprintf("files:item-%d", i)); info != nil && info.InBounds(msg) {
                p.state.SelectedIdx = i
                return p, p.loadPreview()
            }
        }
    }
    return p, nil
```

#### 4.2 Home menu item clicks

**File**: `cmd/prism-tui/app/plugin_home.go`

Same pattern — mark menu items with `zone.Mark("home:menu-N", ...)`, handle clicks to navigate.

### Phase 4 Verification

- [x] Build succeeds: `go build ./...`
- [x] Tests pass: `go test ./...`
- [ ] Manual: Click file tree items — selection moves
- [ ] Manual: Click home menu items — navigates
- [ ] Manual: Keyboard navigation (j/k, Enter) still works in all plugins

---

## Phase 5: Scroll Wheel Support

**Goal**: Handle mouse wheel events for scrolling modals, lists, and plugin content.

### Steps

#### 5.1 Modal scroll wheel

**File**: `cmd/prism-tui/app/update.go`

In `handleScrollWheel`, replace `// TODO Phase 5: modal scroll`:
```go
delta := 3
if msg.Button == tea.MouseButtonWheelUp {
    delta = -3
}
m.ActiveModal.ScrollBy(delta)
return m, nil
```

#### 5.2 List scroll in plugins

In each plugin that has scrollable lists, handle `tea.MouseButtonWheelUp`/`WheelDown` in the `tea.MouseMsg` case:

```go
case tea.MouseMsg:
    if msg.Button == tea.MouseButtonWheelUp {
        // Move selection up by 3
        p.state.SelectedIdx -= 3
        if p.state.SelectedIdx < 0 {
            p.state.SelectedIdx = 0
        }
        return p, nil
    }
    if msg.Button == tea.MouseButtonWheelDown {
        // Move selection down by 3
        p.state.SelectedIdx += 3
        if p.state.SelectedIdx >= len(p.state.FlatList) {
            p.state.SelectedIdx = len(p.state.FlatList) - 1
        }
        return p, nil
    }
    // ... click handling from Phase 4
```

### Phase 5 Verification

- [x] Build succeeds: `go build ./...`
- [x] Tests pass: `go test ./...`
- [ ] Manual: Scroll wheel in help modal scrolls content
- [ ] Manual: Scroll wheel in file browser moves selection
- [ ] Manual: Scroll wheel in research/plans file lists works

---

## Success Criteria

### Automated Verification
- [x] `cd cmd/prism-tui && go build ./...` compiles
- [x] `cd cmd/prism-tui && go test ./...` passes
- [x] `cd cmd/prism-tui && go vet ./...` passes

### Manual Verification
- [ ] Tab bar: clicking any tab switches to that view
- [ ] Modal buttons: clicking triggers action (help close, command palette select)
- [ ] Dialog buttons: clicking confirm/cancel/allow works
- [ ] List items: clicking selects item in modals and file browser
- [ ] Scroll wheel: scrolling in modals and lists works
- [ ] Keyboard navigation: ALL existing keyboard shortcuts still work unchanged
- [ ] Visual rendering: No visual differences when mouse is not being used
- [ ] Demo mode: Mouse works identically in `--demo` mode

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Zone markers break with `\x1b(B` charset reset | Place reset OUTSIDE `zone.Scan()`: `"\x1b(B" + zone.Scan(base)` |
| `MaxHeight()`/`MaxWidth()` truncates zone markers | Audit all lipgloss truncation on zone-marked content; avoid hard truncation |
| Modal overlay clicks pass through to background | Check dialog → modal → app priority before checking app-level zones |
| Zone ID collisions across plugins | Use `"pluginID:element-N"` convention |
| Breaking keyboard navigation | Each phase verifies keyboard still works; mouse is additive only |
