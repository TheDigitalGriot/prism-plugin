---
title: Tab Bar Powerline Redesign Research
date: 2026-02-16
status: complete
tags: [tui, tab-bar, powerline, ui, multi-line]
---

# Tab Bar Powerline Redesign Research

## Research Question

How is the current TUI tab bar implemented, and how can we redesign it from a bordered "folder tab" style to a lualine-inspired powerline style with slanted separators spanning 3 lines?

## Summary

The current tab bar uses bordered boxes with rounded corners (`╭─╮`) for each tab, with active tabs having an "open" bottom border and inactive tabs connecting via T-junctions (`┴`) to a horizontal rule. The implementation lives in `shell.go` with styles defined in `theme.go`. A complete powerline rendering system already exists in `styles/powerline.go` (used by the footer) with slanted Nerd Font separators (`\uE0BC`, `\uE0BA`) and fallback ASCII alternatives. Multi-line rendering patterns throughout the codebase show various approaches using `lipgloss.JoinVertical`, string concatenation with `\n`, and nested horizontal/vertical compositions.

## Files Discovered

| File | Purpose | Key Lines |
|------|---------|-----------|
| `cmd/prism-cli/app/shell.go` | Tab bar rendering and layout | 104-204 |
| `cmd/prism-cli/styles/powerline.go` | Powerline segment rendering system | 9-215 |
| `cmd/prism-cli/styles/theme.go` | Tab styling definitions | 96-141 |
| `cmd/prism-cli/app/footer.go` | Powerline footer implementation (reference) | 114-247 |
| `cmd/prism-cli/app/sidebar.go` | Multi-line rendering examples | 42-109 |
| `cmd/prism-cli/app/update.go` | Tab switching and mouse handling | 403-658 |
| `cmd/prism-cli/app/views.go` | ActiveView enum definitions | 9-25 |
| `cmd/prism-cli/app/model.go` | TabOrder initialization | 93, 257 |
| `cmd/prism-cli/plugin/registry.go` | Plugin lookup by ID | 81-83 |

## Component Analysis

### 1. Current Tab Bar Implementation

#### Entry Point: renderAppShell (`shell.go:15-37`)

The tab bar sits inside `renderAppShell`, which handles two layout modes:
- **With sidebar** (width ≥ 120): Tab bar width = `m.Width - 30`, placed in left column
- **No sidebar**: Tab bar receives full `m.Width`

```go
// shell.go:15-31
if m.showSidebar() {
    leftWidth := m.Width - SidebarWidth
    tabBar := m.renderTabBar(leftWidth)
    leftColumn := lipgloss.JoinVertical(lipgloss.Left, tabBar, content)
    mainRow := lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, m.renderSidebar(sidebarHeight))
    footer := m.renderTwoTierFooter(m.Width)
    return lipgloss.JoinVertical(lipgloss.Left, mainRow, footer)
}
```

#### Tab Data Structure

- **TabOrder** (`model.go:93, 257`): `[]ActiveView` with 9 entries: Home, Research, Plans, Spectrum, Files, Git, Agent, Monitor, Workspaces
- **ActiveView** (`views.go:9-25`): Integer enum (0-11), not all values appear in TabOrder
- **Plugin mapping**: `viewToPluginID()` (`update.go:462-487`) translates enum to plugin ID strings

#### renderTabBar -- Width-Based Dispatcher (`shell.go:104-120`)

Calculates total bordered tab width by summing `len(tabLabel(i, p)) + 4` per tab (the `+4` accounts for borders and padding). If `totalBorderedWidth > width-2`, uses compact mode; otherwise bordered mode.

Current tab label format: `[{i+1}] {name}` (e.g., `[1] Home`, `[2] Research`)

With 9 tabs, total bordered width ≈ 128 characters.

#### renderBorderedTabBar (`shell.go:123-175`)

For each tab:
1. Resolves plugin via `viewToPluginID()` and `m.Registry.PluginByID()`
2. Generates label with `tabLabel(i, p)`
3. Selects `TabActiveStyle` or `TabInactiveStyle`
4. **Adjusts border corners** for first/last tabs to create clean edge connections
5. Wraps in `zone.Mark("tab-{i}", ...)` for mouse hit detection

Border corner overrides (`shell.go:147-158`):

| Position | Active | Inactive | Character | Effect |
|----------|--------|----------|-----------|--------|
| First tab, bottom-left | Yes | - | `│` | Continues vertical left edge |
| First tab, bottom-left | - | Yes | `├` | T-junction joining left edge to rule |
| Last tab, bottom-right | Yes | - | `│` | Continues vertical right edge |
| Last tab, bottom-right | - | Yes | `┤` | T-junction joining right edge to rule |

After joining tabs horizontally, fills remaining width with `TabGapStyle` (bottom-border-only style) to extend the horizontal rule edge-to-edge.

#### renderCompactTabBar (`shell.go:178-204`)

Narrow-terminal fallback:
- Label format: `" {i+1}:{name} "` (no brackets)
- Active: `CurrentStyle.Bold(true)` (bold, Primary color)
- Inactive: `DimStyle` (gray)
- Tabs joined by dim `"│"` separator
- Bottom rule: `strings.Repeat("─", width-2)` in dim style

### 2. Tab Styling System

#### Border Structures (`theme.go:99-120`)

**ActiveTabBorder** (lines 99-108):
```
╭─────╮     Top corners: ╭ ╮
│     │     Sides: │
┘     └     Bottom corners: ┘ └  (open bottom - space below)
```
- Bottom border: `" "` (space) -- creates visual "opening" into content
- Bottom corners: `┘` and `└` (reverse curves)

**InactiveTabBorder** (lines 111-120):
```
╭─────╮     Top corners: ╭ ╮
│     │     Sides: │
┴─────┴     Bottom corners: ┴ ┴  (connects to horizontal rule)
```
- Bottom border: `"─"` (solid line)
- Bottom corners: `┴` (T-junctions connecting to rule below)

#### Tab Styles (`theme.go:96, 122-141`)

- **TabBorderColor**: Defaults to `Primary` (`#7C3AED` purple), can be overridden by `ApplyTheme()`
- **TabActiveStyle** (122-127): Uses ActiveTabBorder, bold text, Primary foreground, `Padding(0, 1)`
- **TabInactiveStyle** (129-133): Uses InactiveTabBorder, Dim foreground (`#6B7280` gray), `Padding(0, 1)`
- **TabGapStyle** (136-141): Uses InactiveTabBorder but disables top/left/right borders, leaving only bottom visible

#### Theme Responsiveness (`theme.go:220-243`)

`ApplyTheme(accentHex)` updates `Primary` and `TabBorderColor`, then rebuilds all three tab styles with new border foreground.

### 3. Powerline Rendering System

#### Separator Characters (`powerline.go:9-23`)

**Nerd Font separators** (slant style):

| Constant | Unicode | Visual | Used For |
|----------|---------|--------|----------|
| `SepRight` | `\uE0BC` | ` ` (backslash slant) | Left-aligned segments |
| `SepLeft` | `\uE0BA` | ` ` (backslash slant) | Right-aligned segments |

**ASCII fallback separators**:

| Constant | Unicode | Visual | Rendered |
|----------|---------|--------|----------|
| `SepRightASCII` | `\u25B6` | `▶` | Right-pointing triangle |
| `SepLeftASCII` | `\u25C0` | `◀` | Left-pointing triangle |

Note: "Thin" variants (`SepRightThin`, `SepLeftThin`) are declared but never used.

#### Segment Data Structure (`powerline.go:116-120`)

```go
type Segment struct {
    Content    string
    Foreground lipgloss.Color
    Background lipgloss.Color
}
```

#### BuildPowerline -- Left-Aligned Rendering (`powerline.go:124-154`)

For each segment at index `i`:
1. **Render content** with `Padding(0, 1)` and segment's foreground/background
2. **Render separator** (`icons.SepRight`):
   - Separator foreground = current segment's background
   - Separator background = next segment's background (or `barBg` if last)

Key powerline technique (`powerline.go:147-150`):
```go
sepStyle := lipgloss.NewStyle().
    Foreground(seg.Background).  // Current segment color fills the separator
    Background(nextBg)            // Next segment color shows through unfilled portion
```

This creates the visual illusion of one colored block transitioning into another via the slanted glyph.

#### BuildPowerlineRight -- Right-Aligned Rendering (`powerline.go:158-188`)

Mirror of `BuildPowerline`:
- Places separator **before** each segment
- Separator foreground = current segment's background
- Separator background = previous segment's background (or `barBg` if first)

#### RenderPowerlineBar (`powerline.go:191-215`)

Combines left and right rendered strings:
1. Measures widths with `lipgloss.Width()` (accounts for ANSI)
2. Calculates spacer: `width - leftWidth - rightWidth`
3. Creates spacer string with `barBg` background
4. Concatenates: `left + spacer + right`
5. Wraps in style with `Background(barBg).Width(width)`

#### Icon System (`powerline.go:26-101`)

**Icons struct** (lines 50-61): Bundles separator glyphs (`SepRight`, `SepLeft`) with content icons (`GitBranch`, `Clock`, `Circle`, etc.)

**Selection** (`powerline.go:96-101`):
- `GetIcons(hasNerdFont bool)` returns `NerdIcons()` or `ASCIIIcons()`
- `hasNerdFont` from `terminal/detect.go:154`: checks if font family contains "nerd" (case-insensitive)

### 4. Footer Powerline Implementation (Reference Pattern)

#### renderPowerlineFooter (`footer.go:114-240`)

Three phases:
1. **Icon resolution** (line 115): `icons := styles.GetIcons(m.HasNerdFont)`
2. **Segment construction**:
   - Left segments (4 total): Workflow phase, active tab, git branch, story ID
   - Right segments (4 total): Quality gates, progress, iteration, elapsed time
3. **Rendering delegation**:
   ```go
   left := styles.BuildPowerline(leftSegments, width, FooterBg, icons)
   right := styles.BuildPowerlineRight(rightSegments, FooterBg, icons)
   return styles.RenderPowerlineBar(left, right, width, FooterBg)
   ```

#### Workflow Phase Colors (`powerline.go:108-112`)

Mapped from `ActiveView`:

| Phase | View | Color | Hex |
|-------|------|-------|-----|
| RESEARCH | `ViewResearch` | Blue | `#3B82F6` |
| PLAN | `ViewPlans` | Teal | `#14B8A6` |
| IMPLEMENT | `ViewSpectrum` | Green | `#22C55E` |
| VALIDATE | `ViewMonitor` | Amber | `#F59E0B` |
| IDLE | default | Primary | `#7C3AED` |

#### Segment Examples from Footer

Left segments (`footer.go:122-166`):

| Segment | Background | Content | Width Condition |
|---------|------------|---------|-----------------|
| Workflow phase | Phase color | `"RESEARCH"`, etc. | Always |
| Active tab | `#2c2d3a` | Icon + name | Always |
| Git branch | `#363748` | Branch icon + name | Always |
| Story ID | `#3d3e50` | Story ID string | `width >= 100` |

Right segments (`footer.go:170-233`):

| Segment | Background | Content | Width Condition |
|---------|------------|---------|-----------------|
| Quality gates | `#363748` | Pass/fail counts | `width >= 80` |
| Progress | `#2c2d3a` | `"N/M"` | `total > 0` |
| Iteration | `#363748` | `"iter N"` | `width >= 90` |
| Elapsed time | Phase color | Clock + duration | Spectrum running |

Left segments progress from bright phase color through increasingly dim grays. Rightmost right segment mirrors the phase color for "bookend" effect.

#### Two-Tier Footer (`footer.go:243-247`)

```go
func (m Model) renderTwoTierFooter(width int) string {
    tier1 := m.renderKeyHintsFooter(width)
    tier2 := m.renderPowerlineFooter(width)
    return lipgloss.JoinVertical(lipgloss.Left, tier1, tier2)
}
```

Stacks key hints bar above powerline status bar.

### 5. Multi-Line Rendering Patterns

#### Pattern 1: Two-Tier Footer (2 lines) -- `footer.go:242-247`

```go
func (m Model) renderTwoTierFooter(width int) string {
    tier1 := m.renderKeyHintsFooter(width)
    tier2 := m.renderPowerlineFooter(width)
    return lipgloss.JoinVertical(lipgloss.Left, tier1, tier2)
}
```

Two separate rendering functions, joined vertically with `lipgloss.Left` alignment.

#### Pattern 2: Three-Line Braille Prism -- `theme.go:411-444`

```go
func RenderPrismBraille(frame int) string {
    // ... color setup ...

    line1 := white.Render("  ─") + glass.Render("⢀⣠⣤⣄⡀")
    line2 := white.Render("━━") + glass.Render("⣾⣿⣿⣿⣷")
    line3 := "  " + glass.Render("⠈⠉") + ray1 + ray2 + ray3 + ray4 + ...

    return line1 + "\n" + line2 + "\n" + line3
}
```

Each line built separately with Unicode braille characters, joined with `\n`.

#### Pattern 3: Five-Line ASCII Art -- `theme.go:446-482`

```go
func RenderPrismASCII(frame int) string {
    // ... color setup ...

    line1 := "        " + glassHL.Render("╱╲")
    line2 := white.Render("   ━━━") + glassHL.Render("╱") + glass.Render("  ") + glass.Render("╲")
    line3 := "      " + glass.Render("╱") + "    " + glass.Render("╲") + rayStyles[0].Render("━━━")
    line4 := "     " + glass.Render("╱") + glassHL.Render("______") + glass.Render("╲") + ...
    line5 := "               " + rayStyles[2].Render("▬▬▬") + rayStyles[3].Render("▬▬▬")

    return line1 + "\n" + line2 + "\n" + line3 + "\n" + line4 + "\n" + line5
}
```

Box drawing characters (`╱`, `╲`, `━`, `═`, `▬`), spacing for alignment, independent styling per line.

#### Pattern 4: Sidebar Logo (2 lines) -- `sidebar.go:91-109`

```go
func (m Model) renderSidebarLogo(width int) string {
    prismIcon := styles.RenderPrismCompact(m.Anim.PrismFrame)

    brand := styles.SidebarBrandStyle.Render("PRISM")
    version := styles.DimStyle.Render("v1.9.8")
    header := lipgloss.JoinHorizontal(lipgloss.Center, brand, " ", version)

    return lipgloss.JoinVertical(lipgloss.Left, prismIcon, header)
}
```

First horizontal join (brand + version), then vertical stack with icon.

#### Pattern 5: Sidebar Vertical Stack -- `sidebar.go:42-88`

```go
func (m Model) renderSidebar(height int) string {
    var blocks []string

    blocks = append(blocks, m.renderSidebarLogo(w))
    blocks = append(blocks, "")  // Empty string for spacing
    blocks = append(blocks, m.renderSidebarProjectInfo(w))
    blocks = append(blocks, "")
    // ... more sections ...

    content := lipgloss.JoinVertical(lipgloss.Left, blocks...)
    panel := styles.SidebarStyle.Width(SidebarWidth).MaxHeight(height - 1).Render(content)

    slashPattern := lipgloss.NewStyle().
        Foreground(styles.Primary).
        Width(SidebarWidth).
        Align(lipgloss.Right).
        Render(strings.Repeat("/", SidebarWidth))

    return lipgloss.JoinVertical(lipgloss.Left, slashPattern, panel)
}
```

Array of blocks built progressively, empty strings for spacing, final `JoinVertical` with slice expansion, decorative pattern line at top.

#### Pattern 6: App Shell Layout (3-tier) -- `shell.go:15-36`

```go
func (m Model) renderAppShell(content string) string {
    if m.showSidebar() {
        tabBar := m.renderTabBar(leftWidth)
        leftColumn := lipgloss.JoinVertical(lipgloss.Left, tabBar, content)
        mainRow := lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, m.renderSidebar(sidebarHeight))
        footer := m.renderTwoTierFooter(m.Width)
        return lipgloss.JoinVertical(lipgloss.Left, mainRow, footer)
    }

    tabBar := m.renderTabBar(m.Width)
    footer := m.renderTwoTierFooter(m.Width)
    return lipgloss.JoinVertical(lipgloss.Left, tabBar, content, footer)
}
```

Nested composition: vertical joins inside horizontal joins. With sidebar uses three levels of joining.

#### Pattern Summary

1. **`lipgloss.JoinVertical(lipgloss.Left, ...)`** -- Primary stacking method
2. **String concatenation with `\n`** -- Simple multi-line (ASCII art)
3. **Array of strings + `JoinVertical(...)`** -- Building blocks pattern
4. **Nested composition** -- Horizontal inside vertical joins
5. **Empty strings `""`** -- Visual separation between sections
6. **Individual line styling** -- Each line styled before joining

### 6. Mouse Interaction and Zone Detection

#### Zone Marking (`shell.go:161, 192-194`)

Both bordered and compact modes wrap each tab in `zone.Mark(tabZoneID, ...)`:
```go
tabZoneID := fmt.Sprintf("tab-%d", i)
zone.Mark(tabZoneID, style.Render(label))
```

#### Zone Scanning (`view.go:68`)

Entire UI passed through `zone.Scan(base)` to register screen positions for hit-testing.

#### Click Handling (`update.go:649-654`)

```go
for i := range m.TabOrder {
    zoneID := fmt.Sprintf("tab-%d", i)
    if zone.Get(zoneID).InBounds(msg) {
        return m.switchToTab(i)
    }
}
```

Iterates tab indices, constructs same zone ID, checks bounds, calls `switchToTab(i)`.

#### switchToTab (`update.go:403-412`)

Bounds-checks index, sets `m.ActiveView`, resolves plugin ID, calls `m.Registry.SetActive(pluginID)`, returns `m.pluginFocusCmd(pluginID)`.

## Patterns Found

### Reusable Powerline Pattern for Tabs

The powerline system in `styles/powerline.go` is fully generic and reusable:

1. **Create `[]Segment`** with desired content, foreground, and background colors
2. **Call `BuildPowerline(segments, width, barBg, icons)`** to render with separator logic
3. **Separator coloring** (`powerline.go:147-150`) automatically handles transitions:
   ```go
   sepStyle := lipgloss.NewStyle().
       Foreground(seg.Background).  // Current segment fills separator
       Background(nextBg)            // Next segment shows through
   ```

Footer demonstrates this pattern at `footer.go:236-239`:
```go
left := styles.BuildPowerline(leftSegments, width, FooterBg, icons)
right := styles.BuildPowerlineRight(rightSegments, FooterBg, icons)
return styles.RenderPowerlineBar(left, right, width, FooterBg)
```

### Multi-Line Construction Approaches

Three main approaches found:

1. **Separate line variables + `\n` concatenation** (braille, ASCII art prisms)
2. **`lipgloss.JoinVertical(lipgloss.Left, ...)` with components** (footer, sidebar, shell)
3. **Array building + slice expansion** (sidebar blocks)

For 3-line tab bar spanning full width, option 2 (JoinVertical with components) is most appropriate, matching the two-tier footer pattern.

### Border-to-Powerline Transition

Current bordered tabs use:
- Box drawing characters: `╭`, `╮`, `│`, `─`, `┴`, `┘`, `└`
- T-junctions for inactive tab connections
- Space character for active tab "opening"

Powerline approach uses:
- Slanted separators: `\uE0BC` (right), `\uE0BA` (left)
- Color transitions via foreground/background on separator glyphs
- No borders around segments, just background color blocks with padding

## Open Questions

1. **3-line layout structure**: Should the 3 lines be:
   - Top: Decorative pattern/gradient?
   - Middle: Main tab segments with slants?
   - Bottom: Thin rule or secondary info?

2. **Active tab highlighting**: With no borders, how to distinguish active tab?
   - Brighter background color (phase color like footer)?
   - Different foreground color?
   - Bold text?
   - Larger segment size?

3. **Responsive behavior**: Current bordered mode has fallback at ~130 cols
   - Keep compact mode for narrow terminals?
   - What width threshold for 3-line powerline tabs?

4. **Icon usage**: Current tabs show `[N] Name` format
   - Include plugin icons (currently empty strings)?
   - Use icons from `Icons` struct?

5. **Zone marking**: With 3-line tabs spanning vertically
   - Mark entire 3-line region for each tab?
   - How to handle vertical bounds checking?

6. **Alignment**: Footer powerline has left + right segments
   - Should tabs only be left-aligned segments?
   - Or include right-aligned info (like current view mode, time, etc.)?

7. **Background color gradient**: Footer uses gradient `#2c2d3a` → `#363748` → `#3d3e50`
   - Apply similar gradient across tabs?
   - Or use distinct colors per plugin/category?

8. **Width calculation**: `BuildPowerline` accepts `totalWidth` but doesn't use it
   - Need to modify for 3-line layout width management?
   - Or handle width at higher level before calling?

## References

- Existing powerline footer plan: `.prism/shared/plans/2026-02-16-powerline-footer-status-bar.md`
- Existing powerline footer research: `.prism/shared/research/2026-02-16-powerline-footer-status-bar.md`
- TUI architecture deep dive: `.prism/shared/research/2026-02-12-prism-cli-deep-dive.md`
