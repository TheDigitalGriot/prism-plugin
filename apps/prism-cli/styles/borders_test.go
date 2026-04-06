package styles

import (
	"strings"
	"testing"
)

func TestRenderPanel_Dimensions(t *testing.T) {
	width := 40
	height := 10
	content := "hello"

	result := RenderPanel(content, width, height, false)
	lines := strings.Split(result, "\n")

	// The last line may be empty after trailing newline — trim it.
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}

	if len(lines) != height {
		t.Errorf("want %d lines, got %d", height, len(lines))
	}
}

func TestRenderPanel_ActiveVsInactive(t *testing.T) {
	// Active and inactive panels should produce different output (different gradients).
	active := RenderPanel("test", 30, 8, true)
	inactive := RenderPanel("test", 30, 8, false)
	if active == inactive {
		t.Error("active and inactive panels should differ (different gradient colors)")
	}
}

func TestRenderPanel_TooSmall(t *testing.T) {
	// width/height < 3 should return content directly
	result := RenderPanel("x", 2, 2, false)
	if result != "x" {
		t.Errorf("want raw content for tiny size, got %q", result)
	}
}

func TestRenderGradientBorder_CornerChars(t *testing.T) {
	g := NewGradient([]string{"#7C3AED", "#3B82F6"}, DefaultGradientAngle)
	result := RenderGradientBorder("hello", 20, 5, g, 0)

	if !strings.Contains(result, "╭") {
		t.Error("missing top-left corner ╭")
	}
	if !strings.Contains(result, "╮") {
		t.Error("missing top-right corner ╮")
	}
	if !strings.Contains(result, "╰") {
		t.Error("missing bottom-left corner ╰")
	}
	if !strings.Contains(result, "╯") {
		t.Error("missing bottom-right corner ╯")
	}
}

func TestRenderGradientBorder_ContentIncluded(t *testing.T) {
	g := NewGradient([]string{"#7C3AED", "#3B82F6"}, DefaultGradientAngle)
	content := "hello world"
	result := RenderGradientBorder(content, 30, 5, g, 0)
	if !strings.Contains(result, content) {
		t.Errorf("panel output should contain content %q", content)
	}
}

func TestTruncateString_ASCII(t *testing.T) {
	s := "hello world"
	got := truncateString(s, 5)
	if got != "hello" {
		t.Errorf("truncateString: want %q, got %q", "hello", got)
	}
}

func TestTruncateString_Empty(t *testing.T) {
	got := truncateString("anything", 0)
	if got != "" {
		t.Errorf("truncateString(0): want empty, got %q", got)
	}
}

func TestTruncateString_ANSIPreserved(t *testing.T) {
	// ANSI sequences should not count toward width
	ansi := "\x1b[31mhello\x1b[0m"
	got := truncateString(ansi, 5)
	// Should contain the full "hello" since ANSI doesn't count
	if !strings.Contains(got, "hello") {
		t.Errorf("ANSI-wrapped content should not be truncated within visual width: got %q", got)
	}
}
