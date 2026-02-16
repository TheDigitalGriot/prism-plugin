package styles

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Powerline separator constants — Nerd Font glyphs (slant style)
const (
	SepRight     = "\uE0BC" // backslash slant (top-left fill)
	SepRightThin = "\uE0BD" // backslash slant thin
	SepLeft      = "\uE0BA" // backslash slant (bottom-right fill)
	SepLeftThin  = "\uE0BB" // backslash slant thin
)

// Powerline separator constants — ASCII fallback (no Nerd Fonts)
const (
	SepRightASCII     = "\u25B6" // ▶
	SepRightThinASCII = "\u276F" // ❯
	SepLeftASCII      = "\u25C0" // ◀
	SepLeftThinASCII  = "\u276E" // ❮
)

// Icon constants — Nerd Font glyphs
const (
	IconGitBranch = "\uE0A0" // Powerline branch symbol
	IconFolder    = "\uF07B" // Folder icon
	IconGear      = "\uF013" // Gear/settings icon
	IconCheck     = "\uF00C" // Checkmark
	IconCross     = "\uF00D" // Cross/X mark
	IconClock     = "\uF017" // Clock icon
	IconPlay      = "\uF04B" // Play icon
	IconCircle    = "\uF111" // Filled circle
	IconHome      = "\uF015" // Home icon
	IconSearch    = "\uF002" // Search/magnifier icon
	IconList      = "\uF03A" // List icon
	IconBolt      = "\uF0E7" // Lightning bolt icon
	IconUser      = "\uF007" // User icon
	IconChart     = "\uF080" // Bar chart icon
	IconGrid      = "\uF009" // Grid/workspaces icon
)

// Icon constants — ASCII/Unicode fallback (no Nerd Fonts)
const (
	IconGitBranchASCII = "\u2387" // ⎇ (alternative key symbol)
	IconFolderASCII    = "\u25A1" // □
	IconGearASCII      = "*"
	IconCheckASCII     = "\u2713" // ✓
	IconCrossASCII     = "\u2717" // ✗
	IconClockASCII     = "\u25F7" // ◷
	IconPlayASCII      = "\u25B6" // ▶
	IconCircleASCII    = "\u25CF" // ●
	IconHomeASCII      = "1"
	IconSearchASCII    = "2"
	IconListASCII      = "3"
	IconBoltASCII      = "4"
	IconUserASCII      = "7"
	IconChartASCII     = "8"
	IconGridASCII      = "9"
)

// Icons holds the active icon set based on font detection
type Icons struct {
	GitBranch string
	Folder    string
	Gear      string
	Check     string
	Cross     string
	Clock     string
	Play      string
	Circle    string
	Home      string
	Search    string
	List      string
	Bolt      string
	User      string
	Chart     string
	Grid      string
	SepRight  string
	SepLeft   string
}

// NerdIcons returns the Nerd Font icon set
func NerdIcons() Icons {
	return Icons{
		GitBranch: IconGitBranch,
		Folder:    IconFolder,
		Gear:      IconGear,
		Check:     IconCheck,
		Cross:     IconCross,
		Clock:     IconClock,
		Play:      IconPlay,
		Circle:    IconCircle,
		Home:      IconHome,
		Search:    IconSearch,
		List:      IconList,
		Bolt:      IconBolt,
		User:      IconUser,
		Chart:     IconChart,
		Grid:      IconGrid,
		SepRight:  SepRight,
		SepLeft:   SepLeft,
	}
}

// ASCIIIcons returns the ASCII/Unicode fallback icon set
func ASCIIIcons() Icons {
	return Icons{
		GitBranch: IconGitBranchASCII,
		Folder:    IconFolderASCII,
		Gear:      IconGearASCII,
		Check:     IconCheckASCII,
		Cross:     IconCrossASCII,
		Clock:     IconClockASCII,
		Play:      IconPlayASCII,
		Circle:    IconCircleASCII,
		Home:      IconHomeASCII,
		Search:    IconSearchASCII,
		List:      IconListASCII,
		Bolt:      IconBoltASCII,
		User:      IconUserASCII,
		Chart:     IconChartASCII,
		Grid:      IconGridASCII,
		SepRight:  SepRightASCII,
		SepLeft:   SepLeftASCII,
	}
}

// GetIcons returns the appropriate icon set based on Nerd Font availability
func GetIcons(hasNerdFont bool) Icons {
	if hasNerdFont {
		return NerdIcons()
	}
	return ASCIIIcons()
}

// Tab bar colors
var (
	TabBarBg         = lipgloss.Color("#1a1b26") // Dark background for bar fill (same as FooterBg)
	TabBarInactiveBg = lipgloss.Color("#2c2d3a") // Inactive tab background
)

// Footer-specific colors
var (
	FooterBg = lipgloss.Color("#1a1b26") // Dark background for bar fill

	// Workflow phase backgrounds
	PhaseResearch  = lipgloss.Color("#3B82F6") // Blue
	PhasePlan      = lipgloss.Color("#14B8A6") // Teal
	PhaseImplement = lipgloss.Color("#22C55E") // Green
	PhaseValidate  = lipgloss.Color("#F59E0B") // Amber
	PhaseIdle      = lipgloss.Color("#4B5563") // Dim gray
)

// Segment represents a powerline segment with content and colors
type Segment struct {
	Content    string
	Foreground lipgloss.Color
	Background lipgloss.Color
}

// BuildPowerline renders left-aligned segments with powerline separators.
// The icons parameter determines which separator glyphs to use.
func BuildPowerline(segments []Segment, totalWidth int, barBg lipgloss.Color, icons Icons) string {
	if len(segments) == 0 {
		return ""
	}

	var parts []string

	for i, seg := range segments {
		// Render the segment content
		style := lipgloss.NewStyle().
			Foreground(seg.Foreground).
			Background(seg.Background).
			Padding(0, 1)
		parts = append(parts, style.Render(seg.Content))

		// Add separator after the segment
		var nextBg lipgloss.Color
		if i < len(segments)-1 {
			nextBg = segments[i+1].Background
		} else {
			nextBg = barBg
		}

		sepStyle := lipgloss.NewStyle().
			Foreground(seg.Background).
			Background(nextBg)
		parts = append(parts, sepStyle.Render(icons.SepRight))
	}

	return strings.Join(parts, "")
}

// BuildPowerlineRight renders right-aligned segments with powerline separators.
// The icons parameter determines which separator glyphs to use.
func BuildPowerlineRight(segments []Segment, barBg lipgloss.Color, icons Icons) string {
	if len(segments) == 0 {
		return ""
	}

	var parts []string

	for i, seg := range segments {
		// Add separator before the segment
		var prevBg lipgloss.Color
		if i == 0 {
			prevBg = barBg
		} else {
			prevBg = segments[i-1].Background
		}

		sepStyle := lipgloss.NewStyle().
			Foreground(seg.Background).
			Background(prevBg)
		parts = append(parts, sepStyle.Render(icons.SepLeft))

		// Render the segment content
		style := lipgloss.NewStyle().
			Foreground(seg.Foreground).
			Background(seg.Background).
			Padding(0, 1)
		parts = append(parts, style.Render(seg.Content))
	}

	return strings.Join(parts, "")
}

// RenderPowerlineBar renders a complete powerline bar with left and right segments
func RenderPowerlineBar(left, right string, width int, barBg lipgloss.Color) string {
	leftWidth := lipgloss.Width(left)
	rightWidth := lipgloss.Width(right)

	// Calculate spacer width
	spacerWidth := width - leftWidth - rightWidth
	if spacerWidth < 0 {
		spacerWidth = 0
	}

	// Create spacer with bar background
	spacer := lipgloss.NewStyle().
		Background(barBg).
		Render(strings.Repeat(" ", spacerWidth))

	// Join left + spacer + right
	bar := left + spacer + right

	// Apply background to entire bar for consistent fill
	barStyle := lipgloss.NewStyle().
		Background(barBg).
		Width(width)

	return barStyle.Render(bar)
}
