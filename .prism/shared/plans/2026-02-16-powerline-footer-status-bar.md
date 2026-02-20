# Plan: Two-Tier Powerline Footer Status Bar

**Date**: 2026-02-16
**Research**: `.prism/shared/research/2026-02-16-powerline-footer-status-bar.md`

## Goal

Add a two-tier footer to prism-cli that spans the full terminal width below both the content area and sidebar:

```
┌─────────────────────────────────────────────────────────────┐
│ Tab Bar (left column width)                                 │
├────────────────────────────────┬────────────────────────────┤
│ Content Area                   │ Sidebar                    │
│                                │                            │
├────────────────────────────────┴────────────────────────────┤
│ [1-9] switch tabs  [enter] start  [?] help  [q] quit       │  ← Tier 1: key hints (full width)
│ ▌IDLE▐ Home ▐  main ▐          ▐ ● 3 ● 1 ▐ 12/36 ▐ 2m34s│  ← Tier 2: powerline bar (full width)
└─────────────────────────────────────────────────────────────┘
```

- **Tier 1 (top)**: Context-aware plain-text key hints — different hints per active plugin (existing `renderAppFooter` logic, moved to full width)
- **Tier 2 (bottom)**: Neovim lualine/powerline-style status bar with colored segments and powerline separators

## What We're NOT Doing

- Not replacing the key hints footer — keeping it as tier 1
- Not changing the tab bar width/position (stays in left column)
- Not adding font detection fallback — assuming Nerd Fonts available
- Not adding a new workflow phase field to Model — deriving from active view
- Not changing sidebar rendering logic

## Success Criteria

#### Automated Verification
- [x] `cd cmd/prism-cli && go build ./...` compiles without errors
- [x] `cd cmd/prism-cli && go vet ./...` passes
- [x] `cd cmd/prism-cli && go test ./...` passes (if tests exist)

#### Manual Verification
- [ ] Footer spans full terminal width (below sidebar) when sidebar is visible
- [ ] Footer spans full terminal width when sidebar is hidden
- [ ] Key hints tier shows different hints per tab (switch tabs 1-9)
- [ ] Powerline bar shows workflow phase pill with correct color per view
- [ ] Powerline bar shows active tab name + icon
- [ ] Powerline bar shows git branch name
- [ ] Powerline bar shows current story ID when Spectrum is running
- [ ] Powerline bar shows quality gate counts (right side)
- [ ] Powerline bar shows story progress (right side)
- [ ] Powerline bar shows iteration counter when Spectrum is running (right side)
- [ ] Powerline bar shows elapsed time when Spectrum is running (right side)
- [ ] Demo mode (`--demo`) populates all segments with realistic data
- [ ] Narrow terminal (<80 cols) hides optional segments gracefully
- [ ] Powerline separators render correctly with proper color transitions

---

## Phase 1: Powerline Segment Builder (`styles/powerline.go`)

**Goal**: Create a reusable powerline segment rendering system in the styles package.

### Files
- **Create**: `cmd/prism-cli/styles/powerline.go`

### Steps

- [x] 1.1 Define powerline separator constants:
  ```go
  const (
      SepRight     = "\uE0B0" // right-pointing solid
      SepRightThin = "\uE0B1" // right-pointing thin (same-bg segments)
      SepLeft      = "\uE0B2" // left-pointing solid
      SepLeftThin  = "\uE0B3" // left-pointing thin
  )
  ```

- [x] 1.2 Define footer-specific colors:
  ```go
  var (
      FooterBg = lipgloss.Color("#1a1b26") // Dark background for bar fill
      // Workflow phase backgrounds
      PhaseResearch  = lipgloss.Color("#3B82F6") // Blue
      PhasePlan      = lipgloss.Color("#14B8A6") // Teal
      PhaseImplement = lipgloss.Color("#22C55E") // Green
      PhaseValidate  = lipgloss.Color("#F59E0B") // Amber
      PhaseIdle      = lipgloss.Color("#4B5563") // Dim gray
  )
  ```

- [x] 1.3 Create `Segment` struct:
  ```go
  type Segment struct {
      Content    string
      Foreground lipgloss.Color
      Background lipgloss.Color
  }
  ```

- [x] 1.4 Create `BuildPowerline(segments []Segment, totalWidth int, barBg lipgloss.Color) string`:
  - Iterate segments, render each with `Foreground`/`Background` + `Padding(0, 1)`
  - Between segments, render separator `SepRight` with `fg=currentBg, bg=nextBg`
  - After last segment, render separator `SepRight` with `fg=lastBg, bg=barBg`
  - Return the joined string

- [x] 1.5 Create `BuildPowerlineRight(segments []Segment, barBg lipgloss.Color) string`:
  - Same logic but segments are right-aligned
  - Before first segment, render separator `SepLeft` with `fg=firstBg, bg=barBg`
  - Between segments, render separator `SepLeft` with `fg=currentBg, bg=prevBg`

- [x] 1.6 Create `RenderPowerlineBar(left, right string, width int, barBg lipgloss.Color) string`:
  - Calculate spacer width: `width - lipgloss.Width(left) - lipgloss.Width(right)`
  - Fill spacer with `barBg` background spaces
  - Return `left + spacer + right`
  - Apply `barBg` background to the entire bar for consistent fill

### Verification
```bash
cd cmd/prism-cli && go build ./...
```

---

## Phase 2: Footer Bar Renderer (`app/footer.go`)

**Goal**: Create the footer data collection and two-tier rendering in a new file.

### Files
- **Create**: `cmd/prism-cli/app/footer.go`

### Steps

- [x] 2.1 Create `workflowPhase() string` method on Model:
  - Map `m.ActiveView` to phase string:
    - `ViewResearch` → `"RESEARCH"`
    - `ViewPlans` → `"PLAN"`
    - `ViewSpectrum` → `"IMPLEMENT"`
    - `ViewMonitor` → `"VALIDATE"`
    - All others → `"IDLE"`

- [x] 2.2 Create `workflowPhaseColor() lipgloss.Color` method on Model:
  - Return corresponding `styles.Phase*` color for each phase

- [x] 2.3 Create `renderKeyHintsFooter(width int) string` method on Model:
  - Move existing `renderAppFooter` logic here (same behavior, now receives full width)
  - Keep context-aware hints from `active.KeyHints()`
  - Use `styles.FooterStyle.Width(width - 2).Render(footerText)`

- [x] 2.4 Create `renderPowerlineFooter(width int) string` method on Model:
  - Build left segments:
    1. **Workflow phase**: `Segment{Content: phase, Fg: White, Bg: phaseColor}`
    2. **Active tab**: `Segment{Content: icon + " " + name, Fg: White, Bg: #2c2d3a}` (slightly lighter than bar bg)
    3. **Git branch**: from `PluginByID("git").(*GitPlugin)` → `Segment{Content: " " + branch, Fg: White, Bg: #363748}`
    4. **Current story** (conditional): from `PluginByID("spectrum").(*SpectrumPlugin)` → only if `sp.currentStoryID != ""` → `Segment{Content: storyID, Fg: White, Bg: #3d3e50}`
  - Build right segments:
    1. **Quality gates**: from `PluginByID("monitor").(*MonitorPlugin)` → count pass/fail → `Segment{Content: "● N ● M", Fg: varies, Bg: #363748}`
    2. **Story progress**: from SpectrumPlugin → `Segment{Content: "N/M stories", Fg: White, Bg: #2c2d3a}`
    3. **Iteration**: from SpectrumPlugin → only if `sp.iteration > 0` → `Segment{Content: "iter N/M", Fg: White, Bg: #363748}`
    4. **Elapsed time**: from SpectrumPlugin → only if running → `Segment{Content: elapsed, Fg: White, Bg: phaseColor}` (bookend matching phase color)
  - Call `styles.BuildPowerline()` for left, `styles.BuildPowerlineRight()` for right
  - Call `styles.RenderPowerlineBar()` to join with spacer

- [x] 2.5 Create `renderTwoTierFooter(width int) string` method on Model:
  - Call `renderKeyHintsFooter(width)` for tier 1
  - Call `renderPowerlineFooter(width)` for tier 2
  - Return `lipgloss.JoinVertical(lipgloss.Left, tier1, tier2)`

- [x] 2.6 Handle narrow terminals (<80 cols):
  - Skip story ID segment if `width < 100`
  - Skip iteration segment if `width < 90`
  - Skip quality gates segment if `width < 80`
  - Always show: workflow phase, active tab, git branch (left); elapsed time, story progress (right)

### Verification
```bash
cd cmd/prism-cli && go build ./...
```

---

## Phase 3: Shell Layout Restructure (`app/shell.go`)

**Goal**: Move the two-tier footer below the sidebar+content composite so it spans full terminal width.

### Files
- **Modify**: `cmd/prism-cli/app/shell.go`

### Steps

- [x] 3.1 Modify `renderAppShell()` for sidebar case:
  ```go
  if m.showSidebar() {
      leftWidth := m.Width - SidebarWidth

      // Tab bar (left column width)
      tabBar := m.renderTabBar(leftWidth)

      // Content + sidebar horizontal join (NO footer here)
      contentRow := lipgloss.JoinHorizontal(lipgloss.Top, content, m.renderSidebar(m.Height))

      // Two-tier footer at full terminal width
      footer := m.renderTwoTierFooter(m.Width)

      return lipgloss.JoinVertical(lipgloss.Left, tabBar, contentRow, footer)
  }
  ```

- [x] 3.2 Modify `renderAppShell()` for no-sidebar case:
  ```go
  // No sidebar — standard vertical layout
  tabBar := m.renderTabBar(m.Width)
  footer := m.renderTwoTierFooter(m.Width)
  return lipgloss.JoinVertical(lipgloss.Left, tabBar, content, footer)
  ```

- [x] 3.3 Remove or deprecate old `renderAppFooter()`:
  - The logic moves to `renderKeyHintsFooter()` in `footer.go`
  - Delete the old method from `shell.go` to avoid confusion
  - The `FooterStyle` in `theme.go` remains in use by `renderKeyHintsFooter()`

- [x] 3.4 Adjust sidebar height calculation:
  - Sidebar height may need to account for 2 fewer rows (the two-tier footer)
  - Check if `m.Height` passed to `renderSidebar()` needs adjusting: `m.Height - 2` (approx 2 lines for footer)

### Verification
```bash
cd cmd/prism-cli && go build ./...
```

---

## Phase 4: Demo Data & Validation

**Goal**: Ensure demo mode shows all segments populated. Build and visually verify.

### Steps

- [x] 4.1 Verify demo mode data sources:
  - `SpectrumPlugin`: already has demo stories, currentStoryID, iteration (seeded in `NewDemoModel`)
  - `GitPlugin`: already has demo branch "feat/spectrum-migration", ahead=3, behind=1
  - `MonitorPlugin`: already has demo quality gates (Lint=pass, Tests=pass, Build=pass)
  - No new demo data needed — all sources already seeded

- [x] 4.2 Build and run:
  ```bash
  cd cmd/prism-cli && go build -o prism-cli . && ./prism-cli --demo
  ```

- [ ] 4.3 Visual verification checklist:
  - [ ] Switch between tabs 1-9, verify key hints change per tab
  - [ ] Verify powerline bar shows correct workflow phase per tab
  - [ ] Verify git branch "feat/spectrum-migration" appears
  - [ ] Start Spectrum execution (Enter), verify story ID, iteration, elapsed appear
  - [ ] Resize terminal narrow (<80), verify optional segments hide
  - [ ] Toggle sidebar (ctrl+d), verify footer still spans full width
  - [ ] Verify powerline separator colors transition correctly between segments

- [x] 4.4 Fix any build or visual issues discovered during testing

### Verification
```bash
cd cmd/prism-cli && go build ./... && go vet ./...
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Powerline glyphs don't render (no Nerd Fonts) | TUI already uses Nerd Font icons in tabs — same requirement |
| Sidebar height misalignment after layout change | Adjust height calc in Phase 3 step 3.4 |
| Width calculation off-by-one with ANSI codes | Use `lipgloss.Width()` everywhere, never `len()` |
| Footer flickers during animation ticks | Footer is static data, no animations — only updates on state change |
| Color transitions look wrong on light terminals | `FooterBg` is dark regardless — matches lualine convention |

## Edge Cases

- **No git data**: Git branch segment shows nothing (empty string, segment hidden)
- **No stories loaded**: Story progress and iteration segments hidden
- **Spectrum not running**: Elapsed time and iteration segments hidden
- **All quality gates unknown**: Quality gates segment shows `● 0` or is hidden
- **Very narrow terminal (<60 cols)**: Only show workflow phase + active tab (left), nothing on right
- **Very wide terminal (>200 cols)**: Spacer fills between left and right groups naturally
