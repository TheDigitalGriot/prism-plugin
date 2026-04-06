package plugin

// FocusPluginMsg requests that a specific plugin be focused/activated.
// Sent by plugins or the app shell to switch the active view.
type FocusPluginMsg struct {
	ID string // Plugin ID to focus
}

// PluginResizeMsg notifies plugins that the terminal has been resized.
// Plugins should update their internal dimensions accordingly.
type PluginResizeMsg struct {
	Width  int
	Height int
}
