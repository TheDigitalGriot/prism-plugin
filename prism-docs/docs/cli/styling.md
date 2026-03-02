---
title: Styling Reference
description: Color palette, spectrum gradient, workflow phase colors, component styles, icons, and Nerd Font glyphs.
outline: [2, 3]
---

# Styling Reference

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#7C3AED` | Purple — Titles, active items, header bg, focused borders |
| Secondary | `#2c2d3a` | Editor bg — Inactive elements, tab bar inactive bg |
| Success | `#10B981` | Green — Completed items, success logs |
| Warning | `#F59E0B` | Amber — Blocked items, warnings, paused state |
| Error | `#EF4444` | Red — Error messages, error state |
| Info | `#3B82F6` | Blue — Info logs, panel titles |
| Dim | `#6B7280` | Gray — Borders, pending items, hints |
| Background | `#1F2937` | Dark gray — Background elements, modal bg |
| White | `#FFFFFF` | White — Header text |
| BorderNormal | `#4B5563` | Inactive borders |
| BorderActive | `= Primary` | Focused borders |
| Highlight | `#06B6D4` | Cyan — Current activity, highlighted text |

## Spectrum Gradient (4-Stop)

```
#3B82F6 ───▶ #14B8A6 ───▶ #22C55E ───▶ #F59E0B
 Blue          Teal         Green        Amber
```

Used for: Progress bar fill, ASCII logo, prism rays, sidebar logo, gradient bar.

## Workflow Phase Colors

| Phase | Color | Hex |
|-------|-------|-----|
| Research | Blue | `#3B82F6` |
| Plan | Teal | `#14B8A6` |
| Implement | Green | `#22C55E` |
| Validate | Amber | `#F59E0B` |
| Idle | Gray | `#4B5563` |

## Component Styles

| Style | Properties |
|-------|------------|
| `TitleStyle` | Bold, FG: Purple `#7C3AED`, Padding(0,1) |
| `HeaderStyle` | Bold, FG: White, BG: Purple `#7C3AED`, Padding(0,1), MarginBottom(1) |
| `PanelStyle` | Border: Rounded, BorderFG: Gray `#6B7280`, Padding(0,1) |
| `StoriesTitleStyle` | Bold, FG: Blue `#3B82F6` |
| `ActivityTitleStyle` | Bold, FG: Teal `#14B8A6` |
| `LogTitleStyle` | Bold, FG: Green `#22C55E` |
| `CompleteStyle` | FG: Green `#10B981` |
| `CurrentStyle` | Bold, FG: Purple `#7C3AED` |
| `PendingStyle` | FG: Gray `#6B7280` |
| `BlockedStyle` | Italic, FG: Amber `#F59E0B` |
| `HighlightStyle` | FG: Cyan `#06B6D4` |
| `DimStyle` | FG: Gray `#6B7280` |
| `ErrorStyle` | Bold, FG: Red `#EF4444` |
| `StatusBarStyle` | FG: Gray `#6B7280`, Padding(0,1) |
| `SidebarStyle` | Border: Rounded, BorderFG: Purple `#7C3AED`, Padding(0,1) |
| `SidebarBrandStyle` | Bold, FG: Purple `#7C3AED` |
| `SidebarTitleStyle` | FG: White `#FFFFFF` |
| `AppHeaderStyle` | Bold, FG: White, BG: Purple `#7C3AED`, Padding(0,1) |
| `FooterStyle` | FG: Gray `#6B7280`, Padding(0,1) |

## Icons

| Icon | Character | Color | Usage |
|------|-----------|-------|-------|
| Check | `✓` | Green `#10B981` | Completed stories |
| Play | `▸` | Purple `#7C3AED` | Active story, running state |
| Pending | `○` | Gray `#6B7280` | Pending stories |
| Blocked | `⊘` | Amber `#F59E0B` | Blocked stories |
| Error | `✗` | Red `#EF4444` | Failed items |

## Nerd Font Icons

When Nerd Font is detected, the following glyphs are used for tab bar, sidebar, and footer:

| Context | Nerd Font | ASCII Fallback |
|---------|-----------|----------------|
| Separator (right) | `\uE0BC` | `▶` |
| Separator (left) | `\uE0BA` | `◀` |
| Home | `\uF015` | `1` |
| Search | `\uF002` | `2` |
| List | `\uF03A` | `3` |
| Bolt | `\uF0E7` | `4` |
| Folder | `\uF07B` | `5` |
| Git Branch | `\uE0A0` | `6` |
| User | `\uF007` | `7` |
| Chart | `\uF080` | `8` |
| Grid | `\uF009` | `9` |

## Theme Override System

When running in an IDE terminal, detected accent and editor background colors override the defaults:

- `ApplyTheme(accentHex)` — Overrides `Primary`, rebuilds TitleStyle, HeaderStyle, CurrentStyle, ProgressBarStyle, SidebarStyle, SidebarBrandStyle, PlayIcon, AppHeaderStyle, TabBorderColor
- `ApplySecondary(editorBgHex)` — Overrides `Secondary` and `TabBarInactiveBg`
