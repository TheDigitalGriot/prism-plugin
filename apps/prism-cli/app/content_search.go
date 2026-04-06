package app

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/prism-cli/modal"
)

// SearchResult represents a single ripgrep match
type SearchResult struct {
	File    string // Relative path (forward slashes)
	Line    int    // 1-based line number
	Text    string // Matched line text (trimmed)
	Context string // Display string "file:line: text"
}

// ContentSearch provides a project-wide content search overlay using ripgrep (F-5).
type ContentSearch struct {
	results       []SearchResult
	query         string
	selectedIndex int
	projectDir    string
	searching     bool
	noRipgrep     bool // True if rg binary not found
	lastError     string
}

// NewContentSearch creates a content search overlay
func NewContentSearch(projectDir string) *ContentSearch {
	cs := &ContentSearch{
		projectDir: projectDir,
	}
	// Check if ripgrep is available
	if _, err := exec.LookPath("rg"); err != nil {
		cs.noRipgrep = true
	}
	return cs
}

// SelectNext moves selection down
func (cs *ContentSearch) SelectNext() {
	if len(cs.results) == 0 {
		return
	}
	cs.selectedIndex = (cs.selectedIndex + 1) % len(cs.results)
}

// SelectPrev moves selection up
func (cs *ContentSearch) SelectPrev() {
	if len(cs.results) == 0 {
		return
	}
	cs.selectedIndex = (cs.selectedIndex - 1 + len(cs.results)) % len(cs.results)
}

// SelectedResult returns the currently selected search result, or nil
func (cs *ContentSearch) SelectedResult() *SearchResult {
	if len(cs.results) == 0 || cs.selectedIndex < 0 || cs.selectedIndex >= len(cs.results) {
		return nil
	}
	return &cs.results[cs.selectedIndex]
}

// HandleResults processes search results from the async command
func (cs *ContentSearch) HandleResults(msg SearchResultsMsg) {
	cs.searching = false
	if msg.Error != nil {
		cs.lastError = msg.Error.Error()
		cs.results = nil
		return
	}
	cs.lastError = ""
	cs.results = msg.Results
	cs.selectedIndex = 0
}

// RunSearchCmd runs ripgrep asynchronously and returns results
func (cs *ContentSearch) RunSearchCmd() tea.Cmd {
	query := cs.query
	projectDir := cs.projectDir
	cs.searching = true

	return func() tea.Msg {
		if query == "" {
			return SearchResultsMsg{}
		}

		// Run rg --json for structured output
		cmd := exec.Command("rg", "--json", "--max-count", "30", "--no-heading", query, projectDir)
		out, err := cmd.Output()
		if err != nil {
			// rg returns exit code 1 for no matches — not an error
			if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
				return SearchResultsMsg{Results: nil}
			}
			return SearchResultsMsg{Error: err}
		}

		// Parse JSON lines output
		var results []SearchResult
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			var entry rgJSONEntry
			if err := json.Unmarshal([]byte(line), &entry); err != nil {
				continue
			}

			if entry.Type != "match" {
				continue
			}

			relPath := entry.Data.Path.Text
			// Make path relative to project dir if absolute
			if strings.HasPrefix(relPath, projectDir) {
				relPath = strings.TrimPrefix(relPath, projectDir)
				relPath = strings.TrimPrefix(relPath, "/")
				relPath = strings.TrimPrefix(relPath, "\\")
			}

			lineText := strings.TrimSpace(entry.Data.Lines.Text)
			// Truncate long lines
			if len(lineText) > 120 {
				lineText = lineText[:117] + "..."
			}

			results = append(results, SearchResult{
				File:    relPath,
				Line:    entry.Data.LineNumber,
				Text:    lineText,
				Context: fmt.Sprintf("%s:%d: %s", relPath, entry.Data.LineNumber, lineText),
			})

			// Cap at 30 results
			if len(results) >= 30 {
				break
			}
		}

		return SearchResultsMsg{Results: results}
	}
}

// BuildModal constructs a modal for the content search overlay
func (cs *ContentSearch) BuildModal() *modal.Modal {
	m := modal.New("Content Search", modal.WithWidth(80), modal.WithHints(true))

	if cs.noRipgrep {
		m.AddSection(modal.Text("ripgrep (rg) not found. Install it for content search:\n  https://github.com/BurntSushi/ripgrep"))
		m.AddSection(modal.Spacer())
		m.AddSection(modal.Buttons(modal.Btn("Close", "cancel")))
		return m
	}

	// Search input
	m.AddSection(modal.Input("search-filter", "Search content...", cs.query))
	m.AddSection(modal.Spacer())

	// Status
	if cs.searching {
		m.AddSection(modal.Text("Searching..."))
	} else if cs.lastError != "" {
		m.AddSection(modal.Text("Error: " + cs.lastError))
	} else if cs.query != "" && len(cs.results) == 0 {
		m.AddSection(modal.Text("No matches found"))
	}

	// Result list
	if len(cs.results) > 0 {
		listItems := make([]string, len(cs.results))
		for i, r := range cs.results {
			listItems[i] = r.Context
		}
		m.AddSection(modal.List("search-results", listItems, &cs.selectedIndex))
	}

	m.AddSection(modal.Spacer())
	m.AddSection(modal.Text("↑/↓ navigate • enter open • esc close"))

	return m
}

// --- Ripgrep JSON types ---

type rgJSONEntry struct {
	Type string      `json:"type"` // "match", "begin", "end", "summary"
	Data rgMatchData `json:"data"`
}

type rgMatchData struct {
	Path       rgText `json:"path"`
	Lines      rgText `json:"lines"`
	LineNumber int    `json:"line_number"`
}

type rgText struct {
	Text string `json:"text"`
}

// SearchResultsMsg carries async ripgrep results
type SearchResultsMsg struct {
	Results []SearchResult
	Error   error
}
