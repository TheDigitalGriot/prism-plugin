package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-cli/diff"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/styles"
	"github.com/prism-plugin/prism-cli/ui"
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

// FileTab represents an open file tab in the preview pane (F-3)
type FileTab struct {
	Path           string
	Name           string
	Content        string
	ScrollOffset   int
	Highlighter    *diff.SyntaxHighlighter
}

// TabManager manages multiple open file tabs (F-3)
type TabManager struct {
	Tabs      []FileTab
	ActiveIdx int
	MaxTabs   int
}

// newTabManager creates a new TabManager with default settings
func newTabManager() TabManager {
	return TabManager{MaxTabs: 10}
}

// OpenTab opens a file in a new tab or switches to it if already open.
// Returns true if a new tab was created (content needs loading).
func (tm *TabManager) OpenTab(path, name string) bool {
	// Check if already open
	for i, tab := range tm.Tabs {
		if tab.Path == path {
			tm.ActiveIdx = i
			return false
		}
	}

	// If at max tabs, close the oldest (first) tab
	if len(tm.Tabs) >= tm.MaxTabs {
		tm.Tabs = tm.Tabs[1:]
		if tm.ActiveIdx > 0 {
			tm.ActiveIdx--
		}
	}

	tm.Tabs = append(tm.Tabs, FileTab{Path: path, Name: name})
	tm.ActiveIdx = len(tm.Tabs) - 1
	return true
}

// CloseTab closes the tab at the given index
func (tm *TabManager) CloseTab(idx int) {
	if idx < 0 || idx >= len(tm.Tabs) {
		return
	}
	tm.Tabs = append(tm.Tabs[:idx], tm.Tabs[idx+1:]...)

	// Adjust active index
	if len(tm.Tabs) == 0 {
		tm.ActiveIdx = 0
	} else if tm.ActiveIdx >= len(tm.Tabs) {
		tm.ActiveIdx = len(tm.Tabs) - 1
	} else if idx < tm.ActiveIdx {
		tm.ActiveIdx--
	}
}

// ActiveTab returns the active tab, or nil if no tabs
func (tm *TabManager) ActiveTab() *FileTab {
	if len(tm.Tabs) == 0 || tm.ActiveIdx < 0 || tm.ActiveIdx >= len(tm.Tabs) {
		return nil
	}
	return &tm.Tabs[tm.ActiveIdx]
}

// CloseActive closes the currently active tab
func (tm *TabManager) CloseActive() {
	tm.CloseTab(tm.ActiveIdx)
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

	// Git status indicators (F-2)
	GitStatusMap map[string]string // relative path → status indicator ("M", "A", "D", "?", "R")

	// Multi-tab support (F-3)
	Tabs TabManager

	// Two-pane layout state (Phase 5)
	activePane       ui.FocusPane
	treeWidth        int // Calculated left pane width
	previewWidth     int // Calculated right pane width
	treeScrollOff    int // Index of first visible item in tree
	previewScrollOff int // First visible line in preview

	// Edit mode state (F-6)
	editMode     bool           // True when editing a file
	editTextarea textarea.Model // Textarea for editing
	editPath     string         // Path of file being edited

	// Blame view state (F-7)
	blameMode  bool          // True when showing blame annotations
	blameLines []BlameLine   // Parsed blame data per line
	blameError string        // Error message if blame failed
}

// FilesPlugin implements the file browser view
type FilesPlugin struct {
	ctx         *plugin.Context
	state       FilesState
	focused     bool
	width       int
	height      int
	highlighter *diff.SyntaxHighlighter // Chroma highlighter for current preview file
}

// NewFilesPlugin creates a new Files plugin instance
func NewFilesPlugin() *FilesPlugin {
	return &FilesPlugin{
		state: FilesState{
			FlatList:   []*FileNode{},
			activePane: ui.PaneLeft,
			Tabs:       newTabManager(),
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
	return tea.Batch(p.buildFileTreeCmd(), p.loadFileGitStatusCmd())
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
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error == nil && msg.ForView == ViewFiles {
			p.state.PreviewPath = msg.Path
			p.state.PreviewContent = msg.Content
			p.state.previewScrollOff = 0
			// Clear blame data when file changes (F-7)
			p.state.blameLines = nil
			p.state.blameError = ""
			// Create syntax highlighter for this file type (F-1)
			hl := diff.NewSyntaxHighlighter(filepath.Base(msg.Path))
			p.highlighter = hl

			// Store content in the active tab (F-3)
			if tab := p.state.Tabs.ActiveTab(); tab != nil && tab.Path == msg.Path {
				tab.Content = msg.Content
				tab.Highlighter = hl
				tab.ScrollOffset = 0
			}
		}
		return p, nil

	case FileGitStatusLoadedMsg:
		if msg.Error == nil {
			p.state.GitStatusMap = msg.StatusMap
		}
		return p, nil

	case FileFinderOpenMsg:
		// Open file from fuzzy finder or content search (F-4, F-5)
		isNew := p.state.Tabs.OpenTab(msg.Path, msg.Name)
		if isNew {
			return p, p.loadPreviewForTab(msg.Path)
		}
		// Tab already exists, sync preview state
		if tab := p.state.Tabs.ActiveTab(); tab != nil {
			p.state.PreviewPath = tab.Path
			p.state.PreviewContent = tab.Content
			p.state.previewScrollOff = tab.ScrollOffset
			p.highlighter = tab.Highlighter
		}
		return p, nil

	case BlameLoadedMsg:
		// Blame data loaded for a file (F-7)
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error != nil {
			p.state.blameError = msg.Error.Error()
			p.state.blameLines = nil
		} else if msg.Path == p.state.PreviewPath {
			p.state.blameLines = msg.Lines
			p.state.blameError = ""
		}
		return p, nil

	case FileSavedMsg:
		// File saved from edit mode (F-6)
		if msg.Error != nil {
			// Stay in edit mode, user can try again or esc
			return p, nil
		}
		// Exit edit mode, reload content
		p.state.editMode = false
		p.state.editPath = ""
		// Publish file changed event
		if p.ctx.EventBus != nil {
			p.ctx.EventBus.Publish(plugin.FileChangedEvent{
				FilePath: msg.Path,
				Action:   "modified",
			})
		}
		return p, p.loadPreviewForTab(msg.Path)
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
	if p.state.editMode {
		return []plugin.KeyHint{
			{Key: "ctrl+s", Description: "save"},
			{Key: "esc", Description: "cancel edit"},
		}
	}
	if p.state.FilterMode {
		return []plugin.KeyHint{
			{Key: "esc", Description: "cancel search"},
			{Key: "enter", Description: "apply filter"},
		}
	}
	if p.state.activePane == ui.PaneRight {
		blameHint := "blame"
		if p.state.blameMode {
			blameHint = "blame off"
		}
		return []plugin.KeyHint{
			{Key: "j/k", Description: "scroll"},
			{Key: "h/l", Description: "switch tab"},
			{Key: "b", Description: blameHint},
			{Key: "e", Description: "edit file"},
			{Key: "x", Description: "close tab"},
			{Key: "esc", Description: "tree pane"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "open/expand"},
		{Key: "x", Description: "close tab"},
		{Key: "/", Description: "search"},
		{Key: "tab", Description: "preview pane"},
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

		// Git status badge (F-2)
		gitStatus := p.fileGitStatus(node)
		if gitStatus != "" {
			// Right-align the badge within maxWidth
			badgeWidth := 2 // " M" or " ?" etc.
			lineWidth := lipgloss.Width(plainLine)
			if lineWidth+badgeWidth <= maxWidth {
				padding := maxWidth - lineWidth - badgeWidth
				if padding > 0 {
					plainLine = plainLine[:len(plainLine)-padding] // trim trailing spaces
				}
				// Re-pad to fit badge
				visW := lipgloss.Width(plainLine)
				if visW+badgeWidth < maxWidth {
					plainLine += strings.Repeat(" ", maxWidth-visW-badgeWidth)
				}
			}
		}

		var styledLine string
		if selected {
			styledLine = styles.CurrentStyle.Render(plainLine)
		} else if node.IsDir {
			styledLine = styles.TitleStyle.Render(plainLine)
		} else {
			styledLine = styles.DimStyle.Render(plainLine)
		}

		// Append colored git status badge after the styled text
		if gitStatus != "" {
			var badgeStyle lipgloss.Style
			switch gitStatus {
			case "M":
				badgeStyle = lipgloss.NewStyle().Foreground(styles.Warning) // Yellow
			case "A":
				badgeStyle = lipgloss.NewStyle().Foreground(styles.Success) // Green
			case "D":
				badgeStyle = lipgloss.NewStyle().Foreground(styles.Error) // Red
			case "?":
				badgeStyle = lipgloss.NewStyle().Foreground(styles.Dim) // Gray
			default:
				badgeStyle = lipgloss.NewStyle().Foreground(styles.Info) // Blue
			}
			styledLine += " " + badgeStyle.Render(gitStatus)
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

// renderTabBar renders the tab bar above the preview (F-3)
func (p *FilesPlugin) renderTabBar(maxWidth int) string {
	if len(p.state.Tabs.Tabs) == 0 {
		return ""
	}

	var parts []string
	for i, tab := range p.state.Tabs.Tabs {
		name := tab.Name
		if len(name) > 15 {
			name = name[:12] + "…"
		}

		if i == p.state.Tabs.ActiveIdx {
			style := lipgloss.NewStyle().
				Bold(true).
				Foreground(styles.White).
				Background(styles.Primary).
				Padding(0, 1)
			parts = append(parts, style.Render(name))
		} else {
			style := lipgloss.NewStyle().
				Foreground(styles.Dim).
				Padding(0, 1)
			parts = append(parts, style.Render(name))
		}
	}

	bar := lipgloss.JoinHorizontal(lipgloss.Top, parts...)
	// Truncate if too wide
	if lipgloss.Width(bar) > maxWidth {
		return bar[:maxWidth]
	}
	return bar
}

// renderPreview renders the file preview in the right pane with line numbers.
// Format: "  42 │ content here" (4-digit right-aligned line number + " │ " separator).
func (p *FilesPlugin) renderPreview(previewWidth, innerHeight int) string {
	// If in edit mode, render the textarea editor instead (F-6)
	if p.state.editMode {
		return p.renderEditPane(previewWidth, innerHeight)
	}

	var sb strings.Builder

	// Tab bar (F-3)
	tabBar := p.renderTabBar(previewWidth - 4)
	if tabBar != "" {
		sb.WriteString(tabBar)
		sb.WriteString("\n")
		innerHeight-- // Consume one line for tab bar
	}

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

	// Blame column width: "abcdef12 JohnDoe  3mo │ " = ~25 chars (F-7)
	const blameColWidth = 25
	effectiveMaxLine := maxLineWidth
	if p.state.blameMode {
		effectiveMaxLine = maxLineWidth - blameColWidth
		if effectiveMaxLine < 10 {
			effectiveMaxLine = 10
		}
	}

	for i := start; i < end; i++ {
		line := contentLines[i]
		if len(line) > effectiveMaxLine {
			line = line[:effectiveMaxLine-1] + "…"
		}

		// Render blame column if active (F-7)
		if p.state.blameMode {
			if p.state.blameError != "" {
				// Show error once at top
				if i == start {
					sb.WriteString(styles.WarningStyle.Render("Not in git"))
					sb.WriteString("\n")
				}
			} else if i < len(p.state.blameLines) {
				bl := p.state.blameLines[i]
				blameStr := fmt.Sprintf("%s %-8s %3s │ ", bl.Hash, bl.Author, bl.Age)
				sb.WriteString(styles.DimStyle.Render(blameStr))
			} else {
				sb.WriteString(styles.DimStyle.Render(strings.Repeat(" ", blameColWidth)))
			}
		}

		lineNum := fmt.Sprintf("%4d │ ", i+1)
		sb.WriteString(styles.FileBrowserLineNumber.Render(lineNum))

		// Apply syntax highlighting if available (F-1)
		if p.highlighter != nil {
			segments := p.highlighter.HighlightLine(line)
			for _, seg := range segments {
				sb.WriteString(seg.Style.Render(seg.Text))
			}
		} else {
			sb.WriteString(line)
		}

		if i < end-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}

// handleKeyPress handles keyboard input with pane-aware navigation.
func (p *FilesPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Edit mode captures all input (F-6)
	if p.state.editMode {
		return p.handleEditModeKey(msg)
	}

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

	// Preview pane: j/k scroll content, h/l switch tabs, x close tab, e edit, esc returns to tree
	if p.state.activePane == ui.PaneRight {
		switch key {
		case "j", "down":
			p.state.previewScrollOff++
			// Save scroll position to active tab
			if tab := p.state.Tabs.ActiveTab(); tab != nil {
				tab.ScrollOffset = p.state.previewScrollOff
			}
			return p, nil
		case "k", "up":
			if p.state.previewScrollOff > 0 {
				p.state.previewScrollOff--
			}
			if tab := p.state.Tabs.ActiveTab(); tab != nil {
				tab.ScrollOffset = p.state.previewScrollOff
			}
			return p, nil
		case "h", "left":
			// Previous tab (F-3)
			if len(p.state.Tabs.Tabs) > 1 {
				p.state.Tabs.ActiveIdx = (p.state.Tabs.ActiveIdx - 1 + len(p.state.Tabs.Tabs)) % len(p.state.Tabs.Tabs)
				p.syncFromActiveTab()
			}
			return p, nil
		case "l", "right":
			// Next tab (F-3)
			if len(p.state.Tabs.Tabs) > 1 {
				p.state.Tabs.ActiveIdx = (p.state.Tabs.ActiveIdx + 1) % len(p.state.Tabs.Tabs)
				p.syncFromActiveTab()
			}
			return p, nil
		case "x":
			// Close active tab (F-3)
			if len(p.state.Tabs.Tabs) > 0 {
				p.state.Tabs.CloseActive()
				p.syncFromActiveTab()
			}
			return p, nil
		case "b":
			// Toggle blame view (F-7)
			if p.state.PreviewPath != "" && p.state.PreviewContent != "" {
				p.state.blameMode = !p.state.blameMode
				if p.state.blameMode && p.state.blameLines == nil && p.state.blameError == "" {
					return p, p.loadBlameCmd(p.state.PreviewPath)
				}
			}
			return p, nil
		case "e":
			// Enter edit mode (F-6)
			if p.state.PreviewPath != "" && p.state.PreviewContent != "" && !p.ctx.DemoMode {
				p.enterEditMode()
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
				// Open in tab (F-3)
				isNew := p.state.Tabs.OpenTab(node.Path, node.Name)
				if isNew {
					return p, p.loadPreviewForTab(node.Path)
				}
				// Tab already exists, just sync preview state
				if tab := p.state.Tabs.ActiveTab(); tab != nil {
					p.state.PreviewPath = tab.Path
					p.state.PreviewContent = tab.Content
					p.state.previewScrollOff = tab.ScrollOffset
					p.highlighter = tab.Highlighter
				}
			}
		}
		return p, nil
	case "x":
		// Close active tab (F-3)
		if p.state.activePane == ui.PaneLeft && len(p.state.Tabs.Tabs) > 0 {
			p.state.Tabs.CloseActive()
			if tab := p.state.Tabs.ActiveTab(); tab != nil {
				p.state.PreviewPath = tab.Path
				p.state.PreviewContent = tab.Content
				p.state.previewScrollOff = tab.ScrollOffset
				p.highlighter = tab.Highlighter
			} else {
				p.state.PreviewPath = ""
				p.state.PreviewContent = ""
				p.state.previewScrollOff = 0
				p.highlighter = nil
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

// syncFromActiveTab syncs the preview state from the currently active tab (F-3)
func (p *FilesPlugin) syncFromActiveTab() {
	tab := p.state.Tabs.ActiveTab()
	if tab == nil {
		p.state.PreviewPath = ""
		p.state.PreviewContent = ""
		p.state.previewScrollOff = 0
		p.highlighter = nil
		return
	}
	p.state.PreviewPath = tab.Path
	p.state.PreviewContent = tab.Content
	p.state.previewScrollOff = tab.ScrollOffset
	p.highlighter = tab.Highlighter
}

// loadPreviewForTab loads file content into the active tab (F-3)
func (p *FilesPlugin) loadPreviewForTab(path string) tea.Cmd {
	return LoadFileContentCmd(path, ViewFiles, p.ctx.Epoch)
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

	return LoadFileContentCmd(node.Path, ViewFiles, p.ctx.Epoch)
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

// FileGitStatusLoadedMsg carries git status for annotation on the file tree (F-2)
type FileGitStatusLoadedMsg struct {
	StatusMap map[string]string // relative path → status indicator
	Error     error
}

// loadFileGitStatusCmd loads git status for annotation on the file tree (F-2).
func (p *FilesPlugin) loadFileGitStatusCmd() tea.Cmd {
	projectDir := p.ctx.ProjectDir
	return func() tea.Msg {
		cmd := exec.Command("git", "-C", projectDir, "status", "--porcelain")
		out, err := cmd.Output()
		if err != nil {
			return FileGitStatusLoadedMsg{Error: err}
		}

		statusMap := make(map[string]string)
		for _, line := range strings.Split(string(out), "\n") {
			if len(line) < 4 {
				continue
			}
			x := line[0]
			y := line[1]
			path := strings.TrimSpace(line[3:])

			// Determine display indicator
			switch {
			case x == '?' && y == '?':
				statusMap[path] = "?"
			case x == 'A' || (x == ' ' && y == 'A'):
				statusMap[path] = "A"
			case x == 'D' || y == 'D':
				statusMap[path] = "D"
			case x == 'R' || y == 'R':
				statusMap[path] = "R"
			case x == 'M' || y == 'M':
				statusMap[path] = "M"
			}
		}

		return FileGitStatusLoadedMsg{StatusMap: statusMap, Error: nil}
	}
}

// fileGitStatus returns the git status indicator for a given file node,
// using the relative path from the project root.
func (p *FilesPlugin) fileGitStatus(node *FileNode) string {
	if p.state.GitStatusMap == nil || node.IsDir {
		return ""
	}
	// Compute relative path from project dir
	rel, err := filepath.Rel(p.ctx.ProjectDir, node.Path)
	if err != nil {
		return ""
	}
	// Normalize to forward slashes for matching
	rel = filepath.ToSlash(rel)
	return p.state.GitStatusMap[rel]
}

// ── Edit Mode (F-6) ───────────────────────────────────────────────────────────

// enterEditMode initializes the textarea with current file content and enters edit mode.
func (p *FilesPlugin) enterEditMode() {
	ta := textarea.New()
	ta.SetValue(p.state.PreviewContent)
	ta.Focus()
	ta.CharLimit = 0 // No limit for file editing
	// Size will be set in renderEditPane based on available dimensions
	ta.SetWidth(p.state.previewWidth - 6)
	ta.SetHeight(p.height - 8) // Leave room for header/footer
	ta.ShowLineNumbers = true

	p.state.editMode = true
	p.state.editTextarea = ta
	p.state.editPath = p.state.PreviewPath
}

// handleEditModeKey handles keys when in file edit mode (F-6).
func (p *FilesPlugin) handleEditModeKey(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	switch key {
	case "esc":
		// Cancel editing, discard changes
		p.state.editMode = false
		p.state.editPath = ""
		return p, nil

	case "ctrl+s":
		// Save file to disk
		content := p.state.editTextarea.Value()
		path := p.state.editPath
		return p, saveFileCmd(path, content)
	}

	// Forward all other keys to textarea
	var cmd tea.Cmd
	p.state.editTextarea, cmd = p.state.editTextarea.Update(msg)
	return p, cmd
}

// renderEditPane renders the textarea editor in the preview pane (F-6).
func (p *FilesPlugin) renderEditPane(previewWidth, innerHeight int) string {
	var sb strings.Builder

	// Header
	name := filepath.Base(p.state.editPath)
	header := fmt.Sprintf("EDITING: %s", name)
	sb.WriteString(styles.WarningStyle.Render(header))
	sb.WriteString("\n")

	// Adjust textarea dimensions to fit
	editHeight := innerHeight - 3 // header + hint line + margin
	if editHeight < 5 {
		editHeight = 5
	}
	editWidth := previewWidth - 6
	if editWidth < 20 {
		editWidth = 20
	}
	p.state.editTextarea.SetWidth(editWidth)
	p.state.editTextarea.SetHeight(editHeight)

	sb.WriteString(p.state.editTextarea.View())
	sb.WriteString("\n")
	sb.WriteString(styles.DimStyle.Render("ctrl+s save │ esc cancel"))

	return sb.String()
}

// saveFileCmd writes content to a file path asynchronously (F-6).
func saveFileCmd(path, content string) tea.Cmd {
	return func() tea.Msg {
		err := os.WriteFile(path, []byte(content), 0644)
		return FileSavedMsg{Path: path, Error: err}
	}
}

// BlameLine holds parsed blame annotation for a single line (F-7)
type BlameLine struct {
	Hash   string // Short commit hash
	Author string // Author name
	Age    string // Relative time (e.g., "3d", "2mo", "1yr")
}

// BlameLoadedMsg carries parsed blame data for a file (F-7)
type BlameLoadedMsg struct {
	Lines []BlameLine
	Path  string
	Error error
	Epoch uint64
}

// loadBlameCmd runs `git blame --porcelain` and parses the output (F-7).
func (p *FilesPlugin) loadBlameCmd(path string) tea.Cmd {
	projectDir := p.ctx.ProjectDir
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		cmd := exec.Command("git", "-C", projectDir, "blame", "--porcelain", path)
		out, err := cmd.Output()
		if err != nil {
			return BlameLoadedMsg{Error: fmt.Errorf("not tracked by git"), Path: path, Epoch: epoch}
		}

		lines := parseBlameOutput(string(out))
		return BlameLoadedMsg{Lines: lines, Path: path, Epoch: epoch}
	}
}

// parseBlameOutput parses `git blame --porcelain` output into per-line BlameLine entries.
// The porcelain format has blocks: first line is "hash origLine finalLine [numLines]",
// followed by header lines (author, author-time, etc.), then a TAB-prefixed content line.
func parseBlameOutput(output string) []BlameLine {
	var result []BlameLine
	rawLines := strings.Split(output, "\n")

	// Track commit metadata: hash -> {author, timestamp}
	type commitMeta struct {
		author string
		time   int64
	}
	commits := make(map[string]*commitMeta)

	i := 0
	for i < len(rawLines) {
		line := rawLines[i]
		if line == "" {
			i++
			continue
		}

		// A commit header line starts with a 40-char hash
		parts := strings.Fields(line)
		if len(parts) < 3 || len(parts[0]) < 40 {
			i++
			continue
		}

		hash := parts[0][:8] // Short hash

		// Check if we've seen this commit before
		meta, known := commits[hash]
		if !known {
			meta = &commitMeta{author: "unknown"}
			commits[hash] = meta
		}

		i++
		// Read header lines until we hit a TAB-prefixed content line
		for i < len(rawLines) {
			if strings.HasPrefix(rawLines[i], "\t") {
				// This is the actual content line — we're done with this block
				i++
				break
			}
			headerLine := rawLines[i]
			if strings.HasPrefix(headerLine, "author ") {
				meta.author = strings.TrimPrefix(headerLine, "author ")
			} else if strings.HasPrefix(headerLine, "author-time ") {
				var ts int64
				fmt.Sscanf(strings.TrimPrefix(headerLine, "author-time "), "%d", &ts)
				meta.time = ts
			}
			i++
		}

		// Compute age string
		age := ""
		if meta.time > 0 {
			age = relativeAge(meta.time)
		}

		// Truncate author to 8 chars
		author := meta.author
		if len(author) > 8 {
			author = author[:8]
		}

		result = append(result, BlameLine{
			Hash:   hash,
			Author: author,
			Age:    age,
		})
	}

	return result
}

// relativeAge converts a unix timestamp to a short relative age string (F-7).
func relativeAge(ts int64) string {
	now := time.Now().Unix()
	diff := now - ts
	if diff < 0 {
		diff = 0
	}

	switch {
	case diff < 3600:
		return fmt.Sprintf("%dm", diff/60)
	case diff < 86400:
		return fmt.Sprintf("%dh", diff/3600)
	case diff < 86400*30:
		return fmt.Sprintf("%dd", diff/86400)
	case diff < 86400*365:
		return fmt.Sprintf("%dmo", diff/(86400*30))
	default:
		return fmt.Sprintf("%dy", diff/(86400*365))
	}
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
		return `module github.com/prism-plugin/prism-cli

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

	"github.com/prism-plugin/prism-cli/app"
	"github.com/spf13/cobra"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "prism-cli",
		Short: "Prism CLI Dashboard",
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
