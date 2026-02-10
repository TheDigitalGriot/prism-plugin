package app

import (
	"fmt"
	"math"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// renderSpectrumView renders the full Spectrum execution dashboard
func (m Model) renderSpectrumView() string {
	var sections []string

	// Epic selector bar (if multiple epics)
	if len(m.Epic.Epics) > 1 {
		sections = append(sections, m.renderEpicSelector())
	}

	// Header
	sections = append(sections, m.renderHeader())

	// Progress bar with prism animation
	sections = append(sections, m.renderProgressBar())

	// Main content (stories + activity panels)
	sections = append(sections, m.renderMainPanels())

	// Log viewport
	sections = append(sections, m.renderLogPanel())

	// Status bar
	sections = append(sections, m.renderStatusBar())

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

func (m Model) renderHeader() string {
	title := styles.TitleStyle.Render("PRISM TUI")

	iterInfo := fmt.Sprintf("Iteration: %d/%d", m.Iteration, m.MaxIterations)
	helpHint := styles.DimStyle.Render("[?] help")

	// Calculate spacing
	rightContent := iterInfo + "  " + helpHint
	leftWidth := lipgloss.Width(title)
	rightWidth := lipgloss.Width(rightContent)
	spacerWidth := m.Width - leftWidth - rightWidth - 4
	if spacerWidth < 1 {
		spacerWidth = 1
	}
	spacer := strings.Repeat(" ", spacerWidth)

	header := lipgloss.JoinHorizontal(lipgloss.Center, title, spacer, rightContent)

	return styles.HeaderStyle.Width(m.Width).Render(header)
}

func (m Model) renderProgressBar() string {
	planName := m.PlanName
	if planName == "" {
		planName = "Loading..."
	}

	completed := m.CompletedCount()
	total := m.TotalStories
	if total == 0 {
		total = 1 // Avoid division by zero
	}

	stats := fmt.Sprintf("%d/%d (%d%%)", completed, m.TotalStories, int(m.ProgressPercent()*100))

	// Render framebuffer prism animation with ASCII art PRISM logotype
	if m.Prism != nil {
		prismStr := m.Prism.String()
		_ = m.Prism.Width()

		logo := m.renderPrismLogo()

		// Join prism animation (left) with ASCII logo (right)
		topSection := lipgloss.JoinHorizontal(lipgloss.Center, prismStr, "  ", logo)

		// Progress info line below - use spectrum gradient matching logo
		barWidth := m.Width - 20
		if barWidth < 20 {
			barWidth = 20
		}
		progressStr := renderSpectrumProgressBar(m.Anim.ProgressPos, barWidth)
		infoLine := fmt.Sprintf("  Plan: %s  %s  %s", planName, progressStr, stats)

		content := lipgloss.JoinVertical(lipgloss.Left, topSection, infoLine)
		return styles.PanelStyle.Width(m.Width - 2).Render(content)
	}

	// Fallback: no framebuffer prism, use text-based prism
	barWidth := m.Width - 50
	if barWidth < 20 {
		barWidth = 20
	}
	progressStr := renderSpectrumProgressBar(m.Anim.ProgressPos, barWidth)

	prism := styles.RenderPrismGradientSpring(m.Anim.PrismFrame, m.Anim.RayLengths, m.Anim.ShimmerPhase)
	line := fmt.Sprintf("%s  Plan: %s  %s  %s", prism, planName, progressStr, stats)
	return styles.PanelStyle.Width(m.Width - 2).Render(line)
}

func (m Model) renderMainPanels() string {
	// Calculate panel widths
	totalWidth := m.Width - 4 // Account for borders
	storyWidth := totalWidth * 40 / 100
	activityWidth := totalWidth - storyWidth - 3 // Account for separator

	// Story list panel
	storyPanel := m.renderStoryList(storyWidth)

	// Activity panel
	activityPanel := m.renderActivityPanel(activityWidth)

	return lipgloss.JoinHorizontal(lipgloss.Top, storyPanel, activityPanel)
}

func (m Model) renderStoryList(width int) string {
	var lines []string

	title := styles.StoriesTitleStyle.Render("STORIES")
	lines = append(lines, title)
	lines = append(lines, styles.HorizontalLine(width-4))

	// Calculate pagination bounds
	start, end := m.StoryPaginator.GetSliceBounds(len(m.Stories))

	// Render stories for current page
	for i := start; i < end && i < len(m.Stories); i++ {
		story := m.Stories[i]
		icon := m.getStoryIcon(story, i)
		style := m.getStoryStyle(story)

		// Truncate title if needed
		maxTitleLen := width - 20
		storyTitle := story.Title
		if len(storyTitle) > maxTitleLen && maxTitleLen > 3 {
			storyTitle = storyTitle[:maxTitleLen-3] + "..."
		}

		line := fmt.Sprintf("%s %s %s", icon, story.ID, storyTitle)
		lines = append(lines, style.Render(line))
	}

	// Pad with empty lines if needed
	for len(lines) < m.StoriesPerPage+2 {
		lines = append(lines, "")
	}

	// Add pagination indicator if there are multiple pages
	totalPages := (len(m.Stories) + m.StoriesPerPage - 1) / m.StoriesPerPage
	if totalPages > 1 {
		pagInfo := fmt.Sprintf("  %s  [a/s]", m.StoryPaginator.View())
		lines = append(lines, styles.DimStyle.Render(pagInfo))
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width).Render(content)
}

func (m Model) getStoryIcon(s StoryView, index int) string {
	if s.Status == "complete" {
		// Check for active pop animation
		if scale, ok := m.Anim.StoryPopScales[index]; ok {
			if scale < 0.7 {
				return "●" // compressed
			} else if scale > 1.1 {
				return "✔" // overshoot (bold effect)
			}
		}
		return styles.CheckIcon
	}
	if s.ID == m.CurrentStoryID {
		// Apply pulse brightness effect
		brightness := 0.6 + 0.4*math.Sin(m.Anim.PulsePhase)
		if brightness > 0.8 {
			return "▶" // bright
		}
		return "▸" // dim
	}
	if s.IsBlocked {
		return styles.BlockedIcon
	}
	return styles.PendingIcon
}

func (m Model) getStoryStyle(s StoryView) lipgloss.Style {
	if s.Status == "complete" {
		return styles.CompleteStyle
	}
	if s.ID == m.CurrentStoryID {
		return styles.CurrentStyle
	}
	if s.IsBlocked {
		return styles.BlockedStyle
	}
	return styles.PendingStyle
}

func (m Model) renderActivityPanel(width int) string {
	var lines []string

	title := styles.ActivityTitleStyle.Render("CURRENT ACTIVITY")
	lines = append(lines, title)
	lines = append(lines, styles.HorizontalLine(width-4))

	if m.CurrentStoryID != "" {
		// Current story info
		storyLine := fmt.Sprintf("%s %s: %s", styles.PlayIcon, m.CurrentStoryID, m.CurrentStoryTitle)
		lines = append(lines, styles.CurrentStyle.Render(storyLine))
		lines = append(lines, "")

		// Status with spinner
		status := "Working..."
		if m.State == StatePaused {
			status = "Paused"
		}
		statusLine := fmt.Sprintf("Status: %s %s", m.Spinner.View(), status)
		lines = append(lines, statusLine)

		// Current tool activity
		if m.CurrentActivity != "" {
			lines = append(lines, "")
			activityLine := m.CurrentActivity
			if len(activityLine) > width-6 {
				activityLine = activityLine[:width-9] + "..."
			}
			lines = append(lines, styles.HighlightStyle.Render(activityLine))
		}
		lines = append(lines, "")
	} else if m.State == StateRunning {
		// Running but no current story yet
		statusLine := fmt.Sprintf("Status: %s Starting...", m.Spinner.View())
		lines = append(lines, statusLine)
		if m.CurrentActivity != "" {
			lines = append(lines, "")
			activityLine := m.CurrentActivity
			if len(activityLine) > width-6 {
				activityLine = activityLine[:width-9] + "..."
			}
			lines = append(lines, styles.HighlightStyle.Render(activityLine))
		}
		lines = append(lines, "")
	} else if m.State == StateIdle {
		lines = append(lines, styles.DimStyle.Render("Press Enter to start execution"))
		lines = append(lines, "")
	} else if m.State == StateComplete {
		lines = append(lines, styles.SuccessStyle.Render("All stories complete!"))
		lines = append(lines, "")
	} else if m.State == StateMaxIterations {
		lines = append(lines, styles.WarningStyle.Render("Iteration limit reached"))
		if m.LastError != "" {
			lines = append(lines, styles.DimStyle.Render(m.LastError))
		}
		lines = append(lines, "")
	} else if m.State == StateError {
		lines = append(lines, styles.ErrorStyle.Render("Error occurred"))
		if m.LastError != "" {
			lines = append(lines, styles.DimStyle.Render(m.LastError))
		}
		lines = append(lines, "")
	}

	// Recent activities history
	if len(m.RecentActivities) > 0 {
		lines = append(lines, styles.DimStyle.Render("Recent:"))

		// Show last 5 activities
		activityLines := m.RecentActivities
		if len(activityLines) > 5 {
			activityLines = activityLines[len(activityLines)-5:]
		}

		for _, line := range activityLines {
			// Truncate long lines
			if len(line) > width-6 {
				line = line[:width-9] + "..."
			}
			lines = append(lines, styles.DimStyle.Render("  "+line))
		}
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width).Render(content)
}

func (m Model) renderLogPanel() string {
	var lines []string

	title := styles.LogTitleStyle.Render("LOG OUTPUT")
	scrollHint := styles.DimStyle.Render("[z/x scroll]")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, strings.Repeat(" ", m.Width-40), scrollHint)
	lines = append(lines, header)
	lines = append(lines, styles.HorizontalLine(m.Width-4))

	// Calculate pagination bounds for logs
	start, end := m.LogPaginator.GetSliceBounds(len(m.LogLines))

	for i := start; i < end && i < len(m.LogLines); i++ {
		entry := m.LogLines[i]
		line := m.formatLogEntry(entry)

		// Apply slide-in offset animation
		offsetIdx := i - start
		if offsetIdx < len(m.Anim.LogEntryOffsets) {
			offset := int(m.Anim.LogEntryOffsets[offsetIdx])
			if offset > 0 {
				line = strings.Repeat(" ", offset) + line
			}
		}
		lines = append(lines, line)
	}

	// Pad with empty lines
	for len(lines) < m.LogsPerPage+2 {
		lines = append(lines, "")
	}

	// Add pagination indicator if there are multiple pages
	totalPages := (len(m.LogLines) + m.LogsPerPage - 1) / m.LogsPerPage
	if totalPages > 1 {
		pagInfo := fmt.Sprintf("  %s", m.LogPaginator.View())
		lines = append(lines, styles.DimStyle.Render(pagInfo))
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(m.Width - 2).Render(content)
}

func (m Model) renderStatusBar() string {
	// State indicator
	var stateStyle lipgloss.Style
	switch m.State {
	case StateRunning:
		stateStyle = styles.SuccessStyle
	case StatePaused:
		stateStyle = styles.WarningStyle
	case StateComplete:
		stateStyle = styles.SuccessStyle
	case StateMaxIterations:
		stateStyle = styles.WarningStyle
	case StateError:
		stateStyle = styles.ErrorStyle
	default:
		stateStyle = styles.DimStyle
	}

	stateStr := fmt.Sprintf("%s %s", styles.PlayIcon, m.State.String())
	if m.State == StatePaused || m.State == StateMaxIterations {
		stateStr = fmt.Sprintf("⏸ %s", m.State.String())
	}

	// Elapsed time
	elapsed := ""
	if !m.StartTime.IsZero() {
		d := m.ElapsedTime()
		elapsed = fmt.Sprintf("Elapsed: %s", formatDuration(d))
	}

	// Controls
	controls := styles.DimStyle.Render("[q]uit [p]ause [/]skip")

	// Combine
	left := stateStyle.Render(stateStr)
	middle := elapsed
	right := controls

	// Calculate spacing
	leftWidth := lipgloss.Width(left)
	middleWidth := lipgloss.Width(middle)
	rightWidth := lipgloss.Width(right)
	spacer1Width := (m.Width - leftWidth - middleWidth - rightWidth - 8) / 2
	if spacer1Width < 1 {
		spacer1Width = 1
	}

	statusLine := lipgloss.JoinHorizontal(
		lipgloss.Center,
		left,
		strings.Repeat(" ", spacer1Width),
		middle,
		strings.Repeat(" ", spacer1Width),
		right,
	)

	return styles.StatusBarStyle.Width(m.Width - 2).Render(statusLine)
}

// renderEpicSelector renders the epic tab bar for Spectrum view
func (m Model) renderEpicSelector() string {
	var tabs []string
	for i, epic := range m.Epic.Epics {
		label := fmt.Sprintf(" %s (%d/%d) ", epic.Name, epic.CompletedCount, epic.StoryCount)
		if i == m.Epic.SelectedIndex {
			tabs = append(tabs, styles.CurrentStyle.Bold(true).Render(label))
		} else {
			tabs = append(tabs, styles.DimStyle.Render(label))
		}
	}
	selector := lipgloss.JoinHorizontal(lipgloss.Center, tabs...)
	hint := styles.DimStyle.Render("  [tab] switch epic")
	content := lipgloss.JoinHorizontal(lipgloss.Center, selector, hint)
	return styles.PanelStyle.Width(m.Width - 2).Render(content)
}

// handleSpectrumKeyPress handles keys for the Spectrum execution view
func (m Model) handleSpectrumKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	// Pagination keys
	switch key {
	case "a": // Story pagination - previous page
		if m.StoryPaginator.Page > 0 {
			m.StoryPaginator.Page--
		}
		return m, nil
	case "s": // Story pagination - next page
		if m.StoryPaginator.Page < m.StoryPaginator.TotalPages-1 {
			m.StoryPaginator.Page++
		}
		return m, nil
	case "z": // Log pagination - previous page
		if m.LogPaginator.Page > 0 {
			m.LogPaginator.Page--
		}
		return m, nil
	case "x": // Log pagination - next page
		if m.LogPaginator.Page < m.LogPaginator.TotalPages-1 {
			m.LogPaginator.Page++
		}
		return m, nil
	}

	// Epic switching
	switch key {
	case "tab":
		if len(m.Epic.Epics) > 1 {
			m.Epic.SelectedIndex = (m.Epic.SelectedIndex + 1) % len(m.Epic.Epics)
			epic := m.Epic.Epics[m.Epic.SelectedIndex]
			return m, LoadStoriesCmd(epic.StoriesPath)
		}
	case "shift+tab":
		if len(m.Epic.Epics) > 1 {
			m.Epic.SelectedIndex = (m.Epic.SelectedIndex - 1 + len(m.Epic.Epics)) % len(m.Epic.Epics)
			epic := m.Epic.Epics[m.Epic.SelectedIndex]
			return m, LoadStoriesCmd(epic.StoriesPath)
		}
	}

	// State-dependent keys
	switch m.State {
	case StateIdle:
		switch key {
		case "enter", " ":
			return m, func() tea.Msg { return StartExecutionMsg{} }
		}

	case StateRunning:
		switch key {
		case "p":
			return m, func() tea.Msg { return PauseToggleMsg{} }
		case "/":
			m.AddLog(LogWarning, "Skip requested - will skip after current story")
			return m, nil
		}

	case StatePaused:
		switch key {
		case "p", "enter", " ":
			return m, func() tea.Msg { return PauseToggleMsg{} }
		}

	case StateComplete, StateMaxIterations, StateError:
		switch key {
		case "enter", " ":
			return m, tea.Quit
		}
	}

	return m, nil
}
