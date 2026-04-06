package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/styles"
)

// RenderDivider renders a vertical divider for separating panes.
// The divider uses BorderNormal color and is shifted down by 1 line
// to align with bordered pane content (below the top border).
// Height should be the full pane height; the divider renders height-2 lines
// to stop above the bottom border.
func RenderDivider(height int) string {
	dividerStyle := lipgloss.NewStyle().
		Foreground(styles.BorderNormal).
		MarginTop(1)

	var sb strings.Builder
	for i := 0; i < height-2; i++ {
		sb.WriteString("│")
		if i < height-3 {
			sb.WriteString("\n")
		}
	}

	return dividerStyle.Render(sb.String())
}
