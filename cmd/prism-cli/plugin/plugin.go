package plugin

import tea "github.com/charmbracelet/bubbletea"

// Plugin defines the interface for all Prism CLI plugins.
// Each plugin is a self-contained view with its own state and rendering logic.
type Plugin interface {
	// ID returns a unique identifier for the plugin (e.g., "home", "spectrum")
	ID() string

	// Name returns the human-readable name displayed in tabs
	Name() string

	// Icon returns the emoji or symbol displayed in the tab bar
	Icon() string

	// Init initializes the plugin with the given context
	Init(ctx *Context) error

	// Start is called when the plugin is first activated or registered
	Start() tea.Cmd

	// Stop is called when the plugin is deactivated or the app is shutting down
	Stop()

	// Update handles incoming messages and returns updated plugin state
	Update(msg tea.Msg) (Plugin, tea.Cmd)

	// View renders the plugin's content for the given dimensions
	// This is called for the active plugin to render its content area
	View(width, height int) string

	// IsFocused returns whether this plugin is currently the active view
	IsFocused() bool

	// SetFocused sets the focus state for this plugin
	SetFocused(focused bool)

	// KeyHints returns the list of key hints to display in the footer
	// Returns hints appropriate for the plugin's current state
	KeyHints() []KeyHint
}

// KeyHint represents a keyboard shortcut hint for footer display
type KeyHint struct {
	Key         string // Key combination (e.g., "j/k", "enter", "ctrl+c")
	Description string // What the key does (e.g., "navigate", "select")
}
