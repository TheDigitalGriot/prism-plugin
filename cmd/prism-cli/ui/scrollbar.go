package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/styles"
)

// ScrollbarParams configures a vertical scrollbar rendering.
type ScrollbarParams struct {
	TotalItems   int // Total logical items in the list
	ScrollOffset int // Index of first visible item (scroll offset)
	VisibleItems int // Number of items that fit in the viewport
	TrackHeight  int // Height of the scrollbar track in terminal rows
}

// RenderScrollbar returns a single-column string (newline-separated)
// representing a vertical scrollbar track. Returns a column of spaces
// if all content is visible (TotalItems <= VisibleItems) to reserve
// the width and prevent layout jitter.
// Output has exactly TrackHeight lines, each 1 character wide.
func RenderScrollbar(params ScrollbarParams) string {
	if params.TrackHeight < 1 {
		return ""
	}

	// No scrollbar needed — return spacer column to prevent layout jitter.
	if params.TotalItems <= params.VisibleItems {
		lines := make([]string, params.TrackHeight)
		for i := range lines {
			lines[i] = " "
		}
		return strings.Join(lines, "\n")
	}

	// Thumb size: proportional to visible fraction, minimum 1, clamped to track.
	thumbSize := (params.VisibleItems * params.TrackHeight) / params.TotalItems
	if thumbSize < 1 {
		thumbSize = 1
	}
	if thumbSize > params.TrackHeight {
		thumbSize = params.TrackHeight
	}

	// Thumb position: proportional to scroll offset within scrollable range.
	maxOffset := params.TotalItems - params.VisibleItems
	if maxOffset < 1 {
		maxOffset = 1
	}
	thumbPos := (params.ScrollOffset * (params.TrackHeight - thumbSize)) / maxOffset
	if thumbPos < 0 {
		thumbPos = 0
	}
	if thumbPos > params.TrackHeight-thumbSize {
		thumbPos = params.TrackHeight - thumbSize
	}

	trackStyle := lipgloss.NewStyle().Foreground(styles.ScrollbarTrackColor)
	thumbStyle := lipgloss.NewStyle().Foreground(styles.ScrollbarThumbColor)

	trackChar := trackStyle.Render("│")
	thumbChar := thumbStyle.Render("┃")

	lines := make([]string, params.TrackHeight)
	for i := range params.TrackHeight {
		if i >= thumbPos && i < thumbPos+thumbSize {
			lines[i] = thumbChar
		} else {
			lines[i] = trackChar
		}
	}

	return strings.Join(lines, "\n")
}
