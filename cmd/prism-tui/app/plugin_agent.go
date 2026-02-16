package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/app/chat"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// AgentState holds state for the agent chat interface
type AgentState struct {
	Messages         []chat.Message
	MessageViewport  viewport.Model
	Input            textarea.Model
	WideMode         bool // true = sidebar + chat, false = chat only
	ConversationList []string
	SelectedConv     int
	InputFocused     bool
	ToolsCollapsed   map[int]bool // Track which tool messages are collapsed
}

// AgentPlugin implements the Agent chat interface
type AgentPlugin struct {
	ctx     *plugin.Context
	state   AgentState
	focused bool
}

// NewAgentPlugin creates a new Agent plugin instance
func NewAgentPlugin() *AgentPlugin {
	// Initialize textarea for message input
	ta := textarea.New()
	ta.Placeholder = "Type a message... (Ctrl+Enter to send)"
	ta.SetHeight(3)
	ta.SetWidth(50)
	ta.CharLimit = 2000
	ta.ShowLineNumbers = false

	return &AgentPlugin{
		state: AgentState{
			Messages:       []chat.Message{},
			WideMode:       true,
			ConversationList: []string{"Current Session"},
			SelectedConv:   0,
			Input:          ta,
			InputFocused:   true,
			ToolsCollapsed: make(map[int]bool),
		},
	}
}

// ID returns the plugin identifier
func (p *AgentPlugin) ID() string {
	return "agent"
}

// Name returns the display name
func (p *AgentPlugin) Name() string {
	return "Agent"
}

// Icon returns the tab icon
func (p *AgentPlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context
func (p *AgentPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize viewport for message history
	p.state.MessageViewport = viewport.New(ctx.Width-4, ctx.Height-10)
	p.state.Input.SetWidth(ctx.Width - 10)
	return nil
}

// Start is called when the plugin is first activated
func (p *AgentPlugin) Start() tea.Cmd {
	// Focus the input when the plugin starts
	p.state.Input.Focus()
	p.state.InputFocused = true
	return textarea.Blink
}

// Stop is called when deactivated
func (p *AgentPlugin) Stop() {
	p.state.Input.Blur()
	p.state.InputFocused = false
}

// Update handles messages
func (p *AgentPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case plugin.PluginResizeMsg:
		// Update viewport and input dimensions
		viewportHeight := msg.Height - 12 // Leave room for header, input, footer
		if viewportHeight < 10 {
			viewportHeight = 10
		}

		inputWidth := msg.Width - 10
		if p.state.WideMode {
			inputWidth = (msg.Width * 2 / 3) - 6 // 2/3 width in wide mode
		}

		p.state.MessageViewport.Width = inputWidth
		p.state.MessageViewport.Height = viewportHeight
		p.state.Input.SetWidth(inputWidth)

		return p, nil
	}

	// Update input if focused
	if p.state.InputFocused {
		p.state.Input, cmd = p.state.Input.Update(msg)
		cmds = append(cmds, cmd)
	}

	// Update viewport
	p.state.MessageViewport, cmd = p.state.MessageViewport.Update(msg)
	cmds = append(cmds, cmd)

	return p, tea.Batch(cmds...)
}

// View renders the agent chat interface
func (p *AgentPlugin) View(width, height int) string {
	var sections []string

	// Powerline breadcrumb header
	sections = append(sections, renderBreadcrumb("Agent", width, p.ctx.HasNerdFont))
	sections = append(sections, "")

	// Main content area
	if p.state.WideMode {
		// Wide mode: sidebar + chat
		content := p.renderWideMode(width, height-6)
		sections = append(sections, content)
	} else {
		// Compact mode: full-width chat
		content := p.renderCompactMode(width, height-6)
		sections = append(sections, content)
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *AgentPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *AgentPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused {
		p.state.Input.Focus()
		p.state.InputFocused = true
	} else {
		p.state.Input.Blur()
		p.state.InputFocused = false
	}
}

// KeyHints returns footer key hints
func (p *AgentPlugin) KeyHints() []plugin.KeyHint {
	return []plugin.KeyHint{
		{Key: "ctrl+enter", Description: "send"},
		{Key: "ctrl+b", Description: "toggle sidebar"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *AgentPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	switch key {
	case "ctrl+b":
		// Toggle wide/compact mode
		p.state.WideMode = !p.state.WideMode
		return p, nil

	case "ctrl+enter":
		// Send message
		if p.state.InputFocused {
			return p, p.sendMessage()
		}
		return p, nil

	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}

	case "ctrl+c":
		// Let ctrl+c bubble up for quit
		return p, nil

	default:
		// Forward to input if focused
		if p.state.InputFocused {
			var cmd tea.Cmd
			p.state.Input, cmd = p.state.Input.Update(msg)
			return p, cmd
		}
	}

	return p, nil
}

// renderWideMode renders the two-pane layout with sidebar
func (p *AgentPlugin) renderWideMode(width, height int) string {
	// Sidebar width (1/3 of total)
	sidebarWidth := width / 3
	if sidebarWidth < 20 {
		sidebarWidth = 20
	}

	// Chat area width (2/3 of total)
	chatWidth := width - sidebarWidth - 4

	// Render sidebar (conversation list)
	sidebar := p.renderSidebar(sidebarWidth, height)

	// Render chat area (messages + input)
	chatArea := p.renderChatArea(chatWidth, height)

	// Combine side by side
	sidebarLines := strings.Split(sidebar, "\n")
	chatLines := strings.Split(chatArea, "\n")

	maxLines := len(sidebarLines)
	if len(chatLines) > maxLines {
		maxLines = len(chatLines)
	}

	var combined []string
	for i := 0; i < maxLines; i++ {
		left := ""
		right := ""

		if i < len(sidebarLines) {
			left = sidebarLines[i]
		} else {
			left = strings.Repeat(" ", sidebarWidth)
		}

		if i < len(chatLines) {
			right = chatLines[i]
		}

		combined = append(combined, left+"  "+right)
	}

	return strings.Join(combined, "\n")
}

// renderCompactMode renders the full-width chat area
func (p *AgentPlugin) renderCompactMode(width, height int) string {
	return p.renderChatArea(width-4, height)
}

// renderSidebar renders the conversation list
func (p *AgentPlugin) renderSidebar(width, height int) string {
	var lines []string

	// Title
	title := styles.PanelTitleStyle.Render("Conversations")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	// Conversation list
	for i, conv := range p.state.ConversationList {
		selected := i == p.state.SelectedConv
		icon := "○"
		if selected {
			icon = "●"
		}

		line := fmt.Sprintf("  %s %s", icon, conv)
		if selected {
			line = styles.CurrentStyle.Render(line)
		} else {
			line = styles.DimStyle.Render(line)
		}

		lines = append(lines, line)
	}

	// Pad to height
	for len(lines) < height {
		lines = append(lines, "")
	}

	// Apply border
	content := strings.Join(lines, "\n")
	bordered := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Dim).
		Width(width).
		Height(height).
		Render(content)

	return bordered
}

// renderChatArea renders the message history and input area
func (p *AgentPlugin) renderChatArea(width, height int) string {
	var sections []string

	// Message history viewport
	historyHeight := height - 6 // Leave room for input area
	if historyHeight < 5 {
		historyHeight = 5
	}

	// Render messages
	messageContent := p.renderMessages(width - 4)
	p.state.MessageViewport.SetContent(messageContent)
	p.state.MessageViewport.Width = width - 2
	p.state.MessageViewport.Height = historyHeight

	historyView := p.state.MessageViewport.View()
	historyBordered := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Dim).
		Width(width).
		Height(historyHeight + 2).
		Render(historyView)

	sections = append(sections, historyBordered)
	sections = append(sections, "")

	// Input area
	inputView := p.state.Input.View()
	inputBordered := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Info).
		Width(width).
		Render(inputView)

	sections = append(sections, inputBordered)

	return strings.Join(sections, "\n")
}

// renderMessages renders all messages in the chat
func (p *AgentPlugin) renderMessages(width int) string {
	if len(p.state.Messages) == 0 {
		return styles.DimStyle.Render("  No messages yet. Start a conversation!")
	}

	var rendered []string
	for i, msg := range p.state.Messages {
		collapsed := p.state.ToolsCollapsed[i]
		msgRendered := chat.RenderMessage(msg, width, collapsed)
		rendered = append(rendered, msgRendered)
		rendered = append(rendered, "") // Spacing between messages
	}

	return strings.Join(rendered, "\n")
}

// sendMessage sends the current input as a message
func (p *AgentPlugin) sendMessage() tea.Cmd {
	content := strings.TrimSpace(p.state.Input.Value())
	if content == "" {
		return nil
	}

	// Add user message
	userMsg := chat.Message{
		Type:    chat.MessageTypeUser,
		Content: content,
	}
	p.state.Messages = append(p.state.Messages, userMsg)

	// Clear input
	p.state.Input.Reset()

	// TODO: Send to Claude CLI and stream response
	// For now, add a placeholder assistant response
	return func() tea.Msg {
		// Placeholder: In a real implementation, this would call claude CLI
		// and stream the response back
		assistantMsg := chat.Message{
			Type:    chat.MessageTypeAssistant,
			Content: "I'm a placeholder response. In the future, I'll integrate with the Claude CLI to provide real responses.",
		}
		return AddMessageMsg{Message: assistantMsg}
	}
}

// AddMessageMsg signals that a new message should be added to the chat
type AddMessageMsg struct {
	Message chat.Message
}
