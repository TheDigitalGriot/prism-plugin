package app

import (
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// SidebarWidth is the fixed width of the sidebar panel (matching Crush's 30-col design)
const SidebarWidth = 30

// CompactBreakpointWidth is the minimum terminal width to show the sidebar
const CompactBreakpointWidth = 120

// SidebarFile represents a file entry in the sidebar's modified files section
type SidebarFile struct {
	Path      string
	Additions int
	Deletions int
	Action    string // "create", "modify", "delete", "staged", "modified", "untracked"
}

// SidebarQualityGate represents a quality gate status in the sidebar
type SidebarQualityGate struct {
	Name   string
	Status string // "pass", "fail", "pending", "unknown"
}

// SidebarEpic represents an epic entry in the sidebar
type SidebarEpic struct {
	Name      string
	Completed int
	Total     int
	IsActive  bool
}

// renderSidebar renders the right-side panel inspired by Crush's sidebar.
// It displays project info, execution state, modified files, quality gates, and epics.
func (m Model) renderSidebar(height int) string {
	w := SidebarWidth - 4 // content width inside panel (border + padding)

	var blocks []string

	// 1. Branded header — compact PRISM logo
	blocks = append(blocks, m.renderSidebarLogo(w))
	blocks = append(blocks, "")

	// 2. Project info
	blocks = append(blocks, m.renderSidebarProjectInfo(w))
	blocks = append(blocks, "")

	// 3. Execution info (model equivalent from Crush)
	blocks = append(blocks, m.renderSidebarExecutionInfo(w))
	blocks = append(blocks, "")

	// 4. Modified Files section
	files := m.collectSidebarFiles()
	blocks = append(blocks, m.renderSidebarSection("Modified Files", m.renderFileList(files, w), w))
	blocks = append(blocks, "")

	// 5. Quality Gates section
	gates := m.collectQualityGates()
	blocks = append(blocks, m.renderSidebarSection("Quality Gates", m.renderQualityGates(gates, w), w))
	blocks = append(blocks, "")

	// 6. Epics section
	epics := m.collectEpics()
	blocks = append(blocks, m.renderSidebarSection("Epics", m.renderEpicList(epics, w), w))

	content := lipgloss.JoinVertical(lipgloss.Left, blocks...)

	// Wrap in panel with max height (subtract 1 for the slash row above)
	panel := styles.SidebarStyle.
		Width(SidebarWidth).
		MaxHeight(height - 1).
		Render(content)

	// Decorative 3-row slash pattern above the panel box.
	// Top row has a leading powerline slant; rows 2-3 are plain slashes.
	icons := styles.GetIcons(m.HasNerdFont)
	slashStyle := lipgloss.NewStyle().Foreground(styles.Primary)

	// Row 1: filled slant + slashes
	row1 := lipgloss.NewStyle().Foreground(styles.Primary).Render(icons.SepRight) +
		slashStyle.Render(strings.Repeat("/", SidebarWidth-1))
	// Rows 2-3: plain slashes
	plainRow := slashStyle.Render(strings.Repeat("/", SidebarWidth))

	slashPattern := lipgloss.JoinVertical(lipgloss.Left, row1, plainRow, plainRow)

	return lipgloss.JoinVertical(lipgloss.Left, slashPattern, panel)
}

// renderSidebarLogo renders a compact branded PRISM logo for the sidebar
func (m Model) renderSidebarLogo(width int) string {
	// Compact prism icon + "PRISM" branding (like Crush's "Charm™ CRUSH")
	var prismIcon string
	if m.Prism != nil {
		// Use the compact inline prism
		prismIcon = styles.RenderPrismCompact(m.Anim.PrismFrame)
	} else {
		prismIcon = styles.RenderPrismCompact(0)
	}

	// Brand line
	brand := styles.SidebarBrandStyle.Render("PRISM")
	version := styles.DimStyle.Render("v1.9.8")

	header := lipgloss.JoinHorizontal(lipgloss.Center, brand, " ", version)

	return lipgloss.JoinVertical(lipgloss.Left, prismIcon, header)
}

// renderSidebarProjectInfo renders the project name and working directory
func (m Model) renderSidebarProjectInfo(width int) string {
	// Session/story title
	title := m.sidebarTitle()
	titleRendered := styles.SidebarTitleStyle.Width(width).MaxHeight(2).Render(title)

	// Working directory (shortened)
	cwd := m.ProjectDir
	if cwd == "" {
		cwd = "."
	}
	// Shorten home directory
	cwd = shortenPath(cwd)
	cwdRendered := styles.DimStyle.Width(width).Render(cwd)

	return lipgloss.JoinVertical(lipgloss.Left, titleRendered, cwdRendered)
}

// sidebarTitle returns the current session/story title for the sidebar
func (m Model) sidebarTitle() string {
	// Try to get current story title from Spectrum plugin
	if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
		if sp.currentStoryTitle != "" {
			return sp.currentStoryTitle
		}
		if sp.planName != "" {
			return sp.planName
		}
	}

	// Fallback to project directory name
	if m.ProjectDir != "" {
		parts := strings.Split(strings.ReplaceAll(m.ProjectDir, "\\", "/"), "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}

	return "PRISM TUI"
}

// renderSidebarExecutionInfo renders model/execution information
// (Prism equivalent of Crush's model info section)
func (m Model) renderSidebarExecutionInfo(width int) string {
	sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin)
	if !ok {
		return styles.DimStyle.Render("◇ Idle")
	}

	var lines []string

	// State icon + status
	stateIcon := "◇"
	var stateStyle lipgloss.Style
	switch sp.state {
	case StateRunning:
		stateIcon = "▸"
		stateStyle = styles.SuccessStyle
	case StatePaused:
		stateIcon = "⏸"
		stateStyle = styles.WarningStyle
	case StateComplete:
		stateIcon = "✓"
		stateStyle = styles.SuccessStyle
	case StateError:
		stateIcon = "✗"
		stateStyle = styles.ErrorStyle
	default:
		stateStyle = styles.DimStyle
	}

	statusLine := stateStyle.Render(fmt.Sprintf("%s %s", stateIcon, sp.state.String()))
	lines = append(lines, statusLine)

	// Iteration counter
	if sp.iteration > 0 || sp.state == StateRunning {
		maxIter := m.MaxIterations
		if maxIter == 0 {
			maxIter = 50
		}
		iterLine := styles.DimStyle.Render(fmt.Sprintf("  Iteration %d/%d", sp.iteration, maxIter))
		lines = append(lines, iterLine)
	}

	// Story progress (like Crush's token count)
	completed := 0
	for _, s := range sp.stories {
		if s.Status == "complete" {
			completed++
		}
	}
	total := sp.totalStories
	if total == 0 {
		total = len(sp.stories)
	}
	if total > 0 {
		pct := 0
		if total > 0 {
			pct = completed * 100 / total
		}
		progressLine := styles.DimStyle.Render(fmt.Sprintf("  %d%% (%d/%d)", pct, completed, total))
		lines = append(lines, progressLine)
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// renderSidebarSection renders a named section with a title separator and content
func (m Model) renderSidebarSection(title, content string, width int) string {
	// Section title with horizontal line (like Crush's "Modified Files ─────")
	titleStr := styles.SidebarSectionTitleStyle.Render(title)
	titleWidth := lipgloss.Width(titleStr)
	lineWidth := width - titleWidth - 1
	if lineWidth < 2 {
		lineWidth = 2
	}
	line := styles.DimStyle.Render(" " + strings.Repeat("─", lineWidth))
	header := titleStr + line

	return lipgloss.JoinVertical(lipgloss.Left, header, content)
}

// collectSidebarFiles gathers modified files from available sources
func (m Model) collectSidebarFiles() []SidebarFile {
	var files []SidebarFile

	// Try git plugin first (most accurate source of modified files)
	if gp, ok := m.Registry.PluginByID("git").(*GitPlugin); ok {
		for _, f := range gp.state.StagedFiles {
			files = append(files, SidebarFile{
				Path:   f.Path,
				Action: "staged",
			})
		}
		for _, f := range gp.state.ModifiedFiles {
			files = append(files, SidebarFile{
				Path:   f.Path,
				Action: "modified",
			})
		}
	}

	// Fallback: try current story's file list from spectrum
	if len(files) == 0 {
		if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok && sp.currentStoryID != "" {
			for _, s := range sp.stories {
				if s.ID == sp.currentStoryID {
					// We don't have file-level info in StoryView, but we could
					// add it later. For now, skip.
					break
				}
			}
		}
	}

	return files
}

// renderFileList renders the list of modified files with diff stats
func (m Model) renderFileList(files []SidebarFile, width int) string {
	if len(files) == 0 {
		return styles.DimStyle.Render("None")
	}

	maxFiles := 6
	var lines []string

	for i, f := range files {
		if i >= maxFiles {
			remaining := len(files) - maxFiles
			lines = append(lines, styles.DimStyle.Render(fmt.Sprintf("...and %d more", remaining)))
			break
		}

		// Shorten file path to fit sidebar width
		name := shortenFilePath(f.Path, width-12)

		// Build diff stats (like Crush: +N -M in green/red)
		var stats string
		if f.Additions > 0 || f.Deletions > 0 {
			add := styles.SidebarAdditionsStyle.Render(fmt.Sprintf("+%d", f.Additions))
			del := styles.SidebarDeletionsStyle.Render(fmt.Sprintf("-%d", f.Deletions))
			stats = add + " " + del
		} else {
			// Show action type for files without diff stats
			switch f.Action {
			case "staged":
				stats = styles.SuccessStyle.Render("staged")
			case "modified":
				stats = styles.WarningStyle.Render("mod")
			case "untracked":
				stats = styles.DimStyle.Render("new")
			case "create":
				stats = styles.SuccessStyle.Render("new")
			case "delete":
				stats = styles.ErrorStyle.Render("del")
			}
		}

		// Right-align stats
		nameWidth := lipgloss.Width(name)
		statsWidth := lipgloss.Width(stats)
		padding := width - nameWidth - statsWidth
		if padding < 1 {
			padding = 1
		}

		line := styles.DimStyle.Render(name) + strings.Repeat(" ", padding) + stats
		lines = append(lines, line)
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// collectQualityGates gathers quality gate statuses from the monitor plugin
func (m Model) collectQualityGates() []SidebarQualityGate {
	var gates []SidebarQualityGate

	if mp, ok := m.Registry.PluginByID("monitor").(*MonitorPlugin); ok {
		for _, g := range mp.state.QualityGates {
			gates = append(gates, SidebarQualityGate{
				Name:   g.Name,
				Status: g.Status,
			})
		}
	}

	return gates
}

// renderQualityGates renders the quality gate status list
func (m Model) renderQualityGates(gates []SidebarQualityGate, width int) string {
	if len(gates) == 0 {
		return styles.DimStyle.Render("None")
	}

	var lines []string
	for _, g := range gates {
		// Status icon (like Crush's LSP status icons)
		var icon string
		var statusStyle lipgloss.Style
		switch g.Status {
		case "pass":
			icon = "●"
			statusStyle = styles.SuccessStyle
		case "fail":
			icon = "●"
			statusStyle = styles.ErrorStyle
		case "pending":
			icon = "●"
			statusStyle = lipgloss.NewStyle().Foreground(styles.Warning)
		default:
			icon = "●"
			statusStyle = styles.DimStyle
		}

		iconStr := statusStyle.Render(icon)
		name := styles.DimStyle.Render(g.Name)
		status := statusStyle.Render(g.Status)

		// Right-align status
		nameWidth := lipgloss.Width(iconStr) + 1 + lipgloss.Width(name)
		statusWidth := lipgloss.Width(status)
		padding := width - nameWidth - statusWidth
		if padding < 1 {
			padding = 1
		}

		line := iconStr + " " + name + strings.Repeat(" ", padding) + status
		lines = append(lines, line)
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// collectEpics gathers epic info from the spectrum plugin
func (m Model) collectEpics() []SidebarEpic {
	var epics []SidebarEpic

	if sp, ok := m.Registry.PluginByID("spectrum").(*SpectrumPlugin); ok {
		for i, e := range sp.epic.Epics {
			epics = append(epics, SidebarEpic{
				Name:      e.Name,
				Completed: e.CompletedCount,
				Total:     e.StoryCount,
				IsActive:  i == sp.epic.SelectedIndex,
			})
		}
	}

	return epics
}

// renderEpicList renders the list of epics with progress
func (m Model) renderEpicList(epics []SidebarEpic, width int) string {
	if len(epics) == 0 {
		return styles.DimStyle.Render("None")
	}

	var lines []string
	for _, e := range epics {
		// Active indicator
		var icon string
		var nameStyle lipgloss.Style
		if e.IsActive {
			icon = styles.SuccessStyle.Render("●")
			nameStyle = styles.CurrentStyle
		} else {
			icon = styles.DimStyle.Render("●")
			nameStyle = styles.DimStyle
		}

		name := nameStyle.Render(e.Name)
		progress := styles.DimStyle.Render(fmt.Sprintf("%d/%d", e.Completed, e.Total))

		// Right-align progress
		nameWidth := lipgloss.Width(icon) + 1 + lipgloss.Width(name)
		progressWidth := lipgloss.Width(progress)
		padding := width - nameWidth - progressWidth
		if padding < 1 {
			padding = 1
		}

		line := icon + " " + name + strings.Repeat(" ", padding) + progress
		lines = append(lines, line)
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// showSidebar returns true if the sidebar should be visible.
// The sidebar is shown when the terminal is wide enough and the user hasn't toggled it off.
func (m Model) showSidebar() bool {
	if m.ForceSidebarOff {
		return false
	}
	return m.Width >= CompactBreakpointWidth
}

// shortenPath replaces the home directory with ~ and trims long paths
func shortenPath(path string) string {
	// Normalize separators
	path = strings.ReplaceAll(path, "\\", "/")

	// Try to shorten home directory
	if home, err := os.UserHomeDir(); err == nil {
		home = strings.ReplaceAll(home, "\\", "/")
		if strings.HasPrefix(path, home) {
			path = "~" + path[len(home):]
		}
	}

	return path
}

// shortenFilePath trims a file path to fit within maxWidth characters.
// Keeps the filename and last directory segment.
func shortenFilePath(path string, maxWidth int) string {
	if maxWidth < 5 {
		maxWidth = 5
	}

	// Normalize separators
	path = strings.ReplaceAll(path, "\\", "/")

	if len(path) <= maxWidth {
		return path
	}

	// Keep last 2 path segments
	parts := strings.Split(path, "/")
	if len(parts) <= 2 {
		// Can't shorten further, just truncate
		return path[:maxWidth-3] + "..."
	}

	// Try last 2 segments
	short := ".../" + strings.Join(parts[len(parts)-2:], "/")
	if len(short) <= maxWidth {
		return short
	}

	// Just filename
	short = ".../" + parts[len(parts)-1]
	if len(short) <= maxWidth {
		return short
	}

	// Truncate filename
	return short[:maxWidth-3] + "..."
}
