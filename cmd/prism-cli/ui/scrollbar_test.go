package ui

import (
	"strings"
	"testing"
)

func TestRenderScrollbar_NoScrollNeeded(t *testing.T) {
	// All items visible — should return spacer column
	result := RenderScrollbar(ScrollbarParams{
		TotalItems:   5,
		ScrollOffset: 0,
		VisibleItems: 10,
		TrackHeight:  10,
	})
	lines := strings.Split(result, "\n")
	if len(lines) != 10 {
		t.Errorf("want 10 lines, got %d", len(lines))
	}
	for i, l := range lines {
		// Strip ANSI — each line should be a single space (spacer)
		stripped := stripANSI(l)
		if stripped != " " {
			t.Errorf("line %d: want space, got %q", i, stripped)
		}
	}
}

func TestRenderScrollbar_ExactTrackHeight(t *testing.T) {
	result := RenderScrollbar(ScrollbarParams{
		TotalItems:   20,
		ScrollOffset: 0,
		VisibleItems: 10,
		TrackHeight:  10,
	})
	lines := strings.Split(result, "\n")
	if len(lines) != 10 {
		t.Errorf("want 10 lines, got %d", len(lines))
	}
}

func TestRenderScrollbar_ScrolledToBottom(t *testing.T) {
	result := RenderScrollbar(ScrollbarParams{
		TotalItems:   20,
		ScrollOffset: 10, // scrolled all the way down
		VisibleItems: 10,
		TrackHeight:  10,
	})
	lines := strings.Split(result, "\n")
	if len(lines) != 10 {
		t.Errorf("want 10 lines, got %d", len(lines))
	}
	// Thumb should appear near the bottom — at least one thumb char
	thumbFound := false
	for _, l := range lines {
		if strings.Contains(stripANSI(l), "┃") {
			thumbFound = true
			break
		}
	}
	if !thumbFound {
		t.Error("expected thumb character ┃ in scrollbar output")
	}
}

func TestRenderScrollbar_ZeroTrackHeight(t *testing.T) {
	result := RenderScrollbar(ScrollbarParams{
		TotalItems:   10,
		ScrollOffset: 0,
		VisibleItems: 5,
		TrackHeight:  0,
	})
	if result != "" {
		t.Errorf("want empty string for TrackHeight=0, got %q", result)
	}
}

// stripANSI removes ANSI escape sequences from a string.
func stripANSI(s string) string {
	var result strings.Builder
	i := 0
	for i < len(s) {
		if i < len(s)-1 && s[i] == '\x1b' && s[i+1] == '[' {
			i += 2
			for i < len(s) && !((s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= 'a' && s[i] <= 'z')) {
				i++
			}
			if i < len(s) {
				i++
			}
			continue
		}
		result.WriteByte(s[i])
		i++
	}
	return result.String()
}
