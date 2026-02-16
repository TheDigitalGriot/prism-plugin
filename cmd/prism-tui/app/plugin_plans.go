package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// PlansPlugin implements the Plans file browser view.
type PlansPlugin struct {
	ctx     *plugin.Context
	state   PlansState
	focused bool
}

// NewPlansPlugin creates a new Plans plugin instance.
func NewPlansPlugin() *PlansPlugin {
	return &PlansPlugin{
		state: PlansState{
			Files: []FileEntry{},
		},
	}
}

// ID returns the plugin identifier.
func (p *PlansPlugin) ID() string {
	return "plans"
}

// Name returns the display name.
func (p *PlansPlugin) Name() string {
	return "Plans"
}

// Icon returns the tab icon.
func (p *PlansPlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context.
func (p *PlansPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize viewport with default dimensions
	p.state.Viewport = viewport.New(ctx.Width-4, ctx.Height-6)
	return nil
}

// Start is called when the plugin is first activated.
func (p *PlansPlugin) Start() tea.Cmd {
	// Load plan files on activation (unless in demo mode)
	if p.ctx.DemoMode {
		return nil
	}
	return LoadPlansFilesCmd(p.ctx.PrismDir)
}

// Stop is called when deactivated.
func (p *PlansPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages.
func (p *PlansPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case plugin.PluginResizeMsg:
		// Update viewport dimensions
		viewportHeight := msg.Height - 6
		if viewportHeight < 10 {
			viewportHeight = 10
		}
		p.state.Viewport.Width = msg.Width - 4
		p.state.Viewport.Height = viewportHeight
		return p, nil

	case PlansFilesLoadedMsg:
		if msg.Error == nil {
			p.state.Files = msg.Files
			p.state.SelectedIdx = 0
		}
		return p, nil

	case FileContentLoadedMsg:
		if msg.Error == nil && msg.ForView == ViewPlans {
			p.state.Viewing = true
			p.state.Viewport.SetContent(msg.Content)
		}
		return p, nil

	case DecomposePlanMsg:
		if msg.Error != nil {
			// Error handled elsewhere (logs)
		} else {
			// Plan decomposed successfully - refresh list
			if !p.ctx.DemoMode {
				return p, LoadPlansFilesCmd(p.ctx.PrismDir)
			}
		}
		return p, nil
	}

	// If viewing file, forward viewport updates
	if p.state.Viewing {
		p.state.Viewport, cmd = p.state.Viewport.Update(msg)
	}

	return p, cmd
}

// View renders the plans browser.
func (p *PlansPlugin) View(width, height int) string {
	var sections []string

	// Powerline breadcrumb header
	sections = append(sections, renderBreadcrumb("Plans", width, p.ctx.HasNerdFont))

	if p.state.Viewing {
		// Scrollable viewport of file content
		sections = append(sections, p.state.Viewport.View())
		sections = append(sections, "")
		sections = append(sections, styles.DimStyle.Render("  esc back   j/k scroll"))
	} else {
		// File list
		sections = append(sections, "")
		if len(p.state.Files) == 0 {
			sections = append(sections, styles.DimStyle.Render("  No plan files found."))
			sections = append(sections, styles.DimStyle.Render("  Add .md files to .prism/shared/plans/"))
		} else {
			for i, file := range p.state.Files {
				selected := i == p.state.SelectedIdx
				dateStr := file.ModTime.Format("2006-01-02")
				line := fmt.Sprintf("  %s  %s", dateStr, file.Name)

				if selected {
					sections = append(sections, styles.CurrentStyle.Render("> "+line))
					// Show preview lines for selected item
					if file.Preview != "" {
						for _, pl := range strings.Split(file.Preview, "\n") {
							sections = append(sections, styles.DimStyle.Render("    "+pl))
						}
					}
				} else {
					sections = append(sections, styles.PendingStyle.Render("  "+line))
				}
			}
		}
		sections = append(sections, "")
		hints := "  j/k navigate   enter view   d decompose to epic   esc home"
		sections = append(sections, styles.DimStyle.Render(hints))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active.
func (p *PlansPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state.
func (p *PlansPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints.
func (p *PlansPlugin) KeyHints() []plugin.KeyHint {
	if p.state.Viewing {
		return []plugin.KeyHint{
			{Key: "esc", Description: "back to list"},
			{Key: "j/k", Description: "scroll"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view"},
		{Key: "d", Description: "decompose"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input.
func (p *PlansPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	if p.state.Viewing {
		// In file viewer mode - viewport scrolling
		switch key {
		case "esc", "backspace":
			p.state.Viewing = false
			return p, nil
		}
		// Forward to viewport for scroll handling
		var cmd tea.Cmd
		p.state.Viewport, cmd = p.state.Viewport.Update(msg)
		return p, cmd
	}

	// In list mode
	switch key {
	case "j", "down":
		if len(p.state.Files) > 0 && p.state.SelectedIdx < len(p.state.Files)-1 {
			p.state.SelectedIdx++
		}
		return p, nil
	case "k", "up":
		if p.state.SelectedIdx > 0 {
			p.state.SelectedIdx--
		}
		return p, nil
	case "enter":
		if len(p.state.Files) > 0 {
			file := p.state.Files[p.state.SelectedIdx]
			return p, LoadFileContentCmd(file.Path, ViewPlans)
		}
		return p, nil
	case "d":
		if len(p.state.Files) > 0 {
			file := p.state.Files[p.state.SelectedIdx]
			return p, DecomposePlanCmd(p.ctx.PrismDir, file.Path)
		}
		return p, nil
	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}
