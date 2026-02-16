package dialog

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
	zone "github.com/lrstanley/bubblezone"
)

// ConfirmDialog is a simple yes/no confirmation dialog
type ConfirmDialog struct {
	id            string
	title         string
	message       string
	confirmLabel  string
	cancelLabel   string
	focusedButton int // 0 = confirm, 1 = cancel
	variant       Variant
}

// Variant controls dialog styling (border color, button styles)
type Variant int

const (
	VariantDefault Variant = iota
	VariantDanger
	VariantWarning
	VariantInfo
)

// NewConfirm creates a new confirmation dialog
func NewConfirm(id, title, message string) *ConfirmDialog {
	return &ConfirmDialog{
		id:            id,
		title:         title,
		message:       message,
		confirmLabel:  "Confirm",
		cancelLabel:   "Cancel",
		focusedButton: 0, // Default focus on confirm button
		variant:       VariantDefault,
	}
}

// WithLabels sets custom button labels
func (d *ConfirmDialog) WithLabels(confirm, cancel string) *ConfirmDialog {
	d.confirmLabel = confirm
	d.cancelLabel = cancel
	return d
}

// WithVariant sets the dialog variant
func (d *ConfirmDialog) WithVariant(variant Variant) *ConfirmDialog {
	d.variant = variant
	return d
}

// WithDefaultFocus sets the default focused button (0 = confirm, 1 = cancel)
func (d *ConfirmDialog) WithDefaultFocus(buttonIdx int) *ConfirmDialog {
	if buttonIdx >= 0 && buttonIdx <= 1 {
		d.focusedButton = buttonIdx
	}
	return d
}

// ID returns the dialog ID
func (d *ConfirmDialog) ID() string {
	return d.id
}

// Update processes keyboard input
func (d *ConfirmDialog) Update(msg tea.Msg) (Action, tea.Cmd) {
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "esc":
			return ActionCancel, nil
		case "enter":
			if d.focusedButton == 0 {
				return ActionConfirm, nil
			}
			return ActionCancel, nil
		case "left", "h", "shift+tab":
			d.focusedButton = 0
			return ActionNone, nil
		case "right", "l", "tab":
			d.focusedButton = 1
			return ActionNone, nil
		case "y":
			// Quick confirm with 'y' key
			return ActionConfirm, nil
		case "n":
			// Quick cancel with 'n' key
			return ActionCancel, nil
		}
	}
	return ActionNone, nil
}

// View renders the confirmation dialog
func (d *ConfirmDialog) View(width, height int) string {
	// Dialog dimensions
	dialogWidth := 50
	if dialogWidth > width-4 {
		dialogWidth = width - 4
	}
	contentWidth := dialogWidth - 6 // Account for border and padding

	// Build content
	var content strings.Builder

	// Title
	titleStyle := d.titleStyle()
	content.WriteString(titleStyle.Width(contentWidth).Render(d.title))
	content.WriteString("\n\n")

	// Message (word-wrapped)
	messageLines := wordWrap(d.message, contentWidth)
	messageStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#D1D5DB"))
	for _, line := range messageLines {
		content.WriteString(messageStyle.Render(line))
		content.WriteString("\n")
	}
	content.WriteString("\n")

	// Buttons
	confirmBtn := zone.Mark("dialog-confirm", d.renderButton(d.confirmLabel, d.focusedButton == 0))
	cancelBtn := zone.Mark("dialog-cancel", d.renderButton(d.cancelLabel, d.focusedButton == 1))
	buttonsRow := lipgloss.JoinHorizontal(lipgloss.Left, confirmBtn, "  ", cancelBtn)
	content.WriteString(buttonsRow)

	// Hints
	content.WriteString("\n\n")
	hintsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280")).Italic(true)
	hints := "y confirm  •  n cancel  •  ←/→ switch  •  esc close"
	content.WriteString(hintsStyle.Render(hints))

	// Wrap in border
	boxStyle := d.boxStyle()
	return boxStyle.Width(dialogWidth).Render(content.String())
}

// HandleMouse processes mouse click events on dialog button zones.
func (d *ConfirmDialog) HandleMouse(msg tea.MouseMsg) Action {
	if zone.Get("dialog-confirm").InBounds(msg) {
		return ActionConfirm
	}
	if zone.Get("dialog-cancel").InBounds(msg) {
		return ActionCancel
	}
	return ActionNone
}

// renderButton renders a single button with optional focus
func (d *ConfirmDialog) renderButton(label string, focused bool) string {
	var style lipgloss.Style
	if focused {
		// Focused button style (variant color with bold text)
		color := d.variantColor()
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(color).
			Bold(true).
			Padding(0, 2)
	} else {
		// Unfocused button style (muted)
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#9CA3AF")).
			Background(lipgloss.Color("#374151")).
			Padding(0, 2)
	}
	return style.Render(label)
}

// boxStyle returns the dialog box style based on variant
func (d *ConfirmDialog) boxStyle() lipgloss.Style {
	borderColor := d.variantColor()
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(1, 2).
		Background(lipgloss.Color("#1F2937"))
}

// titleStyle returns the title style based on variant
func (d *ConfirmDialog) titleStyle() lipgloss.Style {
	color := d.variantColor()
	return lipgloss.NewStyle().
		Bold(true).
		Foreground(color).
		Align(lipgloss.Center)
}

// variantColor returns the color for the dialog variant
func (d *ConfirmDialog) variantColor() lipgloss.Color {
	switch d.variant {
	case VariantDanger:
		return lipgloss.Color("#EF4444") // Red
	case VariantWarning:
		return lipgloss.Color("#F59E0B") // Amber
	case VariantInfo:
		return lipgloss.Color("#3B82F6") // Blue
	default:
		return lipgloss.Color("#7C3AED") // Purple (primary)
	}
}

// wordWrap wraps text to fit within maxWidth
func wordWrap(text string, maxWidth int) []string {
	if maxWidth <= 0 {
		return []string{text}
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{""}
	}

	var lines []string
	var currentLine strings.Builder

	for i, word := range words {
		wordWidth := ansi.StringWidth(word)
		currentWidth := ansi.StringWidth(currentLine.String())

		if i == 0 {
			// First word always starts a line
			currentLine.WriteString(word)
		} else if currentWidth+1+wordWidth <= maxWidth {
			// Word fits on current line
			currentLine.WriteString(" ")
			currentLine.WriteString(word)
		} else {
			// Word doesn't fit, start new line
			lines = append(lines, currentLine.String())
			currentLine.Reset()
			currentLine.WriteString(word)
		}
	}

	// Add last line
	if currentLine.Len() > 0 {
		lines = append(lines, currentLine.String())
	}

	return lines
}
