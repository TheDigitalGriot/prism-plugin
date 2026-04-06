package ui

// dividerWidth is the width of the vertical divider character between panes.
const dividerWidth = 1

// FocusPane identifies which pane currently has keyboard focus.
type FocusPane int

const (
	PaneLeft  FocusPane = iota // Left pane (sidebar / tree)
	PaneRight                  // Right pane (content / preview)
)

// PaneWidths holds the calculated widths for a two-pane layout.
type PaneWidths struct {
	Left      int // Width of the left pane (outer, including borders)
	Right     int // Width of the right pane (outer, including borders)
	Divider   int // Width of the divider (always 1)
	Available int // Total available width passed in
}

// CalculatePaneWidths computes a two-pane split for the given available width.
//
//   - available: total terminal width to fill
//   - ratio: percentage (0–100) of available width given to the left pane
//   - minLeft: minimum width for the left pane
//   - minRight: minimum width for the right pane
//
// The divider (1 char) is subtracted from available before splitting.
// Returned widths are clamped so neither pane falls below its minimum.
func CalculatePaneWidths(available, ratio, minLeft, minRight int) PaneWidths {
	inner := available - dividerWidth
	if inner < minLeft+minRight {
		// Not enough space — give minimum to each, ignore the divider
		return PaneWidths{
			Left:      minLeft,
			Right:     minRight,
			Divider:   dividerWidth,
			Available: available,
		}
	}

	leftWidth := inner * ratio / 100

	// Clamp left to valid bounds
	maxLeft := inner - minRight
	if maxLeft < minLeft {
		maxLeft = minLeft
	}
	if leftWidth < minLeft {
		leftWidth = minLeft
	} else if leftWidth > maxLeft {
		leftWidth = maxLeft
	}

	rightWidth := inner - leftWidth

	return PaneWidths{
		Left:      leftWidth,
		Right:     rightWidth,
		Divider:   dividerWidth,
		Available: available,
	}
}
