package ui

import (
	"strings"
	"testing"
)

func TestRenderDivider_LineCount(t *testing.T) {
	height := 20
	result := RenderDivider(height)
	// The divider uses MarginTop(1) and renders height-2 bar chars.
	// lipgloss MarginTop(1) adds a blank line above the content.
	// So total lines = 1 (margin) + (height-2) bars = height-1
	lines := strings.Split(result, "\n")
	// Allow for trailing newline variation; at minimum we expect height-2 bar lines
	barCount := 0
	for _, l := range lines {
		if strings.Contains(stripANSI(l), "│") {
			barCount++
		}
	}
	want := height - 2
	if barCount != want {
		t.Errorf("want %d bar lines for height %d, got %d (lines: %v)", want, height, barCount, lines)
	}
}

func TestRenderDivider_MinHeight(t *testing.T) {
	// height=3 → 1 bar character
	result := RenderDivider(3)
	barCount := 0
	for _, l := range strings.Split(result, "\n") {
		if strings.Contains(stripANSI(l), "│") {
			barCount++
		}
	}
	if barCount != 1 {
		t.Errorf("want 1 bar for height=3, got %d", barCount)
	}
}

func TestRenderDivider_ContainsBarChar(t *testing.T) {
	result := RenderDivider(10)
	if !strings.Contains(result, "│") {
		t.Error("RenderDivider output should contain │ characters")
	}
}
