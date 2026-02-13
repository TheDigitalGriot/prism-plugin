package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// renderAppShell renders the application shell with header, tab bar, content, and footer
func (m Model) renderAppShell(content string) string {
	var sections []string

	// App header (3D prism + project name)
	sections = append(sections, m.renderAppHeader())

	// Tab bar
	sections = append(sections, m.renderTabBar())

	// Active view content
	sections = append(sections, content)

	// Footer (context-sensitive key hints)
	sections = append(sections, m.renderAppFooter())

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
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

// renderTabBar renders the tab navigation bar with labels from TabOrder (excludes onboarding)
func (m Model) renderTabBar() string {
	var tabs []string

	for i, view := range m.TabOrder {
		pluginID := viewToPluginID(view)
		p := m.Registry.PluginByID(pluginID)
		if p == nil {
			continue
		}
		tabLabel := fmt.Sprintf("[%d] %s %s", i+1, p.Icon(), p.Name())

		if pluginID == viewToPluginID(m.ActiveView) {
			tabs = append(tabs, styles.TabActiveStyle.Render(tabLabel))
		} else {
			tabs = append(tabs, styles.TabInactiveStyle.Render(tabLabel))
		}
	}

	tabBar := lipgloss.JoinHorizontal(lipgloss.Center, tabs...)
	return styles.PanelStyle.Width(m.Width - 2).Render(tabBar)
}

// renderAppFooter renders context-sensitive key hints from the active plugin
func (m Model) renderAppFooter() string {
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

	// Always show help and quit
	hints = append(hints, "[?] help")
	hints = append(hints, "[q] quit")

	footerText := strings.Join(hints, "  ")
	return styles.FooterStyle.Width(m.Width - 2).Render(footerText)
}
