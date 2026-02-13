package modal

import (
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// =============================================================================
// InputSection: Single-line text input
// =============================================================================

// InputSection wraps bubbles/textinput for modal forms
type InputSection struct {
	id              string
	label           string
	model           textinput.Model
	submitOnEnter   bool
	submitAction    string
	showBorder      bool
	borderColor     lipgloss.Color
	labelStyle      lipgloss.Style
}

// InputOption is a functional option for InputSection
type InputOption func(*InputSection)

// WithSubmitOnEnter enables Enter key to submit the input
func WithSubmitOnEnter(action string) InputOption {
	return func(i *InputSection) {
		i.submitOnEnter = true
		if action != "" {
			i.submitAction = action
		}
	}
}

// WithInputBorder adds a border around the input field
func WithInputBorder(color lipgloss.Color) InputOption {
	return func(i *InputSection) {
		i.showBorder = true
		i.borderColor = color
	}
}

// WithInputLabel sets a custom label style
func WithInputLabel(style lipgloss.Style) InputOption {
	return func(i *InputSection) {
		i.labelStyle = style
	}
}

// Input creates a new InputSection
func Input(id, label, placeholder string, opts ...InputOption) *InputSection {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.CharLimit = 256
	ti.Width = 50 // Default width, will be adjusted during render

	section := &InputSection{
		id:          id,
		label:       label,
		model:       ti,
		borderColor: lipgloss.Color("#6B7280"),
		labelStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("#9CA3AF")),
	}

	for _, opt := range opts {
		opt(section)
	}

	return section
}

func (i *InputSection) Render(contentWidth int, focusID string) RenderedSection {
	isFocused := i.id == focusID

	// Update input focus state
	if isFocused {
		i.model.Focus()
	} else {
		i.model.Blur()
	}

	// Adjust input width to fit content area (minus label and padding)
	inputWidth := contentWidth - 4
	if inputWidth < 20 {
		inputWidth = 20
	}
	i.model.Width = inputWidth

	// Render label (if present)
	var lines []string
	if i.label != "" {
		labelText := i.labelStyle.Render(i.label)
		lines = append(lines, labelText)
	}

	// Render input field
	inputView := i.model.View()

	// Add border if requested
	if i.showBorder {
		borderStyle := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(i.borderColor).
			Padding(0, 1)
		if isFocused {
			borderStyle = borderStyle.BorderForeground(lipgloss.Color("#3B82F6"))
		}
		inputView = borderStyle.Render(inputView)
	}

	lines = append(lines, inputView)

	content := strings.Join(lines, "\n")

	return RenderedSection{
		Content:    content,
		Focusables: []string{i.id},
	}
}

func (i *InputSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if i.id != focusID {
		return "", nil
	}

	// Check for submit on Enter
	if i.submitOnEnter && msg.String() == "enter" {
		action := i.submitAction
		if action == "" {
			action = i.id // Default to section ID
		}
		return action, nil
	}

	// Forward all other keys to the textinput model
	var cmd tea.Cmd
	i.model, cmd = i.model.Update(msg)

	return "", cmd
}

// Value returns the current input value
func (i *InputSection) Value() string {
	return i.model.Value()
}

// SetValue sets the input value
func (i *InputSection) SetValue(value string) {
	i.model.SetValue(value)
}

// =============================================================================
// TextareaSection: Multi-line text input
// =============================================================================

// TextareaSection wraps bubbles/textarea for modal forms
type TextareaSection struct {
	id          string
	label       string
	model       textarea.Model
	height      int
	showBorder  bool
	borderColor lipgloss.Color
	labelStyle  lipgloss.Style
}

// TextareaOption is a functional option for TextareaSection
type TextareaOption func(*TextareaSection)

// WithTextareaBorder adds a border around the textarea
func WithTextareaBorder(color lipgloss.Color) TextareaOption {
	return func(t *TextareaSection) {
		t.showBorder = true
		t.borderColor = color
	}
}

// WithTextareaLabel sets a custom label style
func WithTextareaLabel(style lipgloss.Style) TextareaOption {
	return func(t *TextareaSection) {
		t.labelStyle = style
	}
}

// Textarea creates a new TextareaSection
func Textarea(id, label, placeholder string, height int, opts ...TextareaOption) *TextareaSection {
	ta := textarea.New()
	ta.Placeholder = placeholder
	ta.CharLimit = 2000
	ta.SetHeight(height)
	ta.SetWidth(50) // Default, will be adjusted during render

	section := &TextareaSection{
		id:          id,
		label:       label,
		model:       ta,
		height:      height,
		borderColor: lipgloss.Color("#6B7280"),
		labelStyle:  lipgloss.NewStyle().Foreground(lipgloss.Color("#9CA3AF")),
	}

	for _, opt := range opts {
		opt(section)
	}

	return section
}

func (t *TextareaSection) Render(contentWidth int, focusID string) RenderedSection {
	isFocused := t.id == focusID

	// Update textarea focus state
	if isFocused {
		t.model.Focus()
	} else {
		t.model.Blur()
	}

	// Adjust textarea width
	textareaWidth := contentWidth - 4
	if textareaWidth < 20 {
		textareaWidth = 20
	}
	t.model.SetWidth(textareaWidth)

	// Render label (if present)
	var lines []string
	if t.label != "" {
		labelText := t.labelStyle.Render(t.label)
		lines = append(lines, labelText)
	}

	// Render textarea
	textareaView := t.model.View()

	// Add border if requested
	if t.showBorder {
		borderStyle := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(t.borderColor).
			Padding(0, 1)
		if isFocused {
			borderStyle = borderStyle.BorderForeground(lipgloss.Color("#3B82F6"))
		}
		textareaView = borderStyle.Render(textareaView)
	}

	lines = append(lines, textareaView)

	content := strings.Join(lines, "\n")

	return RenderedSection{
		Content:    content,
		Focusables: []string{t.id},
	}
}

func (t *TextareaSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if t.id != focusID {
		return "", nil
	}

	// Enter adds newline in textarea (no submit)
	// Forward all keys to the textarea model
	var cmd tea.Cmd
	t.model, cmd = t.model.Update(msg)

	return "", cmd
}

// Value returns the current textarea value
func (t *TextareaSection) Value() string {
	return t.model.Value()
}

// SetValue sets the textarea value
func (t *TextareaSection) SetValue(value string) {
	t.model.SetValue(value)
}
