package markdown

import (
	"strings"
	"testing"
)

func TestRender(t *testing.T) {
	input := "# Hello\n\nThis is **bold** text."
	result := Render(input, 80)

	if result == "" {
		t.Error("Render returned empty string")
	}
	// Glamour should have processed the markdown (output will differ from input)
	if result == input {
		t.Error("Render returned raw input unchanged")
	}
}

func TestRenderDark(t *testing.T) {
	input := "## Heading\n\n- item 1\n- item 2"
	result := RenderDark(input, 80)

	if result == "" {
		t.Error("RenderDark returned empty string")
	}
	if result == input {
		t.Error("RenderDark returned raw input unchanged")
	}
}

func TestRenderCodeBlock(t *testing.T) {
	input := "```go\nfunc main() {}\n```"
	result := Render(input, 80)

	if !strings.Contains(result, "main") {
		t.Error("Render did not preserve code content")
	}
}

func TestRenderZeroWidth(t *testing.T) {
	input := "# Test"
	result := Render(input, 0)
	if result == "" {
		t.Error("Render with zero width returned empty string")
	}
}

func TestAvailable(t *testing.T) {
	if !Available() {
		t.Error("Available() returned false; glamour should be usable")
	}
}
