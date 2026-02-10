package app

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// renderPlansView renders the Plans file browser
func (m Model) renderPlansView() string {
	var sections []string

	// Header with breadcrumb
	title := styles.TitleStyle.Render("PRISM")
	breadcrumb := styles.DimStyle.Render(" > Plans")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(m.Width).Render(header))

	if m.Plans.Viewing {
		// Scrollable viewport of file content
		sections = append(sections, m.Plans.Viewport.View())
		sections = append(sections, "")
		sections = append(sections, styles.DimStyle.Render("  esc back   j/k scroll"))
	} else {
		// File list
		sections = append(sections, "")
		if len(m.Plans.Files) == 0 {
			sections = append(sections, styles.DimStyle.Render("  No plan files found."))
			sections = append(sections, styles.DimStyle.Render("  Add .md files to .prism/shared/plans/"))
		} else {
			for i, file := range m.Plans.Files {
				selected := i == m.Plans.SelectedIdx
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

// handlePlansKeyPress handles keys for the Plans view
func (m Model) handlePlansKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	if m.Plans.Viewing {
		// In file viewer mode - viewport scrolling
		switch key {
		case "esc", "backspace":
			m.Plans.Viewing = false
			return m, nil
		}
		// Forward to viewport for scroll handling
		var cmd tea.Cmd
		m.Plans.Viewport, cmd = m.Plans.Viewport.Update(msg)
		return m, cmd
	}

	// In list mode
	switch key {
	case "j", "down":
		if len(m.Plans.Files) > 0 && m.Plans.SelectedIdx < len(m.Plans.Files)-1 {
			m.Plans.SelectedIdx++
		}
		return m, nil
	case "k", "up":
		if m.Plans.SelectedIdx > 0 {
			m.Plans.SelectedIdx--
		}
		return m, nil
	case "enter":
		if len(m.Plans.Files) > 0 {
			file := m.Plans.Files[m.Plans.SelectedIdx]
			return m, LoadFileContentCmd(file.Path, ViewPlans)
		}
		return m, nil
	case "d":
		if len(m.Plans.Files) > 0 {
			file := m.Plans.Files[m.Plans.SelectedIdx]
			return m, DecomposePlanCmd(m.PrismDir, file.Path)
		}
		return m, nil
	}

	return m, nil
}
