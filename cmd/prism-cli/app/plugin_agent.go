package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/app/adapter"
	"github.com/prism-plugin/prism-cli/app/chat"
	"github.com/prism-plugin/prism-cli/markdown"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/styles"
)

// inputChromeHeight is the fixed number of lines the input area consumes:
// 1 separator rule + 1 model/prompt line = 2 lines total.
const inputChromeHeight = 2

// sidebarRatio is the percentage of width given to the conversation sidebar.
const sidebarRatio = 25

// SessionGroup represents a date-grouped section in the sidebar
type SessionGroup struct {
	Label    string
	Sessions []adapter.Session
}

// AgentState holds state for the agent chat interface
type AgentState struct {
	Messages         []chat.Message
	MessageViewport  viewport.Model
	SidebarViewport  viewport.Model
	Input            textinput.Model
	InputFocused     bool
	ToolsCollapsed   map[int]bool
	WideMode         bool // true = sidebar + chat, false = chat only
	MarkdownMode     bool // true = render markdown via Glamour (A-6)

	// Session list (A-2)
	Sessions     []adapter.Session // All sessions from adapters
	Groups       []SessionGroup    // Date-grouped sessions for sidebar display
	SelectedConv int               // Global index across flattened session list
	SessionsLoaded bool            // True once initial scan has completed

	// Analytics view (A-5)
	AnalyticsMode   bool // true = show analytics instead of chat
	AnalyticsScroll int  // scroll offset for analytics content

	// Legacy fallback (used in demo mode)
	ConversationList []string
}

// AgentPlugin implements the Agent chat interface
type AgentPlugin struct {
	ctx      *plugin.Context
	state    AgentState
	focused  bool
	width    int
	height   int
	adapters []adapter.Adapter // Registered adapters (A-1)
}

// NewAgentPlugin creates a new Agent plugin instance
func NewAgentPlugin() *AgentPlugin {
	ti := textinput.New()
	ti.Placeholder = "Type a message… (Ctrl+Enter to send)"
	ti.CharLimit = 2000
	ti.Width = 50

	return &AgentPlugin{
		state: AgentState{
			Messages:       []chat.Message{},
			Input:          ti,
			InputFocused:   true,
			ToolsCollapsed: make(map[int]bool),
			SelectedConv:   0,
			WideMode:       true,
			MarkdownMode:   true, // Default to rendered markdown
			ConversationList: []string{
				"Current Session",
				"Research: auth flow",
				"Debug: API timeout",
				"Plan: migration v2",
			},
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

	// Register adapters (A-1)
	p.adapters = []adapter.Adapter{
		adapter.NewClaudeAdapter(""),
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *AgentPlugin) Start() tea.Cmd {
	p.state.Input.Focus()
	p.state.InputFocused = true

	if p.ctx.DemoMode {
		return textinput.Blink
	}

	// Scan sessions from adapters (A-2)
	return tea.Batch(textinput.Blink, p.scanSessionsCmd())
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

	case SessionsLoadedMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error == nil {
			p.state.Sessions = msg.Sessions
			p.state.Groups = groupSessionsByDate(msg.Sessions)
			p.state.SessionsLoaded = true
			if p.state.SelectedConv >= len(msg.Sessions) {
				p.state.SelectedConv = 0
			}
		}
		return p, nil

	case SessionMessagesLoadedMsg:
		if msg.Epoch != p.ctx.Epoch {
			return p, nil
		}
		if msg.Error == nil {
			p.state.Messages = msg.Messages
			p.state.ToolsCollapsed = make(map[int]bool)
		}
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
	} else if p.state.AnalyticsMode {
		body = p.renderAnalytics(width, contentHeight)
	} else {
		body = p.renderChatColumn(width, contentHeight)
	}

	return lipgloss.JoinVertical(lipgloss.Left, breadcrumb, body)
}

// renderWideLayout renders sidebar + divider + chat/analytics side by side.
func (p *AgentPlugin) renderWideLayout(width, contentHeight int) string {
	sidebarWidth := width * sidebarRatio / 100
	if sidebarWidth < 20 {
		sidebarWidth = 20
	}
	dividerWidth := 1
	chatWidth := width - sidebarWidth - dividerWidth

	sidebarStr := p.renderSidebar(sidebarWidth, contentHeight)
	var chatStr string
	if p.state.AnalyticsMode {
		chatStr = p.renderAnalytics(chatWidth, contentHeight)
	} else {
		chatStr = p.renderChatColumn(chatWidth, contentHeight)
	}

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

	p.state.MessageViewport.Width = width - 2
	p.state.MessageViewport.Height = vpHeight
	content := p.renderMessages(width - 2)
	p.state.MessageViewport.SetContent(content)

	vpView := p.state.MessageViewport.View()

	vpLines := strings.Split(vpView, "\n")
	for len(vpLines) < vpHeight {
		vpLines = append(vpLines, "")
	}
	if len(vpLines) > vpHeight {
		vpLines = vpLines[:vpHeight]
	}

	sepStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	separator := sepStyle.Render(strings.Repeat("─", width))

	promptStyle := lipgloss.NewStyle().Foreground(styles.Primary).Bold(true)
	p.state.Input.Width = width - 6
	inputLine := " " + promptStyle.Render("❯ ") + p.state.Input.View()

	return strings.Join(vpLines, "\n") + "\n" + separator + "\n" + inputLine
}

// renderSidebar renders the session list grouped by date (A-2).
func (p *AgentPlugin) renderSidebar(width, height int) string {
	var lines []string

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.White)
	lines = append(lines, " "+titleStyle.Render("Conversations"))
	lines = append(lines, "")

	// Use demo data if in demo mode or sessions not yet loaded
	if p.ctx.DemoMode || !p.state.SessionsLoaded {
		lines = append(lines, p.renderLegacySidebar(width)...)
	} else if len(p.state.Sessions) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(styles.Dim).Render("  No sessions found"))
	} else {
		lines = append(lines, p.renderGroupedSessions(width)...)
	}

	p.state.SidebarViewport.Width = width
	p.state.SidebarViewport.Height = height
	p.state.SidebarViewport.SetContent(strings.Join(lines, "\n"))

	vpView := p.state.SidebarViewport.View()

	vpLines := strings.Split(vpView, "\n")
	for len(vpLines) < height {
		vpLines = append(vpLines, "")
	}
	if len(vpLines) > height {
		vpLines = vpLines[:height]
	}

	return strings.Join(vpLines, "\n")
}

// renderLegacySidebar renders the old hardcoded conversation list (demo mode fallback)
func (p *AgentPlugin) renderLegacySidebar(width int) []string {
	var lines []string
	for i, conv := range p.state.ConversationList {
		selected := i == p.state.SelectedConv

		icon := "○"
		if selected {
			icon = "●"
		}

		label := fmt.Sprintf(" %s %s", icon, conv)
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
	return lines
}

// renderGroupedSessions renders sessions grouped by date (A-2)
func (p *AgentPlugin) renderGroupedSessions(width int) []string {
	var lines []string
	globalIdx := 0

	groupHeaderStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Info)
	timeStyle := lipgloss.NewStyle().Foreground(styles.Dim)

	for _, group := range p.state.Groups {
		// Group header
		lines = append(lines, " "+groupHeaderStyle.Render(group.Label))

		for _, session := range group.Sessions {
			selected := globalIdx == p.state.SelectedConv

			icon := "○"
			if selected {
				icon = "●"
			}

			// Title truncation
			title := session.Title
			maxTitleWidth := width - 5
			if maxTitleWidth > 3 && len(title) > maxTitleWidth {
				title = title[:maxTitleWidth-1] + "…"
			}

			label := fmt.Sprintf(" %s %s", icon, title)

			if selected {
				line := lipgloss.NewStyle().
					Foreground(styles.Primary).
					Bold(true).
					Background(styles.Secondary).
					Width(width).
					Render(label)
				lines = append(lines, line)
			} else {
				lines = append(lines, lipgloss.NewStyle().
					Foreground(styles.White).
					Render(label))
			}

			// Metadata line: time ago + message count
			meta := fmt.Sprintf("    %s · %d msgs", timeAgo(session.UpdatedAt), session.MessageCount)
			if session.Model != "" {
				shortModel := session.Model
				if len(shortModel) > 15 {
					shortModel = shortModel[:15]
				}
				meta += " · " + shortModel
			}
			lines = append(lines, timeStyle.Render(meta))

			globalIdx++
		}

		lines = append(lines, "") // Space between groups
	}

	return lines
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
	if p.state.AnalyticsMode {
		return []plugin.KeyHint{
			{Key: "j/k", Description: "scroll"},
			{Key: "a", Description: "back to chat"},
			{Key: "ctrl+b", Description: "toggle sidebar"},
			{Key: "esc", Description: "home"},
		}
	}
	return []plugin.KeyHint{
		{Key: "j/k", Description: "sessions"},
		{Key: "enter", Description: "load"},
		{Key: "a", Description: "analytics"},
		{Key: "m", Description: "toggle markdown"},
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

	case "m":
		// Toggle markdown rendering (A-6)
		if !p.state.InputFocused {
			p.state.MarkdownMode = !p.state.MarkdownMode
			return p, nil
		}

	case "a":
		// Toggle analytics view (A-5)
		if !p.state.InputFocused {
			p.state.AnalyticsMode = !p.state.AnalyticsMode
			p.state.AnalyticsScroll = 0
			return p, nil
		}

	case "j", "down":
		if !p.state.InputFocused {
			if p.state.AnalyticsMode {
				// Scroll analytics view (A-5)
				p.state.AnalyticsScroll++
				return p, nil
			}
			// Navigate sessions in sidebar (A-2)
			total := p.totalSessions()
			if total > 0 && p.state.SelectedConv < total-1 {
				p.state.SelectedConv++
			}
			return p, nil
		}

	case "k", "up":
		if !p.state.InputFocused {
			if p.state.AnalyticsMode {
				// Scroll analytics view (A-5)
				if p.state.AnalyticsScroll > 0 {
					p.state.AnalyticsScroll--
				}
				return p, nil
			}
			if p.state.SelectedConv > 0 {
				p.state.SelectedConv--
			}
			return p, nil
		}

	case "enter":
		if !p.state.InputFocused {
			// Load selected session messages
			return p, p.loadSelectedSession()
		}

	case "ctrl+enter":
		if p.state.InputFocused {
			return p, p.sendMessage()
		}
		return p, nil

	case "tab":
		// Toggle between sidebar and input focus
		p.state.InputFocused = !p.state.InputFocused
		if p.state.InputFocused {
			p.state.Input.Focus()
		} else {
			p.state.Input.Blur()
		}
		return p, nil

	case "esc", "backspace":
		// If input is focused, blur it first
		if p.state.InputFocused {
			p.state.InputFocused = false
			p.state.Input.Blur()
			return p, nil
		}
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

// renderMessages renders all messages, with optional Glamour markdown (A-6)
func (p *AgentPlugin) renderMessages(width int) string {
	if len(p.state.Messages) == 0 {
		return styles.DimStyle.Render("  No messages yet. Start a conversation!")
	}

	var rendered []string
	for i, msg := range p.state.Messages {
		collapsed := p.state.ToolsCollapsed[i]

		if msg.Type == chat.MessageTypeAssistant && p.state.MarkdownMode {
			// Use Glamour markdown rendering (A-6)
			rendered = append(rendered, renderAssistantMarkdown(msg.Content, width))
		} else {
			msgRendered := chat.RenderMessage(msg, width, collapsed)
			rendered = append(rendered, msgRendered)
		}
		rendered = append(rendered, "")
	}
	return strings.Join(rendered, "\n")
}

// renderAssistantMarkdown renders an assistant message using Glamour (A-6)
func renderAssistantMarkdown(content string, width int) string {
	barWidth := 2
	contentWidth := width - barWidth - 2
	if contentWidth < 20 {
		contentWidth = 20
	}

	// Render with Glamour
	rendered := markdown.RenderDark(content, contentWidth)
	// Strip trailing newlines from Glamour output
	rendered = strings.TrimRight(rendered, "\n")

	lines := strings.Split(rendered, "\n")
	barStyle := lipgloss.NewStyle().Foreground(styles.Primary)

	var result []string
	for _, line := range lines {
		bar := barStyle.Render("▎")
		result = append(result, bar+" "+line)
	}
	return strings.Join(result, "\n")
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
			Content: "I'm a placeholder response. In the future, I'll integrate with the Claude CLI to provide real responses.",
		}}
	}
}

// totalSessions returns the total number of navigable sessions
func (p *AgentPlugin) totalSessions() int {
	if p.ctx.DemoMode || !p.state.SessionsLoaded {
		return len(p.state.ConversationList)
	}
	return len(p.state.Sessions)
}

// loadSelectedSession loads messages for the currently selected session
func (p *AgentPlugin) loadSelectedSession() tea.Cmd {
	if p.ctx.DemoMode || !p.state.SessionsLoaded {
		return nil
	}
	if p.state.SelectedConv < 0 || p.state.SelectedConv >= len(p.state.Sessions) {
		return nil
	}

	session := p.state.Sessions[p.state.SelectedConv]
	adapters := p.adapters
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		for _, a := range adapters {
			if a.ID() == session.Adapter {
				msgs, err := a.LoadMessages(session.Path)
				if err != nil {
					return SessionMessagesLoadedMsg{Error: err, Epoch: epoch}
				}
				return SessionMessagesLoadedMsg{Messages: msgs, Epoch: epoch}
			}
		}
		return SessionMessagesLoadedMsg{Error: fmt.Errorf("adapter %q not found", session.Adapter), Epoch: epoch}
	}
}

// ── Commands ──────────────────────────────────────────────────────────────────

// scanSessionsCmd scans all adapters for sessions
func (p *AgentPlugin) scanSessionsCmd() tea.Cmd {
	adapters := p.adapters
	epoch := p.ctx.Epoch
	return func() tea.Msg {
		var allSessions []adapter.Session
		for _, a := range adapters {
			if !a.Available() {
				continue
			}
			sessions, err := a.ScanSessions()
			if err != nil {
				continue
			}
			allSessions = append(allSessions, sessions...)
		}
		return SessionsLoadedMsg{Sessions: allSessions, Epoch: epoch}
	}
}

// ── Date Grouping Helpers ─────────────────────────────────────────────────────

// groupSessionsByDate groups sessions into Today, Yesterday, This Week, Older
func groupSessionsByDate(sessions []adapter.Session) []SessionGroup {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterday := today.AddDate(0, 0, -1)
	weekAgo := today.AddDate(0, 0, -7)

	groups := map[string][]adapter.Session{
		"Today":     {},
		"Yesterday": {},
		"This Week": {},
		"Older":     {},
	}

	for _, s := range sessions {
		switch {
		case s.UpdatedAt.After(today) || s.UpdatedAt.Equal(today):
			groups["Today"] = append(groups["Today"], s)
		case s.UpdatedAt.After(yesterday) || s.UpdatedAt.Equal(yesterday):
			groups["Yesterday"] = append(groups["Yesterday"], s)
		case s.UpdatedAt.After(weekAgo):
			groups["This Week"] = append(groups["This Week"], s)
		default:
			groups["Older"] = append(groups["Older"], s)
		}
	}

	// Build ordered result, skipping empty groups
	var result []SessionGroup
	for _, label := range []string{"Today", "Yesterday", "This Week", "Older"} {
		if len(groups[label]) > 0 {
			result = append(result, SessionGroup{
				Label:    fmt.Sprintf("%s (%d)", label, len(groups[label])),
				Sessions: groups[label],
			})
		}
	}

	return result
}

// timeAgo returns a human-readable relative time string
func timeAgo(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		m := int(d.Minutes())
		if m == 1 {
			return "1m ago"
		}
		return fmt.Sprintf("%dm ago", m)
	case d < 24*time.Hour:
		h := int(d.Hours())
		if h == 1 {
			return "1h ago"
		}
		return fmt.Sprintf("%dh ago", h)
	case d < 7*24*time.Hour:
		days := int(d.Hours() / 24)
		if days == 1 {
			return "1d ago"
		}
		return fmt.Sprintf("%dd ago", days)
	default:
		return t.Format("Jan 2")
	}
}

// ── Analytics (A-5) ───────────────────────────────────────────────────────────

// modelCostRate holds per-million-token pricing for a model family
type modelCostRate struct {
	InputPerMillion  float64
	OutputPerMillion float64
}

// modelRates maps model name substrings to pricing (approximate Claude API rates)
var modelRates = map[string]modelCostRate{
	"opus":   {InputPerMillion: 15.0, OutputPerMillion: 75.0},
	"sonnet": {InputPerMillion: 3.0, OutputPerMillion: 15.0},
	"haiku":  {InputPerMillion: 0.25, OutputPerMillion: 1.25},
}

// estimateCost estimates the cost of tokens for a given model
func estimateCost(model string, tokens int) float64 {
	lowerModel := strings.ToLower(model)
	for key, rate := range modelRates {
		if strings.Contains(lowerModel, key) {
			// Assume roughly 50/50 input/output split when we only have a total count
			inputTokens := float64(tokens) * 0.7
			outputTokens := float64(tokens) * 0.3
			return (inputTokens * rate.InputPerMillion / 1_000_000) +
				(outputTokens * rate.OutputPerMillion / 1_000_000)
		}
	}
	// Default to Sonnet pricing
	inputTokens := float64(tokens) * 0.7
	outputTokens := float64(tokens) * 0.3
	return (inputTokens * 3.0 / 1_000_000) + (outputTokens * 15.0 / 1_000_000)
}

// modelShortName returns a short display name from a full model string
func modelShortName(model string) string {
	lower := strings.ToLower(model)
	switch {
	case strings.Contains(lower, "opus"):
		return "Opus"
	case strings.Contains(lower, "sonnet"):
		return "Sonnet"
	case strings.Contains(lower, "haiku"):
		return "Haiku"
	case model == "":
		return "Unknown"
	default:
		if len(model) > 12 {
			return model[:12]
		}
		return model
	}
}

// renderAnalytics renders the analytics view with session statistics (A-5)
func (p *AgentPlugin) renderAnalytics(width, height int) string {
	var lines []string

	// Header
	lines = append(lines, styles.TitleStyle.Render("Usage Analytics"))
	sepStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	lines = append(lines, sepStyle.Render(strings.Repeat("━", width-2)))

	sessions := p.state.Sessions

	if len(sessions) == 0 {
		lines = append(lines, "")
		lines = append(lines, styles.DimStyle.Render("  No sessions loaded yet."))
		lines = append(lines, styles.DimStyle.Render("  Sessions will appear after scanning completes."))
		return p.applyAnalyticsScroll(lines, height)
	}

	// Summary: total sessions, total messages, date range
	totalMessages := 0
	totalTokens := 0
	var earliest, latest time.Time
	for _, s := range sessions {
		totalMessages += s.MessageCount
		totalTokens += s.TokenCount
		if earliest.IsZero() || s.CreatedAt.Before(earliest) {
			earliest = s.CreatedAt
		}
		if latest.IsZero() || s.UpdatedAt.After(latest) {
			latest = s.UpdatedAt
		}
	}

	dateRange := ""
	if !earliest.IsZero() {
		dateRange = fmt.Sprintf("  %s - %s", earliest.Format("Jan 2"), latest.Format("Jan 2"))
	}
	summary := fmt.Sprintf("  %d sessions  |  %s messages  |%s",
		len(sessions), formatLargeNumber(totalMessages), dateRange)
	lines = append(lines, summary)
	lines = append(lines, "")

	// Model usage breakdown with colored bars
	lines = append(lines, styles.TitleStyle.Render("Model Usage"))
	lines = append(lines, sepStyle.Render(strings.Repeat("─", width-2)))

	type modelStats struct {
		Name        string
		Sessions    int
		Messages    int
		Tokens      int
		TotalTokens int
	}

	modelMap := make(map[string]*modelStats)
	for _, s := range sessions {
		shortName := modelShortName(s.Model)
		ms, ok := modelMap[shortName]
		if !ok {
			ms = &modelStats{Name: shortName}
			modelMap[shortName] = ms
		}
		ms.Sessions++
		ms.Messages += s.MessageCount
		ms.Tokens += s.TokenCount
		ms.TotalTokens += s.TokenCount
	}

	// Sort by token count descending
	var modelList []*modelStats
	maxTokens := 0
	for _, ms := range modelMap {
		modelList = append(modelList, ms)
		if ms.TotalTokens > maxTokens {
			maxTokens = ms.TotalTokens
		}
	}
	for i := 0; i < len(modelList); i++ {
		for j := i + 1; j < len(modelList); j++ {
			if modelList[i].TotalTokens < modelList[j].TotalTokens {
				modelList[i], modelList[j] = modelList[j], modelList[i]
			}
		}
	}

	barWidth := 16
	if width < 60 {
		barWidth = 10
	}

	for _, ms := range modelList {
		bar := renderColoredBar(ms.TotalTokens, maxTokens, barWidth)
		cost := estimateCost(ms.Name, ms.TotalTokens)

		modelLabel := fmt.Sprintf("  %-8s", ms.Name)
		tokensLabel := fmt.Sprintf("  %s tokens", formatLargeNumber(ms.TotalTokens))
		costLabel := lipgloss.NewStyle().Foreground(styles.Success).Render(fmt.Sprintf("  ~$%.2f", cost))
		sessionsLabel := styles.DimStyle.Render(fmt.Sprintf("  %d sessions, %d msgs", ms.Sessions, ms.Messages))

		lines = append(lines, modelLabel+" "+bar+tokensLabel+costLabel)
		lines = append(lines, sessionsLabel)
	}
	lines = append(lines, "")

	// Cost estimates summary
	lines = append(lines, styles.TitleStyle.Render("Cost Estimates"))
	lines = append(lines, sepStyle.Render(strings.Repeat("─", width-2)))

	totalCost := 0.0
	for _, ms := range modelList {
		cost := estimateCost(ms.Name, ms.TotalTokens)
		totalCost += cost
		lines = append(lines, fmt.Sprintf("  %-8s  %s tokens  ~$%.2f",
			ms.Name,
			formatLargeNumber(ms.TotalTokens),
			cost))
	}
	lines = append(lines, "")
	totalCostStyle := lipgloss.NewStyle().Foreground(styles.Primary).Bold(true)
	lines = append(lines, "  Total Estimated Cost: "+totalCostStyle.Render(fmt.Sprintf("~$%.2f", totalCost)))
	lines = append(lines, "")

	// Session duration stats
	lines = append(lines, styles.TitleStyle.Render("Session Duration"))
	lines = append(lines, sepStyle.Render(strings.Repeat("─", width-2)))

	var totalDuration time.Duration
	var longestDuration time.Duration
	sessionsWithDuration := 0
	for _, s := range sessions {
		if !s.CreatedAt.IsZero() && !s.UpdatedAt.IsZero() && s.UpdatedAt.After(s.CreatedAt) {
			d := s.UpdatedAt.Sub(s.CreatedAt)
			totalDuration += d
			sessionsWithDuration++
			if d > longestDuration {
				longestDuration = d
			}
		}
	}

	if sessionsWithDuration > 0 {
		avgDuration := totalDuration / time.Duration(sessionsWithDuration)
		lines = append(lines, fmt.Sprintf("  Average:  %s", formatDuration(avgDuration)))
		lines = append(lines, fmt.Sprintf("  Longest:  %s", formatDuration(longestDuration)))
		lines = append(lines, fmt.Sprintf("  Total:    %s across %d sessions", formatDuration(totalDuration), sessionsWithDuration))
	} else {
		lines = append(lines, styles.DimStyle.Render("  No duration data available"))
	}
	lines = append(lines, "")

	// Per-adapter breakdown
	adapterMap := make(map[string]int)
	for _, s := range sessions {
		adapterMap[s.Adapter]++
	}
	if len(adapterMap) > 1 {
		lines = append(lines, styles.TitleStyle.Render("Adapter Breakdown"))
		lines = append(lines, sepStyle.Render(strings.Repeat("─", width-2)))
		for adapterID, count := range adapterMap {
			lines = append(lines, fmt.Sprintf("  %-15s  %d sessions", adapterID, count))
		}
		lines = append(lines, "")
	}

	// Pricing reference
	lines = append(lines, styles.DimStyle.Render("  Pricing: Opus $15/$75, Sonnet $3/$15, Haiku $0.25/$1.25 per 1M in/out"))

	return p.applyAnalyticsScroll(lines, height)
}

// applyAnalyticsScroll applies scroll offset and height clamping to analytics lines
func (p *AgentPlugin) applyAnalyticsScroll(lines []string, height int) string {
	if height < 1 {
		height = 1
	}

	// Clamp scroll
	maxScroll := len(lines) - height
	if maxScroll < 0 {
		maxScroll = 0
	}
	if p.state.AnalyticsScroll > maxScroll {
		p.state.AnalyticsScroll = maxScroll
	}
	if p.state.AnalyticsScroll < 0 {
		p.state.AnalyticsScroll = 0
	}

	start := p.state.AnalyticsScroll
	end := start + height
	if end > len(lines) {
		end = len(lines)
	}

	visible := lines[start:end]
	// Pad to fill height
	for len(visible) < height {
		visible = append(visible, "")
	}

	return strings.Join(visible, "\n")
}

// formatLargeNumber formats a number with K/M suffix for compact display
func formatLargeNumber(n int) string {
	if n >= 1_000_000 {
		return fmt.Sprintf("%.1fM", float64(n)/1_000_000)
	}
	if n >= 1_000 {
		return fmt.Sprintf("%.1fK", float64(n)/1_000)
	}
	return fmt.Sprintf("%d", n)
}

// renderColoredBar renders a colored ASCII bar chart segment
func renderColoredBar(value, max, width int) string {
	if max == 0 {
		return styles.DimStyle.Render(strings.Repeat("░", width))
	}
	filled := (value * width) / max
	if filled > width {
		filled = width
	}
	filledBar := lipgloss.NewStyle().Foreground(styles.Primary).Render(strings.Repeat("█", filled))
	emptyBar := styles.DimStyle.Render(strings.Repeat("░", width-filled))
	return filledBar + emptyBar
}

// ── Message types ─────────────────────────────────────────────────────────────

// AddMessageMsg signals that a new message should be added to the chat
type AddMessageMsg struct {
	Message chat.Message
}

// SessionsLoadedMsg carries scanned sessions from adapters (A-2)
type SessionsLoadedMsg struct {
	Sessions []adapter.Session
	Error    error
	Epoch    uint64
}

// SessionMessagesLoadedMsg carries loaded messages for a session (A-2)
type SessionMessagesLoadedMsg struct {
	Messages []chat.Message
	Error    error
	Epoch    uint64
}
