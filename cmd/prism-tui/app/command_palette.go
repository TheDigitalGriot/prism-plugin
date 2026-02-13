package app

import (
	"strings"

	"github.com/prism-plugin/prism-tui/modal"
	"github.com/prism-plugin/prism-tui/plugin"
)

// Command represents an executable command in the palette
type Command struct {
	ID          string // Unique identifier
	Name        string // Display name
	Description string // Short description
	Category    string // Plugin name or category
	PluginID    string // ID of the plugin this command belongs to
}

// CommandPalette manages the command palette modal
type CommandPalette struct {
	commands       []Command
	filteredCmds   []Command
	filterText     string
	selectedIndex  int
}

// NewCommandPalette creates a new command palette with commands from all plugins
func NewCommandPalette(registry *plugin.Registry) *CommandPalette {
	cp := &CommandPalette{
		commands: make([]Command, 0),
	}

	// Gather commands from all registered plugins
	for _, p := range registry.Plugins() {
		pluginCmds := cp.getPluginCommands(p)
		cp.commands = append(cp.commands, pluginCmds...)
	}

	// Initial filter (show all)
	cp.filteredCmds = cp.commands

	return cp
}

// getPluginCommands returns all available commands for a specific plugin
func (cp *CommandPalette) getPluginCommands(p plugin.Plugin) []Command {
	var cmds []Command
	pluginID := p.ID()
	pluginName := p.Name()

	// Define commands per plugin type
	switch pluginID {
	case "home":
		cmds = []Command{
			{ID: "home.focus", Name: "Go to Home", Description: "Switch to the Home dashboard", Category: pluginName, PluginID: pluginID},
		}
	case "research":
		cmds = []Command{
			{ID: "research.focus", Name: "Go to Research", Description: "Browse research documents", Category: pluginName, PluginID: pluginID},
			{ID: "research.refresh", Name: "Refresh Research Files", Description: "Reload research files from disk", Category: pluginName, PluginID: pluginID},
		}
	case "plans":
		cmds = []Command{
			{ID: "plans.focus", Name: "Go to Plans", Description: "Browse implementation plans", Category: pluginName, PluginID: pluginID},
			{ID: "plans.refresh", Name: "Refresh Plans", Description: "Reload plan files from disk", Category: pluginName, PluginID: pluginID},
			{ID: "plans.decompose", Name: "Decompose Plan", Description: "Generate stories.json from selected plan", Category: pluginName, PluginID: pluginID},
		}
	case "spectrum":
		cmds = []Command{
			{ID: "spectrum.focus", Name: "Go to Spectrum", Description: "View autonomous execution dashboard", Category: pluginName, PluginID: pluginID},
			{ID: "spectrum.start", Name: "Start Execution", Description: "Begin Spectrum autonomous execution", Category: pluginName, PluginID: pluginID},
			{ID: "spectrum.stop", Name: "Stop Execution", Description: "Halt Spectrum execution", Category: pluginName, PluginID: pluginID},
			{ID: "spectrum.next_story", Name: "Next Story", Description: "Skip to next pending story", Category: pluginName, PluginID: pluginID},
			{ID: "spectrum.prev_story", Name: "Previous Story", Description: "Navigate to previous story", Category: pluginName, PluginID: pluginID},
			{ID: "spectrum.switch_epic", Name: "Switch Epic", Description: "Change active epic", Category: pluginName, PluginID: pluginID},
		}
	case "files":
		cmds = []Command{
			{ID: "files.focus", Name: "Go to Files", Description: "Browse project files", Category: pluginName, PluginID: pluginID},
			{ID: "files.refresh", Name: "Refresh File Tree", Description: "Reload file browser", Category: pluginName, PluginID: pluginID},
			{ID: "files.filter", Name: "Filter Files", Description: "Search files by name", Category: pluginName, PluginID: pluginID},
		}
	case "git":
		cmds = []Command{
			{ID: "git.focus", Name: "Go to Git", Description: "View git status", Category: pluginName, PluginID: pluginID},
			{ID: "git.refresh", Name: "Refresh Git Status", Description: "Reload git status", Category: pluginName, PluginID: pluginID},
			{ID: "git.stage", Name: "Stage File", Description: "Stage selected file", Category: pluginName, PluginID: pluginID},
			{ID: "git.unstage", Name: "Unstage File", Description: "Unstage selected file", Category: pluginName, PluginID: pluginID},
			{ID: "git.commit", Name: "Commit Changes", Description: "Create a git commit", Category: pluginName, PluginID: pluginID},
		}
	case "agent":
		cmds = []Command{
			{ID: "agent.focus", Name: "Go to Agent", Description: "Open chat interface", Category: pluginName, PluginID: pluginID},
			{ID: "agent.new_chat", Name: "New Chat", Description: "Start a new conversation", Category: pluginName, PluginID: pluginID},
			{ID: "agent.toggle_sidebar", Name: "Toggle Sidebar", Description: "Show/hide chat sidebar", Category: pluginName, PluginID: pluginID},
		}
	case "monitor":
		cmds = []Command{
			{ID: "monitor.focus", Name: "Go to Monitor", Description: "View system health and execution history", Category: pluginName, PluginID: pluginID},
			{ID: "monitor.refresh", Name: "Refresh Monitor", Description: "Update health metrics", Category: pluginName, PluginID: pluginID},
		}
	case "workspaces":
		cmds = []Command{
			{ID: "workspaces.focus", Name: "Go to Workspaces", Description: "Switch projects and epics", Category: pluginName, PluginID: pluginID},
			{ID: "workspaces.refresh", Name: "Refresh Workspaces", Description: "Scan for projects", Category: pluginName, PluginID: pluginID},
		}
	case "onboarding":
		cmds = []Command{
			{ID: "onboarding.focus", Name: "Go to Onboarding", Description: "Run setup wizard", Category: pluginName, PluginID: pluginID},
		}
	}

	// Add global navigation command for all plugins
	if pluginID != "home" {
		cmds = append(cmds, Command{
			ID:          pluginID + ".focus",
			Name:        "Go to " + pluginName,
			Description: "Switch to " + pluginName + " view",
			Category:    "Navigation",
			PluginID:    pluginID,
		})
	}

	return cmds
}

// Filter updates the filtered command list based on search text
func (cp *CommandPalette) Filter(text string) {
	cp.filterText = strings.ToLower(text)
	cp.selectedIndex = 0

	if cp.filterText == "" {
		cp.filteredCmds = cp.commands
		return
	}

	// Simple fuzzy filter: match if all characters appear in order
	cp.filteredCmds = make([]Command, 0)
	for _, cmd := range cp.commands {
		if cp.fuzzyMatch(cmd) {
			cp.filteredCmds = append(cp.filteredCmds, cmd)
		}
	}
}

// fuzzyMatch checks if filterText matches the command (name or description)
func (cp *CommandPalette) fuzzyMatch(cmd Command) bool {
	searchStr := strings.ToLower(cmd.Name + " " + cmd.Description + " " + cmd.Category)
	filterChars := []rune(cp.filterText)
	searchChars := []rune(searchStr)

	filterIdx := 0
	for _, sc := range searchChars {
		if filterIdx >= len(filterChars) {
			return true
		}
		if sc == filterChars[filterIdx] {
			filterIdx++
		}
	}

	return filterIdx >= len(filterChars)
}

// SelectNext moves selection down
func (cp *CommandPalette) SelectNext() {
	if len(cp.filteredCmds) == 0 {
		return
	}
	cp.selectedIndex = (cp.selectedIndex + 1) % len(cp.filteredCmds)
}

// SelectPrev moves selection up
func (cp *CommandPalette) SelectPrev() {
	if len(cp.filteredCmds) == 0 {
		return
	}
	cp.selectedIndex = (cp.selectedIndex - 1 + len(cp.filteredCmds)) % len(cp.filteredCmds)
}

// SelectedCommand returns the currently selected command, or nil if none
func (cp *CommandPalette) SelectedCommand() *Command {
	if len(cp.filteredCmds) == 0 {
		return nil
	}
	if cp.selectedIndex < 0 || cp.selectedIndex >= len(cp.filteredCmds) {
		return nil
	}
	return &cp.filteredCmds[cp.selectedIndex]
}

// BuildModal constructs a modal.Modal for the command palette
func (cp *CommandPalette) BuildModal() *modal.Modal {
	m := modal.New("Command Palette", modal.WithWidth(70), modal.WithHints(true))

	// Add input section for filtering
	m.AddSection(modal.Input("filter", "Search commands...", cp.filterText))

	// Add spacer
	m.AddSection(modal.Spacer())

	// Build command list (simple strings)
	listItems := make([]string, len(cp.filteredCmds))
	for i, cmd := range cp.filteredCmds {
		// Format: "[Category] Name - Description"
		label := cmd.Name
		if cmd.Category != "" {
			label = "[" + cmd.Category + "] " + label
		}
		if cmd.Description != "" {
			label = label + " - " + cmd.Description
		}
		listItems[i] = label
	}

	// Add list section
	if len(listItems) == 0 {
		m.AddSection(modal.Text("No commands found"))
	} else {
		m.AddSection(modal.List("commands", listItems, &cp.selectedIndex))
	}

	// Add footer hint
	m.AddSection(modal.Spacer())
	m.AddSection(modal.Text("↑/↓ navigate • enter execute • esc close"))

	return m
}

// createCommandPaletteModal creates a modal for the command palette
func createCommandPaletteModal(registry *plugin.Registry) *modal.Modal {
	cp := NewCommandPalette(registry)
	return cp.BuildModal()
}
