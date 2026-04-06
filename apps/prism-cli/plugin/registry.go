package plugin

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
)

// Registry manages all registered plugins and handles plugin lifecycle.
type Registry struct {
	plugins      []Plugin
	pluginsByID  map[string]Plugin
	activeID     string
	context      *Context
}

// NewRegistry creates a new plugin registry with the given context.
func NewRegistry(ctx *Context) *Registry {
	// Initialize event bus if not already set
	if ctx.EventBus == nil {
		ctx.EventBus = NewEventBus()
	}

	return &Registry{
		plugins:     make([]Plugin, 0),
		pluginsByID: make(map[string]Plugin),
		context:     ctx,
	}
}

// Register adds a plugin to the registry and initializes it.
// Returns an error if a plugin with the same ID is already registered
// or if initialization fails.
func (r *Registry) Register(p Plugin) error {
	id := p.ID()
	if id == "" {
		return fmt.Errorf("plugin ID cannot be empty")
	}

	// Check for duplicate IDs
	if _, exists := r.pluginsByID[id]; exists {
		return fmt.Errorf("plugin with ID %q already registered", id)
	}

	// Safe initialization with panic recovery
	if err := r.safeInit(p); err != nil {
		return fmt.Errorf("failed to initialize plugin %q: %w", id, err)
	}

	// Add to registry
	r.plugins = append(r.plugins, p)
	r.pluginsByID[id] = p

	// Set as active if this is the first plugin
	if r.activeID == "" {
		r.activeID = id
		p.SetFocused(true)
	}

	return nil
}

// safeInit initializes a plugin with panic recovery.
// Returns an error if initialization panics or returns an error.
func (r *Registry) safeInit(p Plugin) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic during init: %v", r)
		}
	}()

	return p.Init(r.context)
}

// Plugins returns an ordered list of all registered plugins.
func (r *Registry) Plugins() []Plugin {
	return r.plugins
}

// PluginByID returns a plugin by its ID, or nil if not found.
func (r *Registry) PluginByID(id string) Plugin {
	return r.pluginsByID[id]
}

// ActivePlugin returns the currently active plugin.
// Returns nil if no plugins are registered.
func (r *Registry) ActivePlugin() Plugin {
	if r.activeID == "" {
		return nil
	}
	return r.pluginsByID[r.activeID]
}

// SetActive sets the active plugin by ID.
// Returns an error if the plugin ID is not found.
func (r *Registry) SetActive(id string) error {
	plugin, exists := r.pluginsByID[id]
	if !exists {
		return fmt.Errorf("plugin with ID %q not found", id)
	}

	// Unfocus previous active plugin
	if r.activeID != "" && r.activeID != id {
		if prev := r.pluginsByID[r.activeID]; prev != nil {
			prev.SetFocused(false)
		}
	}

	// Focus new active plugin
	r.activeID = id
	plugin.SetFocused(true)

	return nil
}

// Broadcast sends a message to all registered plugins and collects their commands.
// Returns a slice of commands to be batched by the caller.
func (r *Registry) Broadcast(msg tea.Msg) []tea.Cmd {
	var cmds []tea.Cmd

	for i, p := range r.plugins {
		// Update plugin and collect command
		updatedPlugin, cmd := p.Update(msg)
		r.plugins[i] = updatedPlugin
		r.pluginsByID[updatedPlugin.ID()] = updatedPlugin

		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	}

	return cmds
}

// Reinit stops all plugins and re-initializes them with the current context.
// This is used when switching projects or epics.
func (r *Registry) Reinit() error {
	// Increment epoch to invalidate stale async messages from the previous context
	r.context.Epoch++

	// Stop all plugins
	for _, p := range r.plugins {
		p.Stop()
	}

	// Re-initialize all plugins
	for i, p := range r.plugins {
		if err := r.safeInit(p); err != nil {
			return fmt.Errorf("failed to reinit plugin %q: %w", p.ID(), err)
		}
		r.plugins[i] = p
		r.pluginsByID[p.ID()] = p
	}

	return nil
}

// UpdateContext updates the context for all plugins.
// Call this when terminal dimensions or other context fields change.
func (r *Registry) UpdateContext(ctx *Context) {
	r.context = ctx
}

// GetContext returns a copy of the current context.
func (r *Registry) GetContext() *Context {
	if r.context == nil {
		return &Context{}
	}
	// Return a copy to prevent external modification
	ctx := *r.context
	return &ctx
}
