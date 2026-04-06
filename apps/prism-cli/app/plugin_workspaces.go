package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/domain"
	"github.com/prism-plugin/prism-cli/modal"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/registry"
	"github.com/prism-plugin/prism-cli/styles"
	"github.com/prism-plugin/prism-cli/ui"
)

// WorkspacesViewMode controls what the sidebar displays
type WorkspacesViewMode int

const (
	ViewModeProjects  WorkspacesViewMode = iota // Project list (.prism/ scanning)
	ViewModeWorktrees                           // Git worktree list (W-1)
	ViewModeKanban                              // Kanban board view (W-4)
)

// WorktreeInfo represents a parsed git worktree entry (W-1)
type WorktreeInfo struct {
	Path     string // Absolute path to worktree
	Branch   string // Branch name (empty for detached HEAD)
	HEAD     string // Short commit hash
	IsBare   bool   // True for bare repository root
	IsMain   bool   // True for the main worktree (not a linked worktree)
	Prunable bool   // True if worktree is prunable (stale)
}

// ProjectInfo represents a discovered project with .prism/ directory
type ProjectInfo struct {
	Name            string // Directory name
	Path            string // Absolute path
	Branch          string // Current git branch
	StoriesTotal    int
	StoriesComplete int
	Epics           []EpicInfo // Epic directories within project
}

// WorkspacesState holds state for the workspaces browser
type WorkspacesState struct {
	Projects        []ProjectInfo
	SelectedProject int
	EpicsView       bool // true = showing epics within selected project, false = project list
	SelectedEpic    int
	Loading         bool

	// View mode: projects vs worktrees (W-1)
	ViewMode          WorkspacesViewMode
	Worktrees         []WorktreeInfo
	SelectedWorktree  int
	WorktreesLoaded   bool

	// Worktree creation state (W-2)
	pendingDeletePath string // Path of worktree pending deletion (W-3)
	deleteBranch      bool   // Whether to also delete the branch (W-3)

	// Two-pane layout state
	activePane    ui.FocusPane
	sidebarWidth  int
	previewWidth  int
	scrollOff     int // project/epic/worktree list scroll offset
	previewTab    int // 0=Info, 1=Stories, 2=Progress
	previewScroll int // vertical scroll offset within preview pane

	// Kanban board state (W-4)
	kanbanCol      int                       // Selected column index (0-4: Active, Thinking, Waiting, Done, Paused)
	kanbanRow      int                       // Selected card index within current column
	agentStatuses  map[string]KanbanCardInfo // worktree path → agent info
}

// KanbanCardInfo holds agent status for a worktree card (W-4)
type KanbanCardInfo struct {
	AgentType string
	Status    string // "active", "thinking", "waiting", "done", "paused"
}

// WorkspacesPlugin implements the multi-project workspace switcher
type WorkspacesPlugin struct {
	ctx     *plugin.Context
	state   WorkspacesState
	focused bool
	width   int
	height  int
}

// NewWorkspacesPlugin creates a new Workspaces plugin instance
func NewWorkspacesPlugin() *WorkspacesPlugin {
	return &WorkspacesPlugin{
		state: WorkspacesState{
			Projects:        []ProjectInfo{},
			SelectedProject: 0,
			EpicsView:       false,
			SelectedEpic:    0,
			Loading:         false,
			activePane:      ui.PaneLeft,
			ViewMode:        ViewModeProjects,
		},
	}
}

// ID returns the plugin identifier
func (p *WorkspacesPlugin) ID() string {
	return "workspaces"
}

// Name returns the display name
func (p *WorkspacesPlugin) Name() string {
	return "Workspaces"
}

// Icon returns the tab icon
func (p *WorkspacesPlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context
func (p *WorkspacesPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.width = ctx.Width
	p.height = ctx.Height
	p.state.activePane = ui.PaneLeft
	p.state.agentStatuses = make(map[string]KanbanCardInfo)

	// Subscribe to AgentStatusEvent for kanban board (W-4)
	if ctx.EventBus != nil {
		ctx.EventBus.Subscribe("agent.status", func(event plugin.Event) {
			if e, ok := event.(plugin.AgentStatusEvent); ok {
				p.state.agentStatuses[e.WorktreePath] = KanbanCardInfo{
					AgentType: e.AgentType,
					Status:    e.Status,
				}
			}
		})
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *WorkspacesPlugin) Start() tea.Cmd {
	// Scan for projects and worktrees when activated
	return tea.Batch(p.scanProjects(), p.loadWorktreesCmd())
}

// Stop is called when deactivated
func (p *WorkspacesPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages
func (p *WorkspacesPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case plugin.PluginResizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		return p, nil

	case ProjectsScanCompleteMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		p.state.Projects = msg.Projects
		p.state.Loading = false
		return p, nil

	case WorktreeListLoadedMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error == nil {
			p.state.Worktrees = msg.Worktrees
			p.state.WorktreesLoaded = true
			if p.state.SelectedWorktree >= len(msg.Worktrees) {
				p.state.SelectedWorktree = 0
			}
		}
		return p, nil

	case WorktreeCreatedMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error != nil {
			return p, p.openErrorModal(msg.Error.Error())
		}
		// Publish event and refresh
		if p.ctx.EventBus != nil {
			p.ctx.EventBus.Publish(plugin.WorktreeChangedEvent{
				Action: "created",
				Path:   msg.Path,
				Branch: msg.Branch,
			})
		}
		return p, p.loadWorktreesCmd()

	case WorktreeDeletedMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error != nil {
			return p, p.openErrorModal(msg.Error.Error())
		}
		// Publish event and refresh
		if p.ctx.EventBus != nil {
			p.ctx.EventBus.Publish(plugin.WorktreeChangedEvent{
				Action: "deleted",
				Path:   msg.Path,
			})
		}
		return p, p.loadWorktreesCmd()

	case ModalActionMsg:
		return p.handleModalAction(msg)
	}

	return p, nil
}

// View renders the workspaces browser as a two-pane layout
func (p *WorkspacesPlugin) View(width, height int) string {
	p.width = width
	p.height = height
	breadcrumb := renderBreadcrumb("Workspaces", width, p.ctx.HasNerdFont)
	content := p.renderTwoPane(width, height-1)
	return lipgloss.JoinVertical(lipgloss.Left, breadcrumb, content)
}

// IsFocused returns whether the plugin is active
func (p *WorkspacesPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *WorkspacesPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints
func (p *WorkspacesPlugin) KeyHints() []plugin.KeyHint {
	if p.state.activePane == ui.PaneRight {
		tabs := []string{"Info", "Stories", "Progress"}
		tabHint := fmt.Sprintf("tab %d/%d", p.state.previewTab+1, len(tabs))
		return []plugin.KeyHint{
			{Key: "[/]", Description: "switch tab"},
			{Key: "j/k", Description: "scroll"},
			{Key: tabHint, Description: tabs[p.state.previewTab]},
			{Key: "tab/esc", Description: "project list"},
		}
	}
	if p.state.ViewMode == ViewModeKanban {
		return []plugin.KeyHint{
			{Key: "h/l", Description: "columns"},
			{Key: "j/k", Description: "cards"},
			{Key: "enter", Description: "detail"},
			{Key: "v", Description: "list view"},
			{Key: "w", Description: "projects"},
		}
	}
	if p.state.ViewMode == ViewModeWorktrees {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "navigate"},
			{Key: "n", Description: "new worktree"},
			{Key: "d", Description: "delete"},
			{Key: "v", Description: "kanban"},
			{Key: "w", Description: "projects view"},
			{Key: "tab", Description: "preview"},
		}
	}
	if p.state.EpicsView {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "navigate"},
			{Key: "enter", Description: "switch epic"},
			{Key: "tab", Description: "preview"},
			{Key: "esc", Description: "back to projects"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "select / view epics"},
		{Key: "w", Description: "worktrees view"},
		{Key: "tab", Description: "preview"},
		{Key: "r", Description: "rescan"},
	}
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// renderTwoPane assembles the full two-pane layout.
func (p *WorkspacesPlugin) renderTwoPane(width, height int) string {
	paneWidths := ui.CalculatePaneWidths(width, 40, 25, 40)
	p.state.sidebarWidth = paneWidths.Left
	p.state.previewWidth = paneWidths.Right

	paneHeight := height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	if innerHeight < 1 {
		innerHeight = 1
	}

	sidebarActive := p.state.activePane == ui.PaneLeft
	previewActive := p.state.activePane == ui.PaneRight

	sidebarContent := p.renderSidebarList(innerHeight)
	previewContent := p.renderPreviewPane(innerHeight)

	leftPane := styles.RenderPanel(sidebarContent, p.state.sidebarWidth, paneHeight, sidebarActive)
	divider := ui.RenderDivider(paneHeight)
	rightPane := styles.RenderPanel(previewContent, p.state.previewWidth, paneHeight, previewActive)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, divider, rightPane)
}

// renderSidebarList renders the left pane — project list, epic list, worktree list, or kanban board.
func (p *WorkspacesPlugin) renderSidebarList(innerHeight int) string {
	if p.state.ViewMode == ViewModeKanban {
		return p.renderKanbanBoard(innerHeight)
	}
	if p.state.ViewMode == ViewModeWorktrees {
		return p.renderWorktreeList(innerHeight)
	}
	return p.renderProjectList(innerHeight)
}

// renderWorktreeList renders the git worktree sidebar (W-1).
func (p *WorkspacesPlugin) renderWorktreeList(innerHeight int) string {
	var sb strings.Builder

	maxWidth := p.state.sidebarWidth - 4
	if maxWidth < 8 {
		maxWidth = 8
	}

	sb.WriteString(styles.TitleStyle.Render("Worktrees"))
	sb.WriteString("\n\n")

	if !p.state.WorktreesLoaded {
		sb.WriteString(styles.DimStyle.Render("Loading worktrees..."))
		return sb.String()
	}

	if len(p.state.Worktrees) == 0 {
		sb.WriteString(styles.DimStyle.Render("No worktrees found"))
		sb.WriteString("\n\n")
		sb.WriteString(styles.DimStyle.Render("Not a git repo, or no worktrees."))
		sb.WriteString("\n")
		sb.WriteString(styles.DimStyle.Render("Press 'n' to create one."))
		return sb.String()
	}

	const itemHeight = 2
	headerLines := 2
	listAreaHeight := innerHeight - headerLines
	visibleCount := listAreaHeight / itemHeight
	if visibleCount < 1 {
		visibleCount = 1
	}

	// Clamp scroll offset
	if p.state.scrollOff < 0 {
		p.state.scrollOff = 0
	}
	maxScroll := len(p.state.Worktrees) - visibleCount
	if maxScroll < 0 {
		maxScroll = 0
	}
	if p.state.scrollOff > maxScroll {
		p.state.scrollOff = maxScroll
	}

	var itemsSB strings.Builder
	end := p.state.scrollOff + visibleCount
	if end > len(p.state.Worktrees) {
		end = len(p.state.Worktrees)
	}
	for i := p.state.scrollOff; i < end; i++ {
		wt := p.state.Worktrees[i]
		selected := i == p.state.SelectedWorktree
		itemsSB.WriteString(p.renderWorktreeItem(wt, selected, maxWidth-1))
		if i < end-1 {
			itemsSB.WriteString("\n")
		}
	}

	itemsContent := itemsSB.String()
	scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
		TotalItems:   len(p.state.Worktrees),
		ScrollOffset: p.state.scrollOff,
		VisibleItems: visibleCount,
		TrackHeight:  visibleCount * itemHeight,
	})
	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, itemsContent, scrollbar))

	return sb.String()
}

// renderWorktreeItem renders a single worktree entry (2 lines).
func (p *WorkspacesPlugin) renderWorktreeItem(wt WorktreeInfo, selected bool, width int) string {
	// Icon
	var icon string
	if wt.IsMain {
		icon = styles.CurrentStyle.Render("●")
	} else if selected {
		icon = styles.InfoStyle.Render("▸")
	} else {
		icon = styles.DimStyle.Render("○")
	}

	// Branch name (or "(bare)" / "(detached)")
	branch := wt.Branch
	if wt.IsBare {
		branch = "(bare)"
	} else if branch == "" {
		branch = "(detached)"
	}

	maxBranchWidth := width - 4
	if maxBranchWidth < 4 {
		maxBranchWidth = 4
	}
	if len([]rune(branch)) > maxBranchWidth {
		branch = string([]rune(branch)[:maxBranchWidth-1]) + "…"
	}

	line1 := fmt.Sprintf(" %s %s", icon, branch)

	// Line 2: path (truncated, showing just last 2 path components)
	pathLabel := filepath.Base(wt.Path)
	if wt.HEAD != "" {
		pathLabel += "  " + styles.DimStyle.Render(wt.HEAD[:minInt(7, len(wt.HEAD))])
	}
	if len([]rune(pathLabel)) > width-4 {
		pathLabel = string([]rune(pathLabel)[:width-5]) + "…"
	}
	line2 := "    " + pathLabel

	content := line1 + "\n" + line2

	if selected {
		return styles.CurrentStyle.Width(width).Render(content)
	}
	return styles.DimStyle.Width(width).Render(content)
}

// renderProjectList renders the left pane — the project or epic list.
func (p *WorkspacesPlugin) renderProjectList(innerHeight int) string {
	var sb strings.Builder

	maxWidth := p.state.sidebarWidth - 4 // subtract panel border (2) + padding (2)
	if maxWidth < 8 {
		maxWidth = 8
	}

	// Header
	if p.state.EpicsView && p.state.SelectedProject < len(p.state.Projects) {
		proj := p.state.Projects[p.state.SelectedProject]
		header := fmt.Sprintf("Epics: %s", proj.Name)
		if len(header) > maxWidth {
			header = "…" + header[len(header)-(maxWidth-1):]
		}
		sb.WriteString(styles.TitleStyle.Render(header))
	} else {
		sb.WriteString(styles.TitleStyle.Render("Workspaces"))
	}
	sb.WriteString("\n\n")

	if p.state.Loading {
		sb.WriteString(styles.DimStyle.Render("Scanning for .prism/ directories..."))
		return sb.String()
	}

	// itemHeight: each item is 2 lines
	const itemHeight = 2
	headerLines := 2 // header + blank
	listAreaHeight := innerHeight - headerLines
	visibleCount := listAreaHeight / itemHeight
	if visibleCount < 1 {
		visibleCount = 1
	}

	if p.state.EpicsView {
		if p.state.SelectedProject >= len(p.state.Projects) {
			sb.WriteString(styles.DimStyle.Render("No project selected"))
			return sb.String()
		}
		epics := p.state.Projects[p.state.SelectedProject].Epics
		if len(epics) == 0 {
			sb.WriteString(styles.DimStyle.Render("No epics in this project"))
			sb.WriteString("\n")
			sb.WriteString(styles.DimStyle.Render("esc to go back"))
			return sb.String()
		}

		// Clamp scroll offset
		if p.state.scrollOff < 0 {
			p.state.scrollOff = 0
		}
		maxScroll := len(epics) - visibleCount
		if maxScroll < 0 {
			maxScroll = 0
		}
		if p.state.scrollOff > maxScroll {
			p.state.scrollOff = maxScroll
		}

		var itemsSB strings.Builder
		linesRendered := 0
		end := p.state.scrollOff + visibleCount
		if end > len(epics) {
			end = len(epics)
		}
		for i := p.state.scrollOff; i < end; i++ {
			epic := epics[i]
			selected := i == p.state.SelectedEpic
			itemsSB.WriteString(p.renderEpicItem(epic, selected, maxWidth-1))
			linesRendered += itemHeight
			if i < end-1 {
				itemsSB.WriteString("\n")
			}
		}
		_ = linesRendered

		itemsContent := itemsSB.String()
		scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
			TotalItems:   len(epics),
			ScrollOffset: p.state.scrollOff,
			VisibleItems: visibleCount,
			TrackHeight:  visibleCount * itemHeight,
		})
		sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, itemsContent, scrollbar))
	} else {
		if len(p.state.Projects) == 0 {
			sb.WriteString(styles.DimStyle.Render("No projects found"))
			sb.WriteString("\n\n")
			sb.WriteString(styles.DimStyle.Render("Press 'r' to scan"))
			return sb.String()
		}

		// Clamp scroll offset
		if p.state.scrollOff < 0 {
			p.state.scrollOff = 0
		}
		maxScroll := len(p.state.Projects) - visibleCount
		if maxScroll < 0 {
			maxScroll = 0
		}
		if p.state.scrollOff > maxScroll {
			p.state.scrollOff = maxScroll
		}

		var itemsSB strings.Builder
		end := p.state.scrollOff + visibleCount
		if end > len(p.state.Projects) {
			end = len(p.state.Projects)
		}
		for i := p.state.scrollOff; i < end; i++ {
			proj := p.state.Projects[i]
			selected := i == p.state.SelectedProject
			isCurrent := proj.Path == p.ctx.ProjectDir
			itemsSB.WriteString(p.renderProjectItem(proj, selected, isCurrent, maxWidth-1))
			if i < end-1 {
				itemsSB.WriteString("\n")
			}
		}

		itemsContent := itemsSB.String()
		scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
			TotalItems:   len(p.state.Projects),
			ScrollOffset: p.state.scrollOff,
			VisibleItems: visibleCount,
			TrackHeight:  visibleCount * itemHeight,
		})
		sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, itemsContent, scrollbar))
	}

	return sb.String()
}

// renderProjectItem renders a single project list entry (2 lines).
func (p *WorkspacesPlugin) renderProjectItem(proj ProjectInfo, selected, isCurrent bool, width int) string {
	// Status icon
	var icon string
	if isCurrent {
		icon = styles.CurrentStyle.Render("●")
	} else if selected {
		icon = styles.InfoStyle.Render("▸")
	} else {
		icon = styles.DimStyle.Render("○")
	}

	// Name, truncated
	name := proj.Name
	maxNameWidth := width - 4 // icon + space + margin
	if maxNameWidth < 4 {
		maxNameWidth = 4
	}
	if len([]rune(name)) > maxNameWidth {
		name = string([]rune(name)[:maxNameWidth-1]) + "…"
	}

	// Progress bar (8 chars wide)
	progress := renderProgressBar(proj.StoriesComplete, proj.StoriesTotal, 8)

	// Line 1: icon + name + progress
	line1 := fmt.Sprintf(" %s %s  %s", icon, name, progress)

	// Line 2: branch + story counts
	branch := proj.Branch
	maxBranchLen := width - 16
	if maxBranchLen < 4 {
		maxBranchLen = 4
	}
	if len(branch) > maxBranchLen {
		branch = "…" + branch[len(branch)-(maxBranchLen-1):]
	}
	storyInfo := fmt.Sprintf("%d/%d stories", proj.StoriesComplete, proj.StoriesTotal)
	line2 := fmt.Sprintf("    %s  %s", branch, storyInfo)
	// Truncate line2
	if len([]rune(line2)) > width {
		line2 = string([]rune(line2)[:width-1]) + "…"
	}

	content := line1 + "\n" + line2

	if selected {
		return styles.CurrentStyle.Width(width).Render(content)
	}
	return styles.DimStyle.Width(width).Render(content)
}

// renderEpicItem renders a single epic list entry (2 lines).
func (p *WorkspacesPlugin) renderEpicItem(epic EpicInfo, selected bool, width int) string {
	var icon string
	if selected {
		icon = styles.InfoStyle.Render("▸")
	} else {
		icon = styles.DimStyle.Render("○")
	}

	// Name, truncated
	name := epic.Name
	maxNameWidth := width - 4
	if maxNameWidth < 4 {
		maxNameWidth = 4
	}
	if len([]rune(name)) > maxNameWidth {
		name = string([]rune(name)[:maxNameWidth-1]) + "…"
	}

	progress := renderProgressBar(epic.CompletedCount, epic.StoryCount, 8)
	line1 := fmt.Sprintf(" %s %s  %s", icon, name, progress)

	storyInfo := fmt.Sprintf("    %d/%d stories", epic.CompletedCount, epic.StoryCount)
	if len([]rune(storyInfo)) > width {
		storyInfo = string([]rune(storyInfo)[:width-1]) + "…"
	}
	line2 := storyInfo

	content := line1 + "\n" + line2

	if selected {
		return styles.CurrentStyle.Width(width).Render(content)
	}
	return styles.DimStyle.Width(width).Render(content)
}

// renderProgressBar returns an ASCII progress bar: [████░░░░]
func renderProgressBar(done, total, width int) string {
	if total <= 0 {
		bar := strings.Repeat("░", width)
		return styles.DimStyle.Render("[" + bar + "]")
	}
	filled := (done * width) / total
	if filled > width {
		filled = width
	}
	empty := width - filled
	bar := strings.Repeat("█", filled) + strings.Repeat("░", empty)
	pct := (done * 100) / total
	barStr := fmt.Sprintf("[%s] %d%%", bar, pct)
	if done >= total {
		return styles.SuccessStyle.Render(barStr)
	}
	if done > 0 {
		return styles.InfoStyle.Render(barStr)
	}
	return styles.DimStyle.Render(barStr)
}

// renderPreviewPane renders the right pane with tabbed project details.
func (p *WorkspacesPlugin) renderPreviewPane(innerHeight int) string {
	var sb strings.Builder

	contentWidth := p.state.previewWidth - 4 // panel border + padding
	if contentWidth < 20 {
		contentWidth = 20
	}

	// If in worktree or kanban mode, show worktree info
	if p.state.ViewMode == ViewModeWorktrees || p.state.ViewMode == ViewModeKanban {
		return p.renderWorktreePreview(innerHeight, contentWidth)
	}

	// Determine what we're previewing
	var proj *ProjectInfo
	var epic *EpicInfo
	if p.state.EpicsView && p.state.SelectedProject < len(p.state.Projects) {
		p2 := p.state.Projects[p.state.SelectedProject]
		proj = &p2
		if p.state.SelectedEpic < len(proj.Epics) {
			e := proj.Epics[p.state.SelectedEpic]
			epic = &e
		}
	} else if !p.state.EpicsView && p.state.SelectedProject < len(p.state.Projects) {
		p2 := p.state.Projects[p.state.SelectedProject]
		proj = &p2
	}

	// Tab bar: [Info] [Stories] [Progress]
	tabNames := []string{"Info", "Stories", "Progress"}
	var tabBar strings.Builder
	for i, name := range tabNames {
		label := fmt.Sprintf(" %s ", name)
		if i == p.state.previewTab {
			tabBar.WriteString(styles.CurrentStyle.Render(label))
		} else {
			tabBar.WriteString(styles.DimStyle.Render(label))
		}
		if i < len(tabNames)-1 {
			tabBar.WriteString(styles.DimStyle.Render("│"))
		}
	}
	sb.WriteString(tabBar.String())
	sb.WriteString("\n\n")

	// Content area height (subtract tab bar + blank line)
	contentHeight := innerHeight - 2
	if contentHeight < 1 {
		contentHeight = 1
	}

	if proj == nil {
		sb.WriteString(styles.DimStyle.Render("No project selected"))
		return sb.String()
	}

	switch p.state.previewTab {
	case 0:
		sb.WriteString(p.renderInfoTab(proj, epic, contentWidth, contentHeight))
	case 1:
		sb.WriteString(p.renderStoriesTab(proj, epic, contentWidth, contentHeight))
	case 2:
		sb.WriteString(p.renderProgressTab(proj, epic, contentWidth, contentHeight))
	}

	return sb.String()
}

// renderWorktreePreview renders worktree details in the preview pane (W-1).
func (p *WorkspacesPlugin) renderWorktreePreview(innerHeight, contentWidth int) string {
	var lines []string

	lines = append(lines, styles.TitleStyle.Render("Worktree Details"))
	lines = append(lines, "")

	if p.state.SelectedWorktree >= len(p.state.Worktrees) {
		lines = append(lines, styles.DimStyle.Render("No worktree selected"))
		return strings.Join(lines, "\n")
	}

	wt := p.state.Worktrees[p.state.SelectedWorktree]

	// Branch
	branch := wt.Branch
	if wt.IsBare {
		branch = "(bare repository)"
	} else if branch == "" {
		branch = "(detached HEAD)"
	}
	lines = append(lines, styles.DimStyle.Render("Branch:  ")+styles.InfoStyle.Render(branch))

	// Path
	lines = append(lines, styles.DimStyle.Render("Path:    ")+p.truncatePath(wt.Path, contentWidth-10))

	// HEAD
	if wt.HEAD != "" {
		lines = append(lines, styles.DimStyle.Render("HEAD:    ")+wt.HEAD)
	}

	// Type
	var typeStr string
	if wt.IsMain {
		typeStr = "Main worktree"
	} else {
		typeStr = "Linked worktree"
	}
	if wt.IsBare {
		typeStr = "Bare repository"
	}
	if wt.Prunable {
		typeStr += " (prunable)"
	}
	lines = append(lines, styles.DimStyle.Render("Type:    ")+typeStr)

	lines = append(lines, "")

	// Actions hint
	if !wt.IsMain {
		lines = append(lines, styles.DimStyle.Render("Press 'd' to delete this worktree"))
	} else {
		lines = append(lines, styles.DimStyle.Render("Main worktree cannot be deleted"))
	}
	lines = append(lines, styles.DimStyle.Render("Press 'n' to create a new worktree"))

	// Clamp with scroll
	start := p.state.previewScroll
	if start < 0 {
		start = 0
	}
	if start >= len(lines) && len(lines) > 0 {
		start = len(lines) - 1
	}
	end := start + innerHeight
	if end > len(lines) {
		end = len(lines)
	}
	visible := lines[start:end]

	return strings.Join(visible, "\n")
}

// renderInfoTab renders the Info tab showing project/epic metadata.
func (p *WorkspacesPlugin) renderInfoTab(proj *ProjectInfo, epic *EpicInfo, width, height int) string {
	var lines []string

	isCurrent := proj.Path == p.ctx.ProjectDir

	if epic != nil {
		// Epic info
		lines = append(lines, styles.TitleStyle.Render("Epic"))
		lines = append(lines, styles.DimStyle.Render("Name:    ")+epic.Name)
		lines = append(lines, styles.DimStyle.Render("Project: ")+proj.Name)
		lines = append(lines, styles.DimStyle.Render("Stories: ")+
			styles.SuccessStyle.Render(fmt.Sprintf("%d/%d complete", epic.CompletedCount, epic.StoryCount)))
		lines = append(lines, styles.DimStyle.Render("Path:    ")+p.truncatePath(epic.StoriesPath, width-10))
		lines = append(lines, "")
		lines = append(lines, renderProgressBar(epic.CompletedCount, epic.StoryCount, width-4))
	} else {
		// Project info
		title := "Project"
		if isCurrent {
			title = "Project (current)"
		}
		lines = append(lines, styles.TitleStyle.Render(title))
		lines = append(lines, "")
		lines = append(lines, styles.DimStyle.Render("Name:   ")+proj.Name)
		lines = append(lines, styles.DimStyle.Render("Path:   ")+p.truncatePath(proj.Path, width-9))
		lines = append(lines, styles.DimStyle.Render("Branch: ")+
			styles.InfoStyle.Render(proj.Branch))
		lines = append(lines, "")
		lines = append(lines, styles.DimStyle.Render("Stories:")+
			styles.SuccessStyle.Render(fmt.Sprintf(" %d/%d complete", proj.StoriesComplete, proj.StoriesTotal)))
		lines = append(lines, "")
		lines = append(lines, renderProgressBar(proj.StoriesComplete, proj.StoriesTotal, width-4))
		lines = append(lines, "")
		if len(proj.Epics) > 0 {
			lines = append(lines, styles.DimStyle.Render(fmt.Sprintf("Epics:  %d discovered", len(proj.Epics))))
		} else {
			lines = append(lines, styles.DimStyle.Render("Epics:  flat structure (no epics)"))
		}
	}

	// Clamp to visible height with scroll
	start := p.state.previewScroll
	if start < 0 {
		start = 0
	}
	if start >= len(lines) && len(lines) > 0 {
		start = len(lines) - 1
	}
	end := start + height
	if end > len(lines) {
		end = len(lines)
	}
	visible := lines[start:end]

	return strings.Join(visible, "\n")
}

// renderStoriesTab renders the Stories tab listing stories for the selected project/epic.
func (p *WorkspacesPlugin) renderStoriesTab(proj *ProjectInfo, epic *EpicInfo, width, height int) string {
	var lines []string

	// Determine which stories file to load
	var storiesPath string
	if epic != nil {
		storiesPath = epic.StoriesPath
	} else if len(proj.Epics) > 0 {
		// Show stories from first epic
		storiesPath = proj.Epics[0].StoriesPath
	} else {
		// Flat structure
		storiesPath = filepath.Join(proj.Path, ".prism", "stories", "stories.json")
	}

	storiesFile, err := domain.LoadStoriesFile(storiesPath)
	if err != nil {
		lines = append(lines, styles.DimStyle.Render("No stories file found"))
		lines = append(lines, "")
		lines = append(lines, styles.DimStyle.Render("Expected: "+p.truncatePath(storiesPath, width-3)))
	} else {
		if epic != nil {
			lines = append(lines, styles.TitleStyle.Render(fmt.Sprintf("Stories: %s", epic.Name)))
		} else {
			lines = append(lines, styles.TitleStyle.Render("Stories"))
		}
		lines = append(lines, "")

		for _, story := range storiesFile.Stories {
			var icon string
			switch story.Status {
			case "complete":
				icon = styles.SuccessStyle.Render("✓")
			case "in_progress":
				icon = styles.InfoStyle.Render("▸")
			case "blocked":
				icon = styles.WarningStyle.Render("⊘")
			default:
				icon = styles.DimStyle.Render("○")
			}

			id := story.ID
			title := story.Title
			maxTitleWidth := width - len(id) - 5
			if maxTitleWidth < 8 {
				maxTitleWidth = 8
			}
			if len([]rune(title)) > maxTitleWidth {
				title = string([]rune(title)[:maxTitleWidth-1]) + "…"
			}
			lines = append(lines, fmt.Sprintf(" %s %s %s", icon, styles.DimStyle.Render(id), title))
		}
	}

	// Clamp with scroll
	start := p.state.previewScroll
	if start < 0 {
		start = 0
	}
	if start >= len(lines) && len(lines) > 0 {
		start = len(lines) - 1
	}
	end := start + height
	if end > len(lines) {
		end = len(lines)
	}
	visible := lines[start:end]

	return strings.Join(visible, "\n")
}

// renderProgressTab renders the Progress tab with phase/epic summary.
func (p *WorkspacesPlugin) renderProgressTab(proj *ProjectInfo, epic *EpicInfo, width, height int) string {
	var lines []string

	if epic != nil {
		lines = append(lines, styles.TitleStyle.Render("Epic Progress"))
		lines = append(lines, "")
		pct := 0
		if epic.StoryCount > 0 {
			pct = (epic.CompletedCount * 100) / epic.StoryCount
		}
		lines = append(lines, fmt.Sprintf(" Complete: %d%% (%d/%d stories)", pct, epic.CompletedCount, epic.StoryCount))
		lines = append(lines, "")
		lines = append(lines, " "+renderProgressBar(epic.CompletedCount, epic.StoryCount, width-6))
	} else {
		lines = append(lines, styles.TitleStyle.Render("Project Progress"))
		lines = append(lines, "")
		pct := 0
		if proj.StoriesTotal > 0 {
			pct = (proj.StoriesComplete * 100) / proj.StoriesTotal
		}
		lines = append(lines, fmt.Sprintf(" Total:    %d%% (%d/%d stories)", pct, proj.StoriesComplete, proj.StoriesTotal))
		lines = append(lines, "")
		lines = append(lines, " "+renderProgressBar(proj.StoriesComplete, proj.StoriesTotal, width-6))
		lines = append(lines, "")

		if len(proj.Epics) > 0 {
			lines = append(lines, styles.DimStyle.Render("Epics:"))
			for _, e := range proj.Epics {
				ePct := 0
				if e.StoryCount > 0 {
					ePct = (e.CompletedCount * 100) / e.StoryCount
				}
				bar := renderProgressBar(e.CompletedCount, e.StoryCount, 8)
				epicName := e.Name
				maxENameWidth := width - 20
				if maxENameWidth < 6 {
					maxENameWidth = 6
				}
				if len([]rune(epicName)) > maxENameWidth {
					epicName = string([]rune(epicName)[:maxENameWidth-1]) + "…"
				}
				lines = append(lines, fmt.Sprintf("  %-*s %s %d%%", maxENameWidth, epicName, bar, ePct))
			}
		}
	}

	// Clamp with scroll
	start := p.state.previewScroll
	if start < 0 {
		start = 0
	}
	if start >= len(lines) && len(lines) > 0 {
		start = len(lines) - 1
	}
	end := start + height
	if end > len(lines) {
		end = len(lines)
	}
	visible := lines[start:end]

	return strings.Join(visible, "\n")
}

// ── Kanban Board (W-4) ─────────────────────────────────────────────────────────

// kanbanColumnNames are the column headers for the kanban board (W-4).
var kanbanColumnNames = []string{"Active", "Thinking", "Waiting", "Done", "Paused"}

// kanbanStatusForColumn maps column index to the status value.
var kanbanStatusForColumn = []string{"active", "thinking", "waiting", "done", "paused"}

// kanbanColumns groups worktrees into kanban columns by their agent status (W-4).
// Worktrees without an agent status entry are placed in "Waiting".
func (p *WorkspacesPlugin) kanbanColumns() [][]WorktreeInfo {
	columns := make([][]WorktreeInfo, len(kanbanColumnNames))
	for _, wt := range p.state.Worktrees {
		info, hasAgent := p.state.agentStatuses[wt.Path]
		colIdx := 2 // default: Waiting
		if hasAgent {
			for ci, s := range kanbanStatusForColumn {
				if info.Status == s {
					colIdx = ci
					break
				}
			}
		}
		columns[colIdx] = append(columns[colIdx], wt)
	}
	return columns
}

// renderKanbanBoard renders the kanban board in the sidebar pane (W-4).
func (p *WorkspacesPlugin) renderKanbanBoard(innerHeight int) string {
	var sb strings.Builder

	maxWidth := p.state.sidebarWidth - 4
	if maxWidth < 8 {
		maxWidth = 8
	}

	sb.WriteString(styles.TitleStyle.Render("Kanban"))
	sb.WriteString("\n\n")

	columns := p.kanbanColumns()

	if len(p.state.Worktrees) == 0 {
		sb.WriteString(styles.DimStyle.Render("No worktrees found"))
		sb.WriteString("\n")
		sb.WriteString(styles.DimStyle.Render("Press 'w' for projects view"))
		return sb.String()
	}

	// Render columns vertically stacked (sidebar is narrow)
	linesWritten := 2 // header + blank
	for ci, colName := range kanbanColumnNames {
		if linesWritten >= innerHeight-1 {
			break
		}
		cards := columns[ci]

		// Column header with count
		isActiveCol := ci == p.state.kanbanCol
		colHeader := fmt.Sprintf("── %s (%d) ──", colName, len(cards))
		if isActiveCol {
			sb.WriteString(styles.InfoStyle.Render(colHeader))
		} else {
			sb.WriteString(styles.DimStyle.Render(colHeader))
		}
		sb.WriteString("\n")
		linesWritten++

		if len(cards) == 0 {
			sb.WriteString(styles.DimStyle.Render("  (empty)"))
			sb.WriteString("\n")
			linesWritten++
		} else {
			for ri, wt := range cards {
				if linesWritten >= innerHeight-1 {
					break
				}
				selected := isActiveCol && ri == p.state.kanbanRow

				// Status icon
				var icon string
				agentInfo, hasAgent := p.state.agentStatuses[wt.Path]
				switch {
				case hasAgent && agentInfo.Status == "active":
					icon = "●"
				case hasAgent && agentInfo.Status == "thinking":
					icon = "◉"
				case hasAgent && agentInfo.Status == "waiting":
					icon = "○"
				case hasAgent && agentInfo.Status == "done":
					icon = "✓"
				case hasAgent && agentInfo.Status == "paused":
					icon = "⏸"
				default:
					icon = "○"
				}

				branch := wt.Branch
				if branch == "" {
					branch = "(detached)"
				}
				agentLabel := ""
				if hasAgent && agentInfo.AgentType != "" {
					agentLabel = " [" + agentInfo.AgentType + "]"
				}

				cardText := fmt.Sprintf("  %s %s%s", icon, branch, agentLabel)
				maxCardWidth := maxWidth - 1
				if len([]rune(cardText)) > maxCardWidth && maxCardWidth > 5 {
					cardText = string([]rune(cardText)[:maxCardWidth-1]) + "…"
				}

				if selected {
					// Pad for highlight
					if lipgloss.Width(cardText) < maxWidth {
						cardText += strings.Repeat(" ", maxWidth-lipgloss.Width(cardText))
					}
					sb.WriteString(styles.CurrentStyle.Render(cardText))
				} else {
					sb.WriteString(styles.DimStyle.Render(cardText))
				}
				sb.WriteString("\n")
				linesWritten++
			}
		}
	}

	return sb.String()
}

// handleKanbanKey handles navigation within the kanban board (W-4).
func (p *WorkspacesPlugin) handleKanbanKey(key string) (plugin.Plugin, tea.Cmd) {
	columns := p.kanbanColumns()

	switch key {
	case "h", "left":
		// Move to previous column
		if p.state.kanbanCol > 0 {
			p.state.kanbanCol--
			p.state.kanbanRow = 0
		}
		return p, nil

	case "l", "right":
		// Move to next column
		if p.state.kanbanCol < len(kanbanColumnNames)-1 {
			p.state.kanbanCol++
			p.state.kanbanRow = 0
		}
		return p, nil

	case "j", "down":
		// Move down within column
		col := p.state.kanbanCol
		if col < len(columns) && len(columns[col]) > 0 {
			if p.state.kanbanRow < len(columns[col])-1 {
				p.state.kanbanRow++
			}
		}
		return p, nil

	case "k", "up":
		// Move up within column
		if p.state.kanbanRow > 0 {
			p.state.kanbanRow--
		}
		return p, nil

	case "enter":
		// Select card → show detail in preview pane
		col := p.state.kanbanCol
		if col < len(columns) && p.state.kanbanRow < len(columns[col]) {
			wt := columns[col][p.state.kanbanRow]
			// Find the worktree index to sync selection for preview
			for i, w := range p.state.Worktrees {
				if w.Path == wt.Path {
					p.state.SelectedWorktree = i
					break
				}
			}
			p.state.activePane = ui.PaneRight
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// truncatePath shortens a path to fit within maxLen, keeping the tail.
func (p *WorkspacesPlugin) truncatePath(path string, maxLen int) string {
	if len(path) <= maxLen {
		return path
	}
	if maxLen < 4 {
		return path[:maxLen]
	}
	return "…" + path[len(path)-(maxLen-1):]
}

// ── Input handling ─────────────────────────────────────────────────────────────

// handleKeyPress handles keyboard input with pane-aware routing.
func (p *WorkspacesPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
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

	// Global keys
	switch key {
	case "r":
		if p.state.activePane == ui.PaneLeft {
			p.state.Loading = true
			if p.state.ViewMode == ViewModeWorktrees {
				return p, p.loadWorktreesCmd()
			}
			return p, p.scanProjects()
		}
	case "w":
		// Toggle between projects and worktrees view (W-1)
		if p.state.activePane == ui.PaneLeft && !p.state.EpicsView {
			if p.state.ViewMode == ViewModeProjects {
				p.state.ViewMode = ViewModeWorktrees
				p.state.scrollOff = 0
			} else if p.state.ViewMode == ViewModeKanban {
				p.state.ViewMode = ViewModeProjects
				p.state.scrollOff = 0
			} else {
				p.state.ViewMode = ViewModeProjects
				p.state.scrollOff = 0
			}
			return p, nil
		}
	case "v":
		// Toggle between List and Kanban views (W-4)
		if p.state.activePane == ui.PaneLeft && !p.state.EpicsView {
			if p.state.ViewMode == ViewModeKanban {
				p.state.ViewMode = ViewModeWorktrees
				p.state.scrollOff = 0
			} else {
				p.state.ViewMode = ViewModeKanban
				p.state.kanbanCol = 0
				p.state.kanbanRow = 0
			}
			return p, nil
		}
	}

	if p.state.activePane == ui.PaneRight {
		return p.handlePreviewKey(key)
	}

	// Route to view-mode-specific handler
	if p.state.ViewMode == ViewModeKanban {
		return p.handleKanbanKey(key)
	}
	if p.state.ViewMode == ViewModeWorktrees {
		return p.handleWorktreeKey(key)
	}
	return p.handleSidebarKey(key)
}

// handleWorktreeKey handles keys when in worktree view mode (W-1).
func (p *WorkspacesPlugin) handleWorktreeKey(key string) (plugin.Plugin, tea.Cmd) {
	switch key {
	case "j", "down":
		if len(p.state.Worktrees) > 0 && p.state.SelectedWorktree < len(p.state.Worktrees)-1 {
			p.state.SelectedWorktree++
			p.clampWorktreeScroll()
		}
		return p, nil

	case "k", "up":
		if p.state.SelectedWorktree > 0 {
			p.state.SelectedWorktree--
			p.clampWorktreeScroll()
		}
		return p, nil

	case "n":
		// Create new worktree (W-2)
		return p, p.openCreateWorktreeModal()

	case "d":
		// Delete selected worktree (W-3)
		if p.state.SelectedWorktree < len(p.state.Worktrees) {
			wt := p.state.Worktrees[p.state.SelectedWorktree]
			if wt.IsMain {
				return p, p.openErrorModal("Cannot delete the main worktree")
			}
			return p, p.openDeleteWorktreeConfirm(wt)
		}
		return p, nil

	case "enter":
		// Switch to worktree directory
		if p.state.SelectedWorktree < len(p.state.Worktrees) {
			wt := p.state.Worktrees[p.state.SelectedWorktree]
			return p, p.switchToWorktreeDir(wt)
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// handleSidebarKey handles keys when the left (project list) pane is focused.
func (p *WorkspacesPlugin) handleSidebarKey(key string) (plugin.Plugin, tea.Cmd) {
	if p.state.EpicsView {
		return p.handleEpicsViewKey(key)
	}
	return p.handleProjectsViewKey(key)
}

// handleProjectsViewKey handles navigation within the project list.
func (p *WorkspacesPlugin) handleProjectsViewKey(key string) (plugin.Plugin, tea.Cmd) {
	switch key {
	case "j", "down":
		if len(p.state.Projects) > 0 && p.state.SelectedProject < len(p.state.Projects)-1 {
			p.state.SelectedProject++
			p.clampProjectScroll()
		}
		return p, nil

	case "k", "up":
		if p.state.SelectedProject > 0 {
			p.state.SelectedProject--
			p.clampProjectScroll()
		}
		return p, nil

	case "enter":
		if p.state.SelectedProject < len(p.state.Projects) {
			project := p.state.Projects[p.state.SelectedProject]
			if len(project.Epics) > 0 {
				p.state.EpicsView = true
				p.state.SelectedEpic = 0
				p.state.scrollOff = 0
				p.state.previewScroll = 0
			} else {
				return p, p.switchToProject()
			}
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// handleEpicsViewKey handles navigation within the epics list.
func (p *WorkspacesPlugin) handleEpicsViewKey(key string) (plugin.Plugin, tea.Cmd) {
	var epics []EpicInfo
	if p.state.SelectedProject < len(p.state.Projects) {
		epics = p.state.Projects[p.state.SelectedProject].Epics
	}

	switch key {
	case "j", "down":
		if len(epics) > 0 && p.state.SelectedEpic < len(epics)-1 {
			p.state.SelectedEpic++
			p.clampEpicScroll(len(epics))
		}
		return p, nil

	case "k", "up":
		if p.state.SelectedEpic > 0 {
			p.state.SelectedEpic--
			p.clampEpicScroll(len(epics))
		}
		return p, nil

	case "enter":
		return p, p.switchToEpic()

	case "esc", "backspace":
		p.state.EpicsView = false
		p.state.SelectedEpic = 0
		p.state.scrollOff = 0
		p.state.previewScroll = 0
		return p, nil
	}

	return p, nil
}

// handlePreviewKey handles keys when the right (preview) pane is focused.
func (p *WorkspacesPlugin) handlePreviewKey(key string) (plugin.Plugin, tea.Cmd) {
	const numTabs = 3
	switch key {
	case "[", "shift+tab":
		p.state.previewTab = (p.state.previewTab - 1 + numTabs) % numTabs
		p.state.previewScroll = 0
		return p, nil

	case "]":
		p.state.previewTab = (p.state.previewTab + 1) % numTabs
		p.state.previewScroll = 0
		return p, nil

	case "j", "down":
		p.state.previewScroll++
		return p, nil

	case "k", "up":
		if p.state.previewScroll > 0 {
			p.state.previewScroll--
		}
		return p, nil

	case "esc":
		p.state.activePane = ui.PaneLeft
		return p, nil
	}

	return p, nil
}

// handleModalAction handles modal button/list actions
func (p *WorkspacesPlugin) handleModalAction(msg ModalActionMsg) (plugin.Plugin, tea.Cmd) {
	switch msg.Action {
	case "wt-create":
		// Worktree creation confirmed (W-2) — extract branch name from modal inputs
		branchName := ""
		if msg.Inputs != nil {
			branchName = msg.Inputs["wt-branch"]
		}
		if branchName == "" {
			return p, p.openErrorModal("Branch name is required")
		}
		return p, p.createWorktreeCmd(branchName)
	case "wt-delete-confirm":
		// Worktree deletion confirmed (W-3)
		if p.state.pendingDeletePath != "" {
			path := p.state.pendingDeletePath
			deleteBranch := p.state.deleteBranch
			p.state.pendingDeletePath = ""
			p.state.deleteBranch = false
			return p, p.deleteWorktreeCmd(path, deleteBranch)
		}
		return p, nil
	}
	return p, nil
}

// clampProjectScroll keeps the selected project within the visible window.
func (p *WorkspacesPlugin) clampProjectScroll() {
	const itemHeight = 2
	const headerLines = 2
	paneHeight := p.height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	listAreaHeight := innerHeight - headerLines
	visibleCount := listAreaHeight / itemHeight
	if visibleCount < 1 {
		visibleCount = 1
	}

	sel := p.state.SelectedProject
	if sel < p.state.scrollOff {
		p.state.scrollOff = sel
	} else if sel >= p.state.scrollOff+visibleCount {
		p.state.scrollOff = sel - visibleCount + 1
	}
}

// clampEpicScroll keeps the selected epic within the visible window.
func (p *WorkspacesPlugin) clampEpicScroll(totalEpics int) {
	const itemHeight = 2
	const headerLines = 2
	paneHeight := p.height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	listAreaHeight := innerHeight - headerLines
	visibleCount := listAreaHeight / itemHeight
	if visibleCount < 1 {
		visibleCount = 1
	}

	sel := p.state.SelectedEpic
	if sel < p.state.scrollOff {
		p.state.scrollOff = sel
	} else if sel >= p.state.scrollOff+visibleCount {
		p.state.scrollOff = sel - visibleCount + 1
	}
}

// clampWorktreeScroll keeps the selected worktree within the visible window (W-1).
func (p *WorkspacesPlugin) clampWorktreeScroll() {
	const itemHeight = 2
	const headerLines = 2
	paneHeight := p.height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	listAreaHeight := innerHeight - headerLines
	visibleCount := listAreaHeight / itemHeight
	if visibleCount < 1 {
		visibleCount = 1
	}

	sel := p.state.SelectedWorktree
	if sel < p.state.scrollOff {
		p.state.scrollOff = sel
	} else if sel >= p.state.scrollOff+visibleCount {
		p.state.scrollOff = sel - visibleCount + 1
	}
}

// ── Data loading ───────────────────────────────────────────────────────────────

// loadWorktreesCmd runs `git worktree list --porcelain` and parses the output (W-1).
func (p *WorkspacesPlugin) loadWorktreesCmd() tea.Cmd {
	gitRoot := p.ctx.GitRoot
	if gitRoot == "" {
		gitRoot = p.ctx.ProjectDir
	}
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		if gitRoot == "" || gitRoot == "demo" {
			return WorktreeListLoadedMsg{Worktrees: nil, Error: fmt.Errorf("no git root"), Epoch: epoch}
		}

		cmd := exec.Command("git", "-C", gitRoot, "worktree", "list", "--porcelain")
		out, err := cmd.Output()
		if err != nil {
			return WorktreeListLoadedMsg{Error: err, Epoch: epoch}
		}

		worktrees := parseWorktreeListPorcelain(string(out))
		return WorktreeListLoadedMsg{Worktrees: worktrees, Epoch: epoch}
	}
}

// parseWorktreeListPorcelain parses `git worktree list --porcelain` output.
// Each worktree is a block of lines separated by a blank line.
// Format:
//
//	worktree /path/to/worktree
//	HEAD abc123def456
//	branch refs/heads/branch-name
//	<blank line>
func parseWorktreeListPorcelain(output string) []WorktreeInfo {
	var worktrees []WorktreeInfo
	blocks := strings.Split(strings.TrimSpace(output), "\n\n")

	for i, block := range blocks {
		if strings.TrimSpace(block) == "" {
			continue
		}

		wt := WorktreeInfo{IsMain: i == 0}
		lines := strings.Split(block, "\n")

		for _, line := range lines {
			line = strings.TrimSpace(line)
			switch {
			case strings.HasPrefix(line, "worktree "):
				wt.Path = strings.TrimPrefix(line, "worktree ")
			case strings.HasPrefix(line, "HEAD "):
				wt.HEAD = strings.TrimPrefix(line, "HEAD ")
			case strings.HasPrefix(line, "branch "):
				ref := strings.TrimPrefix(line, "branch ")
				// Strip refs/heads/ prefix
				wt.Branch = strings.TrimPrefix(ref, "refs/heads/")
			case line == "bare":
				wt.IsBare = true
			case line == "prunable":
				wt.Prunable = true
			case line == "detached":
				wt.Branch = ""
			}
		}

		if wt.Path != "" {
			worktrees = append(worktrees, wt)
		}
	}

	return worktrees
}

// scanProjects scans for .prism/ directories in parent and sibling directories
func (p *WorkspacesPlugin) scanProjects() tea.Cmd {
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		var projects []ProjectInfo

		// Get current project directory
		currentDir := p.ctx.ProjectDir

		// Search in parent directory and siblings
		parentDir := filepath.Dir(currentDir)

		// Read parent directory
		entries, err := os.ReadDir(parentDir)
		if err != nil {
			// If can't read parent, just return current project
			projects = append(projects, p.scanProject(currentDir))
			return ProjectsScanCompleteMsg{Projects: projects, Epoch: epoch}
		}

		// Check each sibling directory for .prism/
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			projectPath := filepath.Join(parentDir, entry.Name())
			prismPath := filepath.Join(projectPath, ".prism")

			// Check if .prism/ exists
			if stat, err := os.Stat(prismPath); err == nil && stat.IsDir() {
				project := p.scanProject(projectPath)
				projects = append(projects, project)
			}
		}

		// Merge projects from global workspace registry
		if globalEntries, err := registry.LoadAll(); err == nil {
			seen := make(map[string]bool)
			for _, proj := range projects {
				seen[filepath.Clean(proj.Path)] = true
			}
			for _, entry := range globalEntries {
				cleanPath := filepath.Clean(entry.Path)
				if seen[cleanPath] {
					continue
				}
				prismPath := filepath.Join(entry.Path, ".prism")
				if stat, statErr := os.Stat(prismPath); statErr == nil && stat.IsDir() {
					project := p.scanProject(entry.Path)
					projects = append(projects, project)
				}
			}
		}

		// Sort projects by name
		for i := 0; i < len(projects); i++ {
			for j := i + 1; j < len(projects); j++ {
				if projects[i].Name > projects[j].Name {
					projects[i], projects[j] = projects[j], projects[i]
				}
			}
		}

		return ProjectsScanCompleteMsg{Projects: projects, Epoch: epoch}
	}
}

// scanProject scans a single project directory for metadata
func (p *WorkspacesPlugin) scanProject(projectPath string) ProjectInfo {
	project := ProjectInfo{
		Name:   filepath.Base(projectPath),
		Path:   projectPath,
		Branch: "unknown",
	}

	// Get git branch
	cmd := exec.Command("git", "-C", projectPath, "rev-parse", "--abbrev-ref", "HEAD")
	if output, err := cmd.Output(); err == nil {
		project.Branch = strings.TrimSpace(string(output))
	}

	// Scan for stories.json in epics structure
	storiesDir := filepath.Join(projectPath, ".prism", "stories")
	if entries, err := os.ReadDir(storiesDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			epicPath := filepath.Join(storiesDir, entry.Name())
			storiesPath := filepath.Join(epicPath, "stories.json")

			// Check if stories.json exists
			if _, err := os.Stat(storiesPath); err == nil {
				// Parse stories to get count
				storyCount, completedCount := p.countStories(storiesPath)

				epic := EpicInfo{
					Name:           entry.Name(),
					StoriesPath:    storiesPath,
					StoryCount:     storyCount,
					CompletedCount: completedCount,
				}
				project.Epics = append(project.Epics, epic)
				project.StoriesTotal += storyCount
				project.StoriesComplete += completedCount
			}
		}
	}

	// Check for flat structure (legacy)
	flatStoriesPath := filepath.Join(storiesDir, "stories.json")
	if _, err := os.Stat(flatStoriesPath); err == nil && len(project.Epics) == 0 {
		storyCount, completedCount := p.countStories(flatStoriesPath)
		project.StoriesTotal = storyCount
		project.StoriesComplete = completedCount
	}

	return project
}

// countStories parses stories.json and counts total/completed stories
func (p *WorkspacesPlugin) countStories(storiesPath string) (total int, completed int) {
	storiesFile, err := domain.LoadStoriesFile(storiesPath)
	if err != nil {
		return 0, 0
	}

	total = len(storiesFile.Stories)
	for _, story := range storiesFile.Stories {
		if story.Status == "complete" {
			completed++
		}
	}

	return total, completed
}

// switchToProject switches the active project
func (p *WorkspacesPlugin) switchToProject() tea.Cmd {
	if p.state.SelectedProject >= len(p.state.Projects) {
		return nil
	}

	project := p.state.Projects[p.state.SelectedProject]

	return func() tea.Msg {
		ctx := p.ctx
		ctx.ProjectDir = project.Path
		ctx.PrismDir = filepath.Join(project.Path, ".prism")

		if len(project.Epics) == 0 {
			ctx.StoriesPath = filepath.Join(ctx.PrismDir, "stories", "stories.json")
		} else {
			ctx.StoriesPath = project.Epics[0].StoriesPath
		}

		return SwitchProjectMsg{Context: ctx}
	}
}

// switchToEpic switches to the selected epic within the current project
func (p *WorkspacesPlugin) switchToEpic() tea.Cmd {
	if p.state.SelectedProject >= len(p.state.Projects) {
		return nil
	}

	project := p.state.Projects[p.state.SelectedProject]

	if p.state.SelectedEpic >= len(project.Epics) {
		return nil
	}

	epic := project.Epics[p.state.SelectedEpic]

	return func() tea.Msg {
		ctx := p.ctx
		ctx.StoriesPath = epic.StoriesPath
		return SwitchProjectMsg{Context: ctx}
	}
}

// switchToWorktreeDir switches to a worktree's directory (W-1).
func (p *WorkspacesPlugin) switchToWorktreeDir(wt WorktreeInfo) tea.Cmd {
	return func() tea.Msg {
		ctx := p.ctx
		ctx.ProjectDir = wt.Path
		prismDir := filepath.Join(wt.Path, ".prism")
		if _, err := os.Stat(prismDir); err == nil {
			ctx.PrismDir = prismDir
		}
		return SwitchProjectMsg{Context: ctx}
	}
}

// ── Worktree Operations (W-2, W-3) ────────────────────────────────────────────

// openCreateWorktreeModal opens a modal for creating a new worktree (W-2).
func (p *WorkspacesPlugin) openCreateWorktreeModal() tea.Cmd {
	return func() tea.Msg {
		m := modal.New("Create Worktree", modal.WithWidth(60)).
			AddSection(modal.Text("Create a new git worktree with a new branch.")).
			AddSection(modal.Spacer()).
			AddSection(modal.Input("wt-branch", "Branch name:", "feature/my-branch",
				modal.WithSubmitOnEnter("wt-create"),
				modal.WithInputBorder(lipgloss.Color("#7C3AED")))).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(
				modal.Btn("Create", "wt-create", modal.BtnPrimary()),
				modal.Btn("Cancel", "cancel"),
			))
		return OpenModalMsg{Modal: m}
	}
}

// openDeleteWorktreeConfirm opens a danger confirmation modal for deleting a worktree (W-3).
func (p *WorkspacesPlugin) openDeleteWorktreeConfirm(wt WorktreeInfo) tea.Cmd {
	p.state.pendingDeletePath = wt.Path
	p.state.deleteBranch = false

	branchInfo := ""
	if wt.Branch != "" {
		branchInfo = fmt.Sprintf("\nBranch: %s", wt.Branch)
	}

	return func() tea.Msg {
		m := modal.New("Delete Worktree?", modal.WithVariant(modal.VariantDanger), modal.WithWidth(60)).
			AddSection(modal.Text(fmt.Sprintf("This will remove the worktree at:\n%s%s\n\nThis action cannot be undone.", wt.Path, branchInfo))).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(
				modal.Btn("Delete", "wt-delete-confirm", modal.BtnDanger()),
				modal.Btn("Cancel", "cancel"),
			))
		return OpenModalMsg{Modal: m}
	}
}

// openErrorModal opens a simple error notification modal.
func (p *WorkspacesPlugin) openErrorModal(msg string) tea.Cmd {
	return func() tea.Msg {
		m := modal.New("Error", modal.WithVariant(modal.VariantDanger), modal.WithWidth(50)).
			AddSection(modal.Text(msg)).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(modal.Btn("OK", "cancel")))
		return OpenModalMsg{Modal: m}
	}
}

// createWorktreeCmd creates a new git worktree (W-2).
func (p *WorkspacesPlugin) createWorktreeCmd(branchName string) tea.Cmd {
	gitRoot := p.ctx.GitRoot
	if gitRoot == "" {
		gitRoot = p.ctx.ProjectDir
	}
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		if branchName == "" {
			return WorktreeCreatedMsg{Error: fmt.Errorf("branch name is required"), Epoch: epoch}
		}

		// Create worktree as sibling: ../<repo>-<branch>
		repoName := filepath.Base(gitRoot)
		// Sanitize branch name for path (replace / with -)
		safeBranch := strings.ReplaceAll(branchName, "/", "-")
		worktreePath := filepath.Join(filepath.Dir(gitRoot), repoName+"-"+safeBranch)

		cmd := exec.Command("git", "-C", gitRoot, "worktree", "add", "-b", branchName, worktreePath)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return WorktreeCreatedMsg{Error: fmt.Errorf("%s: %s", err, string(out)), Epoch: epoch}
		}

		return WorktreeCreatedMsg{Path: worktreePath, Branch: branchName, Epoch: epoch}
	}
}

// deleteWorktreeCmd removes a git worktree (W-3).
func (p *WorkspacesPlugin) deleteWorktreeCmd(path string, deleteBranch bool) tea.Cmd {
	gitRoot := p.ctx.GitRoot
	if gitRoot == "" {
		gitRoot = p.ctx.ProjectDir
	}

	// Find branch name for the worktree before deleting
	var branchName string
	for _, wt := range p.state.Worktrees {
		if wt.Path == path {
			branchName = wt.Branch
			break
		}
	}

	epoch := p.ctx.Epoch
	return func() tea.Msg {
		// Remove the worktree
		cmd := exec.Command("git", "-C", gitRoot, "worktree", "remove", path)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return WorktreeDeletedMsg{Path: path, Error: fmt.Errorf("%s: %s", err, string(out)), Epoch: epoch}
		}

		// Optionally delete the branch
		if deleteBranch && branchName != "" {
			delCmd := exec.Command("git", "-C", gitRoot, "branch", "-D", branchName)
			delCmd.CombinedOutput() // Best effort, don't fail on branch delete
		}

		return WorktreeDeletedMsg{Path: path, Epoch: epoch}
	}
}

// ── Message types ──────────────────────────────────────────────────────────────

// ProjectsScanCompleteMsg signals that project scanning is complete
type ProjectsScanCompleteMsg struct {
	Projects []ProjectInfo
	Epoch    uint64
}

// SwitchProjectMsg signals that the active project/epic should be switched
type SwitchProjectMsg struct {
	Context *plugin.Context
}

// ── Helpers ────────────────────────────────────────────────────────────────────

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
