package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-tui/styles"
)

// Chrome height constants for the app shell.
const (
	FooterHeight       = 3 // key hints (border-top + content) + powerline bar
	PowerlineTabHeight = 3 // 3-line powerline tab bar
	CompactTabHeight   = 2 // 1-line compact tabs + separator rule
)

// tabBarHeight returns the height of the tab bar based on whether powerline or compact mode is active.
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

// contentHeight returns the available height for plugin content after subtracting chrome (tab bar + footer).
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

// renderAppShell renders the application shell with tab bar, content, and footer.
// When the terminal is wide enough (>= 120 cols), a full-height right-side panel
// (inspired by Crush) is rendered alongside the left column (tabs + content + footer).
func (m Model) renderAppShell(content string) string {
	if m.showSidebar() {
		leftWidth := m.Width - SidebarWidth

		// Tab bar + content form the left column
		tabBar := m.renderTabBar(leftWidth)
		leftColumn := lipgloss.JoinVertical(lipgloss.Left, tabBar, content)

		// Sidebar spans full height (subtract footer)
		sidebarHeight := m.Height - FooterHeight
		mainRow := lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, m.renderSidebar(sidebarHeight))

		// Two-tier footer at full terminal width
		footer := m.renderTwoTierFooter(m.Width)

		return lipgloss.JoinVertical(lipgloss.Left, mainRow, footer)
	}

	// No sidebar — standard vertical layout
	tabBar := m.renderTabBar(m.Width)
	footer := m.renderTwoTierFooter(m.Width)
	return lipgloss.JoinVertical(lipgloss.Left, tabBar, content, footer)
}

// renderAppHeader renders the persistent app header with 3D prism and project info
func (m Model) renderAppHeader() string {
	// Left: 3D prism animation
	var leftSection string
	if m.Prism != nil {
		prismStr := m.Prism.String()
		leftSection = prismStr
	} else {
		// Fallback: simple prism icon
		leftSection = styles.RenderPrismCompact(m.Anim.PrismFrame)
	}

	// Middle: Project name
	projectName := "PRISM TUI"
	if m.ProjectDir != "" {
		// Extract project directory name
		parts := strings.Split(strings.ReplaceAll(m.ProjectDir, "\\", "/"), "/")
		if len(parts) > 0 {
			projectName = parts[len(parts)-1]
		}
	}
	middleSection := styles.TitleStyle.Render(projectName)

	// Right: elapsed time from Spectrum plugin if running
	rightSection := ""
	if sp, ok := m.Registry.ActivePlugin().(*SpectrumPlugin); ok {
		if sp.state == StateRunning && !sp.startTime.IsZero() {
			elapsed := formatDuration(sp.elapsedTime())
			rightSection = styles.DimStyle.Render(elapsed)
		}
	}

	// Calculate spacing
	leftWidth := lipgloss.Width(leftSection)
	middleWidth := lipgloss.Width(middleSection)
	rightWidth := lipgloss.Width(rightSection)
	totalContentWidth := leftWidth + middleWidth + rightWidth
	spacerWidth := m.Width - totalContentWidth - 4
	if spacerWidth < 2 {
		spacerWidth = 2
	}

	// Join sections
	header := lipgloss.JoinHorizontal(lipgloss.Center,
		leftSection,
		" ",
		middleSection,
		strings.Repeat(" ", spacerWidth),
		rightSection,
	)

	return styles.AppHeaderStyle.Width(m.Width).Render(header)
}

// tabIcon returns the icon for a plugin tab from the icon set.
func tabIcon(pluginID string, icons styles.Icons) string {
	switch pluginID {
	case "home":
		return icons.Home
	case "research":
		return icons.Search
	case "plans":
		return icons.List
	case "spectrum":
		return icons.Bolt
	case "files":
		return icons.Folder
	case "git":
		return icons.GitBranch
	case "agent":
		return icons.User
	case "monitor":
		return icons.Chart
	case "workspaces":
		return icons.Grid
	default:
		return ""
	}
}

// tabLabel returns the display label for a plugin tab.
func tabLabel(pluginID string, name string, icon string) string {
	if icon != "" {
		return icon + " " + name
	}
	return name
}

// renderBreadcrumb renders a powerline-style breadcrumb bar: PRISM ▶ viewName
// Uses filled triangle separators (\uE0B0) instead of the slant separators used elsewhere.
func renderBreadcrumb(viewName string, width int, hasNerdFont bool) string {
	barBg := lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", styles.TermBgR, styles.TermBgG, styles.TermBgB))

	// Triangle separator glyph (classic powerline arrow)
	sep := "\uE0B0"
	if !hasNerdFont {
		sep = "\u25B6" // ▶ fallback
	}

	segments := []styles.Segment{
		{Content: "PRISM", Foreground: styles.White, Background: lipgloss.Color("#2c2d3a")},
		{Content: viewName, Foreground: styles.White, Background: lipgloss.Color("#363748")},
	}

	// Build segments with triangle separators
	var parts []string
	for i, seg := range segments {
		style := lipgloss.NewStyle().
			Foreground(seg.Foreground).
			Background(seg.Background).
			Padding(0, 1)
		parts = append(parts, style.Render(seg.Content))

		var nextBg lipgloss.Color
		if i < len(segments)-1 {
			nextBg = segments[i+1].Background
		} else {
			nextBg = barBg
		}
		sepStyle := lipgloss.NewStyle().
			Foreground(seg.Background).
			Background(nextBg)
		parts = append(parts, sepStyle.Render(sep))
	}

	left := strings.Join(parts, "")
	return styles.RenderPowerlineBar(left, "", width, barBg)
}

// renderTabBar renders the tab navigation bar.
// Uses 3-line powerline tabs when they fit; falls back to compact inline style for narrow terminals.
func (m Model) renderTabBar(width int) string {
	icons := styles.GetIcons(m.HasNerdFont)

	// Estimate powerline tab width: each label + 2 padding + 1 separator
	totalPowerlineWidth := 0
	for _, view := range m.TabOrder {
		pluginID := viewToPluginID(view)
		p := m.Registry.PluginByID(pluginID)
		if p == nil {
			continue
		}
		icon := tabIcon(pluginID, icons)
		label := tabLabel(pluginID, p.Name(), icon)
		totalPowerlineWidth += lipgloss.Width(label) + 2 + 1 // padding + separator
	}

	if totalPowerlineWidth > width {
		return m.renderCompactTabBar(width)
	}
	return m.renderPowerlineTabBar(width)
}

// tabInfo holds rendering data for a single tab in the powerline bar.
type tabInfo struct {
	label    string
	pluginID string
	active   bool
	bg       lipgloss.Color
	fg       lipgloss.Color
}

// renderPowerlineTabBar renders a 3-line tall powerline tab bar with diagonal slant separators.
// The slant separator is offset ±1 char per row to create true diagonal edges:
//   - Top row:    first segment width -1 (separator shifted left)
//   - Middle row: base widths with labels and zone marks
//   - Bottom row: first segment width +1 (separator shifted right)
func (m Model) renderPowerlineTabBar(width int) string {
	icons := styles.GetIcons(m.HasNerdFont)
	activePluginID := viewToPluginID(m.ActiveView)

	// Collect tab info
	var tabs []tabInfo
	for _, view := range m.TabOrder {
		pluginID := viewToPluginID(view)
		p := m.Registry.PluginByID(pluginID)
		if p == nil {
			continue
		}
		icon := tabIcon(pluginID, icons)
		label := tabLabel(pluginID, p.Name(), icon)
		isActive := pluginID == activePluginID

		var bg lipgloss.Color
		var fg lipgloss.Color
		if isActive {
			bg = styles.Primary
			fg = styles.White
		} else {
			bg = styles.TabBarInactiveBg
			fg = styles.Dim
		}

		tabs = append(tabs, tabInfo{
			label:    label,
			pluginID: pluginID,
			active:   isActive,
			bg:       bg,
			fg:       fg,
		})
	}

	if len(tabs) == 0 {
		return ""
	}

	// Calculate base widths: label visual width + 2 padding (1 each side)
	baseWidths := make([]int, len(tabs))
	for i, t := range tabs {
		baseWidths[i] = lipgloss.Width(t.label) + 2
	}

	// buildRow constructs one row of the 3-line tab bar.
	// firstOffset: -1 for top, 0 for middle, +1 for bottom
	// contentFn: returns content string for segment i given its width
	// markZones: whether to wrap segments in zone.Mark for mouse clicks
	// capReserve: 0 = no trailing cap, N = reserve N chars from right edge for cap
	//   (cap is 1 char, remaining N-1 chars are trimmed from fill, creating the diagonal)
	buildRow := func(firstOffset int, contentFn func(i int, segWidth int) string, markZones bool, capReserve int) string {
		var parts []string
		for i, t := range tabs {
			segWidth := baseWidths[i]
			if i == 0 {
				segWidth += firstOffset
			}
			if segWidth < 1 {
				segWidth = 1
			}

			content := contentFn(i, segWidth)

			segStyle := lipgloss.NewStyle().
				Foreground(t.fg).
				Background(t.bg)
			rendered := segStyle.Render(content)

			if markZones {
				tabZoneID := fmt.Sprintf("tab-%d", i)
				rendered = zone.Mark(tabZoneID, rendered)
			}
			parts = append(parts, rendered)

			// Separator: current bg → next bg (trail into Primary after last tab)
			var nextBg lipgloss.Color
			if i < len(tabs)-1 {
				nextBg = tabs[i+1].bg
			} else {
				nextBg = styles.Primary
			}
			sepStyle := lipgloss.NewStyle().
				Foreground(t.bg).
				Background(nextBg)
			parts = append(parts, sepStyle.Render(icons.SepRight))
		}

		// Small diagonal accent after tabs (fixed width, not filling entire terminal)
		const accentBase = 3
		row := strings.Join(parts, "")
		rowWidth := lipgloss.Width(row)
		available := width - rowWidth
		if available < 0 {
			available = 0
		}
		fillWidth := accentBase
		if capReserve > 0 {
			fillWidth -= capReserve
		}
		if fillWidth > available-capReserve {
			fillWidth = available - capReserve
		}
		if fillWidth < 0 {
			fillWidth = 0
		}
		if fillWidth > 0 {
			fillStyle := lipgloss.NewStyle().Background(styles.Primary)
			parts = append(parts, fillStyle.Render(strings.Repeat(" ", fillWidth)))
		}
		if capReserve > 0 {
			// Closing slant: Primary → terminal default
			capStyle := lipgloss.NewStyle().Foreground(styles.Primary)
			parts = append(parts, capStyle.Render(icons.SepRight))
		}

		return strings.Join(parts, "")
	}

	// Top row: spaces only, first segment 1 char wider (separator shifts RIGHT), cap for diagonal
	topRow := buildRow(+1, func(i int, segWidth int) string {
		return strings.Repeat(" ", segWidth)
	}, false, 1)

	// Middle row: centered labels with zone marks, cap at right edge
	midRow := buildRow(0, func(i int, segWidth int) string {
		label := tabs[i].label
		labelWidth := lipgloss.Width(label)
		// Center the label in the segment
		totalPad := segWidth - labelWidth
		if totalPad < 0 {
			totalPad = 0
		}
		leftPad := totalPad / 2
		rightPad := totalPad - leftPad
		return strings.Repeat(" ", leftPad) + label + strings.Repeat(" ", rightPad)
	}, true, 1)

	// Bottom row: spaces only, first segment 1 char narrower (separator shifts LEFT)
	botRow := buildRow(-1, func(i int, segWidth int) string {
		return strings.Repeat(" ", segWidth)
	}, false, 1)

	return lipgloss.JoinVertical(lipgloss.Left, topRow, midRow, botRow)
}

// renderCompactTabBar renders a single-line compact tab bar for narrow terminals.
func (m Model) renderCompactTabBar(width int) string {
	var parts []string

	for i, view := range m.TabOrder {
		pluginID := viewToPluginID(view)
		p := m.Registry.PluginByID(pluginID)
		if p == nil {
			continue
		}
		label := fmt.Sprintf(" %d:%s ", i+1, p.Name())

		isActive := pluginID == viewToPluginID(m.ActiveView)
		tabZoneID := fmt.Sprintf("tab-%d", i)
		if isActive {
			parts = append(parts, zone.Mark(tabZoneID, styles.CurrentStyle.Bold(true).Render(label)))
		} else {
			parts = append(parts, zone.Mark(tabZoneID, styles.DimStyle.Render(label)))
		}
	}

	row := strings.Join(parts, styles.DimStyle.Render("│"))

	// Bottom rule to match bordered style
	rule := styles.DimStyle.Render(strings.Repeat("─", width-2))

	return row + "\n" + rule
}

// renderAppFooter has been replaced by renderTwoTierFooter in footer.go
// The key hints logic moved to renderKeyHintsFooter (tier 1)
// The powerline bar logic is in renderPowerlineFooter (tier 2)
