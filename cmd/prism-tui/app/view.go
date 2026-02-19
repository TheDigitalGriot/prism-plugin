package app

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
	zone "github.com/lrstanley/bubblezone"
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

	// Onboarding renders fullscreen between splash and dashboard (no tab bar)
	if m.ActiveView == ViewOnboarding && !m.OnboardingDone {
		active := m.Registry.ActivePlugin()
		if active != nil {
			return active.View(m.Width, m.Height)
		}
	}

	// Get content from active plugin
	// When sidebar is visible, reduce the content width so plugins render correctly
	contentWidth := m.Width
	if m.showSidebar() {
		contentWidth = m.Width - SidebarWidth
	}

	var content string
	active := m.Registry.ActivePlugin()
	if active != nil {
		content = active.View(contentWidth, m.contentHeight())
	} else {
		content = styles.DimStyle.Render("  No active plugin")
	}

	// Wrap content in app shell (header + tab bar + content + footer)
	base := m.renderAppShell(content)

	// If modal is active, composite it on top of dimmed background
	if m.ActiveModal != nil {
		modalContent := m.ActiveModal.Render(m.Width, m.Height)
		base = overlayModal(base, modalContent, m.Width, m.Height)
	}

	// If dialog is active, composite it on top of everything (highest z-order)
	if m.Dialogs.HasDialogs() {
		dialogContent := m.Dialogs.View(m.Width, m.Height)
		base = overlayModal(base, dialogContent, m.Width, m.Height)
	}

	// Reset G0 charset to ASCII — the splash screen's raw ANSI output
	// can leave the terminal in DEC Special Graphics mode, which maps
	// ASCII letters to box-drawing characters (e.g. 't' → '├').
	// CRITICAL: charset reset must be OUTSIDE zone.Scan()
	return "\x1b(B" + zone.Scan(base)
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

// dimStyle applies a dim gray color to background content behind modals.
// Strips existing ANSI codes and applies uniform gray for consistency.
var dimStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280"))

// dimLine strips ANSI codes and applies dim gray styling to a single line.
func dimLine(s string) string {
	return dimStyle.Render(ansi.Strip(s))
}

// maxLineWidth returns the maximum visual width among the given lines.
func maxLineWidth(lines []string) int {
	maxW := 0
	for _, line := range lines {
		w := ansi.StringWidth(line)
		if w > maxW {
			maxW = w
		}
	}
	return maxW
}

// compositeRow overlays modalLine onto bgLine at position modalStartX.
// Returns: dimmed-left-segment + modalLine + dimmed-right-segment
func compositeRow(bgLine, modalLine string, modalStartX, modalWidth, totalWidth int) string {
	var result strings.Builder

	// Strip ANSI from background for consistent dimming
	stripped := ansi.Strip(bgLine)
	bgWidth := ansi.StringWidth(stripped)

	// Left segment: dimmed background from 0 to modalStartX
	if modalStartX > 0 {
		leftSeg := ansi.Truncate(stripped, modalStartX, "")
		leftWidth := ansi.StringWidth(leftSeg)
		result.WriteString(dimStyle.Render(leftSeg))
		// Pad if background is shorter than modal position
		if leftWidth < modalStartX {
			result.WriteString(strings.Repeat(" ", modalStartX-leftWidth))
		}
	}

	// Modal content (not dimmed)
	result.WriteString(modalLine)

	// Right segment: dimmed background after modal
	rightStartX := modalStartX + modalWidth
	if rightStartX < totalWidth && bgWidth > rightStartX {
		// Get substring starting at visual position rightStartX
		// Since stripped has no ANSI codes, we can use rune iteration
		rightSeg := cutAt(stripped, rightStartX)
		result.WriteString(dimStyle.Render(rightSeg))
	}

	return result.String()
}

// overlayModal composites a modal on top of a dimmed background.
// The modal is centered, with dimmed background visible on all sides.
func overlayModal(background, modalStr string, width, height int) string {
	bgLines := strings.Split(background, "\n")
	modalLines := strings.Split(modalStr, "\n")

	// Calculate modal dimensions and centered position
	modalWidth := maxLineWidth(modalLines)
	modalHeight := len(modalLines)
	startX := (width - modalWidth) / 2
	startY := (height - modalHeight) / 2
	if startX < 0 {
		startX = 0
	}
	if startY < 0 {
		startY = 0
	}

	// Ensure we have enough background lines
	for len(bgLines) < height {
		bgLines = append(bgLines, "")
	}

	// Build result with row-by-row compositing
	result := make([]string, 0, height)
	for y := 0; y < height; y++ {
		bgLine := ""
		if y < len(bgLines) {
			bgLine = bgLines[y]
		}

		modalRowIdx := y - startY
		if modalRowIdx >= 0 && modalRowIdx < modalHeight {
			// Composite: dimmed-left + modal + dimmed-right
			result = append(result, compositeRow(bgLine, modalLines[modalRowIdx], startX, modalWidth, width))
		} else {
			// Pure dimmed background (above or below modal)
			result = append(result, dimLine(bgLine))
		}
	}

	return strings.Join(result, "\n")
}

// cutAt returns the substring of s starting at the given visual column position.
// Works with ANSI-stripped strings (no escape codes).
func cutAt(s string, pos int) string {
	currentWidth := 0
	for i, r := range s {
		if currentWidth >= pos {
			return s[i:]
		}
		// runewidth: most chars are width 1, CJK chars are width 2
		w := ansi.StringWidth(string(r))
		currentWidth += w
	}
	return ""
}
