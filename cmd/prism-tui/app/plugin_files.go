package app

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
	"github.com/prism-plugin/prism-tui/ui"
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
	PreviewPath    string
	PreviewContent string // Raw preview content rendered directly
	FilterMode     bool   // Filename search/filter mode active
	FilterQuery    string // Current search query

	// Two-pane layout state (Phase 5)
	activePane       ui.FocusPane
	treeWidth        int // Calculated left pane width
	previewWidth     int // Calculated right pane width
	treeScrollOff    int // Index of first visible item in tree
	previewScrollOff int // First visible line in preview
}

// FilesPlugin implements the file browser view
type FilesPlugin struct {
	ctx     *plugin.Context
	state   FilesState
	focused bool
	width   int
	height  int
}

// NewFilesPlugin creates a new Files plugin instance
func NewFilesPlugin() *FilesPlugin {
	return &FilesPlugin{
		state: FilesState{
			FlatList:   []*FileNode{},
			activePane: ui.PaneLeft,
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
	return ""
}

// Init initializes the plugin with context
func (p *FilesPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.width = ctx.Width
	p.height = ctx.Height
	p.state.activePane = ui.PaneLeft
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
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case tea.MouseMsg:
		// Scroll wheel events scroll the tree list
		if msg.Button == tea.MouseButtonWheelUp {
			if p.state.SelectedIdx > 0 {
				p.state.SelectedIdx--
				return p, p.loadPreview()
			}
			return p, nil
		}
		if msg.Button == tea.MouseButtonWheelDown {
			if len(p.state.FlatList) > 0 && p.state.SelectedIdx < len(p.state.FlatList)-1 {
				p.state.SelectedIdx++
				return p, p.loadPreview()
			}
			return p, nil
		}

		// Handle left-click on file tree items
		if msg.Action == tea.MouseActionRelease && msg.Button == tea.MouseButtonLeft {
			for i := range p.state.FlatList {
				if info := zone.Get(fmt.Sprintf("files:item-%d", i)); info != nil && info.InBounds(msg) {
					p.state.SelectedIdx = i
					p.state.activePane = ui.PaneLeft
					return p, p.loadPreview()
				}
			}
		}
		return p, nil

	case plugin.PluginResizeMsg:
		p.width = msg.Width
		p.height = msg.Height
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
			p.state.previewScrollOff = 0
		}
		return p, nil
	}

	return p, nil
}

// View renders the file browser as a 30/70 two-pane layout
func (p *FilesPlugin) View(width, height int) string {
	p.width = width
	p.height = height
	breadcrumb := renderBreadcrumb("Files", width, p.ctx.HasNerdFont)
	content := p.renderTwoPane(width, height-1)
	return lipgloss.JoinVertical(lipgloss.Left, breadcrumb, content)
}

// IsFocused returns whether the plugin is active
func (p *FilesPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *FilesPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused && len(p.state.FlatList) > 0 {
		p.loadPreview()
	}
}

// KeyHints returns footer key hints based on current pane and mode
func (p *FilesPlugin) KeyHints() []plugin.KeyHint {
	if p.state.FilterMode {
		return []plugin.KeyHint{
			{Key: "esc", Description: "cancel search"},
			{Key: "enter", Description: "apply filter"},
		}
	}
	if p.state.activePane == ui.PaneRight {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "scroll preview"},
			{Key: "tab/esc", Description: "back to tree"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "expand/collapse"},
		{Key: "/", Description: "search"},
		{Key: "tab", Description: "preview pane"},
		{Key: "esc", Description: "home"},
	}
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// renderTwoPane assembles the full 30/70 bordered two-pane layout.
func (p *FilesPlugin) renderTwoPane(width, height int) string {
	paneWidths := ui.CalculatePaneWidths(width, 30, 20, 40)
	p.state.treeWidth = paneWidths.Left
	p.state.previewWidth = paneWidths.Right

	paneHeight := height
	if paneHeight < 4 {
		paneHeight = 4
	}
	innerHeight := paneHeight - 2
	if innerHeight < 1 {
		innerHeight = 1
	}

	treeActive := p.state.activePane == ui.PaneLeft
	previewActive := p.state.activePane == ui.PaneRight

	treeContent := p.renderTree(p.state.treeWidth, innerHeight)
	previewContent := p.renderPreview(p.state.previewWidth, innerHeight)

	leftPane := styles.RenderPanel(treeContent, p.state.treeWidth, paneHeight, treeActive)
	divider := ui.RenderDivider(paneHeight)
	rightPane := styles.RenderPanel(previewContent, p.state.previewWidth, paneHeight, previewActive)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftPane, divider, rightPane)
}

// renderTree renders the file tree in the left pane.
// Returns the inner content string (without border/padding — RenderPanel adds those).
func (p *FilesPlugin) renderTree(treeWidth, innerHeight int) string {
	var sb strings.Builder

	// Header line: "Files" title, or search bar when in filter mode
	if p.state.FilterMode {
		sb.WriteString(styles.CurrentStyle.Render(fmt.Sprintf("/ %s_", p.state.FilterQuery)))
	} else {
		sb.WriteString(styles.TitleStyle.Render("Files"))
	}
	sb.WriteString("\n\n")

	const headerLines = 2
	treeAreaHeight := innerHeight - headerLines
	if treeAreaHeight < 1 {
		treeAreaHeight = 1
	}

	// Content width: RenderPanel adds 2 borders + 2 padding = 4 overhead; scrollbar = 1
	maxWidth := treeWidth - 4 - 1
	if maxWidth < 5 {
		maxWidth = 5
	}

	if len(p.state.FlatList) == 0 {
		sb.WriteString(styles.DimStyle.Render("No files found."))
		return sb.String()
	}

	// Auto-scroll: keep selected item visible
	if p.state.SelectedIdx < p.state.treeScrollOff {
		p.state.treeScrollOff = p.state.SelectedIdx
	}
	if p.state.SelectedIdx >= p.state.treeScrollOff+treeAreaHeight {
		p.state.treeScrollOff = p.state.SelectedIdx - treeAreaHeight + 1
	}
	if p.state.treeScrollOff < 0 {
		p.state.treeScrollOff = 0
	}

	start := p.state.treeScrollOff
	end := start + treeAreaHeight
	if end > len(p.state.FlatList) {
		end = len(p.state.FlatList)
	}

	// Build tree items
	var treeSB strings.Builder
	for i := start; i < end; i++ {
		node := p.state.FlatList[i]
		selected := i == p.state.SelectedIdx

		indent := strings.Repeat("  ", node.Depth)
		var icon string
		if node.IsDir {
			if node.Expanded {
				icon = "▼ "
			} else {
				icon = "▶ "
			}
		} else {
			icon = "  "
		}

		plainLine := indent + icon + node.Name
		// Truncate to maxWidth (rune-safe for emoji/Unicode in filenames)
		if len([]rune(plainLine)) > maxWidth {
			runes := []rune(plainLine)
			plainLine = string(runes[:maxWidth-1]) + "…"
		}
		// Pad to full maxWidth for consistent background highlight
		visWidth := lipgloss.Width(plainLine)
		if visWidth < maxWidth {
			plainLine += strings.Repeat(" ", maxWidth-visWidth)
		}

		var styledLine string
		if selected {
			styledLine = styles.CurrentStyle.Render(plainLine)
		} else if node.IsDir {
			styledLine = styles.TitleStyle.Render(plainLine)
		} else {
			styledLine = styles.DimStyle.Render(plainLine)
		}

		// Register zone for mouse click
		styledLine = zone.Mark(fmt.Sprintf("files:item-%d", i), styledLine)

		treeSB.WriteString(styledLine)
		if i < end-1 {
			treeSB.WriteString("\n")
		}
	}

	// Scrollbar alongside tree content
	scrollbar := ui.RenderScrollbar(ui.ScrollbarParams{
		TotalItems:   len(p.state.FlatList),
		ScrollOffset: p.state.treeScrollOff,
		VisibleItems: treeAreaHeight,
		TrackHeight:  treeAreaHeight,
	})

	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, treeSB.String(), scrollbar))
	return sb.String()
}

// renderPreview renders the file preview in the right pane with line numbers.
// Format: "  42 │ content here" (4-digit right-aligned line number + " │ " separator).
func (p *FilesPlugin) renderPreview(previewWidth, innerHeight int) string {
	var sb strings.Builder

	// Header: filename with type extension hint
	header := "Preview"
	if p.state.PreviewPath != "" {
		name := filepath.Base(p.state.PreviewPath)
		ext := filepath.Ext(p.state.PreviewPath)
		if ext != "" {
			header = fmt.Sprintf("%s [%s]", name, strings.TrimPrefix(ext, "."))
		} else {
			header = name
		}
	}
	sb.WriteString(styles.TitleStyle.Render(header))
	sb.WriteString("\n\n")

	if p.state.PreviewContent == "" {
		sb.WriteString(styles.DimStyle.Render("Select a file to preview"))
		return sb.String()
	}

	const headerLines = 2
	contentAreaHeight := innerHeight - headerLines
	if contentAreaHeight < 1 {
		contentAreaHeight = 1
	}

	contentLines := strings.Split(p.state.PreviewContent, "\n")

	// Clamp preview scroll offset
	if p.state.previewScrollOff < 0 {
		p.state.previewScrollOff = 0
	}
	maxScroll := len(contentLines) - contentAreaHeight
	if maxScroll < 0 {
		maxScroll = 0
	}
	if p.state.previewScrollOff > maxScroll {
		p.state.previewScrollOff = maxScroll
	}

	start := p.state.previewScrollOff
	end := start + contentAreaHeight
	if end > len(contentLines) {
		end = len(contentLines)
	}

	// Line number prefix: "%4d │ " = 7 chars ("   1 │ ")
	const lineNumWidth = 7
	// RenderPanel overhead: 2 borders + 2 padding = 4; minus lineNumWidth
	maxLineWidth := previewWidth - 4 - lineNumWidth
	if maxLineWidth < 10 {
		maxLineWidth = 10
	}

	for i := start; i < end; i++ {
		line := contentLines[i]
		if len(line) > maxLineWidth {
			line = line[:maxLineWidth-1] + "…"
		}
		lineNum := fmt.Sprintf("%4d │ ", i+1)
		sb.WriteString(styles.FileBrowserLineNumber.Render(lineNum))
		sb.WriteString(line)
		if i < end-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

// handleKeyPress handles keyboard input with pane-aware navigation.
func (p *FilesPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Filter/search mode captures all input
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
			if len(key) == 1 {
				p.state.FilterQuery += key
			}
			return p, nil
		}
	}

	// Tab switches focus between tree and preview panes
	if key == "tab" {
		if p.state.activePane == ui.PaneLeft {
			p.state.activePane = ui.PaneRight
		} else {
			p.state.activePane = ui.PaneLeft
		}
		return p, nil
	}

	// Preview pane: j/k scroll content, esc returns to tree
	if p.state.activePane == ui.PaneRight {
		switch key {
		case "j", "down":
			p.state.previewScrollOff++
			return p, nil
		case "k", "up":
			if p.state.previewScrollOff > 0 {
				p.state.previewScrollOff--
			}
			return p, nil
		case "esc":
			p.state.activePane = ui.PaneLeft
			return p, nil
		}
		return p, nil
	}

	// Tree pane navigation
	switch key {
	case "j", "down":
		if len(p.state.FlatList) > 0 && p.state.SelectedIdx < len(p.state.FlatList)-1 {
			p.state.SelectedIdx++
			p.state.previewScrollOff = 0
			return p, p.loadPreview()
		}
		return p, nil
	case "k", "up":
		if p.state.SelectedIdx > 0 {
			p.state.SelectedIdx--
			p.state.previewScrollOff = 0
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

	return p, nil
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

// applyFilter filters the flat list to entries matching FilterQuery
func (p *FilesPlugin) applyFilter() {
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
	p.state.treeScrollOff = 0
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
		p.state.previewScrollOff = 0
		return nil
	}

	// In demo mode, show placeholder preview since files don't exist on disk
	if p.ctx.DemoMode {
		p.state.PreviewPath = node.Path
		p.state.PreviewContent = demoFileContent(node.Name)
		p.state.previewScrollOff = 0
		return nil
	}

	return LoadFileContentCmd(node.Path, ViewFiles)
}

// buildFileTreeCmd builds the file tree asynchronously
func (p *FilesPlugin) buildFileTreeCmd() tea.Cmd {
	return func() tea.Msg {
		root := &FileNode{
			Name:     filepath.Base(p.ctx.ProjectDir),
			Path:     p.ctx.ProjectDir,
			IsDir:    true,
			Expanded: true,
			Depth:    0,
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
