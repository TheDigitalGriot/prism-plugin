package modal

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// buildLayout is the two-pass rendering pipeline that:
// 1. Renders each section individually and measures heights
// 2. Joins sections into full content
// 3. Computes scroll viewport if content exceeds available space
// 4. Applies modal styling (border, title, hints)
// 5. Centers modal on screen
func (m *Modal) buildLayout(screenW, screenH int) string {
	// Clamp modal width to screen bounds
	modalWidth := m.width
	if modalWidth < MinModalWidth {
		modalWidth = MinModalWidth
	}
	if modalWidth > screenW-4 {
		modalWidth = screenW - 4
	}
	if modalWidth < MinModalWidth {
		modalWidth = MinModalWidth
	}

	// Content area width (inside modal border and padding)
	contentWidth := modalWidth - 6 // border(2) + padding(4)
	if contentWidth < 10 {
		contentWidth = 10
	}

	// === PASS 1: Render sections and measure heights ===
	type renderedSection struct {
		content    string
		height     int
		focusables []string
	}

	var rendered []renderedSection
	var allFocusables []string

	for _, section := range m.sections {
		res := section.Render(contentWidth, m.currentFocusID())
		height := measureHeight(res.Content)

		rendered = append(rendered, renderedSection{
			content:    res.Content,
			height:     height,
			focusables: res.Focusables,
		})

		allFocusables = append(allFocusables, res.Focusables...)
	}

	// Update focusables list (rebuilt each render to handle conditional sections)
	m.focusIDs = allFocusables

	// === PASS 2: Join sections ===
	var parts []string
	for _, r := range rendered {
		if r.content != "" {
			parts = append(parts, r.content)
		}
	}

	fullContent := strings.Join(parts, "\n")
	contentHeight := measureHeight(fullContent)

	// === COMPUTE VIEWPORT ===
	// Available height for modal (leave margin for centering)
	maxModalHeight := screenH - 4
	if maxModalHeight < 10 {
		maxModalHeight = 10
	}

	// Calculate modal inner height budget
	// Modal structure: border(2) + title(2 if present) + content + hints(2 if present) + padding(2)
	var headerLines int
	if m.title != "" {
		headerLines = 2 // title + blank line
	}

	var hintLines int
	if m.showHints {
		hintLines = 2 // blank line + hints
	}

	// Available space for content viewport
	maxContentHeight := maxModalHeight - 2 - 2 - headerLines - hintLines // borders(2) + padding(2) + header + hints
	if maxContentHeight < 3 {
		maxContentHeight = 3
	}

	// Determine viewport height
	viewportHeight := contentHeight
	if viewportHeight > maxContentHeight {
		viewportHeight = maxContentHeight
	}

	// Clamp scroll offset
	maxScroll := contentHeight - viewportHeight
	if maxScroll < 0 {
		maxScroll = 0
	}
	if m.scrollOffset > maxScroll {
		m.scrollOffset = maxScroll
	}
	if m.scrollOffset < 0 {
		m.scrollOffset = 0
	}

	// Store viewport height for scrollToFocused
	m.lastViewportH = viewportHeight

	// Slice content to viewport
	viewport := sliceLines(fullContent, m.scrollOffset, viewportHeight)

	// Add scrollbar if content is scrollable
	needsScrollbar := contentHeight > viewportHeight
	if needsScrollbar {
		scrollbar := renderScrollbar(viewportHeight, contentHeight, m.scrollOffset)
		viewport = addScrollbar(viewport, scrollbar)
	}

	// === APPLY MODAL STYLING ===
	var modalParts []string

	// Title
	if m.title != "" {
		titleStyle := m.modalTitleStyle()
		modalParts = append(modalParts, titleStyle.Render(m.title))
		modalParts = append(modalParts, "") // Blank line
	}

	// Content viewport
	modalParts = append(modalParts, viewport)

	// Custom footer (if present)
	if m.customFooter != "" {
		modalParts = append(modalParts, "")
		modalParts = append(modalParts, m.customFooter)
	}

	// Hints
	if m.showHints {
		modalParts = append(modalParts, "")
		hintsStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color("#6B7280")).
			Align(lipgloss.Center)
		hints := "Tab to switch · Enter to confirm · Esc to cancel"
		modalParts = append(modalParts, hintsStyle.Render(hints))
	}

	inner := strings.Join(modalParts, "\n")

	// Apply modal border and style
	modalStyle := m.modalStyle().Width(modalWidth)
	styled := modalStyle.Render(inner)

	// Return the styled modal box WITHOUT positioning.
	// Centering is handled by the overlay compositing function in app/view.go
	return styled
}

// sliceLines extracts a slice of lines from text [start, start+count)
func sliceLines(text string, start, count int) string {
	if text == "" {
		return ""
	}

	lines := strings.Split(text, "\n")
	if start >= len(lines) {
		return ""
	}

	end := start + count
	if end > len(lines) {
		end = len(lines)
	}

	sliced := lines[start:end]

	// Pad with empty lines if we're at the end and need to fill viewport
	for len(sliced) < count && count <= len(lines) {
		sliced = append(sliced, "")
	}

	return strings.Join(sliced, "\n")
}

// renderScrollbar renders a vertical scrollbar
func renderScrollbar(viewportHeight, contentHeight, scrollOffset int) string {
	if contentHeight <= viewportHeight {
		return ""
	}

	// Calculate scrollbar thumb position and size
	thumbSize := max(1, (viewportHeight*viewportHeight)/contentHeight)
	thumbPos := (scrollOffset * viewportHeight) / contentHeight

	var lines []string
	for i := 0; i < viewportHeight; i++ {
		if i >= thumbPos && i < thumbPos+thumbSize {
			lines = append(lines, "█") // Thumb
		} else {
			lines = append(lines, "│") // Track
		}
	}

	scrollbarStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#4B5563"))
	return scrollbarStyle.Render(strings.Join(lines, "\n"))
}

// addScrollbar adds a scrollbar to the right edge of content
func addScrollbar(content, scrollbar string) string {
	contentLines := strings.Split(content, "\n")
	scrollbarLines := strings.Split(scrollbar, "\n")

	maxLines := max(len(contentLines), len(scrollbarLines))

	var combined []string
	for i := 0; i < maxLines; i++ {
		var line string
		if i < len(contentLines) {
			line = contentLines[i]
		}
		var bar string
		if i < len(scrollbarLines) {
			bar = scrollbarLines[i]
		}

		combined = append(combined, line+" "+bar)
	}

	return strings.Join(combined, "\n")
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// clamp clamps a value between min and max
func clamp(val, minVal, maxVal int) int {
	if val < minVal {
		return minVal
	}
	if val > maxVal {
		return maxVal
	}
	return val
}
