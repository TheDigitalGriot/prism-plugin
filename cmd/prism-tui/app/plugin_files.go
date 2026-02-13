package app

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// FileNode represents a file or directory in the tree
type FileNode struct {
	Name     string
	Path     string
	IsDir    bool
	Expanded bool
	Children []*FileNode
	Depth    int
}

// FilesState holds state for the file browser
type FilesState struct {
	Root           *FileNode
	FlatList       []*FileNode // Flattened tree for navigation
	SelectedIdx    int
	Viewport       viewport.Model
	PreviewPath    string
	PreviewContent string // Raw preview content (rendered directly, not via viewport)
	FilterMode     bool
	FilterQuery    string
}

// FilesPlugin implements the file browser view
type FilesPlugin struct {
	ctx     *plugin.Context
	state   FilesState
	focused bool
}

// NewFilesPlugin creates a new Files plugin instance
func NewFilesPlugin() *FilesPlugin {
	return &FilesPlugin{
		state: FilesState{
			FlatList: []*FileNode{},
		},
	}
}

// ID returns the plugin identifier
func (p *FilesPlugin) ID() string {
	return "files"
}

// Name returns the display name
func (p *FilesPlugin) Name() string {
	return "Files"
}

// Icon returns the tab icon
func (p *FilesPlugin) Icon() string {
	return "📁"
}

// Init initializes the plugin with context
func (p *FilesPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize viewport for file preview
	p.state.Viewport = viewport.New(ctx.Width/2-4, ctx.Height-6)
	return nil
}

// Start is called when the plugin is first activated
func (p *FilesPlugin) Start() tea.Cmd {
	// Build file tree when plugin starts
	if p.ctx.DemoMode {
		return nil
	}
	return p.buildFileTreeCmd()
}

// Stop is called when deactivated
func (p *FilesPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages
func (p *FilesPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
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
		p.state.Viewport.Width = msg.Width/2 - 4
		p.state.Viewport.Height = viewportHeight
		return p, nil

	case FileTreeLoadedMsg:
		if msg.Error == nil {
			p.state.Root = msg.Root
			p.rebuildFlatList()
			if len(p.state.FlatList) > 0 {
				p.state.SelectedIdx = 0
			}
		}
		return p, nil

	case FileContentLoadedMsg:
		if msg.Error == nil && msg.ForView == ViewFiles {
			p.state.PreviewPath = msg.Path
			p.state.PreviewContent = msg.Content
			p.state.Viewport.SetContent(msg.Content)
		}
		return p, nil
	}

	// Forward viewport updates when previewing file
	if p.state.PreviewPath != "" {
		p.state.Viewport, cmd = p.state.Viewport.Update(msg)
	}

	return p, cmd
}

// View renders the file browser
func (p *FilesPlugin) View(width, height int) string {
	var sections []string

	// Header
	title := styles.TitleStyle.Render("PRISM")
	breadcrumb := styles.DimStyle.Render(" > Files")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(width).Render(header))
	sections = append(sections, "")

	if p.state.FilterMode {
		// Show filter input
		filterPrompt := styles.CurrentStyle.Render(fmt.Sprintf("Filter: %s_", p.state.FilterQuery))
		sections = append(sections, "  "+filterPrompt)
		sections = append(sections, "")
	}

	// Two-pane layout: tree on left, preview on right
	leftWidth := width/2 - 2
	rightWidth := width - leftWidth - 4

	// Build tree view
	treeLines := p.renderTree(leftWidth, height-6)

	// Build preview pane
	previewLines := p.renderPreview(rightWidth, height-6)

	// Combine left and right panes
	maxLines := len(treeLines)
	if len(previewLines) > maxLines {
		maxLines = len(previewLines)
	}

	for i := 0; i < maxLines; i++ {
		left := ""
		right := ""
		if i < len(treeLines) {
			left = treeLines[i]
		} else {
			left = strings.Repeat(" ", leftWidth)
		}
		if i < len(previewLines) {
			right = previewLines[i]
		}
		sections = append(sections, left+"  "+right)
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *FilesPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *FilesPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused && len(p.state.FlatList) > 0 {
		// Load preview for current selection when focused
		p.loadPreview()
	}
}

// KeyHints returns footer key hints
func (p *FilesPlugin) KeyHints() []plugin.KeyHint {
	if p.state.FilterMode {
		return []plugin.KeyHint{
			{Key: "esc", Description: "cancel filter"},
			{Key: "enter", Description: "apply filter"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "expand/collapse"},
		{Key: "/", Description: "filter"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *FilesPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Filter mode input
	if p.state.FilterMode {
		switch key {
		case "esc":
			p.state.FilterMode = false
			p.state.FilterQuery = ""
			p.rebuildFlatList()
			return p, nil
		case "enter":
			p.state.FilterMode = false
			p.applyFilter()
			return p, nil
		case "backspace":
			if len(p.state.FilterQuery) > 0 {
				p.state.FilterQuery = p.state.FilterQuery[:len(p.state.FilterQuery)-1]
			}
			return p, nil
		default:
			// Add character to filter
			if len(key) == 1 {
				p.state.FilterQuery += key
			}
			return p, nil
		}
	}

	// Normal navigation
	switch key {
	case "j", "down":
		if len(p.state.FlatList) > 0 && p.state.SelectedIdx < len(p.state.FlatList)-1 {
			p.state.SelectedIdx++
			return p, p.loadPreview()
		}
		return p, nil
	case "k", "up":
		if p.state.SelectedIdx > 0 {
			p.state.SelectedIdx--
			return p, p.loadPreview()
		}
		return p, nil
	case "enter", " ":
		if len(p.state.FlatList) > 0 {
			node := p.state.FlatList[p.state.SelectedIdx]
			if node.IsDir {
				node.Expanded = !node.Expanded
				p.rebuildFlatList()
			} else {
				// Load file preview for non-directory files
				return p, p.loadPreview()
			}
		}
		return p, nil
	case "/":
		p.state.FilterMode = true
		p.state.FilterQuery = ""
		return p, nil
	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	// Forward to viewport for scrolling preview
	var cmd tea.Cmd
	p.state.Viewport, cmd = p.state.Viewport.Update(msg)
	return p, cmd
}

// renderTree renders the file tree on the left pane
func (p *FilesPlugin) renderTree(width, height int) []string {
	var lines []string

	if len(p.state.FlatList) == 0 {
		lines = append(lines, styles.DimStyle.Render("  No files found."))
		return lines
	}

	// Render visible portion of flat list
	for i, node := range p.state.FlatList {
		if i >= height {
			break
		}

		selected := i == p.state.SelectedIdx
		indent := strings.Repeat("  ", node.Depth)
		icon := "📄"
		if node.IsDir {
			if node.Expanded {
				icon = "📂"
			} else {
				icon = "📁"
			}
		}

		line := fmt.Sprintf("%s%s %s", indent, icon, node.Name)

		// Truncate if too long
		maxLen := width - 2
		if len(line) > maxLen {
			line = line[:maxLen-3] + "..."
		}

		if selected {
			line = styles.CurrentStyle.Render("> " + line)
		} else {
			line = styles.DimStyle.Render("  " + line)
		}

		// Pad to full width
		padding := width - lipgloss.Width(line)
		if padding > 0 {
			line = line + strings.Repeat(" ", padding)
		}

		lines = append(lines, line)
	}

	return lines
}

// renderPreview renders the file preview on the right pane
func (p *FilesPlugin) renderPreview(width, height int) []string {
	if p.state.PreviewContent == "" {
		return []string{styles.DimStyle.Render("Select a file to preview")}
	}

	// Render preview content directly (bypass viewport for reliability)
	contentLines := strings.Split(p.state.PreviewContent, "\n")

	// Limit to available height
	if len(contentLines) > height {
		contentLines = contentLines[:height]
	}

	// Truncate long lines and style
	var lines []string
	for _, line := range contentLines {
		if len(line) > width {
			line = line[:width-3] + "..."
		}
		lines = append(lines, styles.DimStyle.Render(line))
	}

	return lines
}

// rebuildFlatList rebuilds the flattened list from the tree
func (p *FilesPlugin) rebuildFlatList() {
	p.state.FlatList = []*FileNode{}
	if p.state.Root != nil {
		p.flattenNode(p.state.Root)
	}
	// Ensure selected index is in bounds
	if p.state.SelectedIdx >= len(p.state.FlatList) {
		p.state.SelectedIdx = len(p.state.FlatList) - 1
	}
	if p.state.SelectedIdx < 0 {
		p.state.SelectedIdx = 0
	}
}

// flattenNode recursively flattens the tree into a list
func (p *FilesPlugin) flattenNode(node *FileNode) {
	p.state.FlatList = append(p.state.FlatList, node)
	if node.IsDir && node.Expanded {
		for _, child := range node.Children {
			p.flattenNode(child)
		}
	}
}

// applyFilter filters the tree based on the query
func (p *FilesPlugin) applyFilter() {
	// Simple filter: rebuild flat list with only matching items
	p.rebuildFlatList()
	if p.state.FilterQuery == "" {
		return
	}

	filtered := []*FileNode{}
	query := strings.ToLower(p.state.FilterQuery)
	for _, node := range p.state.FlatList {
		if strings.Contains(strings.ToLower(node.Name), query) {
			filtered = append(filtered, node)
		}
	}
	p.state.FlatList = filtered
	p.state.SelectedIdx = 0
}

// loadPreview loads the preview for the currently selected file
func (p *FilesPlugin) loadPreview() tea.Cmd {
	if len(p.state.FlatList) == 0 {
		p.state.PreviewContent = ""
		return nil
	}
	node := p.state.FlatList[p.state.SelectedIdx]
	if node.IsDir {
		p.state.PreviewPath = node.Path
		content := fmt.Sprintf("Directory: %s\nItems: %d", node.Name, len(node.Children))
		p.state.PreviewContent = content
		p.state.Viewport.SetContent(content)
		return nil
	}

	// In demo mode, show placeholder preview since files don't exist on disk
	if p.ctx.DemoMode {
		p.state.PreviewPath = node.Path
		p.state.PreviewContent = demoFileContent(node.Name)
		p.state.Viewport.SetContent(p.state.PreviewContent)
		return nil
	}

	return LoadFileContentCmd(node.Path, ViewFiles)
}

// buildFileTreeCmd builds the file tree asynchronously
func (p *FilesPlugin) buildFileTreeCmd() tea.Cmd {
	return func() tea.Msg {
		root := &FileNode{
			Name:  filepath.Base(p.ctx.ProjectDir),
			Path:  p.ctx.ProjectDir,
			IsDir: true,
			Expanded: true,
			Depth: 0,
		}

		err := p.buildTree(root, 3) // Max depth of 3 to avoid overwhelming
		if err != nil {
			return FileTreeLoadedMsg{Root: nil, Error: err}
		}

		return FileTreeLoadedMsg{Root: root, Error: nil}
	}
}

// buildTree recursively builds the file tree
func (p *FilesPlugin) buildTree(node *FileNode, maxDepth int) error {
	if node.Depth >= maxDepth {
		return nil
	}

	entries, err := os.ReadDir(node.Path)
	if err != nil {
		return err
	}

	// Filter out .git and other ignored directories
	var children []*FileNode
	for _, entry := range entries {
		// Skip hidden files and common ignore patterns
		name := entry.Name()
		if strings.HasPrefix(name, ".") && name != ".prism" {
			continue
		}
		if name == "node_modules" || name == "vendor" || name == "dist" || name == "build" {
			continue
		}

		childPath := filepath.Join(node.Path, name)
		child := &FileNode{
			Name:  name,
			Path:  childPath,
			IsDir: entry.IsDir(),
			Depth: node.Depth + 1,
		}

		// Recursively build subdirectories (but don't expand them by default)
		if entry.IsDir() && node.Depth < maxDepth-1 {
			p.buildTree(child, maxDepth)
		}

		children = append(children, child)
	}

	// Sort: directories first, then files, alphabetically
	sort.Slice(children, func(i, j int) bool {
		if children[i].IsDir != children[j].IsDir {
			return children[i].IsDir
		}
		return children[i].Name < children[j].Name
	})

	node.Children = children
	return nil
}

// FileTreeLoadedMsg is sent when the file tree is loaded
type FileTreeLoadedMsg struct {
	Root  *FileNode
	Error error
}

// demoFileContent returns realistic placeholder content for demo mode files
func demoFileContent(name string) string {
	switch name {
	case "README.md":
		return `# Prism Plugin

A structured 4-phase development workflow for Claude Code.

> Research → Plan → Implement → Validate

## Installation

` + "```bash" + `
claude plugin install prism
` + "```" + `

## Usage

Say "help me build [feature]" to trigger the full workflow.

| Command               | Purpose                          |
|-----------------------|----------------------------------|
| /prism-research       | Research phase                   |
| /prism-plan           | Create implementation plan       |
| /prism-implement      | Execute approved plan            |
| /prism-validate       | Verify against plan              |

## License

MIT`
	case "go.mod":
		return `module github.com/prism-plugin/prism-tui

go 1.22

require (
	github.com/charmbracelet/bubbletea v1.3.4
	github.com/charmbracelet/lipgloss v1.1.0
	github.com/charmbracelet/bubbles v0.20.0
	github.com/spf13/cobra v1.8.0
)`
	case "main.go":
		return `package main

import (
	"fmt"
	"os"

	"github.com/prism-plugin/prism-tui/app"
	"github.com/spf13/cobra"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "prism-tui",
		Short: "Prism TUI Dashboard",
		RunE:  run,
	}

	rootCmd.Flags().Bool("demo", false, "Run in demo mode")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}`
	default:
		return fmt.Sprintf("// %s\n// (demo file preview)", name)
	}
}
