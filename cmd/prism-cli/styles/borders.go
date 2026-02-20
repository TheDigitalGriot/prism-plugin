package styles

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Border characters for rounded borders (matching lipgloss.RoundedBorder).
const (
	borderCornerTL   = "╭"
	borderCornerTR   = "╮"
	borderCornerBL   = "╰"
	borderCornerBR   = "╯"
	borderHorizontal = "─"
	borderVertical   = "│"
)

// colorChar wraps a character with ANSI foreground color.
func colorChar(char string, color RGB) string {
	return color.ToANSI() + char + ANSIReset
}

// RenderGradientBorder renders content inside a box with gradient-colored borders.
// width and height are the outer dimensions including borders.
func RenderGradientBorder(content string, width, height int, gradient Gradient, padding int) string {
	if width < 3 || height < 3 {
		return content
	}

	innerWidth := width - 2
	innerHeight := height - 2

	lines := strings.Split(content, "\n")

	paddedLines := make([]string, innerHeight)
	paddingStr := strings.Repeat(" ", padding)
	contentWidth := innerWidth - (padding * 2)
	if contentWidth < 0 {
		contentWidth = 0
	}

	for i := 0; i < innerHeight; i++ {
		var line string
		if i < len(lines) {
			line = lines[i]
		}

		lineWidth := lipgloss.Width(line)
		if lineWidth > contentWidth {
			line = truncateString(line, contentWidth)
			lineWidth = lipgloss.Width(line)
		}

		rightPad := contentWidth - lineWidth
		if rightPad < 0 {
			rightPad = 0
		}
		paddedLines[i] = paddingStr + line + strings.Repeat(" ", rightPad) + paddingStr
	}

	var result strings.Builder

	result.WriteString(renderGradientBorderTop(width, height, gradient))
	result.WriteString("\n")

	for y, line := range paddedLines {
		leftPos := gradient.PositionAt(0, y+1, width, height)
		result.WriteString(colorChar(borderVertical, gradient.ColorAt(leftPos)))

		result.WriteString(line)

		rightPos := gradient.PositionAt(width-1, y+1, width, height)
		result.WriteString(colorChar(borderVertical, gradient.ColorAt(rightPos)))
		result.WriteString("\n")
	}

	result.WriteString(renderGradientBorderBottom(width, height, gradient))

	return result.String()
}

// renderGradientBorderTop renders the top border line with gradient colors.
func renderGradientBorderTop(width, height int, g Gradient) string {
	var sb strings.Builder

	pos := g.PositionAt(0, 0, width, height)
	sb.WriteString(colorChar(borderCornerTL, g.ColorAt(pos)))

	for x := 1; x < width-1; x++ {
		pos := g.PositionAt(x, 0, width, height)
		sb.WriteString(colorChar(borderHorizontal, g.ColorAt(pos)))
	}

	pos = g.PositionAt(width-1, 0, width, height)
	sb.WriteString(colorChar(borderCornerTR, g.ColorAt(pos)))

	return sb.String()
}

// renderGradientBorderBottom renders the bottom border line with gradient colors.
func renderGradientBorderBottom(width, height int, g Gradient) string {
	var sb strings.Builder
	y := height - 1

	pos := g.PositionAt(0, y, width, height)
	sb.WriteString(colorChar(borderCornerBL, g.ColorAt(pos)))

	for x := 1; x < width-1; x++ {
		pos := g.PositionAt(x, y, width, height)
		sb.WriteString(colorChar(borderHorizontal, g.ColorAt(pos)))
	}

	pos = g.PositionAt(width-1, y, width, height)
	sb.WriteString(colorChar(borderCornerBR, g.ColorAt(pos)))

	return sb.String()
}

// truncateString truncates a string to maxWidth visual characters.
// ANSI escape sequences are preserved but don't count toward visual width.
func truncateString(s string, maxWidth int) string {
	if maxWidth <= 0 {
		return ""
	}

	var result strings.Builder
	width := 0
	i := 0

	for i < len(s) {
		// Check for ANSI escape sequence (ESC[...m pattern)
		if i < len(s)-1 && s[i] == '\x1b' && s[i+1] == '[' {
			start := i
			i += 2
			for i < len(s) && !isTerminator(s[i]) {
				i++
			}
			if i < len(s) {
				i++
			}
			result.WriteString(s[start:i])
			continue
		}

		r, size := decodeRune(s[i:])
		charWidth := runeWidth(r)

		if width+charWidth > maxWidth {
			break
		}

		result.WriteString(s[i : i+size])
		width += charWidth
		i += size
	}

	return result.String()
}

// isTerminator returns true if b is an ANSI sequence terminator (letter).
func isTerminator(b byte) bool {
	return (b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z')
}

// decodeRune decodes the first rune in s and returns it with its byte size.
func decodeRune(s string) (rune, int) {
	if len(s) == 0 {
		return 0, 0
	}
	r := rune(s[0])
	if r < 0x80 {
		return r, 1
	}
	if r&0xE0 == 0xC0 && len(s) >= 2 && (s[1]&0xC0) == 0x80 {
		return rune(s[0]&0x1F)<<6 | rune(s[1]&0x3F), 2
	}
	if r&0xF0 == 0xE0 && len(s) >= 3 && (s[1]&0xC0) == 0x80 && (s[2]&0xC0) == 0x80 {
		return rune(s[0]&0x0F)<<12 | rune(s[1]&0x3F)<<6 | rune(s[2]&0x3F), 3
	}
	if r&0xF8 == 0xF0 && len(s) >= 4 && (s[1]&0xC0) == 0x80 && (s[2]&0xC0) == 0x80 && (s[3]&0xC0) == 0x80 {
		return rune(s[0]&0x07)<<18 | rune(s[1]&0x3F)<<12 | rune(s[2]&0x3F)<<6 | rune(s[3]&0x3F), 4
	}
	return r, 1
}

// runeWidth returns the visual width of a rune.
func runeWidth(r rune) int {
	if r >= 0x1100 && r <= 0x115F ||
		r >= 0x2E80 && r <= 0x9FFF ||
		r >= 0xAC00 && r <= 0xD7A3 ||
		r >= 0xF900 && r <= 0xFAFF ||
		r >= 0xFE10 && r <= 0xFE1F ||
		r >= 0xFE30 && r <= 0xFE6F ||
		r >= 0xFF00 && r <= 0xFF60 ||
		r >= 0xFFE0 && r <= 0xFFE6 ||
		r >= 0x20000 && r <= 0x2FFFF ||
		r >= 0x1F300 && r <= 0x1F9FF ||
		r >= 0x2600 && r <= 0x26FF ||
		r >= 0x2700 && r <= 0x27BF {
		return 2
	}
	return 1
}

// RenderPanel renders content in a panel with gradient borders.
// active determines whether to use the active (focused) or normal gradient.
// width and height are the outer dimensions including borders.
func RenderPanel(content string, width, height int, active bool) string {
	var gradient Gradient
	if active {
		gradient = GetActiveGradient()
	} else {
		gradient = GetNormalGradient()
	}
	return RenderGradientBorder(content, width, height, gradient, 1)
}

// RenderPanelWithGradient renders content in a panel with a custom gradient.
func RenderPanelWithGradient(content string, width, height int, gradient Gradient) string {
	return RenderGradientBorder(content, width, height, gradient, 1)
}
