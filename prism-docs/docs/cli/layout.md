---
title: Vertical Layout & Height Budget
description: lipgloss Height() semantics, app shell chrome heights, per-plugin height budgets, and resize handler patterns.
outline: [2, 3]
---

# Vertical Layout & Height Budget

## Critical: lipgloss `Height()` Semantic

**`Height(h)` sets the INNER (content) height, not the outer frame height.**

Despite the v1 migration guide claiming Width/Height are "outer dimensions including borders and padding," the actual implementation in lipgloss (v1.1.1-pre) applies `Height()` to content BEFORE `applyBorder()`:

```go
// lipgloss style.go Render() order of operations:
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

## App Shell Chrome Heights

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

## Per-Plugin Height Budgets

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

## Panel Height Pattern (Correct)

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

## Resize Handler Consistency

The `PluginResizeMsg.Height` carries `contentHeight()` (total content area). Plugin resize handlers must subtract the same overhead as their `View()` method to derive the viewport height:

```go
// Agent example:
// View: breadcrumb(2) + history_border(2) + blank(1) + input(5) = 10
case plugin.PluginResizeMsg:
    viewportHeight := msg.Height - 10
```
