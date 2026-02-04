package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/ralph-tui/styles"
)

// View renders the entire UI
func (m Model) View() string {
	if !m.Ready {
		return "\n  Initializing..."
	}

	var sections []string

	// Header
	sections = append(sections, m.renderHeader())

	// Progress bar
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
	title := styles.TitleStyle.Render("RALPH TUI")

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

	// Progress bar
	barWidth := m.Width - 40
	if barWidth < 20 {
		barWidth = 20
	}
	m.Progress.Width = barWidth

	progressStr := m.Progress.ViewAs(m.ProgressPercent())
	stats := fmt.Sprintf("%d/%d (%d%%)", completed, m.TotalStories, int(m.ProgressPercent()*100))

	line := fmt.Sprintf("Plan: %s  %s  %s", planName, progressStr, stats)

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

	title := styles.PanelTitleStyle.Render("STORIES")
	lines = append(lines, title)
	lines = append(lines, styles.HorizontalLine(width-4))

	// Calculate available height for stories
	maxStories := (m.Height - 20) / 1 // Rough estimate
	if maxStories < 5 {
		maxStories = 5
	}

	for i, story := range m.Stories {
		if i >= maxStories {
			remaining := len(m.Stories) - maxStories
			if remaining > 0 {
				lines = append(lines, styles.DimStyle.Render(fmt.Sprintf("  ... and %d more", remaining)))
			}
			break
		}

		icon := m.getStoryIcon(story)
		style := m.getStoryStyle(story)

		// Truncate title if needed
		maxTitleLen := width - 20
		title := story.Title
		if len(title) > maxTitleLen && maxTitleLen > 3 {
			title = title[:maxTitleLen-3] + "..."
		}

		line := fmt.Sprintf("%s %s %s", icon, story.ID, title)
		lines = append(lines, style.Render(line))
	}

	// Pad with empty lines if needed
	for len(lines) < maxStories+2 {
		lines = append(lines, "")
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width).Render(content)
}

func (m Model) getStoryIcon(s StoryView) string {
	if s.Status == "complete" {
		return styles.CheckIcon
	}
	if s.ID == m.CurrentStoryID {
		return styles.PlayIcon
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

	title := styles.PanelTitleStyle.Render("CURRENT ACTIVITY")
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

	title := styles.PanelTitleStyle.Render("LOG OUTPUT")
	scrollHint := styles.DimStyle.Render("[j/k scroll]")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, strings.Repeat(" ", m.Width-40), scrollHint)
	lines = append(lines, header)
	lines = append(lines, styles.HorizontalLine(m.Width-4))

	// Show last N log entries
	maxLogs := 6
	startIdx := 0
	if len(m.LogLines) > maxLogs {
		startIdx = len(m.LogLines) - maxLogs
	}

	for i := startIdx; i < len(m.LogLines); i++ {
		entry := m.LogLines[i]
		line := m.formatLogEntry(entry)
		lines = append(lines, line)
	}

	// Pad with empty lines
	for len(lines) < maxLogs+2 {
		lines = append(lines, "")
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(m.Width - 2).Render(content)
}

func (m Model) formatLogEntry(e LogEntry) string {
	timestamp := e.Time.Format("15:04:05")
	var levelStyle lipgloss.Style
	var levelStr string

	switch e.Level {
	case LogInfo:
		levelStyle = styles.InfoStyle
		levelStr = "INFO "
	case LogSuccess:
		levelStyle = styles.SuccessStyle
		levelStr = "OK   "
	case LogWarning:
		levelStyle = styles.WarningStyle
		levelStr = "WARN "
	case LogError:
		levelStyle = styles.ErrorStyle
		levelStr = "ERROR"
	case LogClaudeOutput:
		levelStyle = styles.DimStyle
		levelStr = "     "
	}

	return fmt.Sprintf("[%s] %s %s",
		styles.DimStyle.Render(timestamp),
		levelStyle.Render(levelStr),
		e.Message,
	)
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
	case StateError:
		stateStyle = styles.ErrorStyle
	default:
		stateStyle = styles.DimStyle
	}

	stateStr := fmt.Sprintf("%s %s", styles.PlayIcon, m.State.String())
	if m.State == StatePaused {
		stateStr = fmt.Sprintf("⏸ %s", m.State.String())
	}

	// Elapsed time
	elapsed := ""
	if !m.StartTime.IsZero() {
		d := m.ElapsedTime()
		elapsed = fmt.Sprintf("Elapsed: %s", formatDuration(d))
	}

	// Controls
	controls := styles.DimStyle.Render("[q]uit [p]ause [s]kip")

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

func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	h := d / time.Hour
	d -= h * time.Hour
	m := d / time.Minute
	d -= m * time.Minute
	s := d / time.Second

	if h > 0 {
		return fmt.Sprintf("%dh %dm %ds", h, m, s)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
