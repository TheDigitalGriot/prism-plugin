# Research: Powerline Footer Status Bar

**Date**: 2026-02-16
**Research Question**: Understand everything needed to implement a Neovim lualine/powerline-style footer status bar for prism-cli that spans full terminal width below both content and sidebar.

## Summary

The current footer in `shell.go` renders simple key hints inside the left column only. To implement a powerline-style footer spanning the full terminal width below both content and sidebar, we need to:
1. Change the layout in `renderAppShell()` to build `(tab bar + content) | sidebar` horizontally first, then place the footer below that composite
2. Create powerline segment builders with colored backgrounds and separator characters (`\uE0B0` right-pointing solid, `\uE0B2` left-pointing solid)
3. Access plugin data via `Registry.PluginByID()` with type assertions to `*SpectrumPlugin`, `*GitPlugin`, and `*MonitorPlugin`
4. Build left segments (workflow phase, active tab, git branch, current story) and right segments (quality gates, progress, iteration, elapsed time)

## Files Discovered

| File Path | Purpose | Lines Referenced |
|-----------|---------|------------------|
| `cmd/prism-cli/app/shell.go` | App shell renderer with footer | 15-39 (renderAppShell), 208-235 (renderAppFooter) |
| `cmd/prism-cli/app/sidebar.go` | Sidebar renderer with plugin data access patterns | 125, 148, 231, 248, 322, 383 |
| `cmd/prism-cli/app/plugin_spectrum.go` | Spectrum plugin with execution state fields | 60-118 (struct), 596-615 (helpers) |
| `cmd/prism-cli/app/plugin_git.go` | Git plugin with branch/ahead/behind fields | 23-35 (GitState struct) |
| `cmd/prism-cli/app/plugin_monitor.go` | Monitor plugin with quality gates | 24-31 (QualityGate struct), 34-53 (MonitorState struct) |
| `cmd/prism-cli/app/update.go` | viewToPluginID mapping function | 461-487 |
| `cmd/prism-cli/plugin/registry.go` | Plugin registry with PluginByID and ActivePlugin | 81-83 (PluginByID), 87-92 (ActivePlugin) |
| `cmd/prism-cli/styles/theme.go` | Color palette and style definitions | 6-23 (colors), 235-253 (separators) |

## Component Analysis

### 1. Current Footer Implementation

**Location**: `cmd/prism-cli/app/shell.go:208-235`

**How it works**:
```go
func (m Model) renderAppFooter(width int) string {
	var hints []string

	// Global hints
	hints = append(hints, fmt.Sprintf("[1-%d] switch tabs", len(m.TabOrder)))
	hints = append(hints, "[tab/shift+tab] cycle")

	// Get view-specific hints from active plugin
	active := m.Registry.ActivePlugin()
	if active != nil {
		for _, kh := range active.KeyHints() {
			hints = append(hints, fmt.Sprintf("[%s] %s", kh.Key, kh.Description))
		}
	}

	// Sidebar toggle hint
	if m.Width >= CompactBreakpointWidth {
		hints = append(hints, "[ctrl+d] details")
	}

	// Always show help and quit
	hints = append(hints, "[?] help")
	hints = append(hints, "[q] quit")

	footerText := strings.Join(hints, "  ")
	return styles.FooterStyle.Width(width - 2).Render(footerText)
}
```

**Current behavior**:
- Builds simple text hints as a single string
- Joins with `"  "` separators
- Applies a single `FooterStyle` (dim color)
- Receives `width` parameter from parent (left column width when sidebar is visible)

### 2. Current Shell Layout (The Problem)

**Location**: `cmd/prism-cli/app/shell.go:15-39`

**Current structure**:
```go
func (m Model) renderAppShell(content string) string {
	if m.showSidebar() {
		leftWidth := m.Width - SidebarWidth

		// Build left column: tab bar + content + footer
		var leftSections []string
		leftSections = append(leftSections, m.renderTabBar(leftWidth))
		leftSections = append(leftSections, content)
		leftSections = append(leftSections, m.renderAppFooter(leftWidth))  // footer inside left column
		leftColumn := lipgloss.JoinVertical(lipgloss.Left, leftSections...)

		// Build sidebar at full terminal height
		sidebar := m.renderSidebar(m.Height)

		// Join left column and sidebar horizontally
		return lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, sidebar)
	}

	// No sidebar — standard vertical layout
	var sections []string
	sections = append(sections, m.renderTabBar(m.Width))
	sections = append(sections, content)
	sections = append(sections, m.renderAppFooter(m.Width))
	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}
```

**The problem**: Footer is inside the `leftColumn` vertical stack, so it only spans `leftWidth`. When sidebar is visible, the footer doesn't reach the right edge of the terminal.

**Required new structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Tab Bar (spans full width or left column width)            │
├────────────────────────────────┬────────────────────────────┤
│ Content Area                   │ Sidebar                    │
│                                │                            │
│                                │                            │
├────────────────────────────────┴────────────────────────────┤
│ Footer Status Bar (spans full terminal width)              │
└─────────────────────────────────────────────────────────────┘
```

**New rendering order**:
1. Tab bar
2. Horizontal join: content | sidebar
3. Footer (full width)
4. Vertical join: tab bar + (content|sidebar) + footer

### 3. Plugin Data Access Patterns

**Access method**: `Registry.PluginByID(id)` with type assertion

**Pattern from sidebar** (`cmd/prism-cli/app/sidebar.go`):

```go
// Access SpectrumPlugin data
if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
	// sp.state (AppState enum: StateIdle, StateRunning, StatePaused, StateComplete, StateError)
	// sp.planName (string)
	// sp.stories ([]StoryView)
	// sp.totalStories (int)
	// sp.currentStoryID / sp.currentStoryTitle (string)
	// sp.iteration (int)
	// sp.startTime (time.Time)
	// sp.completedCount() (int) - helper method
	// sp.elapsedTime() (time.Duration) - helper method
}

// Access GitPlugin data
if gp, ok := m.Registry.PluginByID("git").(*GitPlugin); ok {
	// gp.state.BranchName (string)
	// gp.state.Ahead / gp.state.Behind (int)
	// gp.state.StagedFiles ([]GitFileStatus)
	// gp.state.ModifiedFiles ([]GitFileStatus)
	// gp.state.UntrackedFiles ([]GitFileStatus)
}

// Access MonitorPlugin data
if mp, ok := m.Registry.PluginByID("monitor").(*MonitorPlugin); ok {
	// mp.state.QualityGates ([]QualityGate)
	// Each QualityGate has: Name, Status ("pass"/"fail"/"pending"/"unknown"), Command, LastRun, Output
}
```

**Nil safety**: If the plugin ID is not found, the map returns `nil`, and the type assertion yields `ok == false`. The code safely skips the block.

**Same-package access**: All plugins live in the `app` package alongside the Model, so there are no package boundaries preventing access to unexported fields.

### 4. viewToPluginID Mapping

**Location**: `cmd/prism-cli/app/update.go:461-487`

```go
func viewToPluginID(view ActiveView) string {
	switch view {
	case ViewHome:      return "home"
	case ViewResearch:  return "research"
	case ViewPlans:     return "plans"
	case ViewSpectrum:  return "spectrum"
	case ViewFiles:     return "files"
	case ViewGit:       return "git"
	case ViewAgent:     return "agent"
	case ViewMonitor:   return "monitor"
	case ViewWorkspaces: return "workspaces"
	case ViewOnboarding: return "onboarding"
	default:            return "home"
	}
}
```

**Usage for active tab info**:
```go
pluginID := viewToPluginID(m.ActiveView)
activePlugin := m.Registry.PluginByID(pluginID)
if activePlugin != nil {
	name := activePlugin.Name()  // "Spectrum", "Git", "Home", etc.
	icon := activePlugin.Icon()  // "", "", "", etc.
}
```

### 5. Color System

**Location**: `cmd/prism-cli/styles/theme.go:6-23`

**Available colors**:
```go
var (
	Primary    = lipgloss.Color("#7C3AED") // Purple
	Success    = lipgloss.Color("#10B981") // Green
	Warning    = lipgloss.Color("#F59E0B") // Yellow
	Error      = lipgloss.Color("#EF4444") // Red
	Info       = lipgloss.Color("#3B82F6") // Blue
	Dim        = lipgloss.Color("#6B7280") // Gray
	Background = lipgloss.Color("#1F2937") // Dark
	White      = lipgloss.Color("#FFFFFF")

	// Prism brand colors (spectrum gradient)
	PrismColors = []lipgloss.Color{
		lipgloss.Color("#3B82F6"), // Blue
		lipgloss.Color("#14B8A6"), // Teal
		lipgloss.Color("#22C55E"), // Green
		lipgloss.Color("#F59E0B"), // Amber
	}
)
```

**Workflow phase color mapping** (for footer segments):
- RESEARCH → Blue (`#3B82F6`)
- PLAN → Teal (`#14B8A6`)
- IMPLEMENT → Green (`#22C55E`)
- VALIDATE → Amber (`#F59E0B`)
- IDLE → Dim Gray (`#6B7280`)

## Patterns Found

### Pattern 1: Powerline Separators (Unicode)

**Source**: Web research on powerline-go and Nerd Fonts

**Powerline Unicode characters** (requires Nerd Fonts):
```go
const (
	SepRight      = "\uE0B0" //  (right-pointing solid)
	SepRightThin  = "\uE0B1" //  (right-pointing thin)
	SepLeft       = "\uE0B2" //  (left-pointing solid)
	SepLeftThin   = "\uE0B3" //  (left-pointing thin)
)
```

**Compatible fallback** (standard Unicode):
```go
const (
	SepRight      = "\u25B6" // ▶
	SepRightThin  = "\u276F" // ❯
	SepLeft       = "\u25C0" // ◀
	SepLeftThin   = "\u276E" // ❮
)
```

**Color transition logic** (from powerline-go):
```go
// The separator's foreground color matches the current segment's background,
// while the separator's background matches the next segment's background.
// This creates the seamless powerline effect.

buffer.WriteString(currentSegmentBg)      // Set current background
buffer.WriteString(segmentContent)         // Render segment text
buffer.WriteString(nextSegmentBg)          // Set next segment's background
buffer.WriteString(fgColor(currentSegmentBg)) // Set separator fg to current bg
buffer.WriteString(SepRight)               // Draw separator
```

### Pattern 2: Right Alignment with PlaceHorizontal

**Source**: `ref/sidecar/internal/plugins/notes/view.go:433-452`

```go
// Right-align content
rightAligned := lipgloss.PlaceHorizontal(width, lipgloss.Right, rightPart)

// Overlay left content by replacing leading spaces
leftWidth := lipgloss.Width(leftPart)
rightRunes := []rune(rightAligned)
if leftWidth > 0 && leftWidth < len(rightRunes) {
	result := leftPart + string(rightRunes[leftWidth:])
	return result
}
return rightAligned
```

**Key insight**: `lipgloss.PlaceHorizontal()` pads with spaces. We can overlay left content by replacing leading spaces, avoiding manual spacer width calculations.

### Pattern 3: Segment Join with Width Calculation

**Source**: Crush header rendering (`ref/crush/internal/ui/model/header.go:73-103`)

```go
var b strings.Builder
b.WriteString(leftContent)

// Calculate available width for middle content
availWidth := width - leftPadding - rightPadding - lipgloss.Width(b.String()) - minSeparators
middleContent := renderMiddle(availWidth)

// Calculate remaining width for separators
remainingWidth := width - lipgloss.Width(b.String()) - lipgloss.Width(middleContent) - leftPadding - rightPadding

if remainingWidth > 0 {
	b.WriteString(strings.Repeat(separatorChar, remainingWidth))
}

b.WriteString(rightContent)
```

**Key insight**: Use `lipgloss.Width()` for accurate width of styled strings (accounts for ANSI codes). Build left-to-right, calculating remaining space before adding right-aligned content.

### Pattern 4: Existing Footer Style

**Source**: `cmd/prism-cli/styles/theme.go:151-154`

```go
FooterStyle = lipgloss.NewStyle().
	Foreground(Dim).
	Padding(0, 1)
```

**Current rendering**:
```go
return styles.FooterStyle.Width(width - 2).Render(footerText)
```

**For powerline footer**, we'll build segments individually with different background colors, then join them, so we won't use a single `FooterStyle`. Instead, each segment gets its own background color.

## Data Sources for Footer Segments

### Left Segments

1. **Workflow Phase** (colored pill):
   - **Data source**: Could be determined by active plugin or a global state field
   - **Current approach**: Not directly tracked in Model
   - **Fallback**: Use `"IDLE"` as default, or derive from active plugin (e.g., Spectrum=IMPLEMENT, Research=RESEARCH, Plans=PLAN)
   - **Colors**: Blue/Teal/Green/Amber/Dim per phase

2. **Active Tab** (plugin name + icon):
   - **Data source**: `m.Registry.ActivePlugin()`
   - **Fields**: `activePlugin.Name()`, `activePlugin.Icon()`
   - **Example**: `" Spectrum"`

3. **Git Branch** (with icon):
   - **Data source**: `m.Registry.PluginByID("git").(*GitPlugin)`
   - **Fields**: `gp.state.BranchName`, `gp.state.Ahead`, `gp.state.Behind`
   - **Example**: ` main` or ` feat/spectrum [↑3 ↓1]`

4. **Current Story ID**:
   - **Data source**: `m.Registry.PluginByID("spectrum").(*SpectrumPlugin)`
   - **Fields**: `sp.currentStoryID` (only show if non-empty)
   - **Example**: `DEMO-013`

### Right Segments

1. **Quality Gates** (pass/fail counts):
   - **Data source**: `m.Registry.PluginByID("monitor").(*MonitorPlugin)`
   - **Fields**: `mp.state.QualityGates` (slice of QualityGate structs)
   - **Aggregation**: Count gates with `Status == "pass"` (green) and `Status == "fail"` (red)
   - **Example**: `● 3 ● 1` (3 pass, 1 fail)

2. **Story Progress**:
   - **Data source**: `m.Registry.PluginByID("spectrum").(*SpectrumPlugin)`
   - **Fields**: `sp.completedCount()`, `sp.totalStories`
   - **Format**: `"12/36 stories"` or `"33%"`

3. **Iteration Counter**:
   - **Data source**: `m.Registry.PluginByID("spectrum").(*SpectrumPlugin)`
   - **Fields**: `sp.iteration`, `m.MaxIterations` (or `p.ctx.MaxIterations` from SpectrumPlugin's context)
   - **Example**: `iter 5/50`

4. **Elapsed Time**:
   - **Data source**: `m.Registry.PluginByID("spectrum").(*SpectrumPlugin)`
   - **Fields**: `sp.elapsedTime()` (returns `time.Duration`)
   - **Format helper**: `formatDuration(d)` from `cmd/prism-cli/app/view.go:107-122`
   - **Example**: `2m 34s`

## Open Questions

1. **Workflow phase tracking**: How to determine the current phase (RESEARCH/PLAN/IMPLEMENT/VALIDATE/IDLE)? Options:
   - Add a `CurrentPhase` field to the Model
   - Derive from active plugin (Spectrum=IMPLEMENT, Research=RESEARCH, etc.)
   - Leave as "IDLE" for now and add later

2. **Powerline font detection**: Should we detect if Nerd Fonts are available and fall back to standard Unicode separators? Or just use Nerd Fonts and document the requirement?

3. **Segment overflow**: If the footer has too many segments to fit in the terminal width, how should we handle overflow?
   - Truncate segments from the middle?
   - Hide optional segments (like current story ID)?
   - Just let it wrap/truncate?

4. **Tab bar width**: Should the tab bar remain at `leftWidth` when sidebar is visible, or span full width? Currently it's inside the left column at `leftWidth`.

5. **Footer background color**: Should the footer have a global background color (like `Background` dark gray), or should gaps between segments be transparent?

## Implementation Plan Preview

**Phase 1: Powerline Segment Builder** (`styles/powerline.go`):
- Define separator constants
- Create `Segment` struct with `Content`, `Foreground`, `Background`
- Create `RenderSegment()` function
- Create `RenderSegments()` function that joins segments with separators

**Phase 2: Footer Data Collection** (`app/footer.go`):
- Create `collectFooterData()` method on Model
- Return a struct with all segment data (workflow phase, active tab, git branch, etc.)

**Phase 3: Footer Rendering** (`app/footer.go`):
- Create `renderPowerlineFooter()` method
- Build left segments (workflow, tab, branch, story)
- Build right segments (gates, progress, iteration, elapsed)
- Use `PlaceHorizontal` or manual spacer for left+right alignment

**Phase 4: Shell Layout Update** (`app/shell.go`):
- Modify `renderAppShell()` to build (tab bar + content) | sidebar horizontally first
- Place footer below the composite
- Vertical join: tab bar + (content|sidebar) + footer

**Phase 5: Demo Data Wiring**:
- Ensure demo mode populates all data sources
- Test with and without sidebar
- Test at various terminal widths

**Phase 6: Validation**:
- Build and run (`make build && make run`)
- Switch between tabs, verify active tab updates
- Start Spectrum execution, verify iteration/elapsed updates
- Check all screen sizes (narrow, normal, wide)
