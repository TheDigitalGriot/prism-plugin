package app

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// View renders the entire UI, routing to the active view
func (m Model) View() string {
	if !m.Ready {
		return "\n  Initializing..."
	}

	switch m.ActiveView {
	case ViewHome:
		return m.renderHomeView()
	case ViewResearch:
		return m.renderResearchView()
	case ViewPlans:
		return m.renderPlansView()
	case ViewSpectrum:
		return m.renderSpectrumView()
	default:
		return m.renderHomeView()
	}
}

// === Shared Helpers ===

// renderPrismLogo renders the ASCII art PRISM logotype with spectrum gradient
func (m Model) renderPrismLogo() string {
	spectrumColors := []string{"#3B82F6", "#14B8A6", "#22C55E", "#F59E0B"}
	logoLines := []string{
		"'||''|.  '||''|.   '||'  .|'''.|  '||    ||'",
		" ||   ||  ||   ||   ||   ||..  '   |||  |||",
		" ||...|'  ||''|'    ||    ''|||.   |'|..'||",
		" ||       ||   |.   ||  .     '||  | '|' ||",
		".||.     .||.  '|' .||. |'....|'  .|. | .||.",
	}
	var styledLines []string
	for _, line := range logoLines {
		styledLines = append(styledLines, styles.GradientString(line, spectrumColors))
	}
	return lipgloss.JoinVertical(lipgloss.Left, styledLines...)
}

// renderSpectrumProgressBar renders a progress bar using the 4-stop spectrum gradient
func renderSpectrumProgressBar(percent float64, width int) string {
	spectrumColors := []string{"#3B82F6", "#14B8A6", "#22C55E", "#F59E0B"}

	if width < 2 {
		width = 2
	}

	filled := int(math.Round(percent * float64(width)))
	if filled > width {
		filled = width
	}

	empty := width - filled

	var bar string
	if filled > 0 {
		filledStr := strings.Repeat("█", filled)
		bar = styles.GradientString(filledStr, spectrumColors)
	}
	if empty > 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#374151"))
		bar += emptyStyle.Render(strings.Repeat("░", empty))
	}

	return bar
}

// formatLogEntry formats a single log entry for display
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

// formatDuration formats a duration as human-readable string
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
