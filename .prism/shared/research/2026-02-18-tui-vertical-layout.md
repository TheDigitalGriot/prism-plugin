# Research: TUI Vertical Layout & Responsiveness

**Date**: 2026-02-18
**Topic**: How vertical height is calculated and passed through each TUI screen
**Goal**: Understand current height handling to make all main content sections vertically responsive

---

## Summary

The TUI app shell calculates content dimensions from `m.Width` and `m.Height` (set by `tea.WindowSizeMsg`). The shell passes `(contentWidth, m.Height)` to each plugin's `View(width, height int)` method. **The problem**: each plugin's `View` method receives the full terminal height, but most plugins do NOT subtract the chrome (tab bar = 3 lines, footer = 2 lines) before computing their panel heights. This causes panels to overflow the available vertical space.

---

## Files Discovered

| File | Role |
|------|------|
| `cmd/prism-cli/app/model.go` | Main model, `Width`/`Height` fields, `NewModel()` |
| `cmd/prism-cli/app/update.go` | `WindowSizeMsg` handler — sets `m.Width`, `m.Height`, broadcasts `PluginResizeMsg` |
| `cmd/prism-cli/app/view.go` | `View()` — routes to `renderAppShell(content)` |
| `cmd/prism-cli/app/shell.go` | `renderAppShell()`, tab bar renderers (3-line powerline or 1-line compact) |
| `cmd/prism-cli/app/footer.go` | `renderTwoTierFooter()` — 2-line footer (key hints + powerline bar) |
| `cmd/prism-cli/app/sidebar.go` | `renderSidebar(height)` — fixed 38-col right panel |
| `cmd/prism-cli/app/plugin_spectrum.go` | Spectrum screen — hardcoded panel sizes |
| `cmd/prism-cli/app/plugin_files.go` | Files screen — uses `innerHeight = paneHeight - 2` |
| `cmd/prism-cli/app/plugin_git.go` | Git screen — uses `innerHeight = paneHeight - 2` |
| `cmd/prism-cli/app/plugin_agent.go` | Agent screen — hardcoded `-6`, `-12` offsets |
| `cmd/prism-cli/app/plugin_monitor.go` | Monitor screen — `contentHeight = height - 6` |
| `cmd/prism-cli/app/plugin_workspaces.go` | Workspaces screen — uses `innerHeight = paneHeight - 2` |
| `cmd/prism-cli/app/plugin_research.go` | Research — viewport resized with `Height - 6` |
| `cmd/prism-cli/app/plugin_plans.go` | Plans — viewport resized with `Height - 6` |
| `cmd/prism-cli/app/plugin_home.go` | Home — no height-based layout |

---

## Component Analysis

### 1. App Shell Chrome Dimensions

**Tab bar** (`shell.go:renderTabBar`):
- Powerline mode: **3 lines** tall (`topRow + midRow + botRow`)
- Compact mode: **2 lines** tall (1 row + separator rule)
- Powerline is used when all tabs fit in width (the common case)

**Footer** (`footer.go:renderTwoTierFooter`):
- 2 tiers stacked: `renderKeyHintsFooter` + `renderPowerlineFooter`
- Each tier is **1 line** tall, so footer total = **2 lines**

**Total chrome height = tab bar (3) + footer (2) = 5 lines**
Plugins receive `m.Height` but the visible content area is `m.Height - 5`.

### 2. How Height Flows to Plugins

`update.go:61-88` (WindowSizeMsg handler):
```go
m.Width = msg.Width
m.Height = msg.Height
// ...
resizeMsg := plugin.PluginResizeMsg{Width: msg.Width, Height: msg.Height}
broadcastCmds := m.Registry.Broadcast(resizeMsg)
```

`view.go:44` (plugin.View call):
```go
content = active.View(contentWidth, m.Height)
```

**Key observation**: `m.Height` (full terminal height) is passed directly to plugins — no chrome subtraction happens before calling `View()`.

### 3. Screen-by-Screen Height Analysis

#### Spectrum (`plugin_spectrum.go`)

`View(width, height int)` — `height` parameter is **not used at all**.

Sections are stacked with `lipgloss.JoinVertical`:
- `renderHeader(width)` — 1 line (PanelStyle renders content)
- `renderProgressBar(width)` — ~7 lines (3D prism + logo + info line)
- `renderMainPanels(width)` — calls `renderStoryList` + `renderActivityPanel` with **no height constraint**
  - `renderStoryList`: pads to `storiesPerPage+2 = 14` lines (hardcoded `storiesPerPage: 12`)
  - `renderActivityPanel`: variable, not height-constrained
- `renderLogPanel(width)` — pads to `logsPerPage+2 = 8` lines (hardcoded `logsPerPage: 6`)
- `renderStatusBar(width)` — 1 line

**Total fixed: ~31+ lines** regardless of terminal height.

#### Files (`plugin_files.go`)

`View(width, height int)` → `renderTwoPane(width, height)`:
```go
paneHeight := height   // uses passed height directly
innerHeight := paneHeight - 2  // subtracts panel border
treeContent := p.renderTree(p.state.treeWidth, innerHeight)
previewContent := p.renderPreview(p.state.previewWidth, innerHeight)
leftPane := styles.RenderPanel(treeContent, ..., paneHeight, ...)
```

**Files uses height correctly within panels**, but `paneHeight = height` = full terminal height. Since `height` from `view.go` is the full `m.Height`, panels overflow into the footer/tab bar area.

#### Git (`plugin_git.go`)

Same pattern as Files:
```go
paneHeight := height   // full terminal height
innerHeight := paneHeight - 2
```

Panels are rendered with `paneHeight` which is unsubracted.

#### Agent (`plugin_agent.go`)

`View(width, height int)`:
```go
// Powerline breadcrumb header
sections = append(sections, renderBreadcrumb("Agent", width, ...))  // 1 line
sections = append(sections, "")  // 1 line
content := p.renderWideMode(width, height-6)  // subtracts 6
```

`renderChatArea(chatWidth, height int)`:
```go
historyHeight := height - 6  // another -6 for input area within the already-reduced height
```

**Agent subtracts 6 twice** from a height that already includes chrome.

`PluginResizeMsg` handler:
```go
viewportHeight := msg.Height - 12  // subtracts 12 from full terminal height
```

#### Monitor (`plugin_monitor.go`)

`View(width, height int)`:
```go
// breadcrumb (1 line) + blank (1 line)
contentHeight := height - 6
healthPanel := p.renderHealthPanel(width/3 - 2, contentHeight)
historyPanel := p.renderHistoryPanel(width/3 - 2, contentHeight)
gatesPanel := p.renderQualityGatesPanel(width/3 - 2, contentHeight)
```

Each panel uses `lipgloss.Height(height)` directly — passes `contentHeight` to border style. The `-6` offset is an approximation of chrome height but isn't exact.

#### Workspaces (`plugin_workspaces.go`)

`View(width, height int)` → `renderTwoPane(width, height)`:
```go
paneHeight := height   // full terminal height
innerHeight := paneHeight - 2
```

Same issue as Files/Git — uses full terminal height as pane height.

#### Research/Plans (`plugin_research.go`, `plugin_plans.go`)

`PluginResizeMsg` handler:
```go
viewportHeight := msg.Height - 6
p.state.Viewport.Height = viewportHeight
```

Viewport is resized with `-6` which is an approximation.

### 4. The Core Problem

The `renderAppShell` function in `shell.go` assembles:
```
Tab Bar (3 lines)
Content (full m.Height — NOT subtracted)
Footer (2 lines)
```

The content area should be `m.Height - tabBarHeight - footerHeight`, but **no such calculation exists**. Each plugin receives `m.Height` and is expected to self-limit, but most use rough magic numbers (-6, -12) or no limit at all.

### 5. Sidebar Height

```go
// shell.go:24
sidebarHeight := m.Height - 2
```

The sidebar correctly subtracts 2 (for the footer), but the sidebar uses `MaxHeight` not `Height`, so it won't expand beyond its content anyway.

### 6. Constant Values

| Constant | Value | Location |
|----------|-------|----------|
| `SidebarWidth` | 38 | `sidebar.go:13` |
| `CompactBreakpointWidth` | 120 | `sidebar.go:16` |
| `storiesPerPage` | 12 | `plugin_spectrum.go:147` |
| `logsPerPage` | 6 | `plugin_spectrum.go:148` |
| Tab bar height (powerline) | 3 | `shell.go:350` |
| Tab bar height (compact) | 2 | `shell.go:378` |
| Footer height | 2 | `footer.go:256-260` |

---

## Patterns Found

### Two-pane plugins (Files, Git, Workspaces) — best practice pattern:
```go
func (p *FilesPlugin) renderTwoPane(width, height int) string {
    paneHeight := height     // receives full terminal height → should be content area height
    innerHeight := paneHeight - 2  // subtracts border (correct)
    treeContent := p.renderTree(treeWidth, innerHeight)
    leftPane := styles.RenderPanel(treeContent, treeWidth, paneHeight, ...)
    // ...
}
```

These screens correctly propagate height *within* their pane rendering, but the outer `paneHeight` should be `height - chromeHeight` not just `height`.

### Monitor — explicit content height calculation:
```go
contentHeight := height - 6  // rough approximation of chrome
```

### Spectrum — no height awareness:
```go
func (p *SpectrumPlugin) View(width, height int) string {
    // height is ignored
    sections := []string{header, progressBar, mainPanels, logPanel, statusBar}
    return lipgloss.JoinVertical(...)
}
```

---

## Open Questions (for Planning)

1. **Where to calculate chrome height?** Options:
   - In `renderAppShell` before calling `active.View()` — subtract tab bar height + footer height
   - Define a `contentAreaHeight()` method on `Model`
   - Pass available height down from `View()` instead of full `m.Height`

2. **Tab bar height is variable** (3 for powerline, 2 for compact). The content height needs to account for which mode is active.

3. **Spectrum's fixed pagination** (`storiesPerPage: 12`, `logsPerPage: 6`) — should these become dynamic based on available height?

4. **Should panels fill remaining space?** The Files/Git/Workspaces two-pane screens could use `Height()` in lipgloss to fill to terminal. Spectrum's stacked panels could distribute remaining space between stories, activity, and log panels.

5. **What is the correct chrome height to subtract?** Powerline tab = 3, compact tab = 2, footer = 2. So subtract either 5 or 4 depending on mode.
