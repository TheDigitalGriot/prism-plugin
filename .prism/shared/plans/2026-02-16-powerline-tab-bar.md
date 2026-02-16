---
title: 3-Line Powerline Tab Bar with Diagonal Slants
date: 2026-02-16
status: draft
tags: [tui, tab-bar, powerline, ui]
---

# 3-Line Powerline Tab Bar with Diagonal Slants

## Goal

Replace the bordered "folder tab" menu with a lualine-inspired 3-line powerline tab bar. Each tab is a tall colored button. Slant separators are offset ±1 char per row to create true diagonal edges between tabs.

## Visual Design

```
 ████████╲██████████████╲████████████╲████████████████╲
 █  Home  ╲  Research   ╲   Plans    ╲   Spectrum     ╲  ...
 ██████████╲████████████╲██████████████╲██████████████╲
```

- Top row separator is 1 char LEFT of middle row
- Bottom row separator is 1 char RIGHT of middle row
- Creates a `\` diagonal matching the `\uE0BC` slant glyph direction
- Each tab looks like a tall slanted button

### Colors

| Element | Background | Foreground | Style |
|---------|-----------|-----------|-------|
| Active tab | `Primary` (theme-aware) | `#FFFFFF` | Bold |
| Inactive tabs | `#2c2d3a` | `#6B7280` (Dim) | Normal |
| Bar fill / background | `#1a1b26` (FooterBg) | - | - |

### Tab Labels (Nerd Font icons replace numbers)

| Tab | Nerd Icon | Label | ASCII Fallback |
|-----|-----------|-------|----------------|
| Home | `\uF015` () | ` Home` | `1 Home` |
| Research | `\uF002` () | ` Research` | `2 Research` |
| Plans | `\uF03A` () | ` Plans` | `3 Plans` |
| Spectrum | `\uF0E7` () | ` Spectrum` | `4 Spectrum` |
| Files | `\uF07B` () | ` Files` | `5 Files` |
| Git | `\uE0A0` () | ` Git` | `6 Git` |
| Agent | `\uF007` () | ` Agent` | `7 Agent` |
| Monitor | `\uF080` () | ` Monitor` | `8 Monitor` |
| Workspaces | `\uF009` () | ` Workspaces` | `9 Workspaces` |

### Responsive Behavior

- **Width >= estimated tab width**: 3-line powerline tab bar
- **Width < threshold**: Existing compact 1-line fallback (`renderCompactTabBar`)

## Diagonal Offset Algorithm

For `N` tabs with base widths `w[0]..w[N-1]` (label + 2 padding):

```
Middle row: [seg0: w[0]][sep][seg1: w[1]][sep]...[segN-1: w[N-1]][sep][fill]
Top row:    [seg0: w[0]-1][sep][seg1: w[1]][sep]...[segN-1: w[N-1]][sep][fill+1]
Bottom row: [seg0: w[0]+1][sep][seg1: w[1]][sep]...[segN-1: w[N-1]][sep][fill-1]
```

Only the FIRST segment width changes per row (±1). All interior segments stay the same width because the offsets cancel out between adjacent separators. The trailing fill absorbs the ±1 difference.

## What We're NOT Doing

- Not changing the footer powerline bar
- Not changing the sidebar
- Not modifying the compact tab bar fallback (keeping as-is)
- Not modifying the plugin interface (icons are defined in tab rendering, not in plugins)
- Not changing keyboard shortcuts (1-9 still works, just not displayed in labels)

---

## Phase 1: Add Tab Icon Constants

**File**: `cmd/prism-tui/styles/powerline.go`

### Steps

1. Add tab-specific Nerd Font icon constants:
   ```go
   // Tab icon constants — Nerd Font
   const (
       IconHome       = "\uF015"
       IconSearch     = "\uF002"
       IconList       = "\uF03A"
       IconBolt       = "\uF0E7"
       IconUser       = "\uF007"
       IconChart      = "\uF080"
       IconGrid       = "\uF009"
   )
   ```

2. Add ASCII fallback tab icon constants (use numbers for discoverability):
   ```go
   const (
       IconHomeASCII   = "1"
       IconSearchASCII = "2"
       IconListASCII   = "3"
       IconBoltASCII   = "4"
       IconUserASCII   = "7"
       IconChartASCII  = "8"
       IconGridASCII   = "9"
   )
   ```

3. Add fields to `Icons` struct: `Home`, `Search`, `List`, `Bolt`, `User`, `Chart`, `Grid`

4. Update `NerdIcons()` and `ASCIIIcons()` to populate new fields

5. Add `TabBarBg` and `TabBarInactiveBg` color constants:
   ```go
   TabBarBg         = FooterBg              // #1a1b26
   TabBarInactiveBg = lipgloss.Color("#2c2d3a")
   ```

### Verification
```bash
cd cmd/prism-tui && go build ./...
```

---

## Phase 2: Implement 3-Line Powerline Tab Bar

**File**: `cmd/prism-tui/app/shell.go`

### Steps

1. Add new `tabIcon` function that maps plugin ID to icon from `Icons` struct:
   ```go
   func tabIcon(pluginID string, icons styles.Icons) string {
       switch pluginID {
       case "home":       return icons.Home
       case "research":   return icons.Search
       case "plans":      return icons.List
       case "spectrum":   return icons.Bolt
       case "files":      return icons.Folder
       case "git":        return icons.GitBranch
       case "agent":      return icons.User
       case "monitor":    return icons.Chart
       case "workspaces": return icons.Grid
       default:           return ""
       }
   }
   ```

2. Update `tabLabel` to use icons instead of numbers:
   ```go
   func tabLabel(pluginID string, name string, icon string) string {
       if icon != "" {
           return icon + " " + name
       }
       return name
   }
   ```

3. Implement `renderPowerlineTabBar(width int) string`:

   **a. Collect tab info:**
   ```go
   type tabInfo struct {
       label    string
       pluginID string
       active   bool
       bg       lipgloss.Color
       fg       lipgloss.Color
       zoneID   string
   }
   ```
   For each tab: resolve plugin, build label with icon, determine active state and colors.

   **b. Calculate base widths:**
   `baseWidth[i] = lipgloss.Width(label[i]) + 2` (1 padding each side)

   **c. Build 3 rows with offset slants:**

   Helper to build one row:
   ```go
   buildRow := func(contentFn func(i int, tab tabInfo, segWidth int) string,
                    firstOffset int, markZones bool) string
   ```
   - `firstOffset`: -1 for top, 0 for mid, +1 for bottom
   - First segment width = `baseWidth[0] + firstOffset`
   - All other segment widths = `baseWidth[i]`
   - For top/bottom rows: `contentFn` returns spaces
   - For middle row: `contentFn` returns the label (centered in segWidth)
   - Zone marking: only on middle row segments
   - Separator: `icons.SepRight` with fg=current bg, bg=next bg
   - Trailing fill with barBg absorbs the ±1 offset

   **d. Join rows:**
   ```go
   return lipgloss.JoinVertical(lipgloss.Left, topRow, midRow, botRow)
   ```

4. Update `renderTabBar` dispatcher:
   - Calculate powerline width estimate: `sum(baseWidth[i]) + numTabs` (segments + separators)
   - If fits: call `renderPowerlineTabBar(width)`
   - If doesn't fit: call `renderCompactTabBar(width)` (existing fallback)

5. Remove `renderBorderedTabBar` function (no longer used)

### Mouse Click Support

Zone marks on the MIDDLE row only using existing `"tab-{i}"` IDs. The click handler in `update.go:649-654` is unchanged since zone IDs stay the same.

### Verification
```bash
cd cmd/prism-tui && go build ./...
```

---

## Phase 3: Clean Up Old Tab Styles

**File**: `cmd/prism-tui/styles/theme.go`

### Steps

1. Remove old bordered tab style definitions:
   - `ActiveTabBorder` (lines 99-108)
   - `InactiveTabBorder` (lines 111-120)
   - `TabActiveStyle` (lines 122-127)
   - `TabInactiveStyle` (lines 129-133)
   - `TabGapStyle` (lines 136-141)

2. Keep `TabBorderColor` (still used by `renderKeyHintsFooter` for the top border at `footer.go:106`)

3. Update `ApplyTheme()` to remove references to removed styles:
   - Remove: `TabActiveStyle = ...`, `TabInactiveStyle = ...`, `TabGapStyle = ...`
   - Keep: `TabBorderColor = accent`

### Verification
```bash
cd cmd/prism-tui && go build ./...
```

---

## Phase 4: Build and Verify

### Steps

1. Full build:
   ```bash
   cd cmd/prism-tui && make build
   ```

2. Run tests:
   ```bash
   cd cmd/prism-tui && make test
   ```

3. Run lint:
   ```bash
   cd cmd/prism-tui && make lint
   ```

---

## Success Criteria

### Automated Verification
- [ ] `go build ./...` compiles without errors
- [ ] `make test` passes
- [ ] `make lint` passes (or no new lint issues)

### Manual Verification
- [ ] Tab bar renders as 3-line powerline with slanted separators
- [ ] Slant diagonals align across all 3 rows (top shifted left, bottom shifted right)
- [ ] Active tab shows Primary color background with white bold text
- [ ] Inactive tabs show dim dark background
- [ ] Nerd Font icons display correctly for each tab
- [ ] ASCII fallback icons display when Nerd Fonts unavailable
- [ ] Mouse clicks on tabs switch views correctly
- [ ] Keyboard shortcuts 1-9 still work
- [ ] Tab/shift+tab cycling still works
- [ ] Narrow terminal falls back to compact mode
- [ ] Sidebar mode reduces tab bar width correctly
- [ ] `ApplyTheme()` correctly colors active tab with custom accent

## Risks

| Risk | Mitigation |
|------|-----------|
| `lipgloss.Width` miscounts styled content width | Use plain string lengths for padding calculations |
| Zone marking on single row misses clicks on top/bottom | Acceptable tradeoff; text row is natural click target |
| First segment too narrow when offset -1 on top row | Min label width is ~6 chars + 2 pad = 8; -1 = 7, always safe |
| Some Nerd Font icons not in user's font | ASCII fallback with numbers preserves usability |
