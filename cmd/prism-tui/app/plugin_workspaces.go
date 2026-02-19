package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/domain"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
	"github.com/prism-plugin/prism-tui/ui"
)

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

	// Two-pane layout state
	activePane    ui.FocusPane
	sidebarWidth  int
	previewWidth  int
	scrollOff     int // project/epic list scroll offset
	previewTab    int // 0=Info, 1=Stories, 2=Progress
	previewScroll int // vertical scroll offset within preview pane
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
	return nil
}

// Start is called when the plugin is first activated
func (p *WorkspacesPlugin) Start() tea.Cmd {
	// Scan for projects when activated
	return p.scanProjects()
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
		p.state.Projects = msg.Projects
		p.state.Loading = false
		return p, nil
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
		{Key: "tab", Description: "preview"},
		{Key: "r", Description: "rescan"},
		{Key: "esc", Description: "home"},
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

	sidebarContent := p.renderProjectList(innerHeight)
	previewContent := p.renderPreviewPane(innerHeight)

	leftPane := styles.RenderPanel(sidebarContent, p.state.sidebarWidth, paneHeight, sidebarActive)
	divider := ui.RenderDivider(paneHeight)
	rightPane := styles.RenderPanel(previewContent, p.state.previewWidth, paneHeight, previewActive)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, divider, rightPane)
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
			return p, p.scanProjects()
		}
	}

	if p.state.activePane == ui.PaneRight {
		return p.handlePreviewKey(key)
	}
	return p.handleSidebarKey(key)
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

// ── Data loading ───────────────────────────────────────────────────────────────

// scanProjects scans for .prism/ directories in parent and sibling directories
func (p *WorkspacesPlugin) scanProjects() tea.Cmd {
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
			return ProjectsScanCompleteMsg{Projects: projects}
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

		// Sort projects by name
		for i := 0; i < len(projects); i++ {
			for j := i + 1; j < len(projects); j++ {
				if projects[i].Name > projects[j].Name {
					projects[i], projects[j] = projects[j], projects[i]
				}
			}
		}

		return ProjectsScanCompleteMsg{Projects: projects}
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

// ── Message types ──────────────────────────────────────────────────────────────

// ProjectsScanCompleteMsg signals that project scanning is complete
type ProjectsScanCompleteMsg struct {
	Projects []ProjectInfo
}

// SwitchProjectMsg signals that the active project/epic should be switched
type SwitchProjectMsg struct {
	Context *plugin.Context
}
