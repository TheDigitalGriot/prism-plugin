package styles

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// parseHex parses a hex color string (#RRGGBB) into RGB components
func parseHex(hex string) (r, g, b uint8) {
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) != 6 {
		return 0, 0, 0
	}
	rVal, _ := strconv.ParseUint(hex[0:2], 16, 8)
	gVal, _ := strconv.ParseUint(hex[2:4], 16, 8)
	bVal, _ := strconv.ParseUint(hex[4:6], 16, 8)
	return uint8(rVal), uint8(gVal), uint8(bVal)
}

// LerpColor interpolates between two hex colors
// t should be between 0 (c1) and 1 (c2)
func LerpColor(c1, c2 string, t float64) string {
	r1, g1, b1 := parseHex(c1)
	r2, g2, b2 := parseHex(c2)

	r := uint8(float64(r1) + t*(float64(r2)-float64(r1)))
	g := uint8(float64(g1) + t*(float64(g2)-float64(g1)))
	b := uint8(float64(b1) + t*(float64(b2)-float64(b1)))

	return fmt.Sprintf("#%02X%02X%02X", r, g, b)
}

// AdjustBrightness multiplies the brightness of a hex color
// factor > 1.0 brightens, < 1.0 darkens
func AdjustBrightness(hex string, factor float64) string {
	r, g, b := parseHex(hex)

	// Clamp helper
	clamp := func(v float64) uint8 {
		if v > 255 {
			return 255
		}
		if v < 0 {
			return 0
		}
		return uint8(v)
	}

	r = clamp(float64(r) * factor)
	g = clamp(float64(g) * factor)
	b = clamp(float64(b) * factor)

	return fmt.Sprintf("#%02X%02X%02X", r, g, b)
}

// GradientString applies a gradient across text characters
// colors should be hex strings like "#RRGGBB"
func GradientString(text string, colors []string) string {
	if len(colors) == 0 {
		return text
	}
	if len(colors) == 1 {
		return lipgloss.NewStyle().Foreground(lipgloss.Color(colors[0])).Render(text)
	}

	runes := []rune(text)
	if len(runes) == 0 {
		return ""
	}

	var sb strings.Builder

	for i, r := range runes {
		// Calculate position in gradient (0 to 1)
		t := float64(i) / float64(len(runes)-1)
		if len(runes) == 1 {
			t = 0
		}

		// Map to color index and local t
		colorPos := t * float64(len(colors)-1)
		colorIdx := int(colorPos)
		localT := colorPos - float64(colorIdx)

		// Clamp to valid range
		if colorIdx >= len(colors)-1 {
			colorIdx = len(colors) - 2
			localT = 1.0
		}

		c := LerpColor(colors[colorIdx], colors[colorIdx+1], localT)
		style := lipgloss.NewStyle().Foreground(lipgloss.Color(c))
		sb.WriteString(style.Render(string(r)))
	}

	return sb.String()
}

// ShiftColors rotates the color array by offset positions
func ShiftColors(colors []string, offset int) []string {
	if len(colors) == 0 {
		return colors
	}
	offset = offset % len(colors)
	if offset < 0 {
		offset += len(colors)
	}
	result := make([]string, len(colors))
	for i := range colors {
		result[i] = colors[(i+offset)%len(colors)]
	}
	return result
}

// BrailleCell represents a 2x4 pixel cell using Unicode Braille
// Dot positions:
//
//	[0] [3]
//	[1] [4]
//	[2] [5]
//	[6] [7]
type BrailleCell struct {
	Pixels [8]bool
}

// Bit values for each dot position in Braille character
var brailleBits = [8]int{0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80}

// Rune converts the cell to its Unicode Braille character
func (c BrailleCell) Rune() rune {
	val := 0x2800 // Base braille character (empty)
	for i, on := range c.Pixels {
		if on {
			val |= brailleBits[i]
		}
	}
	return rune(val)
}

// SetPixel sets a pixel at the given position (0-7)
func (c *BrailleCell) SetPixel(pos int, on bool) {
	if pos >= 0 && pos < 8 {
		c.Pixels[pos] = on
	}
}

// Clear resets all pixels to off
func (c *BrailleCell) Clear() {
	c.Pixels = [8]bool{}
}

// Fill sets all pixels to on
func (c *BrailleCell) Fill() {
	for i := range c.Pixels {
		c.Pixels[i] = true
	}
}

// BrailleCanvas is a 2D grid of braille cells for pixel art
type BrailleCanvas struct {
	cells  [][]BrailleCell
	width  int // in cells
	height int // in cells
}

// NewBrailleCanvas creates a new canvas with given dimensions (in cells)
func NewBrailleCanvas(widthCells, heightCells int) *BrailleCanvas {
	cells := make([][]BrailleCell, heightCells)
	for i := range cells {
		cells[i] = make([]BrailleCell, widthCells)
	}
	return &BrailleCanvas{
		cells:  cells,
		width:  widthCells,
		height: heightCells,
	}
}

// SetPixel sets a pixel at (x, y) where coordinates are in "pixels" (2x4 per cell)
func (bc *BrailleCanvas) SetPixel(x, y int, on bool) {
	cellX := x / 2
	cellY := y / 4
	if cellX < 0 || cellX >= bc.width || cellY < 0 || cellY >= bc.height {
		return
	}

	// Calculate which dot in the cell
	dotX := x % 2
	dotY := y % 4

	// Map to dot position (left column: 0,1,2,6; right column: 3,4,5,7)
	var dotPos int
	if dotY < 3 {
		dotPos = dotY + dotX*3
	} else {
		dotPos = 6 + dotX
	}

	bc.cells[cellY][cellX].SetPixel(dotPos, on)
}

// Render converts the canvas to a multi-line string
func (bc *BrailleCanvas) Render() string {
	var lines []string
	for _, row := range bc.cells {
		var line strings.Builder
		for _, cell := range row {
			line.WriteRune(cell.Rune())
		}
		lines = append(lines, line.String())
	}
	return strings.Join(lines, "\n")
}

// RenderWithColor renders the canvas with a single color
func (bc *BrailleCanvas) RenderWithColor(color lipgloss.Color) string {
	style := lipgloss.NewStyle().Foreground(color)
	return style.Render(bc.Render())
}

// Shimmer calculates brightness oscillation for shimmer effects
// phase should cycle from 0 to 2*Pi
func Shimmer(phase float64, minBrightness, maxBrightness float64) float64 {
	return minBrightness + (maxBrightness-minBrightness)*(0.5+0.5*math.Sin(phase))
}
