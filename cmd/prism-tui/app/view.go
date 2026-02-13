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

	// Splash screen renders fullscreen without app shell
	if m.ActiveView == ViewSplash {
		return m.renderSplashView()
	}

	// Get content from active plugin
	var content string
	active := m.Registry.ActivePlugin()
	if active != nil {
		content = active.View(m.Width, m.Height)
	} else {
		content = styles.DimStyle.Render("  No active plugin")
	}

	// Wrap content in app shell (header + tab bar + content + footer)
	return m.renderAppShell(content)
}

// === Shared Helpers ===

// renderPrismLogo renders the ASCII art PRISM logotype with spectrum gradient
func (m Model) renderPrismLogo() string {
	return renderPrismLogoStatic()
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
