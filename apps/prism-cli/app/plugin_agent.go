package app

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/agentbus"
	"github.com/prism-plugin/prism-cli/app/adapter"
	"github.com/prism-plugin/prism-cli/app/chat"
	"github.com/prism-plugin/prism-cli/claude"
	"github.com/prism-plugin/prism-cli/dialog"
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

// AgentTracker tracks a running subagent spawned via the Task tool.
type AgentTracker struct {
	ID          string
	Name        string
	Type        string
	ParentID    string
	Status      string // "running", "complete", "error"
	NestedParts []chat.ContentPart
	StartTime   time.Time
}

// AgentState holds state for the agent chat interface
type AgentState struct {
	Messages         []chat.Message
	MessageViewport  viewport.Model
	SidebarViewport  viewport.Model
	Input            textarea.Model
	InputFocused     bool
	ToolsCollapsed   map[int]bool
	WideMode         bool // true = sidebar + chat, false = chat only
	MarkdownMode     bool // true = render markdown via Glamour (A-6)

	// Session list (A-2)
	Sessions       []adapter.Session // All sessions from adapters
	Groups         []SessionGroup    // Date-grouped sessions for sidebar display
	SelectedConv   int               // Global index across flattened session list
	SessionsLoaded bool              // True once initial scan has completed

	// Analytics view (A-5)
	AnalyticsMode   bool // true = show analytics instead of chat
	AnalyticsScroll int  // scroll offset for analytics content

	// Parallel agent tracking (Phase 9)
	ActiveAgents   map[string]*AgentTracker // toolID → tracker
	AgentCollapsed map[string]bool          // agentID → collapsed

	// Sidebar grouping (Phase 14)
	GroupByAdapter bool // true = group by adapter, false = group by date

	// Search (Phase 15)
	SearchMode   bool
	SearchInput  textinput.Model
	SearchQuery  string
	SearchResult []adapter.Session

	// Legacy fallback (used in demo mode)
	ConversationList []string
}

// CostTracker accumulates token usage and cost for the current conversation (Phase 16).
type CostTracker struct {
	InputTokens  int
	OutputTokens int
	TotalCost    float64
	Model        string
}

// AgentPlugin implements the Agent chat interface
type AgentPlugin struct {
	ctx      *plugin.Context
	state    AgentState
	focused  bool
	width    int
	height   int
	adapters []adapter.Adapter // Registered adapters (A-1)

	// Conversation integration (Phase 6)
	bus          *agentbus.Bus
	store        *agentbus.Store
	conversation *agentbus.ManagedSession // Active conversation, nil if idle
	stdinPipe    io.WriteCloser           // Claude CLI stdin pipe
	cancelConv   context.CancelFunc       // Cancel func for current Claude CLI subprocess
	streaming    bool                     // Currently receiving a response
	streamText   strings.Builder          // Accumulator for streaming text delta
	overlay      *dialog.Overlay          // Dialog overlay stack
	eventChan    chan agentbus.Event       // Bus→BubbleTea bridge channel

	// Conversation state
	pendingPerm  *agentbus.PermissionRequest // Current permission request
	pendingQ     *agentbus.QuestionRequest   // Current question request
	currentPhase string                      // Latest phase breadcrumb

	// Render cache (Phase 10): messageIndex → rendered string
	renderCache map[int]string
	lastWidth   int // width at last cache build

	// Session management (Phase 11)
	resumeSessionID string // session ID to resume on next send (set when user selects a historical session)
	activeSessionID  string // session ID of the currently running subprocess
	currentTitle     string // title of the current session (set after first assistant response)
	titleGenerated   bool   // true once title has been generated for the current session

	// Cost & token tracking (Phase 16)
	cost CostTracker

	// Error handling & resilience (Phase 18)
	lastError       error  // Most recent fatal error (process crash, CLI not found, etc.)
	lastUserMessage string // Last message sent (for retry)

	// Enhanced status bar (Phase 3 visualization)
	activeToolName  string      // Tool name currently running, cleared on complete
	streamStartTime time.Time   // When current streaming started
	lastSignal      string      // Last Spectrum signal detected
}

// newTextarea creates and configures the multi-line input textarea.
func newTextarea() textarea.Model {
	ta := textarea.New()
	ta.Placeholder = "Type a message… (Enter to send, Shift+Enter for newline)"
	ta.CharLimit = 10000
	ta.SetWidth(50)
	ta.SetHeight(3)
	ta.ShowLineNumbers = false
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle() // no cursor-line highlight
	// Shift+Enter inserts a newline; plain Enter is intercepted to send.
	ta.KeyMap.InsertNewline.SetKeys("shift+enter", "ctrl+j")
	return ta
}

// NewAgentPlugin creates a new Agent plugin instance
func NewAgentPlugin() *AgentPlugin {
	bus := agentbus.New()
	store := agentbus.NewStore(bus)
	eventChan := make(chan agentbus.Event, 256)

	searchInput := textinput.New()
	searchInput.Placeholder = "Search sessions…"
	searchInput.CharLimit = 200

	p := &AgentPlugin{
		state: AgentState{
			Messages:       []chat.Message{},
			Input:          newTextarea(),
			SearchInput:    searchInput,
			InputFocused:   true,
			ToolsCollapsed: make(map[int]bool),
			ActiveAgents:   make(map[string]*AgentTracker),
			AgentCollapsed: make(map[string]bool),
			SelectedConv:   0,
			WideMode:       true,
			MarkdownMode:   true,
			ConversationList: []string{
				"Current Session",
				"Research: auth flow",
				"Debug: API timeout",
				"Plan: migration v2",
			},
		},
		bus:         bus,
		store:       store,
		overlay:     dialog.NewOverlay(),
		eventChan:   eventChan,
		renderCache: make(map[int]string),
	}

	// Subscribe bus events → eventChan for BubbleTea consumption.
	bus.Subscribe(func(e agentbus.Event) {
		select {
		case eventChan <- e:
		default:
			// Channel full — drop event to avoid blocking bus goroutine.
		}
	})

	return p
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
	p.state.Input.SetWidth(ctx.Width - 10)

	// Register adapters (A-1, Phase 12, Phase 13)
	p.adapters = []adapter.Adapter{
		adapter.NewClaudeAdapter(""),
		adapter.NewCodexAdapter(""),
		adapter.NewCursorAdapter(""),
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *AgentPlugin) Start() tea.Cmd {
	_ = p.state.Input.Focus()
	p.state.InputFocused = true

	if p.ctx.DemoMode {
		return tea.Batch(textarea.Blink, listenForBusEvents(p.eventChan))
	}

	// Scan sessions from adapters (A-2) and start bus event listener.
	return tea.Batch(textarea.Blink, p.scanSessionsCmd(), listenForBusEvents(p.eventChan))
}

// Stop is called when deactivated
func (p *AgentPlugin) Stop() {
	p.state.Input.Blur()
	p.state.InputFocused = false
	// Gracefully abort any active subprocess (Phase 18b).
	if p.cancelConv != nil {
		p.cancelConv()
		p.cancelConv = nil
	}
}

// Update handles messages
func (p *AgentPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	// Let the overlay consume input first when a dialog is open.
	if p.overlay.HasDialogs() {
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			action, overlayCmd := p.overlay.Update(keyMsg)
			cmds = append(cmds, overlayCmd)
			if action != dialog.ActionNone {
				p.handleDialogAction(action)
				p.overlay.CloseFront()
			}
			return p, tea.Batch(cmds...)
		}
	}

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

	case claude.ConvStartedMsg:
		if msg.Handle != nil {
			p.stdinPipe = msg.Handle.Stdin
			p.cancelConv = msg.Handle.Cancel
			p.streaming = true
			p.activeSessionID = msg.SessionID
			p.titleGenerated = false
		}
		// Send the initial user message now that the subprocess is ready.
		batchCmds := []tea.Cmd{listenForBusEvents(p.eventChan)}
		if msg.Handle != nil && p.lastUserMessage != "" {
			initialMsg := p.lastUserMessage
			stdinPipe := p.stdinPipe
			batchCmds = append(batchCmds, func() tea.Msg {
				_ = claude.SendMessage(stdinPipe, initialMsg)
				return nil
			})
		}
		return p, tea.Batch(batchCmds...)

	case busEventMsg:
		handleCmd := p.handleBusEvent(msg.Event)
		cmds = append(cmds, handleCmd)
		// Re-issue listener to pick up next event.
		cmds = append(cmds, listenForBusEvents(p.eventChan))
		return p, tea.Batch(cmds...)
	}

	if p.state.InputFocused && !p.overlay.HasDialogs() {
		p.state.Input, cmd = p.state.Input.Update(msg)
		cmds = append(cmds, cmd)
	}

	p.state.MessageViewport, cmd = p.state.MessageViewport.Update(msg)
	cmds = append(cmds, cmd)

	return p, tea.Batch(cmds...)
}

// handleBusEvent processes an agentbus.Event received from the bus.
func (p *AgentPlugin) handleBusEvent(e agentbus.Event) tea.Cmd {
	switch e.Type {
	case agentbus.EventTextDelta:
		p.streamText.WriteString(e.Text)
		// Update or create the current assistant message with the accumulated text.
		p.upsertStreamingMessage()
		p.autoScroll()

	case agentbus.EventThinkingDelta:
		part := chat.ContentPart{
			Type: chat.PartThinking,
			Text: e.Text,
		}
		p.appendPart(part)
		p.autoScroll()

	case agentbus.EventToolCallStart:
		p.activeToolName = e.ToolName
		// Add a tool call part to the current message.
		part := chat.ContentPart{
			Type:       chat.PartToolCall,
			ToolName:   e.ToolName,
			ToolInput:  string(e.ToolInput),
			ToolStatus: "running",
			ToolID:     e.ToolID,
		}
		p.appendPart(part)
		p.autoScroll()

	case agentbus.EventToolCallComplete:
		p.activeToolName = ""
		// Find and update the matching tool call part.
		p.updateToolPartStatus(e.ToolID, e.ToolStatus)

	case agentbus.EventAgentSpawnStart:
		tracker := &AgentTracker{
			ID:        e.ToolID,
			Name:      e.AgentDesc,
			Type:      e.AgentType,
			Status:    "running",
			StartTime: e.Timestamp,
		}
		p.state.ActiveAgents[e.ToolID] = tracker
		p.state.AgentCollapsed[e.ToolID] = true // start collapsed
		part := chat.ContentPart{
			Type:       chat.PartAgent,
			AgentID:    e.ToolID,
			AgentName:  e.AgentDesc,
			AgentType:  e.AgentType,
			ToolStatus: "running",
			ToolID:     e.ToolID,
		}
		p.appendPart(part)

	case agentbus.EventAgentSpawnFinish:
		if t, ok := p.state.ActiveAgents[e.ToolID]; ok {
			t.Status = "complete"
		}
		p.updateToolPartStatus(e.ToolID, "complete")

	case agentbus.EventPhaseChanged:
		p.currentPhase = e.Phase

	case agentbus.EventSignalDetected:
		if e.Signal.Type != 0 {
			p.lastSignal = e.Signal.Type.String()
		}

	case agentbus.EventMessageComplete:
		// Finalize the streaming message.
		p.streamText.Reset()
		p.streaming = false
		p.activeToolName = ""
		p.lastSignal = ""
		// Generate session title from first user message (Phase 11c).
		if !p.titleGenerated {
			for _, msg := range p.state.Messages {
				if msg.Type == chat.MessageTypeUser && msg.Content != "" {
					title := msg.Content
					if len(title) > 80 {
						title = title[:77] + "…"
					}
					p.currentTitle = title
					p.titleGenerated = true
					break
				}
			}
		}

	case agentbus.EventPermissionRequired:
		p.pendingPerm = e.Permission
		if e.Permission != nil {
			p.overlay.Open(dialog.NewPermission(
				e.Permission.ID,
				e.Permission.ToolName,
				e.Permission.Description,
				e.Permission.Preview,
			))
		}

	case agentbus.EventQuestionAsked:
		p.pendingQ = e.Question
		if e.Question != nil {
			p.overlay.Open(dialog.NewQuestion(e.Question.ID, e.Question.Questions))
		}

	case agentbus.EventCostUpdate:
		// Accumulate token counts and estimate cost (Phase 16a).
		p.cost.InputTokens += e.InputTokens
		p.cost.OutputTokens += e.OutputTokens
		if e.Model != "" {
			p.cost.Model = e.Model
		}
		inputCost := float64(p.cost.InputTokens) * estimateCostPerToken(p.cost.Model, true)
		outputCost := float64(p.cost.OutputTokens) * estimateCostPerToken(p.cost.Model, false)
		p.cost.TotalCost = inputCost + outputCost

	case agentbus.EventStreamError:
		p.lastError = e.Error
		errMsg := "Claude CLI error"
		if e.Error != nil {
			errMsg = e.Error.Error()
		}
		p.state.Messages = append(p.state.Messages, chat.Message{
			Type:    chat.MessageTypeAssistant,
			Content: "⚠ " + errMsg,
			Status:  "error",
		})
		p.streaming = false

	case agentbus.EventProcessExited:
		if e.ExitCode != 0 {
			p.lastError = e.Error
		}
		p.streaming = false
		p.stdinPipe = nil
	}
	return nil
}

// handleDialogAction handles the result of a dialog being closed.
func (p *AgentPlugin) handleDialogAction(action dialog.Action) {
	if p.pendingPerm != nil {
		var responseAction string
		switch action {
		case dialog.ActionAllow:
			responseAction = "allow"
		case dialog.ActionAllowSession:
			responseAction = "allow_session"
		case dialog.ActionDeny:
			responseAction = "deny"
		}
		if responseAction != "" {
			p.bus.Publish(agentbus.Event{
				Type: agentbus.EventPermissionResponse,
				PermResp: &agentbus.PermissionResponse{
					RequestID: p.pendingPerm.ID,
					Action:    responseAction,
				},
			})
		}
		p.pendingPerm = nil
		return
	}

	if p.pendingQ != nil {
		// For questions, ActionConfirm = submit answers, ActionDeny = skip.
		resp := agentbus.QuestionResponse{
			RequestID: p.pendingQ.ID,
			Answers:   make(map[string]string),
			Skipped:   action == dialog.ActionDeny,
		}
		p.bus.Publish(agentbus.Event{
			Type:      agentbus.EventQuestionAnswered,
			QuestResp: &resp,
		})
		p.pendingQ = nil
	}
}

// renderErrorBanner renders a red-bordered error banner (Phase 18c).
func renderErrorBanner(err error, width int) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if len(msg) > width-6 {
		msg = msg[:width-9] + "…"
	}
	hint := "Press R to retry · Ctrl+N for new chat"
	banner := lipgloss.JoinVertical(lipgloss.Left,
		"⚠ "+msg,
		lipgloss.NewStyle().Foreground(styles.Dim).Render(hint),
	)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Error).
		Foreground(styles.Error).
		Width(width - 4).
		Padding(0, 1).
		Render(banner)
}

const maxStreamSize = 1 * 1024 * 1024 // 1MB

// upsertStreamingMessage creates or updates the last assistant message with current stream text.
func (p *AgentPlugin) upsertStreamingMessage() {
	text := p.streamText.String()
	// Cap at 1MB to prevent runaway memory (Phase 18).
	if len(text) > maxStreamSize {
		text = text[:maxStreamSize] + "\n\n[output truncated]"
	}
	msgs := p.state.Messages
	if len(msgs) > 0 && msgs[len(msgs)-1].Type == chat.MessageTypeAssistant &&
		msgs[len(msgs)-1].Status == "streaming" {
		// Update in place.
		msgs[len(msgs)-1].Content = text
		return
	}
	// Create new streaming assistant message.
	p.state.Messages = append(msgs, chat.Message{
		Type:    chat.MessageTypeAssistant,
		Content: text,
		Status:  "streaming",
	})
}

// appendPart adds a ContentPart to the last assistant message.
func (p *AgentPlugin) appendPart(part chat.ContentPart) {
	msgs := p.state.Messages
	if len(msgs) > 0 && msgs[len(msgs)-1].Type == chat.MessageTypeAssistant {
		msgs[len(msgs)-1].Parts = append(msgs[len(msgs)-1].Parts, part)
		return
	}
	// Create a new assistant message with just this part.
	p.state.Messages = append(msgs, chat.Message{
		Type:   chat.MessageTypeAssistant,
		Status: "streaming",
		Parts:  []chat.ContentPart{part},
	})
}

// updateToolPartStatus finds a PartToolCall with the given ToolID and updates its status.
// Also invalidates the render cache for the affected message so the new status is visible.
func (p *AgentPlugin) updateToolPartStatus(toolID, status string) {
	msgs := p.state.Messages
	for i := len(msgs) - 1; i >= 0; i-- {
		for j := range msgs[i].Parts {
			if msgs[i].Parts[j].ToolID == toolID {
				msgs[i].Parts[j].ToolStatus = status
				// Invalidate cache so the status change is re-rendered.
				delete(p.renderCache, i)
				return
			}
		}
	}
}

// hasRunningParts returns true if any ContentPart has status "running".
func hasRunningParts(parts []chat.ContentPart) bool {
	for _, part := range parts {
		if part.ToolStatus == "running" {
			return true
		}
	}
	return false
}

// autoScroll scrolls the viewport to the bottom if the user hasn't scrolled up.
func (p *AgentPlugin) autoScroll() {
	vp := &p.state.MessageViewport
	if vp.AtBottom() {
		vp.GotoBottom()
	}
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
	// Dynamically size the textarea: grow 1-8 lines based on content.
	lineCount := strings.Count(p.state.Input.Value(), "\n") + 1
	if lineCount < 1 {
		lineCount = 1
	}
	if lineCount > 8 {
		lineCount = 8
	}
	p.state.Input.SetHeight(lineCount)
	p.state.Input.SetWidth(width - 4)

	// 1 separator line + textarea lines.
	inputChrome := 1 + lineCount
	vpHeight := height - inputChrome
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

	// Build separator with streaming cost indicator (Phase 16b).
	costIndicator := p.renderCostIndicator(width)
	sepStr := strings.Repeat("─", width)
	if costIndicator != "" {
		// Overwrite the right side of the separator with the cost indicator.
		indicatorLen := lipgloss.Width(costIndicator)
		if indicatorLen < width {
			sepStr = strings.Repeat("─", width-indicatorLen) + costIndicator
		}
	}
	separator := lipgloss.NewStyle().Foreground(styles.Dim).Render(sepStr)

	inputView := p.state.Input.View()

	// Show error banner between viewport and separator if there's a recent error (Phase 18c).
	if p.lastError != nil && !p.streaming {
		errBanner := renderErrorBanner(p.lastError, width)
		return strings.Join(vpLines, "\n") + "\n" + errBanner + "\n" + separator + "\n" + inputView
	}

	return strings.Join(vpLines, "\n") + "\n" + separator + "\n" + inputView
}

// renderCostIndicator returns a compact cost/status string for the separator line.
func (p *AgentPlugin) renderCostIndicator(width int) string {
	if !p.streaming && p.cost.TotalCost == 0 && p.lastSignal == "" {
		return ""
	}

	var parts []string

	// Phase label (e.g. "Research")
	if p.currentPhase != "" {
		phaseStyle := lipgloss.NewStyle().Foreground(styles.White).Bold(true)
		parts = append(parts, phaseStyle.Render(p.currentPhase))
	}

	if p.streaming {
		dot := lipgloss.NewStyle().Foreground(styles.Primary).Render("⬤")
		streamPart := dot + " streaming…"
		// Active tool name
		if p.activeToolName != "" {
			dimStyle := lipgloss.NewStyle().Foreground(styles.Dim)
			streamPart += " " + dimStyle.Render("· "+p.activeToolName)
		}
		// Elapsed time
		if !p.streamStartTime.IsZero() {
			elapsed := time.Since(p.streamStartTime)
			var elapsedStr string
			if elapsed >= time.Minute {
				m := int(elapsed.Minutes())
				s := int(elapsed.Seconds()) % 60
				elapsedStr = fmt.Sprintf("%dm %ds", m, s)
			} else {
				elapsedStr = fmt.Sprintf("%ds", int(elapsed.Seconds()))
			}
			dimStyle := lipgloss.NewStyle().Foreground(styles.Dim)
			streamPart += " " + dimStyle.Render(elapsedStr)
		}
		parts = append(parts, streamPart)
	}

	if p.cost.InputTokens > 0 || p.cost.OutputTokens > 0 {
		inK := fmt.Sprintf("%.1fk", float64(p.cost.InputTokens)/1000)
		outK := fmt.Sprintf("%.1fk", float64(p.cost.OutputTokens)/1000)
		parts = append(parts, inK+" in / "+outK+" out")
	}
	if p.cost.TotalCost > 0 {
		parts = append(parts, fmt.Sprintf("$%.4f", p.cost.TotalCost))
	}

	// Signal badge (e.g. "spectrum-blocked")
	if p.lastSignal != "" {
		sigStyle := lipgloss.NewStyle().Foreground(styles.Error)
		parts = append(parts, sigStyle.Render("["+p.lastSignal+"]"))
	}

	if len(parts) == 0 {
		return ""
	}
	indicator := strings.Join(parts, " | ")
	return lipgloss.NewStyle().Foreground(styles.Dim).Render(indicator)
}

// renderSidebar renders the session list grouped by date (A-2).
func (p *AgentPlugin) renderSidebar(width, height int) string {
	var lines []string

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.White)
	lines = append(lines, " "+titleStyle.Render("Conversations"))
	lines = append(lines, "")

	// Search mode: show search input and results (Phase 15a).
	if p.state.SearchMode {
		p.state.SearchInput.Width = width - 4
		searchBox := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(styles.Primary).
			Padding(0, 1).
			Render(p.state.SearchInput.View())
		lines = append(lines, searchBox)
		lines = append(lines, "")
		lines = append(lines, p.renderSearchResults(width)...)
	} else if p.ctx.DemoMode || !p.state.SessionsLoaded {
		lines = append(lines, p.renderLegacySidebar(width)...)
	} else if len(p.state.Sessions) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(styles.Dim).Render("  No sessions found"))
	} else if p.state.GroupByAdapter {
		lines = append(lines, p.renderAdapterGroupedSessions(width)...)
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
	activeStyle := lipgloss.NewStyle().Foreground(styles.Primary)

	// Show in-progress new conversation at top of list (Phase 11d).
	if p.activeSessionID == "" && p.stdinPipe != nil {
		// New session not yet assigned an ID — show ephemeral entry.
		title := p.currentTitle
		if title == "" {
			title = "New Conversation…"
		}
		icon := "▸"
		label := fmt.Sprintf(" %s %s", icon, truncateSidebarTitle(title, width))
		runningDot := " ●"
		if p.streaming {
			label += activeStyle.Render(runningDot)
		}
		line := lipgloss.NewStyle().
			Foreground(styles.Primary).
			Bold(true).
			Background(styles.Secondary).
			Width(width).
			Render(label)
		lines = append(lines, line)
		lines = append(lines, "")
	}

	for _, group := range p.state.Groups {
		// Group header
		lines = append(lines, " "+groupHeaderStyle.Render(group.Label))

		for _, session := range group.Sessions {
			selected := globalIdx == p.state.SelectedConv
			isActive := session.ID != "" && session.ID == p.activeSessionID

			// Icon: ▸ for active subprocess, ● for cursor-selected, ○ for others.
			icon := "○"
			if isActive {
				icon = "▸"
			} else if selected {
				icon = "●"
			}

			// Title truncation
			title := session.Title
			// If this is the active session and we have a generated title, use it.
			if isActive && p.currentTitle != "" {
				title = p.currentTitle
			}
			badge := adapterBadge(session.Adapter)
			label := fmt.Sprintf(" %s %s %s", icon, badge, truncateSidebarTitle(title, width-5))

			// Running indicator for the active streaming session.
			if isActive && p.streaming {
				label += activeStyle.Render(" ●")
			}

			if selected || isActive {
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

// renderSearchResults renders the filtered search result list (Phase 15c).
func (p *AgentPlugin) renderSearchResults(width int) []string {
	var lines []string
	results := p.state.SearchResult
	timeStyle := lipgloss.NewStyle().Foreground(styles.Dim)

	if len(results) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(styles.Dim).Render("  No matches found"))
		return lines
	}

	for i, session := range results {
		selected := i == p.state.SelectedConv
		icon := "○"
		if selected {
			icon = "●"
		}

		badge := adapterBadge(session.Adapter)
		title := highlightMatch(session.Title, p.state.SearchQuery, width-7)
		label := fmt.Sprintf(" %s %s %s", icon, badge, title)

		if selected {
			line := lipgloss.NewStyle().
				Foreground(styles.Primary).
				Bold(true).
				Background(styles.Secondary).
				Width(width).
				Render(label)
			lines = append(lines, line)
		} else {
			lines = append(lines, lipgloss.NewStyle().Foreground(styles.White).Render(label))
		}

		meta := fmt.Sprintf("    %s · %d msgs", timeAgo(session.UpdatedAt), session.MessageCount)
		lines = append(lines, timeStyle.Render(meta))
	}

	return lines
}

// highlightMatch returns the title with the query match visually distinguished.
// The matched portion is bolded; unmatched plain. Returns plain title if no match.
func highlightMatch(title, query string, maxWidth int) string {
	if query == "" || maxWidth < 3 {
		return truncateSidebarTitle(title, maxWidth+5)
	}
	lowerTitle := strings.ToLower(title)
	lowerQuery := strings.ToLower(query)
	idx := strings.Index(lowerTitle, lowerQuery)
	if idx < 0 {
		return truncateSidebarTitle(title, maxWidth+5)
	}

	before := title[:idx]
	match := title[idx : idx+len(query)]
	after := title[idx+len(query):]

	highlightStyle := lipgloss.NewStyle().Foreground(styles.Warning).Bold(true)
	result := before + highlightStyle.Render(match) + after

	// Truncate total if too long (approximate — ANSI codes affect length).
	if len(title) > maxWidth {
		truncated := title
		if len(truncated) > maxWidth-1 {
			truncated = title[:maxWidth-2] + "…"
		}
		// Re-apply highlight on truncated.
		lowerTrunc := strings.ToLower(truncated)
		idx2 := strings.Index(lowerTrunc, lowerQuery)
		if idx2 >= 0 {
			return truncated[:idx2] + highlightStyle.Render(truncated[idx2:idx2+len(query)]) + truncated[idx2+len(query):]
		}
		return truncated
	}

	return result
}

// truncateSidebarTitle truncates a session title to fit the sidebar width.
func truncateSidebarTitle(title string, width int) string {
	maxTitleWidth := width - 5
	if maxTitleWidth < 3 {
		return title
	}
	if len(title) > maxTitleWidth {
		return title[:maxTitleWidth-1] + "…"
	}
	return title
}

// adapterBadge returns a colored badge string for a given adapter ID (Phase 14a).
func adapterBadge(adapterID string) string {
	switch adapterID {
	case "claude":
		return lipgloss.NewStyle().Foreground(styles.Info).Render("[C]")
	case "codex":
		return lipgloss.NewStyle().Foreground(styles.Success).Render("[X]")
	case "cursor":
		return lipgloss.NewStyle().Foreground(styles.Primary).Render("[R]")
	default:
		return lipgloss.NewStyle().Foreground(styles.Dim).Render("[?]")
	}
}

// renderAdapterGroupedSessions renders sessions grouped by adapter (Phase 14b).
func (p *AgentPlugin) renderAdapterGroupedSessions(width int) []string {
	var lines []string
	globalIdx := 0

	groupHeaderStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Info)
	timeStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	activeStyle := lipgloss.NewStyle().Foreground(styles.Primary)

	// Collect groups by adapter.
	adapterOrder := []string{"claude", "codex", "cursor"}
	adapterSessions := make(map[string][]adapter.Session)
	adapterNames := map[string]string{
		"claude": "Claude Code",
		"codex":  "Codex",
		"cursor": "Cursor",
	}

	for _, s := range p.state.Sessions {
		adapterSessions[s.Adapter] = append(adapterSessions[s.Adapter], s)
	}

	for _, adapterID := range adapterOrder {
		sessions := adapterSessions[adapterID]
		if len(sessions) == 0 {
			continue
		}

		name := adapterNames[adapterID]
		if name == "" {
			name = adapterID
		}
		header := fmt.Sprintf("%s (%d)", name, len(sessions))
		lines = append(lines, " "+groupHeaderStyle.Render(header))

		for _, session := range sessions {
			selected := globalIdx == p.state.SelectedConv
			isActive := session.ID != "" && session.ID == p.activeSessionID

			icon := "○"
			if isActive {
				icon = "▸"
			} else if selected {
				icon = "●"
			}

			title := session.Title
			if isActive && p.currentTitle != "" {
				title = p.currentTitle
			}
			badge := adapterBadge(session.Adapter)
			label := fmt.Sprintf(" %s %s %s", icon, badge, truncateSidebarTitle(title, width-5))

			if isActive && p.streaming {
				label += activeStyle.Render(" ●")
			}

			if selected || isActive {
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

			meta := fmt.Sprintf("    %s · %d msgs", timeAgo(session.UpdatedAt), session.MessageCount)
			lines = append(lines, timeStyle.Render(meta))

			globalIdx++
		}

		lines = append(lines, "")
	}

	return lines
}

// IsFocused returns whether the plugin is active
func (p *AgentPlugin) IsFocused() bool { return p.focused }

// SetFocused sets the focus state
func (p *AgentPlugin) SetFocused(focused bool) {
	p.focused = focused
	if focused {
		_ = p.state.Input.Focus()
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
		{Key: "ctrl+n", Description: "new chat"},
		{Key: "ctrl+l", Description: "clear"},
		{Key: "ctrl+g", Description: "group by"},
		{Key: "a", Description: "analytics"},
		{Key: "m", Description: "toggle markdown"},
		{Key: "ctrl+b", Description: "toggle sidebar"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *AgentPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Search mode: route most keys to the search input (Phase 15).
	if p.state.SearchMode {
		switch key {
		case "esc":
			// Cancel search.
			p.state.SearchMode = false
			p.state.SearchQuery = ""
			p.state.SearchResult = nil
			p.state.SearchInput.Reset()
			p.state.SearchInput.Blur()
			return p, nil
		case "enter":
			// Load the highlighted search result.
			return p, p.loadSelectedSession()
		case "j", "down":
			total := len(p.state.SearchResult)
			if total > 0 && p.state.SelectedConv < total-1 {
				p.state.SelectedConv++
			}
			return p, nil
		case "k", "up":
			if p.state.SelectedConv > 0 {
				p.state.SelectedConv--
			}
			return p, nil
		default:
			var cmd tea.Cmd
			p.state.SearchInput, cmd = p.state.SearchInput.Update(msg)
			q := p.state.SearchInput.Value()
			if q != p.state.SearchQuery {
				p.state.SearchQuery = q
				p.state.SearchResult = p.searchSessions(q)
				p.state.SelectedConv = 0
			}
			return p, cmd
		}
	}

	// When the input textarea is focused, forward all non-control keys to it
	// so that letter hotkeys (m, a, r, j, k, /) don't swallow typed characters.
	if p.state.InputFocused {
		switch key {
		case "enter":
			return p, p.sendMessage()
		case "esc":
			if strings.TrimSpace(p.state.Input.Value()) != "" {
				// First Esc: clear text, stay focused.
				p.state.Input.Reset()
				return p, nil
			}
			// Second Esc (empty): blur textarea.
			p.state.InputFocused = false
			p.state.Input.Blur()
			return p, nil
		case "tab":
			p.state.InputFocused = false
			p.state.Input.Blur()
			return p, nil
		case "ctrl+c":
			if p.streaming && p.cancelConv != nil {
				p.cancelConv()
				p.cancelConv = nil
				p.streaming = false
				p.stdinPipe = nil
				p.streamText.Reset()
			}
			return p, nil
		case "ctrl+b":
			p.state.WideMode = !p.state.WideMode
			return p, nil
		case "ctrl+n":
			p.state.Messages = []chat.Message{}
			p.renderCache = make(map[int]string)
			p.stdinPipe = nil
			p.streaming = false
			p.streamText.Reset()
			p.resumeSessionID = ""
			p.activeSessionID = ""
			p.currentTitle = ""
			p.titleGenerated = false
			_ = p.state.Input.Focus()
			return p, nil
		case "ctrl+l":
			p.state.Messages = []chat.Message{}
			p.renderCache = make(map[int]string)
			return p, nil
		case "ctrl+g":
			p.state.GroupByAdapter = !p.state.GroupByAdapter
			return p, nil
		default:
			// Forward all other keys (letters, symbols, etc.) to the textarea.
			var cmd tea.Cmd
			p.state.Input, cmd = p.state.Input.Update(msg)
			return p, cmd
		}
	}

	// Input is NOT focused — handle navigation and hotkeys.
	switch key {
	case "ctrl+b":
		p.state.WideMode = !p.state.WideMode
		return p, nil

	case "ctrl+g":
		p.state.GroupByAdapter = !p.state.GroupByAdapter
		return p, nil

	case "/":
		p.state.SearchMode = true
		p.state.SearchQuery = ""
		p.state.SearchResult = p.state.Sessions
		p.state.SelectedConv = 0
		p.state.SearchInput.Reset()
		_ = p.state.SearchInput.Focus()
		return p, textinput.Blink

	case "m":
		p.state.MarkdownMode = !p.state.MarkdownMode
		return p, nil

	case "a":
		p.state.AnalyticsMode = !p.state.AnalyticsMode
		p.state.AnalyticsScroll = 0
		return p, nil

	case "j", "down":
		if p.state.AnalyticsMode {
			p.state.AnalyticsScroll++
			return p, nil
		}
		total := p.totalSessions()
		if total > 0 && p.state.SelectedConv < total-1 {
			p.state.SelectedConv++
		}
		return p, nil

	case "k", "up":
		if p.state.AnalyticsMode {
			if p.state.AnalyticsScroll > 0 {
				p.state.AnalyticsScroll--
			}
			return p, nil
		}
		if p.state.SelectedConv > 0 {
			p.state.SelectedConv--
		}
		return p, nil

	case "enter":
		return p, p.loadSelectedSession()

	case "tab":
		p.state.InputFocused = true
		_ = p.state.Input.Focus()
		return p, nil

	case "esc":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}

	case "ctrl+n":
		p.state.Messages = []chat.Message{}
		p.renderCache = make(map[int]string)
		p.stdinPipe = nil
		p.streaming = false
		p.streamText.Reset()
		p.resumeSessionID = ""
		p.activeSessionID = ""
		p.currentTitle = ""
		p.titleGenerated = false
		_ = p.state.Input.Focus()
		p.state.InputFocused = true
		return p, nil

	case "r":
		if p.lastError != nil && !p.streaming && p.lastUserMessage != "" {
			p.lastError = nil
			p.state.Input.SetValue(p.lastUserMessage)
			return p, p.sendMessage()
		}

	case "ctrl+c":
		if p.streaming && p.cancelConv != nil {
			p.cancelConv()
			p.cancelConv = nil
			p.streaming = false
			p.stdinPipe = nil
			p.streamText.Reset()
		}
		return p, nil

	case "ctrl+l":
		p.state.Messages = []chat.Message{}
		p.renderCache = make(map[int]string)
		return p, nil
	}

	return p, nil
}

// renderMessages renders all messages with caching for completed messages.
func (p *AgentPlugin) renderMessages(width int) string {
	if len(p.state.Messages) == 0 {
		return styles.DimStyle.Render("  No messages yet. Start a conversation!")
	}

	// Invalidate cache on resize.
	if width != p.lastWidth {
		p.renderCache = make(map[int]string)
		p.lastWidth = width
	}

	var rendered []string
	for i, msg := range p.state.Messages {
		// Use cached render for completed messages.
		if cached, ok := p.renderCache[i]; ok {
			rendered = append(rendered, cached)
			rendered = append(rendered, "")
			continue
		}

		collapsed := p.state.ToolsCollapsed[i]
		var msgRendered string

		if msg.Type == chat.MessageTypeAssistant && p.state.MarkdownMode {
			if msg.Status == "streaming" {
				// Use streaming renderer — no cache yet.
				msgRendered = renderAssistantMarkdownStreaming(msg.Content, width)
			} else {
				msgRendered = renderAssistantMarkdown(msg.Content, width)
				// Cache only if there are no pending-status parts (all complete).
				if !hasRunningParts(msg.Parts) {
					p.renderCache[i] = msgRendered
				}
			}
			// Append Parts (tool calls, agents, thinking) below the Glamour block.
			if len(msg.Parts) > 0 {
				partsRendered := chat.RenderParts(msg.Parts, width, collapsed)
				if partsRendered != "" {
					msgRendered = msgRendered + "\n" + partsRendered
				}
			}
		} else {
			msgRendered = chat.RenderMessage(msg, width, collapsed)
			if msg.Status != "streaming" {
				p.renderCache[i] = msgRendered
			}
		}
		rendered = append(rendered, msgRendered)
		rendered = append(rendered, "")
	}
	return strings.Join(rendered, "\n")
}

// renderAssistantMarkdownStreaming renders a streaming assistant message using
// the incremental Glamour approach — complete paragraphs rendered, trailing
// partial text shown raw.
func renderAssistantMarkdownStreaming(content string, width int) string {
	barWidth := 2
	contentWidth := width - barWidth - 2
	if contentWidth < 20 {
		contentWidth = 20
	}

	rendered := markdown.RenderStreaming(content, contentWidth)
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

// sendMessage sends the current textarea input as a message.
// If a Claude CLI subprocess is already running, writes to its stdin.
// Otherwise, starts a new conversation subprocess.
func (p *AgentPlugin) sendMessage() tea.Cmd {
	content := strings.TrimSpace(p.state.Input.Value())
	if content == "" || p.streaming {
		return nil
	}

	p.state.Messages = append(p.state.Messages, chat.Message{
		Type:    chat.MessageTypeUser,
		Content: content,
	})
	p.state.Input.Reset()
	p.streaming = true
	p.streamStartTime = time.Now()
	p.streamText.Reset()
	p.lastError = nil
	p.lastUserMessage = content

	if p.stdinPipe != nil {
		// Send to existing conversation subprocess.
		stdinPipe := p.stdinPipe
		return func() tea.Msg {
			_ = claude.SendMessage(stdinPipe, content)
			return nil
		}
	}

	// Start a new conversation subprocess (fresh or resuming).
	projectDir := p.getProjectDir()
	config := claude.ConversationConfig{
		ProjectDir: projectDir,
		SessionID:  p.resumeSessionID,
	}
	p.resumeSessionID = "" // consume the resume ID
	bus := p.bus
	return claude.RunConversationCmd(config, bus)
}

// getProjectDir returns the best project directory for new conversations.
func (p *AgentPlugin) getProjectDir() string {
	// Prefer the selected session's project path.
	if p.state.SessionsLoaded && len(p.state.Sessions) > 0 &&
		p.state.SelectedConv < len(p.state.Sessions) {
		return p.state.Sessions[p.state.SelectedConv].ProjectPath
	}
	return ""
}

// totalSessions returns the total number of navigable sessions
func (p *AgentPlugin) totalSessions() int {
	if p.ctx.DemoMode || !p.state.SessionsLoaded {
		return len(p.state.ConversationList)
	}
	return len(p.state.Sessions)
}

// loadSelectedSession loads messages for the currently selected session and
// prepares the session ID for resumption when the user sends the next message.
func (p *AgentPlugin) loadSelectedSession() tea.Cmd {
	if p.ctx.DemoMode || !p.state.SessionsLoaded {
		return nil
	}

	// In search mode, navigate from search results.
	sessions := p.state.Sessions
	if p.state.SearchMode && len(p.state.SearchResult) > 0 {
		sessions = p.state.SearchResult
	}

	if p.state.SelectedConv < 0 || p.state.SelectedConv >= len(sessions) {
		return nil
	}

	session := sessions[p.state.SelectedConv]
	// Set the resume session ID so the next sendMessage() will use --resume.
	p.resumeSessionID = session.ID
	p.currentTitle = session.Title
	p.titleGenerated = true

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

// resumeSession starts a Claude CLI subprocess to resume a previous session.
func (p *AgentPlugin) resumeSession(session adapter.Session) tea.Cmd {
	config := claude.ConversationConfig{
		ProjectDir: session.ProjectPath,
		SessionID:  session.ID,
	}
	return claude.RunConversationCmd(config, p.bus)
}

// searchSessions filters sessions by title or project path (Phase 15b).
func (p *AgentPlugin) searchSessions(query string) []adapter.Session {
	if query == "" {
		return p.state.Sessions
	}
	query = strings.ToLower(query)
	var results []adapter.Session
	for _, s := range p.state.Sessions {
		if strings.Contains(strings.ToLower(s.Title), query) ||
			strings.Contains(strings.ToLower(s.ProjectPath), query) {
			results = append(results, s)
		}
	}
	return results
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

// estimateCostPerToken returns cost per token for input (isInput=true) or output.
func estimateCostPerToken(model string, isInput bool) float64 {
	lowerModel := strings.ToLower(model)
	for key, rate := range modelRates {
		if strings.Contains(lowerModel, key) {
			if isInput {
				return rate.InputPerMillion / 1_000_000
			}
			return rate.OutputPerMillion / 1_000_000
		}
	}
	// Default to Sonnet pricing.
	if isInput {
		return 3.0 / 1_000_000
	}
	return 15.0 / 1_000_000
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

// ── Streaming message types (Phase 6) ─────────────────────────────────────────

// busEventMsg wraps an agentbus.Event for delivery through the Bubble Tea runtime.
type busEventMsg struct{ Event agentbus.Event }

// listenForBusEvents returns a tea.Cmd that reads one event from the channel
// and delivers it as a busEventMsg. The caller should re-issue this command
// after handling each event to keep the pipeline alive.
func listenForBusEvents(ch <-chan agentbus.Event) tea.Cmd {
	return func() tea.Msg {
		e, ok := <-ch
		if !ok {
			return nil
		}
		return busEventMsg{Event: e}
	}
}
