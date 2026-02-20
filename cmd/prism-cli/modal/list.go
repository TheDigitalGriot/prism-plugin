package modal

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
)

// =============================================================================
// ListSection: Scrollable item list with selection
// =============================================================================

// ListSection renders a scrollable list of items
type ListSection struct {
	id          string
	items       []string
	selectedIdx *int // Pointer to allow external state binding
	maxVisible  int  // Maximum visible items before scrolling
	scrollOffset int // Current scroll position
}

// ListOption is a functional option for ListSection
type ListOption func(*ListSection)

// WithMaxVisible sets the maximum number of visible items
func WithMaxVisible(max int) ListOption {
	return func(l *ListSection) {
		l.maxVisible = max
	}
}

// List creates a new ListSection
func List(id string, items []string, selectedIdx *int, opts ...ListOption) *ListSection {
	section := &ListSection{
		id:          id,
		items:       items,
		selectedIdx: selectedIdx,
		maxVisible:  5, // Default to 5 visible items
	}

	for _, opt := range opts {
		opt(section)
	}

	return section
}

func (l *ListSection) Render(contentWidth int, focusID string) RenderedSection {
	if len(l.items) == 0 {
		dimStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280")).Italic(true)
		return RenderedSection{
			Content:    dimStyle.Render("(no items)"),
			Focusables: []string{l.id},
		}
	}

	isFocused := l.id == focusID

	// Ensure selectedIdx is within bounds
	if *l.selectedIdx < 0 {
		*l.selectedIdx = 0
	}
	if *l.selectedIdx >= len(l.items) {
		*l.selectedIdx = len(l.items) - 1
	}

	// Adjust scroll offset to keep selected item visible
	if *l.selectedIdx < l.scrollOffset {
		l.scrollOffset = *l.selectedIdx
	}
	if *l.selectedIdx >= l.scrollOffset+l.maxVisible {
		l.scrollOffset = *l.selectedIdx - l.maxVisible + 1
	}

	// Clamp scroll offset
	maxScroll := len(l.items) - l.maxVisible
	if maxScroll < 0 {
		maxScroll = 0
	}
	if l.scrollOffset > maxScroll {
		l.scrollOffset = maxScroll
	}
	if l.scrollOffset < 0 {
		l.scrollOffset = 0
	}

	// Determine visible range
	visibleStart := l.scrollOffset
	visibleEnd := l.scrollOffset + l.maxVisible
	if visibleEnd > len(l.items) {
		visibleEnd = len(l.items)
	}

	// Render visible items
	var lines []string
	for i := visibleStart; i < visibleEnd; i++ {
		item := l.items[i]
		isSelected := i == *l.selectedIdx

		// Truncate item if too long
		maxItemWidth := contentWidth - 4 // Leave room for cursor and padding
		if lipgloss.Width(item) > maxItemWidth {
			item = item[:maxItemWidth-3] + "..."
		}

		// Style based on selection and focus
		var line string
		if isSelected && isFocused {
			// Selected and focused: bold blue with cursor
			style := lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#3B82F6")).
				Width(contentWidth)
			line = style.Render("▸ " + item)
		} else if isSelected {
			// Selected but not focused: dim with cursor
			style := lipgloss.NewStyle().
				Foreground(lipgloss.Color("#9CA3AF")).
				Width(contentWidth)
			line = style.Render("▸ " + item)
		} else {
			// Not selected: regular with indent
			style := lipgloss.NewStyle().
				Foreground(lipgloss.Color("#6B7280")).
				Width(contentWidth)
			line = style.Render("  " + item)
		}

		line = zone.Mark(fmt.Sprintf("modal-%s-%d", l.id, i), line)
		lines = append(lines, line)
	}

	// Add scroll indicators if needed
	hasMore := false
	if l.scrollOffset > 0 {
		// Show "more above" indicator
		dimStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#4B5563")).Align(lipgloss.Center)
		lines = append([]string{dimStyle.Render("⋯")}, lines...)
		hasMore = true
	}
	if visibleEnd < len(l.items) {
		// Show "more below" indicator
		dimStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#4B5563")).Align(lipgloss.Center)
		lines = append(lines, dimStyle.Render("⋯"))
		hasMore = true
	}

	content := strings.Join(lines, "\n")

	// Add border around list if focused
	if isFocused {
		borderStyle := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#3B82F6")).
			Padding(0, 1).
			Width(contentWidth)
		content = borderStyle.Render(content)
	} else if hasMore {
		// Light border to indicate scrollable content
		borderStyle := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#4B5563")).
			Padding(0, 1).
			Width(contentWidth)
		content = borderStyle.Render(content)
	}

	return RenderedSection{
		Content:    content,
		Focusables: []string{l.id},
	}
}

func (l *ListSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if l.id != focusID || len(l.items) == 0 {
		return "", nil
	}

	switch msg.String() {
	case "up", "k":
		// Move selection up
		if *l.selectedIdx > 0 {
			*l.selectedIdx--
		}
		return "", nil

	case "down", "j":
		// Move selection down
		if *l.selectedIdx < len(l.items)-1 {
			*l.selectedIdx++
		}
		return "", nil

	case "home", "g":
		// Jump to first item
		*l.selectedIdx = 0
		l.scrollOffset = 0
		return "", nil

	case "end", "G":
		// Jump to last item
		*l.selectedIdx = len(l.items) - 1
		l.scrollOffset = len(l.items) - l.maxVisible
		if l.scrollOffset < 0 {
			l.scrollOffset = 0
		}
		return "", nil

	case "enter":
		// Select the current item (return list ID as action with selected index)
		return l.id, nil
	}

	return "", nil
}

// SelectedItem returns the currently selected item text (or empty string if no items)
func (l *ListSection) SelectedItem() string {
	if len(l.items) == 0 || *l.selectedIdx < 0 || *l.selectedIdx >= len(l.items) {
		return ""
	}
	return l.items[*l.selectedIdx]
}

// SelectedIndex returns the currently selected index
func (l *ListSection) SelectedIndex() int {
	return *l.selectedIdx
}

// SetItems updates the list items
func (l *ListSection) SetItems(items []string) {
	l.items = items
	// Reset selection if out of bounds
	if *l.selectedIdx >= len(items) {
		*l.selectedIdx = 0
	}
	if *l.selectedIdx < 0 && len(items) > 0 {
		*l.selectedIdx = 0
	}
}

// HandleMouse checks if a list item was clicked and updates selection.
func (l *ListSection) HandleMouse(msg tea.MouseMsg) bool {
	visibleEnd := l.scrollOffset + l.maxVisible
	if visibleEnd > len(l.items) {
		visibleEnd = len(l.items)
	}
	for i := l.scrollOffset; i < visibleEnd; i++ {
		zoneID := fmt.Sprintf("modal-%s-%d", l.id, i)
		if zone.Get(zoneID).InBounds(msg) {
			*l.selectedIdx = i
			return true
		}
	}
	return false
}
