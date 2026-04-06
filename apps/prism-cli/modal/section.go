package modal

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
)

// Section represents a section within a modal (text, buttons, inputs, etc.)
type Section interface {
	// Render renders the section and returns the content plus focusable IDs
	Render(contentWidth int, focusID string) RenderedSection
	// Update handles key input for the section when focused
	Update(msg tea.KeyMsg, focusID string) (action string, cmd tea.Cmd)
}

// RenderedSection contains the rendered content and metadata about focusable elements
type RenderedSection struct {
	Content    string   // Rendered content (may be multi-line)
	Focusables []string // IDs of focusable elements in this section
}

// measureHeight counts the number of lines in content (0 for empty string)
func measureHeight(content string) int {
	if content == "" {
		return 0
	}
	trimmed := strings.TrimRight(content, "\n")
	if trimmed == "" {
		return 0
	}
	return lipgloss.Height(trimmed)
}

// =============================================================================
// TextSection: Non-focusable static text
// =============================================================================

// TextSection displays static text content
type TextSection struct {
	text string
}

// Text creates a new TextSection
func Text(text string) *TextSection {
	return &TextSection{text: text}
}

func (t *TextSection) Render(contentWidth int, focusID string) RenderedSection {
	// Wrap text to contentWidth
	style := lipgloss.NewStyle().Width(contentWidth)
	content := style.Render(t.text)
	return RenderedSection{
		Content:    content,
		Focusables: nil, // Not focusable
	}
}

func (t *TextSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	return "", nil // No interaction
}

// =============================================================================
// SpacerSection: Non-focusable blank line
// =============================================================================

// SpacerSection renders a blank line for spacing
type SpacerSection struct{}

// Spacer creates a new SpacerSection
func Spacer() *SpacerSection {
	return &SpacerSection{}
}

func (s *SpacerSection) Render(contentWidth int, focusID string) RenderedSection {
	return RenderedSection{
		Content:    "",
		Focusables: nil,
	}
}

func (s *SpacerSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	return "", nil
}

// =============================================================================
// ButtonsSection: Focusable button row
// =============================================================================

// ButtonDef defines a button with label and action ID
type ButtonDef struct {
	Label   string
	ID      string
	Variant ButtonVariant
}

// ButtonVariant controls button styling
type ButtonVariant int

const (
	ButtonNormal ButtonVariant = iota
	ButtonPrimary
	ButtonDanger
)

// Btn creates a button definition
func Btn(label, id string, opts ...BtnOption) ButtonDef {
	btn := ButtonDef{
		Label:   label,
		ID:      id,
		Variant: ButtonNormal,
	}
	for _, opt := range opts {
		opt(&btn)
	}
	return btn
}

// BtnOption is a functional option for buttons
type BtnOption func(*ButtonDef)

// BtnPrimary marks a button as primary (highlighted by default)
func BtnPrimary() BtnOption {
	return func(b *ButtonDef) {
		b.Variant = ButtonPrimary
	}
}

// BtnDanger marks a button as danger (red styling)
func BtnDanger() BtnOption {
	return func(b *ButtonDef) {
		b.Variant = ButtonDanger
	}
}

// ButtonsSection renders a row of buttons
type ButtonsSection struct {
	buttons []ButtonDef
}

// Buttons creates a new ButtonsSection
func Buttons(buttons ...ButtonDef) *ButtonsSection {
	return &ButtonsSection{buttons: buttons}
}

func (b *ButtonsSection) Render(contentWidth int, focusID string) RenderedSection {
	if len(b.buttons) == 0 {
		return RenderedSection{Content: "", Focusables: nil}
	}

	// Build focusable IDs list
	focusables := make([]string, len(b.buttons))
	for i, btn := range b.buttons {
		focusables[i] = btn.ID
	}

	// Render buttons with focus/variant styling
	var parts []string
	for _, btn := range b.buttons {
		isFocused := btn.ID == focusID
		styled := renderButton(btn.Label, btn.Variant, isFocused)
		parts = append(parts, zone.Mark("modal-"+btn.ID, styled))
	}

	// Join with spacing
	content := strings.Join(parts, "  ")

	// Center the button row
	if lipgloss.Width(content) < contentWidth {
		centered := lipgloss.NewStyle().Width(contentWidth).Align(lipgloss.Center).Render(content)
		content = centered
	}

	return RenderedSection{
		Content:    content,
		Focusables: focusables,
	}
}

func (b *ButtonsSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	// Enter activates the focused button
	if msg.String() == "enter" {
		// Find the focused button
		for _, btn := range b.buttons {
			if btn.ID == focusID {
				return btn.ID, nil
			}
		}
	}
	return "", nil
}

// renderButton renders a single button with appropriate styling
func renderButton(label string, variant ButtonVariant, focused bool) string {
	var style lipgloss.Style

	switch {
	case focused && variant == ButtonDanger:
		style = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#EF4444")).
			Padding(0, 2)
	case focused && variant == ButtonPrimary:
		style = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#7C3AED")).
			Padding(0, 2)
	case focused:
		style = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#3B82F6")).
			Padding(0, 2)
	case variant == ButtonDanger:
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#EF4444")).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#EF4444")).
			Padding(0, 1)
	case variant == ButtonPrimary:
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#7C3AED")).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#7C3AED")).
			Padding(0, 1)
	default:
		style = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#6B7280")).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#6B7280")).
			Padding(0, 1)
	}

	return style.Render(label)
}

// =============================================================================
// CheckboxSection: Focusable checkbox
// =============================================================================

// CheckboxSection renders a checkbox with label
type CheckboxSection struct {
	id      string
	label   string
	checked *bool // Pointer to allow external state binding
}

// Checkbox creates a new CheckboxSection
func Checkbox(id, label string, checked *bool) *CheckboxSection {
	return &CheckboxSection{
		id:      id,
		label:   label,
		checked: checked,
	}
}

func (c *CheckboxSection) Render(contentWidth int, focusID string) RenderedSection {
	isFocused := c.id == focusID

	// Checkbox icon
	var icon string
	if *c.checked {
		icon = "[✓]"
	} else {
		icon = "[ ]"
	}

	// Style based on focus
	var style lipgloss.Style
	if isFocused {
		style = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#3B82F6"))
	} else {
		style = lipgloss.NewStyle().Foreground(lipgloss.Color("#6B7280"))
	}

	content := style.Render(icon + " " + c.label)

	return RenderedSection{
		Content:    content,
		Focusables: []string{c.id},
	}
}

func (c *CheckboxSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if c.id != focusID {
		return "", nil
	}

	// Space or Enter toggles the checkbox
	key := msg.String()
	if key == " " || key == "enter" {
		*c.checked = !*c.checked
		return "", nil // No action, just state change
	}

	return "", nil
}

// =============================================================================
// CustomSection: Plugin-specific rich modal content (SI-3)
// =============================================================================

// CustomSection allows plugins to render arbitrary content within a modal.
// This enables rich, dynamic modal content beyond static text/buttons/lists —
// for example, gate output viewers, search result panels, or progress displays.
type CustomSection struct {
	id        string
	renderFn  func(width int, focusID string) RenderedSection
	updateFn  func(msg tea.KeyMsg, focusID string) (string, tea.Cmd)
	focusable bool
}

// CustomOption is a functional option for CustomSection
type CustomOption func(*CustomSection)

// CustomFocusable marks the custom section as focusable
func CustomFocusable() CustomOption {
	return func(c *CustomSection) {
		c.focusable = true
	}
}

// Custom creates a new CustomSection with render and update callbacks.
// The render function receives the content width and current focus ID, and must
// return a RenderedSection with content and optional focusable IDs.
// The update function handles key input when the section (or one of its focusables) is focused.
func Custom(id string, render func(int, string) RenderedSection, update func(tea.KeyMsg, string) (string, tea.Cmd), opts ...CustomOption) *CustomSection {
	s := &CustomSection{
		id:       id,
		renderFn: render,
		updateFn: update,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (c *CustomSection) Render(contentWidth int, focusID string) RenderedSection {
	if c.renderFn == nil {
		return RenderedSection{}
	}
	rs := c.renderFn(contentWidth, focusID)
	// If the section is focusable but the render function didn't add focusables,
	// add the section's own ID as a focusable
	if c.focusable && len(rs.Focusables) == 0 {
		rs.Focusables = []string{c.id}
	}
	return rs
}

func (c *CustomSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if c.updateFn == nil {
		return "", nil
	}
	return c.updateFn(msg, focusID)
}

// =============================================================================
// WhenSection: Conditional section wrapper
// =============================================================================

// WhenSection conditionally renders a section based on a predicate
type WhenSection struct {
	condition func() bool
	section   Section
}

// When creates a conditional section
func When(condition func() bool, section Section) *WhenSection {
	return &WhenSection{
		condition: condition,
		section:   section,
	}
}

func (w *WhenSection) Render(contentWidth int, focusID string) RenderedSection {
	if !w.condition() {
		return RenderedSection{Content: "", Focusables: nil}
	}
	return w.section.Render(contentWidth, focusID)
}

func (w *WhenSection) Update(msg tea.KeyMsg, focusID string) (string, tea.Cmd) {
	if !w.condition() {
		return "", nil
	}
	return w.section.Update(msg, focusID)
}
