package styles

import "github.com/charmbracelet/lipgloss"

// Color palette
var (
	Primary    = lipgloss.Color("#7C3AED") // Purple
	Success    = lipgloss.Color("#10B981") // Green
	Warning    = lipgloss.Color("#F59E0B") // Yellow
	Error      = lipgloss.Color("#EF4444") // Red
	Info       = lipgloss.Color("#3B82F6") // Blue
	Dim        = lipgloss.Color("#6B7280") // Gray
	Background = lipgloss.Color("#1F2937") // Dark
	White      = lipgloss.Color("#FFFFFF")

	// Prism brand colors for animation
	PrismColors = []lipgloss.Color{
		lipgloss.Color("#3B82F6"), // Blue
		lipgloss.Color("#14B8A6"), // Teal
		lipgloss.Color("#22C55E"), // Green
		lipgloss.Color("#F59E0B"), // Amber
	}
)

// Icons (cross-platform compatible)
var (
	CheckIcon   = lipgloss.NewStyle().Foreground(Success).Render("✓")
	PlayIcon    = lipgloss.NewStyle().Foreground(Primary).Render("▸")
	PendingIcon = lipgloss.NewStyle().Foreground(Dim).Render("○")
	BlockedIcon = lipgloss.NewStyle().Foreground(Warning).Render("⊘")
	ErrorIcon   = lipgloss.NewStyle().Foreground(Error).Render("✗")
)

// Component Styles
var (
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Primary).
			Padding(0, 1)

	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(White).
			Background(Primary).
			Padding(0, 1).
			MarginBottom(1)

	PanelStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(Dim).
			Padding(0, 1)

	PanelTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Info)

	CompleteStyle = lipgloss.NewStyle().
			Foreground(Success)

	CurrentStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Primary)

	PendingStyle = lipgloss.NewStyle().
			Foreground(Dim)

	BlockedStyle = lipgloss.NewStyle().
			Foreground(Warning).
			Italic(true)

	InfoStyle      = lipgloss.NewStyle().Foreground(Info)
	SuccessStyle   = lipgloss.NewStyle().Foreground(Success)
	WarningStyle   = lipgloss.NewStyle().Foreground(Warning)
	ErrorStyle     = lipgloss.NewStyle().Foreground(Error).Bold(true)
	DimStyle       = lipgloss.NewStyle().Foreground(Dim)
	HighlightStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#06B6D4")) // Cyan for tool activity

	OutputBoxStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(Dim).
			Padding(0, 1)

	StatusBarStyle = lipgloss.NewStyle().
			Foreground(Dim).
			Padding(0, 1)

	ProgressBarStyle = lipgloss.NewStyle().
				Foreground(Primary)
)

// Separator renders a vertical separator
func Separator() string {
	return lipgloss.NewStyle().Foreground(Dim).Render(" │ ")
}

// HorizontalLine renders a horizontal divider
func HorizontalLine(width int) string {
	return lipgloss.NewStyle().
		Foreground(Dim).
		Render(repeatChar("─", width))
}

func repeatChar(char string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += char
	}
	return result
}

// RenderPrism returns a geometric prism with animated color refraction
func RenderPrism(frame int) string {
	// Prism body - crystalline glass effect
	glass := lipgloss.Color("#E2E8F0")      // Light silver
	glassEdge := lipgloss.Color("#94A3B8")  // Darker edge
	white := lipgloss.Color("#FFFFFF")

	// Animated spectrum - 4 brand colors cycling
	c0 := lipgloss.NewStyle().Foreground(PrismColors[(frame+0)%4]).Render("━")
	c1 := lipgloss.NewStyle().Foreground(PrismColors[(frame+1)%4]).Render("━")
	c2 := lipgloss.NewStyle().Foreground(PrismColors[(frame+2)%4]).Render("━")
	c3 := lipgloss.NewStyle().Foreground(PrismColors[(frame+3)%4]).Render("━")

	// Light beam
	beam := lipgloss.NewStyle().Foreground(white).Render("─")

	// Geometric prism triangle: ◁▷ or ◀▶ or ◄►
	// Using filled triangle for solid glass look
	prismL := lipgloss.NewStyle().Foreground(glass).Render("◀")
	prismR := lipgloss.NewStyle().Foreground(glassEdge).Render("▶")

	// Build: ─◀▶━━━━
	return beam + prismL + prismR + c0 + c1 + c2 + c3
}

// RenderPrismGeometric returns a more detailed geometric prism
func RenderPrismGeometric(frame int) string {
	// Crystal prism with faceted look
	topFace := lipgloss.Color("#F8FAFC")   // Bright highlight
	sideFace := lipgloss.Color("#94A3B8")  // Shadow side
	white := lipgloss.Color("#FFFFFF")

	// Animated spectrum bands
	colors := make([]lipgloss.Style, 4)
	for i := 0; i < 4; i++ {
		colors[i] = lipgloss.NewStyle().Foreground(PrismColors[(frame+i)%4])
	}

	// Build geometric prism: ─▲━━━━
	beam := lipgloss.NewStyle().Foreground(white).Render("─")

	// Triangle prism using geometric shapes
	// ◢◣ creates bottom-aligned triangle, ◤◥ creates top-aligned
	triL := lipgloss.NewStyle().Foreground(topFace).Bold(true).Render("◢")
	triR := lipgloss.NewStyle().Foreground(sideFace).Render("◣")

	// Spectrum rays
	rays := colors[0].Render("━") + colors[1].Render("━") + colors[2].Render("━") + colors[3].Render("━")

	return beam + triL + triR + rays
}

// RenderPrismFancy returns an elaborate multi-character prism
func RenderPrismFancy(frame int) string {
	// High-fidelity crystal prism
	highlight := lipgloss.Color("#FFFFFF")
	glass := lipgloss.Color("#E2E8F0")
	shadow := lipgloss.Color("#64748B")
	white := lipgloss.Color("#FFFFFF")

	hl := lipgloss.NewStyle().Foreground(highlight).Bold(true)
	gl := lipgloss.NewStyle().Foreground(glass)
	sh := lipgloss.NewStyle().Foreground(shadow)
	wh := lipgloss.NewStyle().Foreground(white)

	// Spectrum with varying thickness for depth
	c := make([]lipgloss.Style, 4)
	for i := 0; i < 4; i++ {
		c[i] = lipgloss.NewStyle().Foreground(PrismColors[(frame+i)%4])
	}

	// Build elaborate prism: ─╱△╲━━━━
	// or: ─◁◆▷━━━━
	beam := wh.Render("─")
	left := hl.Render("◁")
	center := gl.Render("◆")
	right := sh.Render("▷")

	rays := c[0].Render("▬") + c[1].Render("▬") + c[2].Render("▬") + c[3].Render("▬")

	return beam + left + center + right + rays
}

// RenderPrismCompact returns a minimal animated prism
func RenderPrismCompact(frame int) string {
	glass := lipgloss.Color("#E2E8F0")
	white := lipgloss.Color("#FFFFFF")

	beam := lipgloss.NewStyle().Foreground(white).Render("─")
	prism := lipgloss.NewStyle().Foreground(glass).Bold(true).Render("◆")

	// Mini spectrum
	c0 := lipgloss.NewStyle().Foreground(PrismColors[(frame+0)%4]).Render("▬")
	c1 := lipgloss.NewStyle().Foreground(PrismColors[(frame+1)%4]).Render("▬")

	return beam + prism + c0 + c1
}

// RenderPrismGradientSpring returns a prism with gradient rays and spring animation
// rayLengths: current animated lengths for each of 4 rays (typically 4-8)
// shimmerPhase: phase for brightness oscillation (0 to 2π)
func RenderPrismGradientSpring(frame int, rayLengths [4]float64, shimmerPhase float64) string {
	// Prism body with shimmer
	shimmer := Shimmer(shimmerPhase, 0.85, 1.0)
	glass := AdjustBrightness("#E2E8F0", shimmer)
	highlight := AdjustBrightness("#FFFFFF", shimmer)

	hl := lipgloss.NewStyle().Foreground(lipgloss.Color(highlight)).Bold(true)
	gl := lipgloss.NewStyle().Foreground(lipgloss.Color(glass))

	// Build prism body
	beam := hl.Render("─")
	left := hl.Render("◁")
	center := gl.Render("◆")
	right := lipgloss.NewStyle().Foreground(lipgloss.Color("#94A3B8")).Render("▷")

	// Get shifted colors for animation
	prismColorsStr := make([]string, len(PrismColors))
	for i, c := range PrismColors {
		prismColorsStr[i] = string(c)
	}
	shiftedColors := ShiftColors(prismColorsStr, frame)

	// Build gradient rays with spring-animated lengths
	var rays string
	totalLen := 0
	for i, length := range rayLengths {
		count := int(length + 0.5) // Round to nearest int
		if count < 1 {
			count = 1
		}
		if count > 10 {
			count = 10
		}
		rayStr := repeatChar("▬", count)

		// Apply gradient within this ray segment
		startColor := shiftedColors[i%len(shiftedColors)]
		endColor := shiftedColors[(i+1)%len(shiftedColors)]
		rays += GradientString(rayStr, []string{startColor, endColor})
		totalLen += count
	}

	return beam + left + center + right + rays
}

// RenderPrismBraille returns a 3-line high-resolution braille prism
// Uses Unicode braille characters for pixel-art effect
func RenderPrismBraille(frame int) string {
	// 3-line braille prism design
	// Line 1: Top of prism triangle
	// Line 2: Middle with light beam entering
	// Line 3: Dispersed light rays

	// Shift colors based on frame
	prismColorsStr := make([]string, len(PrismColors))
	for i, c := range PrismColors {
		prismColorsStr[i] = string(c)
	}
	shifted := ShiftColors(prismColorsStr, frame)

	// Glass/crystal styling
	glass := lipgloss.NewStyle().Foreground(lipgloss.Color("#E2E8F0")).Bold(true)
	white := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))

	// Line 1: Prism apex with light entering
	line1 := white.Render("  ─") + glass.Render("⢀⣠⣤⣄⡀")

	// Line 2: Prism body - full
	line2 := white.Render("━━") + glass.Render("⣾⣿⣿⣿⣷")

	// Line 3: Dispersed spectrum rays (animated colors)
	ray1 := lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[0])).Render("⠛")
	ray2 := lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[1])).Render("⠛")
	ray3 := lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[2])).Render("⠛")
	ray4 := lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[3])).Render("⠛")
	line3 := "  " + glass.Render("⠈⠉") + ray1 + ray2 + ray3 + ray4 + lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[0])).Render("⠛⠛")

	return line1 + "\n" + line2 + "\n" + line3
}

// RenderPrismASCII returns a 5-line classic ASCII art prism
func RenderPrismASCII(frame int) string {
	// Shift colors based on frame
	prismColorsStr := make([]string, len(PrismColors))
	for i, c := range PrismColors {
		prismColorsStr[i] = string(c)
	}
	shifted := ShiftColors(prismColorsStr, frame)

	// Styling
	glass := lipgloss.NewStyle().Foreground(lipgloss.Color("#E2E8F0"))
	glassHL := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF")).Bold(true)
	white := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))

	// Ray styles
	rayStyles := make([]lipgloss.Style, 4)
	for i := range rayStyles {
		rayStyles[i] = lipgloss.NewStyle().Foreground(lipgloss.Color(shifted[i]))
	}

	// Line 1: Apex
	line1 := "        " + glassHL.Render("╱╲")

	// Line 2: Upper body with light entering
	line2 := white.Render("   ━━━") + glassHL.Render("╱") + glass.Render("  ") + glass.Render("╲")

	// Line 3: Middle with first rays
	line3 := "      " + glass.Render("╱") + "    " + glass.Render("╲") + rayStyles[0].Render("━━━")

	// Line 4: Base with more rays
	line4 := "     " + glass.Render("╱") + glassHL.Render("______") + glass.Render("╲") + rayStyles[1].Render("═══") + rayStyles[2].Render("═══")

	// Line 5: Final dispersed rays
	line5 := "               " + rayStyles[2].Render("▬▬▬") + rayStyles[3].Render("▬▬▬")

	return line1 + "\n" + line2 + "\n" + line3 + "\n" + line4 + "\n" + line5
}

// RenderPrismSimple returns a single-line ASCII-only prism for maximum compatibility
// Uses only characters guaranteed to render in all terminals
func RenderPrismSimple(frame int) string {
	// All ASCII characters that render everywhere
	white := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))
	glass := lipgloss.NewStyle().Foreground(lipgloss.Color("#E2E8F0")).Bold(true)

	// Prism body using ASCII-safe characters
	beam := white.Render("-")
	prism := glass.Render("<>")

	// Animated spectrum rays
	c0 := lipgloss.NewStyle().Foreground(PrismColors[(frame+0)%4]).Render("=")
	c1 := lipgloss.NewStyle().Foreground(PrismColors[(frame+1)%4]).Render("=")
	c2 := lipgloss.NewStyle().Foreground(PrismColors[(frame+2)%4]).Render("=")
	c3 := lipgloss.NewStyle().Foreground(PrismColors[(frame+3)%4]).Render("=")

	return beam + prism + c0 + c1 + c2 + c3
}

// PrismStyleHeight returns the number of lines for a given prism style
func PrismStyleHeight(style string) int {
	switch style {
	case "braille":
		return 3
	case "ascii":
		return 5
	default: // "gradient", "simple", or "fancy"
		return 1
	}
}
