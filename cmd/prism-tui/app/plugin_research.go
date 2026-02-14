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

// ResearchPlugin implements the Research file browser view.
type ResearchPlugin struct {
	ctx     *plugin.Context
	state   ResearchState
	focused bool
}

// NewResearchPlugin creates a new Research plugin instance.
func NewResearchPlugin() *ResearchPlugin {
	return &ResearchPlugin{
		state: ResearchState{
			Files: []FileEntry{},
		},
	}
}

// ID returns the plugin identifier.
func (p *ResearchPlugin) ID() string {
	return "research"
}

// Name returns the display name.
func (p *ResearchPlugin) Name() string {
	return "Research"
}

// Icon returns the tab icon.
func (p *ResearchPlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context.
func (p *ResearchPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize viewport with default dimensions
	p.state.Viewport = viewport.New(ctx.Width-4, ctx.Height-6)
	return nil
}

// Start is called when the plugin is first activated.
func (p *ResearchPlugin) Start() tea.Cmd {
	// Load research files on activation (unless in demo mode)
	if p.ctx.DemoMode {
		return nil
	}
	return LoadResearchFilesCmd(p.ctx.PrismDir)
}

// Stop is called when deactivated.
func (p *ResearchPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages.
func (p *ResearchPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
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

	case ResearchFilesLoadedMsg:
		if msg.Error == nil {
			p.state.Files = msg.Files
			p.state.SelectedIdx = 0
		}
		return p, nil

	case FileContentLoadedMsg:
		if msg.Error == nil && msg.ForView == ViewResearch {
			p.state.Viewing = true
			p.state.Viewport.SetContent(msg.Content)
		}
		return p, nil
	}

	// If viewing file, forward viewport updates
	if p.state.Viewing {
		p.state.Viewport, cmd = p.state.Viewport.Update(msg)
	}

	return p, cmd
}

// View renders the research browser.
func (p *ResearchPlugin) View(width, height int) string {
	var sections []string

	// Header with breadcrumb
	title := styles.TitleStyle.Render("PRISM")
	breadcrumb := styles.DimStyle.Render(" > Research")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(width).Render(header))

	if p.state.Viewing {
		// Scrollable viewport of file content
		sections = append(sections, p.state.Viewport.View())
		sections = append(sections, "")
		sections = append(sections, styles.DimStyle.Render("  esc back   j/k scroll"))
	} else {
		// File list
		sections = append(sections, "")
		if len(p.state.Files) == 0 {
			sections = append(sections, styles.DimStyle.Render("  No research files found."))
			sections = append(sections, styles.DimStyle.Render("  Add .md files to .prism/shared/research/"))
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
		sections = append(sections, styles.DimStyle.Render("  j/k navigate   enter view   esc home"))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active.
func (p *ResearchPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state.
func (p *ResearchPlugin) SetFocused(focused bool) {
	p.focused = focused
	// Load files when focused (unless already loaded or in demo mode)
	if focused && !p.ctx.DemoMode && len(p.state.Files) == 0 {
		// Files will be loaded via Start() command
	}
}

// KeyHints returns footer key hints.
func (p *ResearchPlugin) KeyHints() []plugin.KeyHint {
	if p.state.Viewing {
		return []plugin.KeyHint{
			{Key: "esc", Description: "back to list"},
			{Key: "j/k", Description: "scroll"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input.
func (p *ResearchPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
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
			return p, LoadFileContentCmd(file.Path, ViewResearch)
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
