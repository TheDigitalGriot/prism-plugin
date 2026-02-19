package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/app/chat"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// inputChromeHeight is the fixed number of lines the input area consumes:
// 1 separator rule + 1 model/prompt line = 2 lines total.
const inputChromeHeight = 2

// sidebarRatio is the percentage of width given to the conversation sidebar.
const sidebarRatio = 25

// AgentState holds state for the agent chat interface
type AgentState struct {
	Messages         []chat.Message
	MessageViewport  viewport.Model
	SidebarViewport  viewport.Model
	Input            textinput.Model
	InputFocused     bool
	ToolsCollapsed   map[int]bool
	ConversationList []string
	SelectedConv     int
	WideMode         bool // true = sidebar + chat, false = chat only
}

// AgentPlugin implements the Agent chat interface
type AgentPlugin struct {
	ctx     *plugin.Context
	state   AgentState
	focused bool
	width   int
	height  int
}

// NewAgentPlugin creates a new Agent plugin instance
func NewAgentPlugin() *AgentPlugin {
	ti := textinput.New()
	ti.Placeholder = "Type a message… (Ctrl+Enter to send)"
	ti.CharLimit = 2000
	ti.Width = 50

	return &AgentPlugin{
		state: AgentState{
			Messages:   []chat.Message{},
			Input:      ti,
			InputFocused: true,
			ToolsCollapsed: make(map[int]bool),
			ConversationList: []string{
				"Current Session",
				"Research: auth flow",
				"Debug: API timeout",
				"Plan: migration v2",
			},
			SelectedConv: 0,
			WideMode:     true,
		},
	}
}

// ID returns the plugin identifier
func (p *AgentPlugin) ID() string { return "agent" }

// Name returns the display name
func (p *AgentPlugin) Name() string { return "Agent" }

// Icon returns the tab icon
func (p *AgentPlugin) Icon() string { return "" }

// Init initializes the plugin with context
func (p *AgentPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.state.MessageViewport = viewport.New(ctx.Width-4, ctx.Height-inputChromeHeight-1)
	p.state.SidebarViewport = viewport.New(20, ctx.Height-1)
	p.state.Input.Width = ctx.Width - 10
	return nil
}

// Start is called when the plugin is first activated
func (p *AgentPlugin) Start() tea.Cmd {
	p.state.Input.Focus()
	p.state.InputFocused = true
	return textinput.Blink
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
		p.width = msg.Width
		p.height = msg.Height
		return p, nil

	case AddMessageMsg:
		p.state.Messages = append(p.state.Messages, msg.Message)
		return p, nil
	}

	if p.state.InputFocused {
		p.state.Input, cmd = p.state.Input.Update(msg)
		cmds = append(cmds, cmd)
	}

	p.state.MessageViewport, cmd = p.state.MessageViewport.Update(msg)
	cmds = append(cmds, cmd)

	return p, tea.Batch(cmds...)
}

// View renders the agent chat interface.
// Layout: breadcrumb + body = height (measured dynamically to avoid off-by-one)
func (p *AgentPlugin) View(width, height int) string {
	breadcrumb := renderBreadcrumb("Agent", width, p.ctx.HasNerdFont)

	bcHeight := lipgloss.Height(breadcrumb)
	contentHeight := height - bcHeight
	if contentHeight < 3 {
		contentHeight = 3
	}

	var body string
	if p.state.WideMode && width >= 60 {
		body = p.renderWideLayout(width, contentHeight)
	} else {
		body = p.renderChatColumn(width, contentHeight)
	}

	return lipgloss.JoinVertical(lipgloss.Left, breadcrumb, body)
}

// renderWideLayout renders sidebar + divider + chat side by side.
// Both columns produce exactly contentHeight lines, joined horizontally via manual line zipping.
func (p *AgentPlugin) renderWideLayout(width, contentHeight int) string {
	sidebarWidth := width * sidebarRatio / 100
	if sidebarWidth < 20 {
		sidebarWidth = 20
	}
	dividerWidth := 1
	chatWidth := width - sidebarWidth - dividerWidth

	sidebarStr := p.renderSidebar(sidebarWidth, contentHeight)
	chatStr := p.renderChatColumn(chatWidth, contentHeight)

	// Divider column (thin vertical line)
	divStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	divLine := divStyle.Render("│")

	sidebarLines := strings.Split(sidebarStr, "\n")
	chatLines := strings.Split(chatStr, "\n")

	var combined []string
	for i := 0; i < contentHeight; i++ {
		left := ""
		if i < len(sidebarLines) {
			left = sidebarLines[i]
		}
		// Pad left to exact sidebar width
		leftW := lipgloss.Width(left)
		if leftW < sidebarWidth {
			left += strings.Repeat(" ", sidebarWidth-leftW)
		}

		right := ""
		if i < len(chatLines) {
			right = chatLines[i]
		}

		combined = append(combined, left+divLine+right)
	}
	return strings.Join(combined, "\n")
}

// renderChatColumn renders the chat viewport + separator + input as exactly `height` lines.
func (p *AgentPlugin) renderChatColumn(width, height int) string {
	vpHeight := height - inputChromeHeight
	if vpHeight < 1 {
		vpHeight = 1
	}

	// Sync viewport
	p.state.MessageViewport.Width = width - 2
	p.state.MessageViewport.Height = vpHeight
	content := p.renderMessages(width - 2)
	p.state.MessageViewport.SetContent(content)

	vpView := p.state.MessageViewport.View()

	// Pad/truncate viewport to exact height
	vpLines := strings.Split(vpView, "\n")
	for len(vpLines) < vpHeight {
		vpLines = append(vpLines, "")
	}
	if len(vpLines) > vpHeight {
		vpLines = vpLines[:vpHeight]
	}

	// Separator
	sepStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	separator := sepStyle.Render(strings.Repeat("─", width))

	// Input prompt
	promptStyle := lipgloss.NewStyle().Foreground(styles.Primary).Bold(true)
	p.state.Input.Width = width - 6
	inputLine := " " + promptStyle.Render("❯ ") + p.state.Input.View()

	return strings.Join(vpLines, "\n") + "\n" + separator + "\n" + inputLine
}

// renderSidebar renders the conversation list as exactly `height` lines with a scrollable viewport.
func (p *AgentPlugin) renderSidebar(width, height int) string {
	// Build conversation list content for the viewport
	var lines []string

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.White)
	lines = append(lines, " "+titleStyle.Render("Conversations"))
	lines = append(lines, "")

	for i, conv := range p.state.ConversationList {
		selected := i == p.state.SelectedConv

		var icon string
		if selected {
			icon = "●"
		} else {
			icon = "○"
		}

		label := fmt.Sprintf(" %s %s", icon, conv)

		// Truncate if wider than sidebar
		if lipgloss.Width(label) > width-1 {
			label = label[:width-2] + "…"
		}

		if selected {
			line := lipgloss.NewStyle().
				Foreground(styles.Primary).
				Bold(true).
				Background(styles.Secondary).
				Width(width).
				Render(label)
			lines = append(lines, line)
		} else {
			line := lipgloss.NewStyle().
				Foreground(styles.Dim).
				Render(label)
			lines = append(lines, line)
		}
	}

	// Set viewport content and dimensions
	p.state.SidebarViewport.Width = width
	p.state.SidebarViewport.Height = height
	p.state.SidebarViewport.SetContent(strings.Join(lines, "\n"))

	vpView := p.state.SidebarViewport.View()

	// Pad/truncate to exact height
	vpLines := strings.Split(vpView, "\n")
	for len(vpLines) < height {
		vpLines = append(vpLines, "")
	}
	if len(vpLines) > height {
		vpLines = vpLines[:height]
	}

	return strings.Join(vpLines, "\n")
}

// IsFocused returns whether the plugin is active
func (p *AgentPlugin) IsFocused() bool { return p.focused }

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
		p.state.WideMode = !p.state.WideMode
		return p, nil

	case "ctrl+enter":
		if p.state.InputFocused {
			return p, p.sendMessage()
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}

	case "ctrl+c":
		return p, nil

	default:
		if p.state.InputFocused {
			var cmd tea.Cmd
			p.state.Input, cmd = p.state.Input.Update(msg)
			return p, cmd
		}
	}

	return p, nil
}

// renderMessages renders all messages as inline text
func (p *AgentPlugin) renderMessages(width int) string {
	if len(p.state.Messages) == 0 {
		return styles.DimStyle.Render("  No messages yet. Start a conversation!")
	}

	var rendered []string
	for i, msg := range p.state.Messages {
		collapsed := p.state.ToolsCollapsed[i]
		msgRendered := chat.RenderMessage(msg, width, collapsed)
		rendered = append(rendered, msgRendered)
		rendered = append(rendered, "")
	}
	return strings.Join(rendered, "\n")
}

// sendMessage sends the current input as a message
func (p *AgentPlugin) sendMessage() tea.Cmd {
	content := strings.TrimSpace(p.state.Input.Value())
	if content == "" {
		return nil
	}

	userMsg := chat.Message{
		Type:    chat.MessageTypeUser,
		Content: content,
	}
	p.state.Messages = append(p.state.Messages, userMsg)
	p.state.Input.Reset()

	return func() tea.Msg {
		return AddMessageMsg{Message: chat.Message{
			Type:    chat.MessageTypeAssistant,
			Content: fmt.Sprintf("I'm a placeholder response. In the future, I'll integrate with the Claude CLI to provide real responses."),
		}}
	}
}

// AddMessageMsg signals that a new message should be added to the chat
type AddMessageMsg struct {
	Message chat.Message
}
