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
}

// WorkspacesPlugin implements the multi-project workspace switcher
type WorkspacesPlugin struct {
	ctx     *plugin.Context
	state   WorkspacesState
	focused bool
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

	case ProjectsScanCompleteMsg:
		p.state.Projects = msg.Projects
		p.state.Loading = false
		return p, nil
	}

	return p, nil
}

// View renders the workspaces browser
func (p *WorkspacesPlugin) View(width, height int) string {
	var sections []string

	// Powerline breadcrumb header
	sections = append(sections, renderBreadcrumb("Workspaces", width, p.ctx.HasNerdFont))
	sections = append(sections, "")

	// Main content
	if p.state.Loading {
		sections = append(sections, "")
		sections = append(sections, "  "+styles.InfoStyle.Render("🔍 Scanning for .prism/ directories..."))
	} else if p.state.EpicsView {
		// Show epics within selected project
		content := p.renderEpicsView(width, height-6)
		sections = append(sections, content)
	} else {
		// Show project list
		content := p.renderProjectsView(width, height-6)
		sections = append(sections, content)
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
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
	if p.state.EpicsView {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "navigate"},
			{Key: "enter", Description: "switch epic"},
			{Key: "esc", Description: "back to projects"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view epics / switch project"},
		{Key: "r", Description: "rescan"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *WorkspacesPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Epics view navigation
	if p.state.EpicsView {
		switch key {
		case "j", "down":
			if p.state.SelectedProject < len(p.state.Projects) && len(p.state.Projects[p.state.SelectedProject].Epics) > 0 {
				p.state.SelectedEpic = (p.state.SelectedEpic + 1) % len(p.state.Projects[p.state.SelectedProject].Epics)
			}
			return p, nil

		case "k", "up":
			if p.state.SelectedProject < len(p.state.Projects) && len(p.state.Projects[p.state.SelectedProject].Epics) > 0 {
				epicsCount := len(p.state.Projects[p.state.SelectedProject].Epics)
				p.state.SelectedEpic = (p.state.SelectedEpic - 1 + epicsCount) % epicsCount
			}
			return p, nil

		case "enter":
			// Switch to selected epic
			return p, p.switchToEpic()

		case "esc", "backspace":
			// Return to projects view
			p.state.EpicsView = false
			p.state.SelectedEpic = 0
			return p, nil
		}
		return p, nil
	}

	// Projects view navigation
	switch key {
	case "j", "down":
		if len(p.state.Projects) > 0 {
			p.state.SelectedProject = (p.state.SelectedProject + 1) % len(p.state.Projects)
		}
		return p, nil

	case "k", "up":
		if len(p.state.Projects) > 0 {
			p.state.SelectedProject = (p.state.SelectedProject - 1 + len(p.state.Projects)) % len(p.state.Projects)
		}
		return p, nil

	case "enter":
		// If selected project has epics, show epics view
		// Otherwise, switch directly to project
		if p.state.SelectedProject < len(p.state.Projects) {
			project := p.state.Projects[p.state.SelectedProject]
			if len(project.Epics) > 0 {
				p.state.EpicsView = true
				p.state.SelectedEpic = 0
			} else {
				return p, p.switchToProject()
			}
		}
		return p, nil

	case "r":
		// Rescan projects
		p.state.Loading = true
		return p, p.scanProjects()

	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// renderProjectsView renders the list of discovered projects
func (p *WorkspacesPlugin) renderProjectsView(width, height int) string {
	var lines []string

	// Section title
	title := styles.PanelTitleStyle.Render("📂 Discovered Projects")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(p.state.Projects) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No projects found"))
		lines = append(lines, "")
		lines = append(lines, "  "+styles.DimStyle.Render("Press 'r' to scan for .prism/ directories"))
	} else {
		// Current project indicator
		currentPath := p.ctx.ProjectDir
		lines = append(lines, "  "+styles.DimStyle.Render(fmt.Sprintf("Current: %s", currentPath)))
		lines = append(lines, "")

		// Project list
		for i, proj := range p.state.Projects {
			selected := i == p.state.SelectedProject

			// Project name and path
			var projectLine string
			if proj.Path == currentPath {
				projectLine = fmt.Sprintf("● %s", proj.Name)
				projectLine = styles.CurrentStyle.Bold(true).Render(projectLine)
			} else if selected {
				projectLine = fmt.Sprintf("▸ %s", proj.Name)
				projectLine = styles.InfoStyle.Bold(true).Render(projectLine)
			} else {
				projectLine = fmt.Sprintf("  %s", proj.Name)
				projectLine = styles.DimStyle.Render(projectLine)
			}

			lines = append(lines, "  "+projectLine)

			// Branch and progress (indented)
			branchInfo := fmt.Sprintf("    Branch: %s", proj.Branch)
			if selected || proj.Path == currentPath {
				lines = append(lines, styles.InfoStyle.Render(branchInfo))
			} else {
				lines = append(lines, styles.DimStyle.Render(branchInfo))
			}

			// Story progress
			progressInfo := fmt.Sprintf("    Stories: %d/%d complete", proj.StoriesComplete, proj.StoriesTotal)
			if selected || proj.Path == currentPath {
				lines = append(lines, styles.SuccessStyle.Render(progressInfo))
			} else {
				lines = append(lines, styles.DimStyle.Render(progressInfo))
			}

			// Epics count
			if len(proj.Epics) > 0 {
				epicsInfo := fmt.Sprintf("    Epics: %d", len(proj.Epics))
				if selected || proj.Path == currentPath {
					lines = append(lines, styles.WarningStyle.Render(epicsInfo))
				} else {
					lines = append(lines, styles.DimStyle.Render(epicsInfo))
				}
			}

			lines = append(lines, "")
		}
	}

	// Hints
	lines = append(lines, "")
	lines = append(lines, "  "+styles.DimStyle.Render("j/k navigate  enter select/view epics  r rescan  esc home"))

	content := strings.Join(lines, "\n")
	panelHeight := height
	if panelHeight < 10 {
		panelHeight = 10
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Info).
		Width(width - 4).
		Height(panelHeight).
		Padding(1, 2).
		Render(content)
}

// renderEpicsView renders the epic selector for the selected project
func (p *WorkspacesPlugin) renderEpicsView(width, height int) string {
	var lines []string

	if p.state.SelectedProject >= len(p.state.Projects) {
		return "No project selected"
	}

	project := p.state.Projects[p.state.SelectedProject]

	// Section title
	title := styles.PanelTitleStyle.Render(fmt.Sprintf("📚 Epics in %s", project.Name))
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(project.Epics) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No epics found in this project"))
		lines = append(lines, "")
		lines = append(lines, "  "+styles.DimStyle.Render("Using flat story structure: .prism/stories/stories.json"))
	} else {
		// Epic list
		for i, epic := range project.Epics {
			selected := i == p.state.SelectedEpic

			// Epic name
			var epicLine string
			if selected {
				epicLine = fmt.Sprintf("▸ %s", epic.Name)
				epicLine = styles.InfoStyle.Bold(true).Render(epicLine)
			} else {
				epicLine = fmt.Sprintf("  %s", epic.Name)
				epicLine = styles.DimStyle.Render(epicLine)
			}

			lines = append(lines, "  "+epicLine)

			// Story progress
			progressInfo := fmt.Sprintf("    %d/%d stories complete", epic.CompletedCount, epic.StoryCount)
			if selected {
				lines = append(lines, styles.SuccessStyle.Render(progressInfo))
			} else {
				lines = append(lines, styles.DimStyle.Render(progressInfo))
			}

			// Stories path
			pathInfo := fmt.Sprintf("    %s", epic.StoriesPath)
			if selected {
				lines = append(lines, styles.DimStyle.Render(pathInfo))
			} else {
				lines = append(lines, styles.DimStyle.Render(pathInfo))
			}

			lines = append(lines, "")
		}
	}

	// Hints
	lines = append(lines, "")
	lines = append(lines, "  "+styles.DimStyle.Render("j/k navigate  enter switch epic  esc back to projects"))

	content := strings.Join(lines, "\n")
	panelHeight := height
	if panelHeight < 10 {
		panelHeight = 10
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Warning).
		Width(width - 4).
		Height(panelHeight).
		Padding(1, 2).
		Render(content)
}

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
		// (Simple sort implementation to avoid importing sort package)
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
	// Parse stories using domain package
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

// switchToProject switches the active project by triggering Registry.Reinit
func (p *WorkspacesPlugin) switchToProject() tea.Cmd {
	if p.state.SelectedProject >= len(p.state.Projects) {
		return nil
	}

	project := p.state.Projects[p.state.SelectedProject]

	return func() tea.Msg {
		// Create new context with updated paths
		ctx := p.ctx
		ctx.ProjectDir = project.Path
		ctx.PrismDir = filepath.Join(project.Path, ".prism")

		// Determine stories path (flat or epic structure)
		if len(project.Epics) == 0 {
			ctx.StoriesPath = filepath.Join(ctx.PrismDir, "stories", "stories.json")
		} else {
			// Use first epic by default
			ctx.StoriesPath = project.Epics[0].StoriesPath
		}

		// Return message to trigger reinit
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
		// Create new context with updated epic path
		ctx := p.ctx
		ctx.StoriesPath = epic.StoriesPath

		// Return message to trigger reinit
		return SwitchProjectMsg{Context: ctx}
	}
}

// ProjectsScanCompleteMsg signals that project scanning is complete
type ProjectsScanCompleteMsg struct {
	Projects []ProjectInfo
}

// SwitchProjectMsg signals that the active project/epic should be switched
type SwitchProjectMsg struct {
	Context *plugin.Context
}
