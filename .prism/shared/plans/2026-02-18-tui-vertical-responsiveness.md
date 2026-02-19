# Plan: TUI Vertical Responsiveness

**Date**: 2026-02-18
**Status**: Approved
**Research**: `.prism/shared/research/2026-02-18-tui-vertical-layout.md`

---

## Goal

Make all main content sections in the Prism TUI fill exactly the available vertical space. Currently, the app shell passes `m.Height` (full terminal height) to plugins without subtracting chrome (tab bar + footer), causing panels to overflow or use hardcoded magic numbers.

## Chrome Height Budget

| Component | Lines |
|-----------|-------|
| Powerline tab bar | 3 |
| Compact tab bar | 2 |
| Key hints footer (tier 1, has border-top) | 2 |
| Powerline footer (tier 2) | 1 |
| **Total (powerline tabs)** | **6** |
| **Total (compact tabs)** | **5** |

---

## Success Criteria

#### Automated Verification:
- [ ] `cd cmd/prism-tui && make build` succeeds
- [ ] `cd cmd/prism-tui && make test` passes
- [ ] `cd cmd/prism-tui && make lint` passes (if golangci-lint available)

#### Manual Verification:
- [ ] Run `./prism-tui --demo` at various terminal sizes (80x24, 120x40, 200x60)
- [ ] Spectrum screen: stories + activity + log panels fill the space between tab bar and footer with no gap or overflow
- [ ] Files screen: two-pane layout fills exactly to footer
- [ ] Git screen: two-pane layout fills exactly to footer
- [ ] Agent screen: chat area fills between breadcrumb and footer
- [ ] Monitor screen: three panels fill between breadcrumb and footer
- [ ] Workspaces screen: two-pane layout fills exactly to footer
- [ ] Resize terminal while running — all screens adapt without overflow
- [ ] Sidebar still renders correctly when terminal >= 120 cols wide

---

## Phase 1: Fix the Source (view.go, shell.go, update.go)

**Goal**: Compute correct `contentHeight` and pass it to plugins instead of `m.Height`.

### Step 1.1: Add `tabBarHeight()` method to shell.go

Add a method that returns 3 (powerline) or 2 (compact) based on the same width check used in `renderTabBar`:

```go
// shell.go — add after renderTabBar function

const (
    FooterHeight        = 3 // key hints (2: border-top + content) + powerline (1)
    PowerlineTabHeight  = 3
    CompactTabHeight    = 2
)

func (m Model) tabBarHeight(width int) int {
    icons := styles.GetIcons(m.HasNerdFont)
    totalPowerlineWidth := 0
    for _, view := range m.TabOrder {
        pluginID := viewToPluginID(view)
        p := m.Registry.PluginByID(pluginID)
        if p == nil {
            continue
        }
        icon := tabIcon(pluginID, icons)
        label := tabLabel(pluginID, p.Name(), icon)
        totalPowerlineWidth += lipgloss.Width(label) + 2 + 1
    }
    if totalPowerlineWidth > width {
        return CompactTabHeight
    }
    return PowerlineTabHeight
}

func (m Model) contentHeight() int {
    tabWidth := m.Width
    if m.showSidebar() {
        tabWidth = m.Width - SidebarWidth
    }
    h := m.Height - m.tabBarHeight(tabWidth) - FooterHeight
    if h < 1 {
        h = 1
    }
    return h
}
```

### Step 1.2: Update view.go to pass contentHeight

Change `view.go:44`:
```go
// Before:
content = active.View(contentWidth, m.Height)

// After:
content = active.View(contentWidth, m.contentHeight())
```

### Step 1.3: Update update.go PluginResizeMsg to pass contentHeight

Change `update.go:85-86`:
```go
// Before:
resizeMsg := plugin.PluginResizeMsg{Width: msg.Width, Height: msg.Height}

// After:
resizeMsg := plugin.PluginResizeMsg{Width: msg.Width, Height: m.contentHeight()}
```

Note: This must happen AFTER `m.Width` and `m.Height` are set (they already are on lines 61-62), so `contentHeight()` will use the updated values.

### Step 1.4: Update sidebar height

In `shell.go:24`, update the sidebar height to use the new constants:
```go
// Before:
sidebarHeight := m.Height - 2

// After:
sidebarHeight := m.Height - FooterHeight
```

### Verification:
- `make build` succeeds
- Run `--demo`, check that two-pane screens (Files/Git/Workspaces) now fit correctly since they already use `height` properly internally

---

## Phase 2: Fix Two-Pane Plugins (Files, Git, Workspaces)

**Goal**: These plugins already propagate height correctly internally. After Phase 1, they should "just work". This phase is cleanup — remove any defensive magic numbers.

### Step 2.1: plugin_files.go — no changes needed

`renderTwoPane(width, height)` uses `paneHeight := height` which will now be correct.

### Step 2.2: plugin_git.go — no changes needed

Same pattern as Files.

### Step 2.3: plugin_workspaces.go — no changes needed

Same pattern as Files.

### Verification:
- Run `--demo`, switch to Files/Git/Workspaces tabs
- Panels should fill exactly to footer at any terminal size

---

## Phase 3: Fix Spectrum (plugin_spectrum.go)

**Goal**: Make Spectrum height-aware. Currently ignores `height` entirely — all panel sizes are hardcoded.

### Step 3.1: Pass height through View to sub-renderers

Update `View(width, height int)` to compute available space:

```go
func (p *SpectrumPlugin) View(width, height int) string {
    var sections []string

    // Epic selector (conditional)
    epicHeight := 0
    if len(p.epic.Epics) > 1 {
        epicSelector := p.renderEpicSelector(width)
        sections = append(sections, epicSelector)
        epicHeight = lipgloss.Height(epicSelector)
    }

    // Header (fixed)
    header := p.renderHeader(width)
    sections = append(sections, header)
    headerHeight := lipgloss.Height(header)

    // Progress bar (fixed)
    progressBar := p.renderProgressBar(width)
    sections = append(sections, progressBar)
    progressHeight := lipgloss.Height(progressBar)

    // Status bar (fixed, 1 line)
    statusBarHeight := 1

    // Remaining height for dynamic panels (stories+activity and log)
    fixedHeight := epicHeight + headerHeight + progressHeight + statusBarHeight
    dynamicHeight := height - fixedHeight
    if dynamicHeight < 6 {
        dynamicHeight = 6
    }

    // Split: ~60% for main panels (stories + activity), ~40% for log
    mainPanelHeight := dynamicHeight * 60 / 100
    logPanelHeight := dynamicHeight - mainPanelHeight

    // Main content (stories + activity panels)
    sections = append(sections, p.renderMainPanels(width, mainPanelHeight))

    // Log viewport
    sections = append(sections, p.renderLogPanel(width, logPanelHeight))

    // Status bar
    sections = append(sections, p.renderStatusBar(width))

    return lipgloss.JoinVertical(lipgloss.Left, sections...)
}
```

### Step 3.2: Update renderMainPanels to accept height

```go
func (p *SpectrumPlugin) renderMainPanels(width, height int) string {
    totalWidth := width - 4
    storyWidth := totalWidth * 40 / 100
    activityWidth := totalWidth - storyWidth - 3

    storyPanel := p.renderStoryList(storyWidth, height)
    activityPanel := p.renderActivityPanel(activityWidth, height)

    return lipgloss.JoinHorizontal(lipgloss.Top, storyPanel, activityPanel)
}
```

### Step 3.3: Update renderStoryList to use dynamic height

Change signature to accept height and compute `storiesPerPage` dynamically:

```go
func (p *SpectrumPlugin) renderStoryList(width, height int) string {
    // Dynamic stories per page based on available height
    // Height budget: title (1) + separator (1) + paginator (1) + panel border (2) = 5 lines overhead
    storiesVisible := height - 5
    if storiesVisible < 3 {
        storiesVisible = 3
    }

    // ... use storiesVisible instead of p.storiesPerPage for display
    // Keep p.storiesPerPage for pagination math, but render only storiesVisible items
```

Also apply `Height(height)` to the panel style so it fills exactly:
```go
return styles.PanelStyle.Width(width).Height(height).Render(content)
```

### Step 3.4: Update renderActivityPanel to accept and use height

Same pattern — accept height, apply to panel style:
```go
func (p *SpectrumPlugin) renderActivityPanel(width, height int) string {
    // ... existing content logic ...
    return styles.PanelStyle.Width(width).Height(height).Render(content)
}
```

### Step 3.5: Update renderLogPanel to use dynamic height

```go
func (p *SpectrumPlugin) renderLogPanel(width, height int) string {
    // Dynamic logs per page
    // Height budget: header (1) + separator (1) + paginator (1) + panel border (2) = 5 lines overhead
    logsVisible := height - 5
    if logsVisible < 2 {
        logsVisible = 2
    }

    // ... use logsVisible instead of p.logsPerPage for display
    // Apply Height to panel:
    return styles.PanelStyle.Width(width - 2).Height(height).Render(content)
}
```

### Verification:
- Run `--demo`, go to Spectrum tab
- Stories panel + activity panel + log panel should fill exactly to footer
- Resize terminal vertically — panels should redistribute
- Pagination dots should still work correctly

---

## Phase 4: Fix Remaining Plugins (Agent, Monitor, Research, Plans)

### Step 4.1: plugin_agent.go — remove magic numbers

In `View()`:
```go
// Before:
content := p.renderWideMode(width, height-6)
// After (height is now already content-area height):
breadcrumbHeight := 2 // breadcrumb line + blank line
content := p.renderWideMode(width, height - breadcrumbHeight)
```

In `renderChatArea()`:
```go
// Before:
historyHeight := height - 6
// After — subtract only input area overhead (input box ~5 lines + blank):
historyHeight := height - 5
if historyHeight < 5 {
    historyHeight = 5
}
```

In `PluginResizeMsg` handler:
```go
// Before:
viewportHeight := msg.Height - 12
// After — msg.Height is now content-area height:
viewportHeight := msg.Height - 7 // breadcrumb(2) + input(5)
if viewportHeight < 10 {
    viewportHeight = 10
}
```

### Step 4.2: plugin_monitor.go — remove magic number

In `View()`:
```go
// Before:
contentHeight := height - 6
// After — height is now content-area, subtract only monitor's own chrome:
breadcrumbHeight := 2 // breadcrumb + blank
footerAreaHeight := 2 // blank + refresh timestamp
contentHeight := height - breadcrumbHeight - footerAreaHeight
if contentHeight < 4 {
    contentHeight = 4
}
```

### Step 4.3: plugin_research.go — fix resize handler

In `PluginResizeMsg` handler:
```go
// Before:
viewportHeight := msg.Height - 6
// After — msg.Height is now content-area height:
viewportHeight := msg.Height - 4 // list header + margins
if viewportHeight < 10 {
    viewportHeight = 10
}
```

Also in `Init()`:
```go
// Before:
p.state.Viewport = viewport.New(ctx.Width-4, ctx.Height-6)
// After:
p.state.Viewport = viewport.New(ctx.Width-4, ctx.Height-4)
```

### Step 4.4: plugin_plans.go — same fix as Research

Mirror the Research changes.

### Verification:
- Run `--demo`, check Agent, Monitor tabs
- Chat history fills the space, no excessive empty area
- Monitor panels fill height

---

## What We're NOT Doing

- Horizontal responsiveness (already handled)
- Splash/onboarding screens (fullscreen, no chrome)
- Home screen (minimal layout, no panels to fill)
- Sidebar height adjustment (already correct after constant rename)
- Dynamic reflow when sidebar toggles (already works via width propagation)

## Risks

| Risk | Mitigation |
|------|------------|
| Footer height changes in the future | Use named constants (`FooterHeight`) not magic numbers |
| Tab bar mode depends on width + font + number of tabs | `tabBarHeight()` method mirrors `renderTabBar()` logic exactly |
| `lipgloss.Height()` on styled content may include border lines | Test with `--demo` at small sizes (80x24) to catch off-by-one |
| Spectrum pagination math changes when dynamic | Keep `storiesPerPage`/`logsPerPage` as defaults, override with `storiesVisible`/`logsVisible` in render |

## Edge Cases

- Very small terminal (80x24): Content height = 24 - 6 = 18. Spectrum gets ~10 for main panels, ~7 for log. Viable.
- Very tall terminal (200x60): Content height = 54. Panels expand to fill. Stories show more items per page.
- Sidebar toggle: Width changes, `contentHeight()` recalculates `tabBarHeight()` with new width. Works.
