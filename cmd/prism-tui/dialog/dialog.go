package dialog

import (
	tea "github.com/charmbracelet/bubbletea"
)

// Action represents the result of a dialog interaction
type Action int

const (
	ActionNone Action = iota
	ActionConfirm
	ActionCancel
	ActionAllow
	ActionAllowSession
	ActionDeny
)

func (a Action) String() string {
	switch a {
	case ActionConfirm:
		return "confirm"
	case ActionCancel:
		return "cancel"
	case ActionAllow:
		return "allow"
	case ActionAllowSession:
		return "allow_session"
	case ActionDeny:
		return "deny"
	default:
		return ""
	}
}

// Dialog represents a modal dialog that can be stacked on top of other UI elements.
// Dialogs are lighter-weight than modals and designed to stack.
type Dialog interface {
	// ID returns a unique identifier for this dialog instance
	ID() string

	// Update processes a message and returns an action (if the dialog should close)
	// and an optional tea.Cmd for async operations.
	// Returns ActionNone if the dialog should remain open.
	Update(msg tea.Msg) (Action, tea.Cmd)

	// HandleMouse processes mouse click events and returns an action if a zone was clicked.
	HandleMouse(msg tea.MouseMsg) Action

	// View renders the dialog content (without backdrop/dimming, which is handled by Overlay)
	View(width, height int) string
}

// Overlay manages a stack of dialogs, rendering them on top of each other.
// The top dialog captures all input. Dialogs are rendered bottom-to-top.
type Overlay struct {
	dialogs []Dialog
}

// NewOverlay creates a new empty dialog overlay
func NewOverlay() *Overlay {
	return &Overlay{
		dialogs: make([]Dialog, 0),
	}
}

// Open pushes a new dialog onto the stack
func (o *Overlay) Open(d Dialog) {
	o.dialogs = append(o.dialogs, d)
}

// CloseFront removes the top dialog from the stack
func (o *Overlay) CloseFront() {
	if len(o.dialogs) > 0 {
		o.dialogs = o.dialogs[:len(o.dialogs)-1]
	}
}

// HasDialogs returns true if there are any dialogs on the stack
func (o *Overlay) HasDialogs() bool {
	return len(o.dialogs) > 0
}

// Front returns the top dialog (the one that should receive input), or nil if empty
func (o *Overlay) Front() Dialog {
	if len(o.dialogs) == 0 {
		return nil
	}
	return o.dialogs[len(o.dialogs)-1]
}

// Update routes a message to the front dialog.
// Returns the action (if dialog should close) and optional command.
func (o *Overlay) Update(msg tea.Msg) (Action, tea.Cmd) {
	front := o.Front()
	if front == nil {
		return ActionNone, nil
	}
	return front.Update(msg)
}

// HandleMouse routes a mouse event to the front dialog.
func (o *Overlay) HandleMouse(msg tea.MouseMsg) Action {
	if !o.HasDialogs() {
		return ActionNone
	}
	return o.dialogs[len(o.dialogs)-1].HandleMouse(msg)
}

// View renders all dialogs in the stack (bottom to top).
// Each dialog is rendered independently; the caller is responsible for compositing them.
func (o *Overlay) View(width, height int) string {
	if len(o.dialogs) == 0 {
		return ""
	}
	// For now, only render the front dialog (stacking multiple dialogs is a nice-to-have)
	return o.Front().View(width, height)
}
