package app

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// HomePlugin implements the Home dashboard view.
type HomePlugin struct {
	ctx     *plugin.Context
	state   HomeState
	focused bool
}

// NewHomePlugin creates a new Home plugin instance.
func NewHomePlugin() *HomePlugin {
	return &HomePlugin{
		state: HomeState{
			MenuItems: []string{"Research", "Plans", "Spectrum"},
		},
	}
}

// ID returns the plugin identifier.
func (p *HomePlugin) ID() string {
	return "home"
}

// Name returns the display name.
func (p *HomePlugin) Name() string {
	return "Home"
}

// Icon returns the tab icon.
func (p *HomePlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context.
func (p *HomePlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	return nil
}

// Start is called when the plugin is first activated.
func (p *HomePlugin) Start() tea.Cmd {
	return nil
}

// Stop is called when deactivated.
func (p *HomePlugin) Stop() {
	// No cleanup needed
}

// Update handles messages.
func (p *HomePlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)
	}
	return p, nil
}

// View renders the home screen.
func (p *HomePlugin) View(width, height int) string {
	var sections []string

	// ASCII logo (prism is now in app shell header)
	logo := renderPrismLogoStatic()
	sections = append(sections, styles.PanelStyle.Width(width-2).Render(logo))
	sections = append(sections, "")

	// Menu items
	type menuItem struct {
		label string
		desc  string
		icon  string
	}
	items := []menuItem{
		{"Research", "Browse and create research documents", "📝"},
		{"Plans", "View and decompose implementation plans", "📋"},
		{"Spectrum", "Execute stories autonomously", "▶"},
	}

	menuWidth := width - 8
	if menuWidth < 40 {
		menuWidth = 40
	}

	for i, item := range items {
		selected := i == p.state.SelectedIndex
		line := fmt.Sprintf("  %s  %-12s %s", item.icon, item.label, item.desc)

		if selected {
			// Highlight selected item
			styledLine := styles.CurrentStyle.Bold(true).Render(fmt.Sprintf("  >  %s", line))
			sections = append(sections, styledLine)
		} else {
			styledLine := styles.DimStyle.Render(fmt.Sprintf("     %s", line))
			sections = append(sections, styledLine)
		}
		sections = append(sections, "") // spacing
	}

	// Navigation hints
	sections = append(sections, "")
	hints := styles.DimStyle.Render(strings.Repeat(" ", 6) + "j/k navigate   enter select   q quit")
	sections = append(sections, hints)

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active.
func (p *HomePlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state.
func (p *HomePlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints.
func (p *HomePlugin) KeyHints() []plugin.KeyHint {
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "select"},
	}
}

// handleKeyPress handles keyboard input.
func (p *HomePlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	switch key {
	case "j", "down":
		p.state.SelectedIndex = (p.state.SelectedIndex + 1) % len(p.state.MenuItems)
		return p, nil
	case "k", "up":
		p.state.SelectedIndex = (p.state.SelectedIndex - 1 + len(p.state.MenuItems)) % len(p.state.MenuItems)
		return p, nil
	case "enter", " ":
		cmd := p.navigateToMenuItem()
		return p, cmd
	}

	return p, nil
}

// navigateToMenuItem handles menu selection.
func (p *HomePlugin) navigateToMenuItem() tea.Cmd {
	switch p.state.SelectedIndex {
	case 0: // Research
		return func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "research"}
		}
	case 1: // Plans
		return func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "plans"}
		}
	case 2: // Spectrum
		return func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "spectrum"}
		}
	}
	return nil
}

// renderPrismLogoStatic renders the ASCII PRISM logo with gradient.
// This is a standalone version that doesn't depend on Model.
func renderPrismLogoStatic() string {
	spectrumColors := []string{"#3B82F6", "#14B8A6", "#22C55E", "#F59E0B"}
	logoLines := []string{
		"'||''|.  '||''|.   '||'  .|'''.|  '||    ||'",
		" ||   ||  ||   ||   ||   ||..  '   |||  |||",
		" ||...|'  ||''|'    ||    ''|||.   |'|..'||",
		" ||       ||   |.   ||  .     '||  | '|' ||",
		".||.     .||.  '|' .||. |'....|'  .|. | .||.",
	}
	var styledLines []string
	for _, line := range logoLines {
		styledLines = append(styledLines, styles.GradientString(line, spectrumColors))
	}
	return lipgloss.JoinVertical(lipgloss.Left, styledLines...)
}
