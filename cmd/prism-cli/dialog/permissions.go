package dialog

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
	zone "github.com/lrstanley/bubblezone"
)

// PermissionDialog displays a tool execution request with preview content
// and three action buttons: Allow, Allow Session, Deny
type PermissionDialog struct {
	id           string
	toolName     string
	description  string
	preview      string // Command or file diff
	previewLabel string // "Command" or "Changes"
	focusedBtn   int    // 0=Allow, 1=Allow Session, 2=Deny
	scrollOffset int    // Scroll position for preview content
}

// NewPermission creates a new permission dialog
func NewPermission(id, toolName, description, preview string) *PermissionDialog {
	return &PermissionDialog{
		id:           id,
		toolName:     toolName,
		description:  description,
		preview:      preview,
		previewLabel: "Preview",
		focusedBtn:   0, // Default to "Allow"
	}
}

// WithPreviewLabel sets a custom label for the preview section
func (d *PermissionDialog) WithPreviewLabel(label string) *PermissionDialog {
	d.previewLabel = label
	return d
}

// ID returns the dialog ID
func (d *PermissionDialog) ID() string {
	return d.id
}

// Update processes keyboard input
func (d *PermissionDialog) Update(msg tea.Msg) (Action, tea.Cmd) {
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		case "esc":
			return ActionDeny, nil

		case "enter":
			switch d.focusedBtn {
			case 0:
				return ActionAllow, nil
			case 1:
				return ActionAllowSession, nil
			case 2:
				return ActionDeny, nil
			}
			return ActionNone, nil

		case "left", "h", "shift+tab":
			d.focusedBtn = (d.focusedBtn - 1 + 3) % 3
			return ActionNone, nil

		case "right", "l", "tab":
			d.focusedBtn = (d.focusedBtn + 1) % 3
			return ActionNone, nil

		case "up", "k":
			// Scroll preview up
			d.scrollOffset -= 3
			if d.scrollOffset < 0 {
				d.scrollOffset = 0
			}
			return ActionNone, nil

		case "down", "j":
			// Scroll preview down
			d.scrollOffset += 3
			return ActionNone, nil

		case "a":
			// Quick allow with 'a' key
			return ActionAllow, nil

		case "s":
			// Quick allow session with 's' key
			return ActionAllowSession, nil

		case "d", "n":
			// Quick deny with 'd' or 'n' key
			return ActionDeny, nil
		}
	}
	return ActionNone, nil
}

// View renders the permission dialog
func (d *PermissionDialog) View(width, height int) string {
	// Dialog dimensions
	dialogWidth := 70
	if dialogWidth > width-4 {
		dialogWidth = width - 4
	}
	contentWidth := dialogWidth - 6 // Account for border and padding

	// Build content
	var content strings.Builder

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#F59E0B")). // Warning amber
		Align(lipgloss.Center)
	content.WriteString(titleStyle.Width(contentWidth).Render("Permission Required"))
	content.WriteString("\n\n")

	// Tool name
	toolStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#3B82F6")) // Blue
	content.WriteString(toolStyle.Render("Tool: "))
	content.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#D1D5DB")).Render(d.toolName))
	content.WriteString("\n\n")

	// Description
	if d.description != "" {
		descStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#D1D5DB"))
		descLines := wordWrap(d.description, contentWidth)
		for _, line := range descLines {
			content.WriteString(descStyle.Render(line))
			content.WriteString("\n")
		}
		content.WriteString("\n")
	}

	// Preview section
	if d.preview != "" {
		labelStyle := lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#10B981")) // Green
		content.WriteString(labelStyle.Render(d.previewLabel + ":"))
		content.WriteString("\n")

		// Render preview content in a scrollable viewport
		previewContent := d.renderPreview(contentWidth, 8) // Max 8 lines for preview
		previewBoxStyle := lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("#374151")).
			Padding(0, 1).
			Width(contentWidth)
		content.WriteString(previewBoxStyle.Render(previewContent))
		content.WriteString("\n\n")
	}

	// Buttons
	allowBtn := zone.Mark("dialog-allow", d.renderButton("Allow", 0))
	allowSessionBtn := zone.Mark("dialog-allow-session", d.renderButton("Allow Session", 1))
	denyBtn := zone.Mark("dialog-deny", d.renderButton("Deny", 2))
	buttonsRow := lipgloss.JoinHorizontal(lipgloss.Left, allowBtn, "  ", allowSessionBtn, "  ", denyBtn)
	content.WriteString(buttonsRow)

	// Hints
	content.WriteString("\n\n")
	hintsStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280")).Italic(true)
	hints := "a allow  •  s allow session  •  d deny  •  ↑/↓ scroll  •  ←/→ switch  •  esc deny"
	content.WriteString(hintsStyle.Render(hints))

	// Wrap in border
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#F59E0B")). // Warning amber
		Padding(1, 2).
		Background(lipgloss.Color("#1F2937"))

	return boxStyle.Width(dialogWidth).Render(content.String())
}

// renderPreview renders the preview content with scrolling
func (d *PermissionDialog) renderPreview(width, maxLines int) string {
	lines := strings.Split(d.preview, "\n")

	// Apply scroll offset
	start := d.scrollOffset
	if start >= len(lines) {
		start = len(lines) - 1
	}
	if start < 0 {
		start = 0
	}

	end := start + maxLines
	if end > len(lines) {
		end = len(lines)
	}

	visibleLines := lines[start:end]

	// Truncate lines that are too long
	codeStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#A5B4FC")) // Light purple
	var rendered []string
	for _, line := range visibleLines {
		truncated := ansi.Truncate(line, width-2, "…")
		rendered = append(rendered, codeStyle.Render(truncated))
	}

	// Pad if we have fewer lines than maxLines
	for len(rendered) < maxLines {
		rendered = append(rendered, "")
	}

	// Add scroll indicator if needed
	if len(lines) > maxLines {
		scrollInfo := lipgloss.NewStyle().
			Foreground(lipgloss.Color("#6B7280")).
			Italic(true).
			Render("(scroll with ↑/↓)")
		rendered = append([]string{scrollInfo}, rendered[:maxLines-1]...)
	}

	return strings.Join(rendered, "\n")
}

// HandleMouse processes mouse click events on permission dialog button zones.
func (d *PermissionDialog) HandleMouse(msg tea.MouseMsg) Action {
	if zone.Get("dialog-allow").InBounds(msg) {
		return ActionAllow
	}
	if zone.Get("dialog-allow-session").InBounds(msg) {
		return ActionAllowSession
	}
	if zone.Get("dialog-deny").InBounds(msg) {
		return ActionDeny
	}
	return ActionNone
}

// renderButton renders a single button with optional focus
func (d *PermissionDialog) renderButton(label string, btnIdx int) string {
	focused := d.focusedBtn == btnIdx

	var style lipgloss.Style
	if focused {
		// Focused button style based on action type
		var bgColor lipgloss.Color
		switch btnIdx {
		case 0: // Allow
			bgColor = lipgloss.Color("#10B981") // Green
		case 1: // Allow Session
			bgColor = lipgloss.Color("#3B82F6") // Blue
		case 2: // Deny
			bgColor = lipgloss.Color("#EF4444") // Red
		default:
			bgColor = lipgloss.Color("#7C3AED") // Purple
		}
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(bgColor).
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
