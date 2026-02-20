package markdown

import (
	"github.com/charmbracelet/glamour"
)

// renderer is a lazily-initialized, reusable glamour renderer.
// Using a package-level instance avoids re-allocating the renderer on every call.
var renderer *glamour.TermRenderer

// initRenderer lazily creates the renderer on first use.
func initRenderer(width int) *glamour.TermRenderer {
	r, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(width),
	)
	if err != nil {
		// Fallback: return nil and let callers use raw content
		return nil
	}
	return r
}

// Render renders markdown content for the given terminal width.
// Returns the rendered string or the raw content if rendering fails.
func Render(content string, width int) string {
	if width <= 0 {
		width = 80
	}

	// Recreate renderer if width changed or not yet initialized
	r := initRenderer(width)
	if r == nil {
		return content
	}

	out, err := r.Render(content)
	if err != nil {
		return content
	}
	return out
}

// RenderDark renders markdown content using a dark theme.
func RenderDark(content string, width int) string {
	if width <= 0 {
		width = 80
	}

	r, err := glamour.NewTermRenderer(
		glamour.WithStylePath("dark"),
		glamour.WithWordWrap(width),
	)
	if err != nil {
		return content
	}

	out, err := r.Render(content)
	if err != nil {
		return content
	}
	return out
}

// Available returns true if the glamour renderer can be initialized.
// Used to check if markdown rendering is supported in the current environment.
func Available() bool {
	if renderer != nil {
		return true
	}
	renderer = initRenderer(80)
	return renderer != nil
}
