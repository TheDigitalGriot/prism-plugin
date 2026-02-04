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

	InfoStyle    = lipgloss.NewStyle().Foreground(Info)
	SuccessStyle = lipgloss.NewStyle().Foreground(Success)
	WarningStyle = lipgloss.NewStyle().Foreground(Warning)
	ErrorStyle   = lipgloss.NewStyle().Foreground(Error).Bold(true)
	DimStyle     = lipgloss.NewStyle().Foreground(Dim)

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
