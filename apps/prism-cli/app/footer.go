package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/styles"
)

// workflowPhase returns the current workflow phase based on active view
func (m Model) workflowPhase() string {
	switch m.ActiveView {
	case ViewResearch:
		return "RESEARCH"
	case ViewPlans:
		return "PLAN"
	case ViewSpectrum:
		return "IMPLEMENT"
	case ViewMonitor:
		return "VALIDATE"
	default:
		return "IDLE"
	}
}

// workflowPhaseColor returns the color for the current workflow phase
func (m Model) workflowPhaseColor() lipgloss.Color {
	switch m.ActiveView {
	case ViewResearch:
		return styles.PhaseResearch
	case ViewPlans:
		return styles.PhasePlan
	case ViewSpectrum:
		return styles.PhaseImplement
	case ViewMonitor:
		return styles.PhaseValidate
	default:
		return styles.Primary
	}
}

// renderKeyHintsFooter renders tier 1: context-aware key hints (moved from renderAppFooter)
func (m Model) renderKeyHintsFooter(width int) string {
	var hints []string

	// View-specific hints from active plugin (global keys are in the [?] help modal)
	active := m.Registry.ActivePlugin()
	if active != nil {
		for _, kh := range active.KeyHints() {
			hints = append(hints, fmt.Sprintf("[%s] %s", kh.Key, kh.Description))
		}
	}

	footerText := strings.Join(hints, "  ")
	bg := lipgloss.Color("#232435")

	// Calculate content width (total minus left+right padding of 1 each)
	contentWidth := width - 2
	hintsWidth := lipgloss.Width(footerText)

	// Build hints portion
	hintsRendered := lipgloss.NewStyle().
		Foreground(styles.Dim).
		Background(bg).
		Render(footerText)

	// Fill right edge with decorative slash pattern in primary color
	remaining := contentWidth - hintsWidth
	slashWidth := remaining
	if slashWidth > SidebarWidth {
		slashWidth = SidebarWidth
	}
	content := hintsRendered
	if slashWidth > 0 {
		icons := styles.GetIcons(m.HasNerdFont)
		var pattern string
		if slashWidth >= 2 {
			pattern = icons.SepLeft + icons.SepRight + strings.Repeat("/", slashWidth-2)
		} else {
			pattern = strings.Repeat("/", slashWidth)
		}
		spacerWidth := remaining - slashWidth
		spacer := lipgloss.NewStyle().Background(bg).Render(strings.Repeat(" ", spacerWidth))
		slashes := lipgloss.NewStyle().
			Foreground(styles.Primary).
			Background(bg).
			Render(pattern)
		content = hintsRendered + spacer + slashes
	}

	return lipgloss.NewStyle().
		Background(bg).
		BorderStyle(lipgloss.NormalBorder()).
		BorderTop(true).
		BorderBottom(false).
		BorderLeft(false).
		BorderRight(false).
		BorderForeground(styles.TabBorderColor).
		BorderBackground(lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", styles.TermBgR, styles.TermBgG, styles.TermBgB))).
		Padding(0, 1).
		Width(width).
		Render(content)
}

// renderPowerlineFooter renders tier 2: powerline status bar
func (m Model) renderPowerlineFooter(width int) string {
	icons := styles.GetIcons(m.HasNerdFont)

	var leftSegments []styles.Segment
	var rightSegments []styles.Segment

	// Left segments
	// 1. Workflow phase pill
	phase := m.workflowPhase()
	phaseColor := m.workflowPhaseColor()
	leftSegments = append(leftSegments, styles.Segment{
		Content:    phase,
		Foreground: styles.White,
		Background: phaseColor,
	})

	// 2. Active tab (icon + name)
	active := m.Registry.ActivePlugin()
	if active != nil {
		icon := active.Icon()
		name := active.Name()
		tabContent := icon + " " + name
		leftSegments = append(leftSegments, styles.Segment{
			Content:    tabContent,
			Foreground: styles.White,
			Background: styles.Secondary,
		})
	}

	// 3. Git branch
	if gp, ok := m.Registry.PluginByID("git").(*GitPlugin); ok {
		if gp.state.BranchName != "" {
			branchContent := icons.GitBranch + " " + gp.state.BranchName
			leftSegments = append(leftSegments, styles.Segment{
				Content:    branchContent,
				Foreground: styles.White,
				Background: lipgloss.Color("#363748"),
			})
		}
	}

	// 4. Current story ID (conditional, skip if narrow)
	if width >= 100 {
		if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
			if sp.currentStoryID != "" {
				leftSegments = append(leftSegments, styles.Segment{
					Content:    sp.currentStoryID,
					Foreground: styles.White,
					Background: lipgloss.Color("#3d3e50"),
				})
			}
		}
	}

	// Right segments (build in display order, left-to-right)

	// 1. Version
	rightSegments = append(rightSegments, styles.Segment{
		Content:    "v3.9.0",
		Foreground: styles.White,
		Background: lipgloss.Color("#2c2d3a"),
	})

	// 2. Quality gates (conditional, skip if very narrow)
	if width >= 80 {
		if mp, ok := m.Registry.PluginByID("monitor").(*MonitorPlugin); ok {
			passCount := 0
			failCount := 0
			for _, gate := range mp.state.QualityGates {
				if gate.Status == "pass" {
					passCount++
				} else if gate.Status == "fail" {
					failCount++
				}
			}

			if passCount > 0 || failCount > 0 {
				gateContent := fmt.Sprintf("%s %d %s %d", icons.Circle, passCount, icons.Circle, failCount)
				rightSegments = append(rightSegments, styles.Segment{
					Content:    gateContent,
					Foreground: styles.White,
					Background: lipgloss.Color("#363748"),
				})
			}
		}
	}

	// 2. Story progress
	if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
		completed := sp.completedCount()
		total := sp.totalStories
		if total > 0 {
			progressContent := fmt.Sprintf("%d/%d", completed, total)
			rightSegments = append(rightSegments, styles.Segment{
				Content:    progressContent,
				Foreground: styles.White,
				Background: lipgloss.Color("#2c2d3a"),
			})
		}
	}

	// 3. Iteration counter (conditional)
	if width >= 90 {
		if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
			if sp.iteration > 0 {
				iterContent := fmt.Sprintf("iter %d", sp.iteration)
				rightSegments = append(rightSegments, styles.Segment{
					Content:    iterContent,
					Foreground: styles.White,
					Background: lipgloss.Color("#363748"),
				})
			}
		}
	}

	// 4. Elapsed time (rightmost, matching phase color)
	if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
		if sp.state == StateRunning {
			elapsed := sp.elapsedTime()
			timeStr := icons.Clock + " " + formatDuration(elapsed)
			rightSegments = append(rightSegments, styles.Segment{
				Content:    timeStr,
				Foreground: styles.White,
				Background: phaseColor, // Match phase color for bookend effect
			})
		}
	}

	// Build powerline bars using detected terminal background
	barBg := lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", styles.TermBgR, styles.TermBgG, styles.TermBgB))
	left := styles.BuildPowerline(leftSegments, width, barBg, icons)
	right := styles.BuildPowerlineRight(rightSegments, barBg, icons)

	return styles.RenderPowerlineBar(left, right, width, barBg)
}

// renderTwoTierFooter renders both tiers stacked vertically
func (m Model) renderTwoTierFooter(width int) string {
	tier1 := m.renderKeyHintsFooter(width)
	tier2 := m.renderPowerlineFooter(width)
	return lipgloss.JoinVertical(lipgloss.Left, tier1, tier2)
}
