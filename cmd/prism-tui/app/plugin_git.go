package app

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/modal"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// GitFileStatus represents a file in git status
type GitFileStatus struct {
	Path   string
	Status string // "staged", "modified", "untracked"
}

// GitState holds state for the git status view
type GitState struct {
	BranchName   string
	Ahead        int
	Behind       int
	StagedFiles  []GitFileStatus
	ModifiedFiles []GitFileStatus
	UntrackedFiles []GitFileStatus
	SelectedIdx  int
	CurrentSection string // "staged", "modified", "untracked"
	ViewingDiff  bool
	DiffViewport viewport.Model
	Error        string
}

// GitPlugin implements the git status viewer
type GitPlugin struct {
	ctx     *plugin.Context
	state   GitState
	focused bool
}

// NewGitPlugin creates a new Git plugin instance
func NewGitPlugin() *GitPlugin {
	return &GitPlugin{
		state: GitState{
			CurrentSection: "modified",
		},
	}
}

// ID returns the plugin identifier
func (p *GitPlugin) ID() string {
	return "git"
}

// Name returns the display name
func (p *GitPlugin) Name() string {
	return "Git"
}

// Icon returns the tab icon
func (p *GitPlugin) Icon() string {
	return "⎇"
}

// Init initializes the plugin with context
func (p *GitPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize diff viewport
	p.state.DiffViewport = viewport.New(ctx.Width-4, ctx.Height-6)
	return nil
}

// Start is called when the plugin is first activated
func (p *GitPlugin) Start() tea.Cmd {
	// Load git status when plugin starts
	if p.ctx.DemoMode {
		return nil
	}
	return p.loadGitStatusCmd()
}

// Stop is called when deactivated
func (p *GitPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages
func (p *GitPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
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
		p.state.DiffViewport.Width = msg.Width - 4
		p.state.DiffViewport.Height = viewportHeight
		return p, nil

	case GitStatusLoadedMsg:
		if msg.Error == nil {
			p.state.BranchName = msg.BranchName
			p.state.Ahead = msg.Ahead
			p.state.Behind = msg.Behind
			p.state.StagedFiles = msg.StagedFiles
			p.state.ModifiedFiles = msg.ModifiedFiles
			p.state.UntrackedFiles = msg.UntrackedFiles
			p.state.Error = ""
		} else {
			p.state.Error = msg.Error.Error()
		}
		return p, nil

	case GitDiffLoadedMsg:
		if msg.Error == nil {
			p.state.ViewingDiff = true
			p.state.DiffViewport.SetContent(msg.Diff)
		}
		return p, nil

	case GitOperationCompleteMsg:
		// Reload status after git operation
		p.state.ViewingDiff = false
		return p, p.loadGitStatusCmd()
	}

	// Forward viewport updates when viewing diff
	if p.state.ViewingDiff {
		p.state.DiffViewport, cmd = p.state.DiffViewport.Update(msg)
	}

	return p, cmd
}

// View renders the git status view
func (p *GitPlugin) View(width, height int) string {
	var sections []string

	// Header with branch info
	title := styles.TitleStyle.Render("PRISM")
	branchInfo := ""
	if p.state.BranchName != "" {
		branchInfo = fmt.Sprintf(" > Git: %s", p.state.BranchName)
		if p.state.Ahead > 0 || p.state.Behind > 0 {
			branchInfo += fmt.Sprintf(" [↑%d ↓%d]", p.state.Ahead, p.state.Behind)
		}
	} else {
		branchInfo = " > Git Status"
	}
	breadcrumb := styles.DimStyle.Render(branchInfo)
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(width).Render(header))
	sections = append(sections, "")

	if p.state.Error != "" {
		sections = append(sections, styles.ErrorStyle.Render("  Error: "+p.state.Error))
		sections = append(sections, "")
		return lipgloss.JoinVertical(lipgloss.Left, sections...)
	}

	if p.state.ViewingDiff {
		// Show diff viewer
		sections = append(sections, p.state.DiffViewport.View())
		sections = append(sections, "")
		sections = append(sections, styles.DimStyle.Render("  esc back   j/k scroll"))
		return lipgloss.JoinVertical(lipgloss.Left, sections...)
	}

	// Show file lists
	sections = append(sections, p.renderFileList("Staged Changes", p.state.StagedFiles, "staged", width))
	sections = append(sections, "")
	sections = append(sections, p.renderFileList("Modified Files", p.state.ModifiedFiles, "modified", width))
	sections = append(sections, "")
	sections = append(sections, p.renderFileList("Untracked Files", p.state.UntrackedFiles, "untracked", width))
	sections = append(sections, "")

	// Footer hints
	hints := "  j/k navigate   enter view diff   s stage/unstage   c commit   r refresh   esc home"
	sections = append(sections, styles.DimStyle.Render(hints))

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *GitPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *GitPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused && p.state.BranchName == "" && !p.ctx.DemoMode {
		// Load status when focused for first time
	}
}

// KeyHints returns footer key hints
func (p *GitPlugin) KeyHints() []plugin.KeyHint {
	if p.state.ViewingDiff {
		return []plugin.KeyHint{
			{Key: "esc", Description: "back to list"},
			{Key: "j/k", Description: "scroll"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view diff"},
		{Key: "s", Description: "stage/unstage"},
		{Key: "c", Description: "commit"},
		{Key: "r", Description: "refresh"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *GitPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	if p.state.ViewingDiff {
		// In diff viewer mode
		switch key {
		case "esc", "backspace":
			p.state.ViewingDiff = false
			return p, nil
		}
		// Forward to viewport for scroll handling
		var cmd tea.Cmd
		p.state.DiffViewport, cmd = p.state.DiffViewport.Update(msg)
		return p, cmd
	}

	// In file list mode
	switch key {
	case "j", "down":
		p.moveSelection(1)
		return p, nil
	case "k", "up":
		p.moveSelection(-1)
		return p, nil
	case "tab":
		// Cycle through sections
		p.cycleSections(1)
		return p, nil
	case "shift+tab":
		p.cycleSections(-1)
		return p, nil
	case "enter":
		// View diff for selected file
		file := p.getSelectedFile()
		if file != nil {
			return p, p.loadDiffCmd(file.Path, file.Status)
		}
		return p, nil
	case "s":
		// Stage/unstage selected file
		file := p.getSelectedFile()
		if file != nil {
			return p, p.toggleStageCmd(file.Path, file.Status)
		}
		return p, nil
	case "c":
		// Open commit modal
		return p, p.openCommitModal()
	case "r":
		// Refresh git status
		return p, p.loadGitStatusCmd()
	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// renderFileList renders a section of files
func (p *GitPlugin) renderFileList(title string, files []GitFileStatus, section string, width int) string {
	var lines []string

	// Section header
	headerStyle := styles.TitleStyle
	if section == p.state.CurrentSection {
		headerStyle = styles.CurrentStyle
	}
	lines = append(lines, headerStyle.Render(fmt.Sprintf("  %s (%d)", title, len(files))))

	if len(files) == 0 {
		lines = append(lines, styles.DimStyle.Render("    (none)"))
		return lipgloss.JoinVertical(lipgloss.Left, lines...)
	}

	// File list
	for i, file := range files {
		selected := section == p.state.CurrentSection && i == p.state.SelectedIdx
		icon := "  "
		switch file.Status {
		case "staged":
			icon = "✓ "
		case "modified":
			icon = "M "
		case "untracked":
			icon = "? "
		}

		line := fmt.Sprintf("    %s%s", icon, file.Path)

		if selected {
			line = styles.CurrentStyle.Render("> " + line)
		} else {
			line = styles.DimStyle.Render("  " + line)
		}

		lines = append(lines, line)
	}

	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// moveSelection moves the selection within the current section
func (p *GitPlugin) moveSelection(delta int) {
	files := p.getCurrentSectionFiles()
	if len(files) == 0 {
		return
	}

	p.state.SelectedIdx += delta
	if p.state.SelectedIdx < 0 {
		p.state.SelectedIdx = 0
	}
	if p.state.SelectedIdx >= len(files) {
		p.state.SelectedIdx = len(files) - 1
	}
}

// cycleSections moves between sections
func (p *GitPlugin) cycleSections(delta int) {
	sections := []string{"staged", "modified", "untracked"}
	currentIdx := 0
	for i, s := range sections {
		if s == p.state.CurrentSection {
			currentIdx = i
			break
		}
	}

	currentIdx += delta
	if currentIdx < 0 {
		currentIdx = len(sections) - 1
	}
	if currentIdx >= len(sections) {
		currentIdx = 0
	}

	p.state.CurrentSection = sections[currentIdx]
	p.state.SelectedIdx = 0
}

// getCurrentSectionFiles returns the files for the current section
func (p *GitPlugin) getCurrentSectionFiles() []GitFileStatus {
	switch p.state.CurrentSection {
	case "staged":
		return p.state.StagedFiles
	case "modified":
		return p.state.ModifiedFiles
	case "untracked":
		return p.state.UntrackedFiles
	default:
		return nil
	}
}

// getSelectedFile returns the currently selected file
func (p *GitPlugin) getSelectedFile() *GitFileStatus {
	files := p.getCurrentSectionFiles()
	if len(files) == 0 || p.state.SelectedIdx >= len(files) {
		return nil
	}
	return &files[p.state.SelectedIdx]
}

// loadGitStatusCmd loads the current git status
func (p *GitPlugin) loadGitStatusCmd() tea.Cmd {
	return func() tea.Msg {
		// Get current branch
		branchCmd := exec.Command("git", "-C", p.ctx.ProjectDir, "rev-parse", "--abbrev-ref", "HEAD")
		branchOut, err := branchCmd.Output()
		if err != nil {
			return GitStatusLoadedMsg{Error: fmt.Errorf("not a git repository")}
		}
		branchName := strings.TrimSpace(string(branchOut))

		// Get ahead/behind count
		ahead, behind := 0, 0
		revListCmd := exec.Command("git", "-C", p.ctx.ProjectDir, "rev-list", "--left-right", "--count", "HEAD...@{u}")
		revListOut, err := revListCmd.Output()
		if err == nil {
			fmt.Sscanf(string(revListOut), "%d\t%d", &ahead, &behind)
		}

		// Get status
		statusCmd := exec.Command("git", "-C", p.ctx.ProjectDir, "status", "--porcelain")
		statusOut, err := statusCmd.Output()
		if err != nil {
			return GitStatusLoadedMsg{Error: err}
		}

		var staged, modified, untracked []GitFileStatus
		lines := strings.Split(string(statusOut), "\n")
		for _, line := range lines {
			if len(line) < 4 {
				continue
			}
			x := line[0]
			y := line[1]
			path := strings.TrimSpace(line[3:])

			if x == 'M' || x == 'A' || x == 'D' || x == 'R' || x == 'C' {
				staged = append(staged, GitFileStatus{Path: path, Status: "staged"})
			}
			if y == 'M' || (x == ' ' && y == 'M') {
				modified = append(modified, GitFileStatus{Path: path, Status: "modified"})
			}
			if x == '?' && y == '?' {
				untracked = append(untracked, GitFileStatus{Path: path, Status: "untracked"})
			}
		}

		return GitStatusLoadedMsg{
			BranchName:     branchName,
			Ahead:          ahead,
			Behind:         behind,
			StagedFiles:    staged,
			ModifiedFiles:  modified,
			UntrackedFiles: untracked,
		}
	}
}

// loadDiffCmd loads the diff for a file
func (p *GitPlugin) loadDiffCmd(path, status string) tea.Cmd {
	return func() tea.Msg {
		var cmd *exec.Cmd
		if status == "staged" {
			cmd = exec.Command("git", "-C", p.ctx.ProjectDir, "diff", "--cached", path)
		} else {
			cmd = exec.Command("git", "-C", p.ctx.ProjectDir, "diff", path)
		}

		out, err := cmd.Output()
		if err != nil {
			return GitDiffLoadedMsg{Diff: "", Error: err}
		}

		return GitDiffLoadedMsg{Diff: string(out), Error: nil}
	}
}

// toggleStageCmd stages or unstages a file
func (p *GitPlugin) toggleStageCmd(path, status string) tea.Cmd {
	return func() tea.Msg {
		var cmd *exec.Cmd
		if status == "staged" {
			// Unstage
			cmd = exec.Command("git", "-C", p.ctx.ProjectDir, "reset", "HEAD", path)
		} else {
			// Stage
			cmd = exec.Command("git", "-C", p.ctx.ProjectDir, "add", path)
		}

		err := cmd.Run()
		if err != nil {
			return GitOperationCompleteMsg{Error: err}
		}

		return GitOperationCompleteMsg{Error: nil}
	}
}

// openCommitModal opens a modal to enter commit message
func (p *GitPlugin) openCommitModal() tea.Cmd {
	return func() tea.Msg {
		// Create commit modal using the modal system
		commitModal := modal.New("Commit Changes", modal.WithWidth(60)).
			AddSection(modal.Text("Enter commit message:")).
			AddSection(modal.Textarea("message", "", "Enter your commit message here", 5)).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(
				modal.Btn("Commit", "commit"),
				modal.Btn("Cancel", "cancel"),
			))

		return OpenModalMsg{Modal: commitModal}
	}
}

// GitStatusLoadedMsg is sent when git status is loaded
type GitStatusLoadedMsg struct {
	BranchName     string
	Ahead          int
	Behind         int
	StagedFiles    []GitFileStatus
	ModifiedFiles  []GitFileStatus
	UntrackedFiles []GitFileStatus
	Error          error
}

// GitDiffLoadedMsg is sent when a diff is loaded
type GitDiffLoadedMsg struct {
	Diff  string
	Error error
}

// GitOperationCompleteMsg is sent when a git operation completes
type GitOperationCompleteMsg struct {
	Error error
}
