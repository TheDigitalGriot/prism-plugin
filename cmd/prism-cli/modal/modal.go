package modal

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
)

// Modal constants
const (
	DefaultWidth   = 50
	MinModalWidth  = 30
	MaxModalWidth  = 120
)

// Variant controls modal styling (border color, button styles)
type Variant int

const (
	VariantDefault Variant = iota
	VariantDanger
	VariantWarning
	VariantInfo
)

// Modal represents a declarative modal dialog with automatic focus management
type Modal struct {
	title           string
	variant         Variant
	width           int
	sections        []Section
	showHints       bool
	primaryAction   string
	closeOnBackdrop bool
	customFooter    string

	// State (managed internally)
	focusIdx      int      // Current focused element index in focusIDs
	focusIDs      []string // Ordered list of focusable IDs (rebuilt during Render)
	scrollOffset  int      // Content scroll position in lines
	lastViewportH int      // Viewport height from last render (for scrollToFocused)
}

// New creates a new Modal with the given title and options
func New(title string, opts ...Option) *Modal {
	m := &Modal{
		title:           title,
		variant:         VariantDefault,
		width:           DefaultWidth,
		showHints:       true,
		closeOnBackdrop: true,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

// Option is a functional option for Modal
type Option func(*Modal)

// WithWidth sets the modal width
func WithWidth(width int) Option {
	return func(m *Modal) {
		m.width = width
	}
}

// WithVariant sets the modal variant (border color, styling)
func WithVariant(variant Variant) Option {
	return func(m *Modal) {
		m.variant = variant
	}
}

// WithHints controls whether to show keyboard hints at the bottom
func WithHints(show bool) Option {
	return func(m *Modal) {
		m.showHints = show
	}
}

// WithPrimaryAction sets the primary action ID (triggered by Enter in some contexts)
func WithPrimaryAction(action string) Option {
	return func(m *Modal) {
		m.primaryAction = action
	}
}

// WithCloseOnBackdrop controls whether clicking outside closes the modal
func WithCloseOnBackdrop(close bool) Option {
	return func(m *Modal) {
		m.closeOnBackdrop = close
	}
}

// WithFooter sets a custom footer (rendered outside scroll viewport)
func WithFooter(footer string) Option {
	return func(m *Modal) {
		m.customFooter = footer
	}
}

// AddSection adds a section to the modal. Returns the modal for chaining.
func (m *Modal) AddSection(s Section) *Modal {
	m.sections = append(m.sections, s)
	return m
}

// Render renders the modal and returns the styled content string
func (m *Modal) Render(screenW, screenH int) string {
	return m.buildLayout(screenW, screenH)
}

// HandleKey processes keyboard input.
// Returns:
//   - action: the action ID if triggered ("cancel" for Esc, button/input ID for Enter, etc.)
//   - cmd: any tea.Cmd from bubbles models (cursor blink, etc.)
func (m *Modal) HandleKey(msg tea.KeyMsg) (action string, cmd tea.Cmd) {
	key := msg.String()

	switch key {
	case "esc":
		return "cancel", nil

	case "tab":
		m.cycleFocus(1)
		return "", nil

	case "shift+tab":
		m.cycleFocus(-1)
		return "", nil

	case "up", "k":
		// Scroll up
		m.scrollOffset -= 3
		if m.scrollOffset < 0 {
			m.scrollOffset = 0
		}
		return "", nil

	case "down", "j":
		// Scroll down
		m.scrollOffset += 3
		return "", nil

	case "enter":
		// Enter on a focused element triggers that element's action
		focusID := m.currentFocusID()
		if focusID != "" {
			// Route to focused section first
			action, cmd = m.routeToFocusedSection(msg)
			if action != "" {
				return action, cmd
			}
			// If section didn't return an action, use the focus ID or primary action
			if m.primaryAction != "" {
				return m.primaryAction, cmd
			}
			return focusID, cmd
		}
		return "", nil

	default:
		// Route other keys to the focused section
		return m.routeToFocusedSection(msg)
	}
}

// HandleMouse processes mouse click events on modal zones.
// Returns the action ID if a zone was clicked, empty string otherwise.
func (m *Modal) HandleMouse(msg tea.MouseMsg) (action string, cmd tea.Cmd) {
	// Check list sections first (they have per-item zones)
	for _, section := range m.sections {
		if list, ok := section.(*ListSection); ok {
			if list.HandleMouse(msg) {
				m.SetFocus(list.id)
				return list.id, nil
			}
		}
	}

	// Check each focusable element's zone (buttons, checkboxes, etc.)
	for i, id := range m.focusIDs {
		zoneID := "modal-" + id
		if zone.Get(zoneID).InBounds(msg) {
			m.focusIdx = i
			return m.routeToFocusedSection(tea.KeyMsg{Type: tea.KeyEnter})
		}
	}
	return "", nil
}

// currentFocusID returns the ID of the currently focused element
func (m *Modal) currentFocusID() string {
	if len(m.focusIDs) == 0 {
		return ""
	}
	if m.focusIdx < 0 || m.focusIdx >= len(m.focusIDs) {
		return m.focusIDs[0]
	}
	return m.focusIDs[m.focusIdx]
}

// cycleFocus moves focus by delta (1 for next, -1 for previous)
func (m *Modal) cycleFocus(delta int) {
	if len(m.focusIDs) == 0 {
		return
	}
	m.focusIdx = (m.focusIdx + delta + len(m.focusIDs)) % len(m.focusIDs)
	// Note: scrollToFocused would require tracking focusable positions, which we skip for now
	// as it's a nice-to-have optimization. The modal will re-render and the user can scroll manually.
}

// routeToFocusedSection routes a key message to the focused section
func (m *Modal) routeToFocusedSection(msg tea.KeyMsg) (string, tea.Cmd) {
	focusID := m.currentFocusID()
	if focusID == "" {
		return "", nil
	}

	// Find which section contains this focus ID and route to it
	for _, section := range m.sections {
		action, cmd := section.Update(msg, focusID)
		if action != "" || cmd != nil {
			return action, cmd
		}
	}
	return "", nil
}

// ScrollBy adjusts the scroll offset by delta lines (positive = down, negative = up)
func (m *Modal) ScrollBy(delta int) {
	m.scrollOffset += delta
	// Clamping happens in buildLayout
}

// ScrollToTop scrolls to the top of the content
func (m *Modal) ScrollToTop() {
	m.scrollOffset = 0
}

// ScrollToBottom scrolls to the bottom of the content
func (m *Modal) ScrollToBottom() {
	m.scrollOffset = 999999 // Clamped in buildLayout
}

// SetFocus sets focus to a specific element by ID
func (m *Modal) SetFocus(id string) {
	for i, fid := range m.focusIDs {
		if fid == id {
			m.focusIdx = i
			return
		}
	}
}

// FocusedID returns the currently focused element ID
func (m *Modal) FocusedID() string {
	return m.currentFocusID()
}

// Reset resets the modal state (focus, scroll)
func (m *Modal) Reset() {
	m.focusIdx = 0
	m.scrollOffset = 0
}

// InputValue returns the current value of an InputSection identified by ID.
// Returns empty string if no input section with that ID exists.
func (m *Modal) InputValue(id string) string {
	for _, section := range m.sections {
		if input, ok := section.(*InputSection); ok && input.id == id {
			return input.Value()
		}
	}
	return ""
}

// InputValues returns all input values from InputSection and TextareaSection
// as a map of section ID → current value. Used to capture input state before
// the modal is cleared on action dispatch.
func (m *Modal) InputValues() map[string]string {
	values := make(map[string]string)
	for _, section := range m.sections {
		if input, ok := section.(*InputSection); ok {
			values[input.id] = input.Value()
		}
		if ta, ok := section.(*TextareaSection); ok {
			values[ta.id] = ta.Value()
		}
	}
	return values
}

// modalStyle returns the modal box style based on variant
func (m *Modal) modalStyle() lipgloss.Style {
	var borderColor lipgloss.Color

	switch m.variant {
	case VariantDanger:
		borderColor = lipgloss.Color("#EF4444") // Red
	case VariantWarning:
		borderColor = lipgloss.Color("#F59E0B") // Amber
	case VariantInfo:
		borderColor = lipgloss.Color("#3B82F6") // Blue
	default:
		borderColor = lipgloss.Color("#7C3AED") // Purple (primary)
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(1, 2).
		Background(lipgloss.Color("#1F2937")) // Dark background
}

// modalTitleStyle returns the title style based on variant
func (m *Modal) modalTitleStyle() lipgloss.Style {
	var color lipgloss.Color

	switch m.variant {
	case VariantDanger:
		color = lipgloss.Color("#EF4444")
	case VariantWarning:
		color = lipgloss.Color("#F59E0B")
	case VariantInfo:
		color = lipgloss.Color("#3B82F6")
	default:
		color = lipgloss.Color("#7C3AED")
	}

	return lipgloss.NewStyle().
		Bold(true).
		Foreground(color).
		Align(lipgloss.Center)
}
