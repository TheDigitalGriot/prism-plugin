package app

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// renderResearchView renders the Research file browser
func (m Model) renderResearchView() string {
	var sections []string

	// Header with breadcrumb
	title := styles.TitleStyle.Render("PRISM")
	breadcrumb := styles.DimStyle.Render(" > Research")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(m.Width).Render(header))

	if m.Research.Viewing {
		// Scrollable viewport of file content
		sections = append(sections, m.Research.Viewport.View())
		sections = append(sections, "")
		sections = append(sections, styles.DimStyle.Render("  esc back   j/k scroll"))
	} else {
		// File list
		sections = append(sections, "")
		if len(m.Research.Files) == 0 {
			sections = append(sections, styles.DimStyle.Render("  No research files found."))
			sections = append(sections, styles.DimStyle.Render("  Add .md files to .prism/shared/research/"))
		} else {
			for i, file := range m.Research.Files {
				selected := i == m.Research.SelectedIdx
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

// handleResearchKeyPress handles keys for the Research view
func (m Model) handleResearchKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	if m.Research.Viewing {
		// In file viewer mode - viewport scrolling
		switch key {
		case "esc", "backspace":
			m.Research.Viewing = false
			return m, nil
		}
		// Forward to viewport for scroll handling
		var cmd tea.Cmd
		m.Research.Viewport, cmd = m.Research.Viewport.Update(msg)
		return m, cmd
	}

	// In list mode
	switch key {
	case "j", "down":
		if len(m.Research.Files) > 0 && m.Research.SelectedIdx < len(m.Research.Files)-1 {
			m.Research.SelectedIdx++
		}
		return m, nil
	case "k", "up":
		if m.Research.SelectedIdx > 0 {
			m.Research.SelectedIdx--
		}
		return m, nil
	case "enter":
		if len(m.Research.Files) > 0 {
			file := m.Research.Files[m.Research.SelectedIdx]
			return m, LoadFileContentCmd(file.Path, ViewResearch)
		}
		return m, nil
	}

	return m, nil
}
