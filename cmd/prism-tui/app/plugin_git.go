package app

import (
	"fmt"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/diff"
	"github.com/prism-plugin/prism-tui/modal"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
	"github.com/prism-plugin/prism-tui/ui"
)

// GitFileStatus represents a file in git status
type GitFileStatus struct {
	Path   string
	Status string // "staged", "modified", "untracked"
}

// CommitInfo represents a recent git commit entry
type CommitInfo struct {
	ShortHash string
	Subject   string
}

// GitState holds state for the git status view
type GitState struct {
	// Git data
	BranchName     string
	Ahead          int
	Behind         int
	StagedFiles    []GitFileStatus
	ModifiedFiles  []GitFileStatus
	UntrackedFiles []GitFileStatus
	Error          string

	// Navigation: global cursor (staged files, then modified, then untracked, then commits)
	SelectedIdx int

	// Two-pane layout state
	activePane      ui.FocusPane
	sidebarWidth    int
	diffPaneWidth   int
	scrollOff       int // file list scroll offset in sidebar
	commitScrollOff int // commit list scroll offset in sidebar
	recentCommits   []CommitInfo
	diffParsedDiff  *diff.ParsedDiff
	selectedDiffFile string
	diffViewMode    diff.DiffViewMode
	diffPaneScroll  int // vertical scroll offset in diff pane
	sidebarVisible  bool
	highlighter     *diff.SyntaxHighlighter
}

// GitPlugin implements the git status viewer
type GitPlugin struct {
	ctx     *plugin.Context
	state   GitState
	focused bool
	width   int
	height  int
}

// NewGitPlugin creates a new Git plugin instance
func NewGitPlugin() *GitPlugin {
	return &GitPlugin{
		state: GitState{
			activePane:     ui.PaneLeft,
			sidebarVisible: true,
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
	return ""
}

// Init initializes the plugin with context
func (p *GitPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.width = ctx.Width
	p.height = ctx.Height
	p.state.sidebarVisible = true
	p.state.activePane = ui.PaneLeft

	if ctx.EventBus != nil {
		ctx.EventBus.Subscribe("file.changed", func(event plugin.Event) {
			// Trigger git status reload when files change
		})
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *GitPlugin) Start() tea.Cmd {
	if p.ctx.DemoMode {
		return nil
	}
	return tea.Batch(p.loadGitStatusCmd(), p.loadCommitsCmd())
}

// Stop is called when deactivated
func (p *GitPlugin) Stop() {}

// Update handles messages
func (p *GitPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case plugin.PluginResizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		return p, nil

	case GitStatusLoadedMsg:
		if msg.Error == nil {
			branchChanged := p.state.BranchName != msg.BranchName
			p.state.BranchName = msg.BranchName
			p.state.Ahead = msg.Ahead
			p.state.Behind = msg.Behind
			p.state.StagedFiles = msg.StagedFiles
			p.state.ModifiedFiles = msg.ModifiedFiles
			p.state.UntrackedFiles = msg.UntrackedFiles
			p.state.Error = ""

			// Clamp cursor to valid range after refresh
			total := p.totalItems()
			if p.state.SelectedIdx >= total && total > 0 {
				p.state.SelectedIdx = total - 1
			}

			if branchChanged && p.ctx != nil && p.ctx.EventBus != nil {
				p.ctx.EventBus.Publish(plugin.BranchChangedEvent{
					BranchName: msg.BranchName,
					Ahead:      msg.Ahead,
					Behind:     msg.Behind,
				})
			}

			// Auto-reload diff if a file is still selected
			if p.state.selectedDiffFile != "" {
				file := p.getFileAtCursor()
				if file != nil && file.Path == p.state.selectedDiffFile {
					return p, p.loadDiffCmd(file.Path, file.Status)
				}
			}
		} else {
			p.state.Error = msg.Error.Error()
		}
		return p, nil

	case GitDiffLoadedMsg:
		if msg.Error == nil && msg.File == p.state.selectedDiffFile {
			parsed, _ := diff.ParseUnifiedDiff(msg.Raw)
			p.state.diffParsedDiff = parsed
			p.state.highlighter = diff.NewSyntaxHighlighter(msg.File)
			p.state.diffPaneScroll = 0
		}
		return p, nil

	case RecentCommitsLoadedMsg:
		if msg.Error == nil {
			p.state.recentCommits = msg.Commits
		}
		return p, nil

	case GitOperationCompleteMsg:
		p.state.selectedDiffFile = ""
		p.state.diffParsedDiff = nil
		return p, tea.Batch(p.loadGitStatusCmd(), p.loadCommitsCmd())
	}

	return p, nil
}

// View renders the git status two-pane view
func (p *GitPlugin) View(width, height int) string {
	p.width = width
	p.height = height
	breadcrumb := renderBreadcrumb("Git", width, p.ctx.HasNerdFont)
	content := p.renderTwoPane(width, height-1)
	return lipgloss.JoinVertical(lipgloss.Left, breadcrumb, content)
}

// IsFocused returns whether the plugin is active
func (p *GitPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *GitPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused && p.state.BranchName == "" && !p.ctx.DemoMode {
		// Will load on first render
	}
}

// KeyHints returns footer key hints
func (p *GitPlugin) KeyHints() []plugin.KeyHint {
	if p.state.activePane == ui.PaneRight {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "scroll"},
			{Key: "v", Description: "toggle view"},
			{Key: "tab/esc", Description: "sidebar"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view diff"},
		{Key: "s", Description: "stage/unstage"},
		{Key: "c", Description: "commit"},
		{Key: "tab", Description: "diff pane"},
		{Key: "r", Description: "refresh"},
	}
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// renderTwoPane assembles the full two-pane layout.
func (p *GitPlugin) renderTwoPane(width, height int) string {
	paneWidths := ui.CalculatePaneWidths(width, 30, 25, 40)
	p.state.sidebarWidth = paneWidths.Left
	p.state.diffPaneWidth = paneWidths.Right

	paneHeight := height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	if innerHeight < 1 {
		innerHeight = 1
	}

	sidebarActive := p.state.activePane == ui.PaneLeft
	diffActive := p.state.activePane == ui.PaneRight

	sidebarContent := p.renderSidebar(innerHeight)
	diffContent := p.renderDiffPane(innerHeight)

	leftPane := styles.RenderPanel(sidebarContent, p.state.sidebarWidth, paneHeight, sidebarActive)
	divider := ui.RenderDivider(paneHeight)
	rightPane := styles.RenderPanel(diffContent, p.state.diffPaneWidth, paneHeight, diffActive)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, divider, rightPane)
}

// renderSidebar renders the left pane with files and recent commits.
func (p *GitPlugin) renderSidebar(innerHeight int) string {
	var sb strings.Builder

	// Inner content width (panel border=2 + padding=2 per side)
	maxWidth := p.state.sidebarWidth - 4
	if maxWidth < 8 {
		maxWidth = 8
	}

	// Branch header
	header := styles.TitleStyle.Render("Git")
	if p.state.BranchName != "" {
		branch := p.state.BranchName
		maxBranchLen := maxWidth - 5
		if maxBranchLen > 3 && len(branch) > maxBranchLen {
			branch = "…" + branch[len(branch)-(maxBranchLen-1):]
		}
		header += " " + styles.DimStyle.Render(branch)
		if p.state.Ahead > 0 || p.state.Behind > 0 {
			header += " " + styles.WarningStyle.Render(fmt.Sprintf("↑%d↓%d", p.state.Ahead, p.state.Behind))
		}
	}
	sb.WriteString(header)
	sb.WriteString("\n\n")

	if p.state.Error != "" {
		errMsg := p.state.Error
		if len(errMsg) > maxWidth-4 && maxWidth > 7 {
			errMsg = errMsg[:maxWidth-7] + "..."
		}
		sb.WriteString(styles.ErrorStyle.Render("✗ " + errMsg))
		return sb.String()
	}

	allFiles := p.allFiles()

	// Reserve lines at bottom for separator + commits section
	commitsReserve := 5
	if len(p.state.recentCommits) > 3 {
		commitsReserve = 7
	}
	// 2 header lines (header + blank) already written; remaining for files + sep + commits
	filesAreaHeight := innerHeight - 2 - commitsReserve - 2 // -2 for sep+blank
	if filesAreaHeight < 2 {
		filesAreaHeight = 2
	}

	if len(allFiles) == 0 {
		sb.WriteString(styles.DimStyle.Render("Working tree clean"))
		sb.WriteString("\n")
	} else {
		var filesSB strings.Builder
		linesWritten := 0
		globalIdx := 0

		// Staged files
		if len(p.state.StagedFiles) > 0 && linesWritten < filesAreaHeight {
			filesSB.WriteString(styles.SuccessStyle.Render(fmt.Sprintf("Staged (%d)", len(p.state.StagedFiles))))
			filesSB.WriteString("\n")
			linesWritten++
		}
		for _, f := range p.state.StagedFiles {
			if linesWritten < filesAreaHeight {
				filesSB.WriteString(p.renderFileEntry(f.Path, "M", globalIdx == p.state.SelectedIdx, maxWidth-1))
				filesSB.WriteString("\n")
				linesWritten++
			}
			globalIdx++
		}

		// Modified files
		if len(p.state.ModifiedFiles) > 0 && linesWritten < filesAreaHeight {
			if len(p.state.StagedFiles) > 0 && linesWritten < filesAreaHeight {
				filesSB.WriteString("\n")
				linesWritten++
			}
			if linesWritten < filesAreaHeight {
				filesSB.WriteString(styles.WarningStyle.Render(fmt.Sprintf("Modified (%d)", len(p.state.ModifiedFiles))))
				filesSB.WriteString("\n")
				linesWritten++
			}
		}
		for _, f := range p.state.ModifiedFiles {
			if linesWritten < filesAreaHeight {
				filesSB.WriteString(p.renderFileEntry(f.Path, "M", globalIdx == p.state.SelectedIdx, maxWidth-1))
				filesSB.WriteString("\n")
				linesWritten++
			}
			globalIdx++
		}

		// Untracked files
		if len(p.state.UntrackedFiles) > 0 && linesWritten < filesAreaHeight {
			if (len(p.state.StagedFiles) > 0 || len(p.state.ModifiedFiles) > 0) && linesWritten < filesAreaHeight {
				filesSB.WriteString("\n")
				linesWritten++
			}
			if linesWritten < filesAreaHeight {
				filesSB.WriteString(styles.DimStyle.Render(fmt.Sprintf("Untracked (%d)", len(p.state.UntrackedFiles))))
				filesSB.WriteString("\n")
				linesWritten++
			}
		}
		for _, f := range p.state.UntrackedFiles {
			if linesWritten < filesAreaHeight {
				filesSB.WriteString(p.renderFileEntry(f.Path, "?", globalIdx == p.state.SelectedIdx, maxWidth-1))
				filesSB.WriteString("\n")
				linesWritten++
			}
			globalIdx++
		}

		// Files content with scrollbar alongside
		if linesWritten > 0 {
			filesContent := strings.TrimRight(filesSB.String(), "\n")
			scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
				TotalItems:   len(allFiles),
				ScrollOffset: p.state.scrollOff,
				VisibleItems: linesWritten,
				TrackHeight:  linesWritten,
			})
			sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, filesContent, scrollbar))
			sb.WriteString("\n")
		}
	}

	// Separator
	sb.WriteString("\n")
	if maxWidth > 0 {
		sb.WriteString(styles.DimStyle.Render(strings.Repeat("─", maxWidth)))
	}
	sb.WriteString("\n")

	// Recent commits section
	sb.WriteString(p.renderSidebarCommits(maxWidth))

	return sb.String()
}

// renderFileEntry renders a single file row for the sidebar.
func (p *GitPlugin) renderFileEntry(path, icon string, selected bool, maxWidth int) string {
	displayPath := path
	availableWidth := maxWidth - 2 // icon + space
	if availableWidth > 3 && len(displayPath) > availableWidth {
		displayPath = "…" + displayPath[len(displayPath)-availableWidth+1:]
	}

	if selected {
		line := fmt.Sprintf("%s %s", icon, displayPath)
		if len(line) < maxWidth {
			line += strings.Repeat(" ", maxWidth-len(line))
		}
		return styles.CurrentStyle.Render(line)
	}
	return styles.DimStyle.Render(fmt.Sprintf("%s %s", icon, displayPath))
}

// renderSidebarCommits renders the recent commits list with scrollbar.
func (p *GitPlugin) renderSidebarCommits(maxWidth int) string {
	var sb strings.Builder

	totalFiles := p.totalFiles()

	sb.WriteString(styles.TitleStyle.Render("Recent Commits"))
	sb.WriteString("\n")

	if len(p.state.recentCommits) == 0 {
		sb.WriteString(styles.DimStyle.Render("No commits"))
		return sb.String()
	}

	// Visible window for commits
	commitsVisible := 5
	if commitsVisible > len(p.state.recentCommits) {
		commitsVisible = len(p.state.recentCommits)
	}

	startIdx := p.state.commitScrollOff
	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx >= len(p.state.recentCommits) {
		startIdx = len(p.state.recentCommits) - 1
		if startIdx < 0 {
			startIdx = 0
		}
	}
	endIdx := startIdx + commitsVisible
	if endIdx > len(p.state.recentCommits) {
		endIdx = len(p.state.recentCommits)
	}

	var commitsSB strings.Builder
	for i := startIdx; i < endIdx; i++ {
		commit := p.state.recentCommits[i]
		selected := totalFiles+i == p.state.SelectedIdx

		hashWidth := 8
		msgWidth := maxWidth - hashWidth - 1
		if msgWidth < 5 {
			msgWidth = 5
		}
		msg := commit.Subject
		if len([]rune(msg)) > msgWidth && msgWidth > 3 {
			msg = string([]rune(msg)[:msgWidth-1]) + "…"
		}

		if selected {
			line := fmt.Sprintf("%s %s", commit.ShortHash, msg)
			if len(line) < maxWidth-1 {
				line += strings.Repeat(" ", maxWidth-1-len(line))
			}
			commitsSB.WriteString(styles.CurrentStyle.Render(line))
		} else {
			hash := styles.InfoStyle.Render(commit.ShortHash)
			commitsSB.WriteString(styles.DimStyle.Render(fmt.Sprintf("%s %s", hash, msg)))
		}
		if i < endIdx-1 {
			commitsSB.WriteString("\n")
		}
	}

	commitsContent := commitsSB.String()
	scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
		TotalItems:   len(p.state.recentCommits),
		ScrollOffset: p.state.commitScrollOff,
		VisibleItems: commitsVisible,
		TrackHeight:  commitsVisible,
	})
	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, commitsContent, scrollbar))

	return sb.String()
}

// renderDiffPane renders the right pane showing the selected file's diff.
func (p *GitPlugin) renderDiffPane(innerHeight int) string {
	var sb strings.Builder

	diffWidth := p.state.diffPaneWidth - 4
	if diffWidth < 40 {
		diffWidth = 40
	}

	// Header: filename + view mode
	viewModeStr := "unified"
	if p.state.diffViewMode == diff.DiffViewSideBySide {
		viewModeStr = "split"
	}
	header := "Diff"
	if p.state.selectedDiffFile != "" {
		header = p.state.selectedDiffFile
		maxHeaderLen := diffWidth - 12
		if maxHeaderLen > 5 && len(header) > maxHeaderLen {
			header = "…" + header[len(header)-maxHeaderLen+1:]
		}
	}
	header = fmt.Sprintf("%s [%s]", header, viewModeStr)
	sb.WriteString(styles.TitleStyle.Render(header))
	sb.WriteString("\n\n")

	if p.state.selectedDiffFile == "" {
		sb.WriteString(styles.DimStyle.Render("Select a file to view diff"))
		return sb.String()
	}

	if p.state.diffParsedDiff == nil {
		sb.WriteString(styles.DimStyle.Render("Loading diff..."))
		return sb.String()
	}

	if p.state.diffParsedDiff.Binary {
		sb.WriteString(styles.DimStyle.Render("Binary file — no diff available"))
		return sb.String()
	}

	contentHeight := innerHeight - 2
	if contentHeight < 1 {
		contentHeight = 1
	}

	var diffContent string
	if p.state.diffViewMode == diff.DiffViewSideBySide {
		diffContent = diff.RenderSideBySide(
			p.state.diffParsedDiff, diffWidth,
			p.state.diffPaneScroll, contentHeight,
			0, p.state.highlighter, false,
		)
	} else {
		diffContent = diff.RenderLineDiff(
			p.state.diffParsedDiff, diffWidth,
			p.state.diffPaneScroll, contentHeight,
			0, p.state.highlighter, false,
		)
	}
	sb.WriteString(diffContent)

	return sb.String()
}

// ── Input handling ─────────────────────────────────────────────────────────────

// handleKeyPress dispatches key events to pane-specific handlers.
func (p *GitPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Tab always toggles the active pane
	if key == "tab" {
		if p.state.activePane == ui.PaneLeft {
			p.state.activePane = ui.PaneRight
		} else {
			p.state.activePane = ui.PaneLeft
		}
		return p, nil
	}

	// Global keys (work in both panes)
	switch key {
	case "s":
		file := p.getFileAtCursor()
		if file != nil {
			return p, p.toggleStageCmd(file.Path, file.Status)
		}
		return p, nil
	case "c":
		return p, p.openCommitModal()
	case "r":
		return p, tea.Batch(p.loadGitStatusCmd(), p.loadCommitsCmd())
	}

	if p.state.activePane == ui.PaneRight {
		return p.handleDiffPaneKey(key)
	}
	return p.handleSidebarKey(key)
}

// handleSidebarKey handles keys when the sidebar (left pane) is focused.
func (p *GitPlugin) handleSidebarKey(key string) (plugin.Plugin, tea.Cmd) {
	switch key {
	case "j", "down":
		total := p.totalItems()
		if total > 0 && p.state.SelectedIdx < total-1 {
			p.state.SelectedIdx++
			p.clampCommitScroll()
		}
		return p, nil

	case "k", "up":
		if p.state.SelectedIdx > 0 {
			p.state.SelectedIdx--
			p.clampCommitScroll()
		}
		return p, nil

	case "enter":
		file := p.getFileAtCursor()
		if file != nil {
			p.state.selectedDiffFile = file.Path
			p.state.diffParsedDiff = nil
			p.state.diffPaneScroll = 0
			return p, p.loadDiffCmd(file.Path, file.Status)
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// handleDiffPaneKey handles keys when the diff (right pane) is focused.
func (p *GitPlugin) handleDiffPaneKey(key string) (plugin.Plugin, tea.Cmd) {
	switch key {
	case "j", "down":
		p.state.diffPaneScroll++
		return p, nil

	case "k", "up":
		if p.state.diffPaneScroll > 0 {
			p.state.diffPaneScroll--
		}
		return p, nil

	case "v":
		if p.state.diffViewMode == diff.DiffViewUnified {
			p.state.diffViewMode = diff.DiffViewSideBySide
		} else {
			p.state.diffViewMode = diff.DiffViewUnified
		}
		return p, nil

	case "esc":
		p.state.activePane = ui.PaneLeft
		return p, nil
	}

	return p, nil
}

// clampCommitScroll adjusts commitScrollOff so the selected commit stays visible.
func (p *GitPlugin) clampCommitScroll() {
	totalFiles := p.totalFiles()
	commitIdx := p.state.SelectedIdx - totalFiles
	if commitIdx < 0 {
		return // cursor is on a file, not a commit
	}
	commitsVisible := 5
	if commitIdx < p.state.commitScrollOff {
		p.state.commitScrollOff = commitIdx
	} else if commitIdx >= p.state.commitScrollOff+commitsVisible {
		p.state.commitScrollOff = commitIdx - commitsVisible + 1
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// allFiles returns all tracked files in section order.
func (p *GitPlugin) allFiles() []GitFileStatus {
	var files []GitFileStatus
	files = append(files, p.state.StagedFiles...)
	files = append(files, p.state.ModifiedFiles...)
	files = append(files, p.state.UntrackedFiles...)
	return files
}

// totalFiles returns the total number of tracked files.
func (p *GitPlugin) totalFiles() int {
	return len(p.state.StagedFiles) + len(p.state.ModifiedFiles) + len(p.state.UntrackedFiles)
}

// totalItems returns total navigable items (files + commits).
func (p *GitPlugin) totalItems() int {
	return p.totalFiles() + len(p.state.recentCommits)
}

// getFileAtCursor returns the file at the current global cursor, or nil if on a commit.
func (p *GitPlugin) getFileAtCursor() *GitFileStatus {
	idx := p.state.SelectedIdx
	if idx < len(p.state.StagedFiles) {
		return &p.state.StagedFiles[idx]
	}
	idx -= len(p.state.StagedFiles)
	if idx < len(p.state.ModifiedFiles) {
		return &p.state.ModifiedFiles[idx]
	}
	idx -= len(p.state.ModifiedFiles)
	if idx < len(p.state.UntrackedFiles) {
		return &p.state.UntrackedFiles[idx]
	}
	return nil // cursor is on a commit
}

// ── Commands (async operations) ───────────────────────────────────────────────

// loadGitStatusCmd loads the current git status
func (p *GitPlugin) loadGitStatusCmd() tea.Cmd {
	return func() tea.Msg {
		branchCmd := exec.Command("git", "-C", p.ctx.ProjectDir, "rev-parse", "--abbrev-ref", "HEAD")
		branchOut, err := branchCmd.Output()
		if err != nil {
			return GitStatusLoadedMsg{Error: fmt.Errorf("not a git repository")}
		}
		branchName := strings.TrimSpace(string(branchOut))

		ahead, behind := 0, 0
		revListCmd := exec.Command("git", "-C", p.ctx.ProjectDir, "rev-list", "--left-right", "--count", "HEAD...@{u}")
		revListOut, err := revListCmd.Output()
		if err == nil {
			fmt.Sscanf(string(revListOut), "%d\t%d", &ahead, &behind)
		}

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

// loadDiffCmd loads the diff for a file and returns raw output for parsing.
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
			return GitDiffLoadedMsg{Error: err, File: path}
		}

		return GitDiffLoadedMsg{Raw: string(out), File: path, Error: nil}
	}
}

// loadCommitsCmd loads recent git commits for the sidebar.
func (p *GitPlugin) loadCommitsCmd() tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command("git", "-C", p.ctx.ProjectDir, "log", "--oneline", "-20")
		out, err := cmd.Output()
		if err != nil {
			return RecentCommitsLoadedMsg{Error: err}
		}

		var commits []CommitInfo
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			if len(line) < 8 {
				continue
			}
			parts := strings.SplitN(line, " ", 2)
			if len(parts) == 2 {
				commits = append(commits, CommitInfo{
					ShortHash: parts[0],
					Subject:   parts[1],
				})
			}
		}

		return RecentCommitsLoadedMsg{Commits: commits}
	}
}

// toggleStageCmd stages or unstages a file
func (p *GitPlugin) toggleStageCmd(path, status string) tea.Cmd {
	return func() tea.Msg {
		var cmd *exec.Cmd
		if status == "staged" {
			cmd = exec.Command("git", "-C", p.ctx.ProjectDir, "reset", "HEAD", path)
		} else {
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

// ── Message types ─────────────────────────────────────────────────────────────

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

// GitDiffLoadedMsg is sent when a diff is loaded (raw output for inline parsing)
type GitDiffLoadedMsg struct {
	Raw   string // Raw unified diff output
	File  string // File path this diff is for
	Error error
}

// RecentCommitsLoadedMsg is sent when recent commits are loaded
type RecentCommitsLoadedMsg struct {
	Commits []CommitInfo
	Error   error
}

// GitOperationCompleteMsg is sent when a git operation completes
type GitOperationCompleteMsg struct {
	Error error
}
