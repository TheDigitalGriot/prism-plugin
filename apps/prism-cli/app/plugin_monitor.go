package app

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/modal"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/styles"
)

// ExecutionRecord represents a single Spectrum execution entry
type ExecutionRecord struct {
	StoryID   string
	StoryName string
	Duration  time.Duration
	Result    string // "success", "error", "blocked"
	Timestamp time.Time
}

// QualityGate represents the status of a quality gate check
type QualityGate struct {
	Name     string
	Command  string
	Status   string // "pass", "fail", "pending", "running", "unknown"
	LastRun  time.Time
	Output   string // Full command output
	Category string // "build", "test", "lint", "browser"
}

// MonitorPanel represents which panel has focus (M-1)
type MonitorPanel int

const (
	PanelHealth  MonitorPanel = iota
	PanelHistory
	PanelGates
)

// MonitorState holds state for the monitor dashboard
type MonitorState struct {
	// System health
	Goroutines  int
	MemAllocMB  float64
	MemTotalMB  float64
	GCCount     uint32
	LastGCPause time.Duration

	// Execution history
	History     []ExecutionRecord
	SelectedRow int

	// Quality gates
	QualityGates  []QualityGate
	GatesSelected int

	// Multi-panel focus (M-1)
	FocusedPanel MonitorPanel

	// Auto-refresh
	LastRefresh   time.Time
	RefreshTicker *time.Ticker

	// Agent health tracking (M-5)
	ActiveAgents []AgentInfo
}

// AgentInfo represents a running agent's status in the health panel (M-5)
type AgentInfo struct {
	WorktreePath string
	AgentType    string
	Status       string // "active", "thinking", "waiting", "done", "paused", "error"
}

// MonitorPlugin implements the technical debt and diagnostics monitor
type MonitorPlugin struct {
	ctx     *plugin.Context
	state   MonitorState
	focused bool
}

// NewMonitorPlugin creates a new Monitor plugin instance
func NewMonitorPlugin() *MonitorPlugin {
	return &MonitorPlugin{
		state: MonitorState{
			History: []ExecutionRecord{},
			QualityGates: []QualityGate{
				{Name: "Lint", Command: "golangci-lint run", Status: "unknown", LastRun: time.Time{}},
				{Name: "Tests", Command: "go test ./...", Status: "unknown", LastRun: time.Time{}},
				{Name: "Build", Command: "go build ./...", Status: "unknown", LastRun: time.Time{}},
			},
			LastRefresh: time.Now(),
		},
	}
}

// ID returns the plugin identifier
func (p *MonitorPlugin) ID() string {
	return "monitor"
}

// Name returns the display name
func (p *MonitorPlugin) Name() string {
	return "Monitor"
}

// Icon returns the tab icon
func (p *MonitorPlugin) Icon() string {
	return ""
}

// Init initializes the plugin with context
func (p *MonitorPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.updateHealthStats()

	// Subscribe to StoryCompletedEvent to update execution history
	if ctx.EventBus != nil {
		ctx.EventBus.Subscribe("story.completed", func(event plugin.Event) {
			if e, ok := event.(plugin.StoryCompletedEvent); ok {
				// Add to execution history
				record := ExecutionRecord{
					StoryID:   e.StoryID,
					StoryName: e.StoryName,
					Duration:  time.Duration(e.Duration) * time.Millisecond,
					Result:    e.Result,
					Timestamp: time.Now(),
				}
				p.state.History = append([]ExecutionRecord{record}, p.state.History...)
				// Keep only last 50 entries
				if len(p.state.History) > 50 {
					p.state.History = p.state.History[:50]
				}
			}
		})

		// Subscribe to AgentStatusEvent for agent health display (M-5)
		ctx.EventBus.Subscribe("agent.status", func(event plugin.Event) {
			if e, ok := event.(plugin.AgentStatusEvent); ok {
				p.updateAgentStatus(e)
			}
		})

		// Subscribe to BrowserVerificationEvent to display browser gates
		ctx.EventBus.Subscribe("browser.verification", func(event plugin.Event) {
			if e, ok := event.(plugin.BrowserVerificationEvent); ok {
				gateName := browserVerificationToGateName(e.CheckType)
				// Update existing gate or append a new one
				found := false
				for i := range p.state.QualityGates {
					if p.state.QualityGates[i].Name == gateName {
						p.state.QualityGates[i].Status = e.Status
						p.state.QualityGates[i].Output = e.Details
						p.state.QualityGates[i].LastRun = time.Now()
						p.state.QualityGates[i].Category = "browser"
						found = true
						break
					}
				}
				if !found {
					p.state.QualityGates = append(p.state.QualityGates, QualityGate{
						Name:     gateName,
						Command:  "playwright-cli " + e.CheckType,
						Status:   e.Status,
						Output:   e.Details,
						LastRun:  time.Now(),
						Category: "browser",
					})
				}
			}
		})
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *MonitorPlugin) Start() tea.Cmd {
	// Start auto-refresh ticker (5 seconds)
	p.state.RefreshTicker = time.NewTicker(5 * time.Second)
	return p.waitForRefresh()
}

// Stop is called when deactivated
func (p *MonitorPlugin) Stop() {
	if p.state.RefreshTicker != nil {
		p.state.RefreshTicker.Stop()
	}
}

// Update handles messages
func (p *MonitorPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case RefreshMonitorMsg:
		// Auto-refresh triggered
		p.updateHealthStats()
		p.state.LastRefresh = time.Now()
		return p, p.waitForRefresh()

	case GateResultMsg:
		// Quality gate execution completed (M-2)
		for i := range p.state.QualityGates {
			if p.state.QualityGates[i].Name == msg.GateName {
				p.state.QualityGates[i].Status = msg.Status
				p.state.QualityGates[i].Output = msg.Output
				p.state.QualityGates[i].LastRun = time.Now()

				// Publish event
				if p.ctx.EventBus != nil {
					p.ctx.EventBus.Publish(plugin.QualityGateResultEvent{
						GateName: msg.GateName,
						Status:   msg.Status,
						Output:   msg.Output,
						Duration: msg.Duration,
					})
				}
				break
			}
		}
		return p, nil
	}

	return p, nil
}

// View renders the monitor dashboard
func (p *MonitorPlugin) View(width, height int) string {
	var sections []string

	// Powerline breadcrumb header
	sections = append(sections, renderBreadcrumb("Monitor", width, p.ctx.HasNerdFont))
	sections = append(sections, "")

	// height is now content-area; subtract breadcrumb(2) + footer area(2: blank + refresh timestamp)
	contentHeight := height - 4
	if contentHeight < 4 {
		contentHeight = 4
	}

	// Layout constants for three-panel horizontal split.
	// lipgloss Width()/Height() are inner dimensions; border adds 2 to outer.
	const (
		minPanelInner  = 25 // minimum inner width per panel for readable content
		panelBorder    = 2  // border adds 2 to outer width (left + right)
		separatorChars = 2  // "  " gap between adjacent panels
		numPanels      = 3
		numGaps        = 2 // gaps between 3 panels
	)
	chrome := numGaps*separatorChars + numPanels*panelBorder // 4 + 6 = 10
	minThreePanelWidth := minPanelInner*numPanels + chrome   // 75 + 10 = 85

	if width >= minThreePanelWidth {
		// Three-panel horizontal layout — fits comfortably
		usable := width - chrome
		panelWidth := usable / 3
		lastPanelWidth := usable - panelWidth*2 // absorb integer-division remainder

		healthPanel := p.renderHealthPanel(panelWidth, contentHeight)
		historyPanel := p.renderHistoryPanel(panelWidth, contentHeight)
		gatesPanel := p.renderQualityGatesPanel(lastPanelWidth, contentHeight)

		panelsRow := lipgloss.JoinHorizontal(lipgloss.Top, healthPanel, "  ", historyPanel, "  ", gatesPanel)
		sections = append(sections, panelsRow)
	} else {
		// Stacked vertical layout — terminal too narrow for three columns
		stackWidth := width - panelBorder
		if stackWidth < minPanelInner {
			stackWidth = minPanelInner
		}
		stackHeight := (contentHeight - 2) / 3 // -2 for gaps between stacked panels
		if stackHeight < 6 {
			stackHeight = 6
		}

		sections = append(sections, p.renderHealthPanel(stackWidth, stackHeight))
		sections = append(sections, p.renderHistoryPanel(stackWidth, stackHeight))
		sections = append(sections, p.renderQualityGatesPanel(stackWidth, stackHeight))
	}

	// Footer with last refresh time and focused panel hint
	lastRefresh := p.state.LastRefresh.Format("15:04:05")
	panelName := [3]string{"Health", "History", "Gates"}[p.state.FocusedPanel]
	footer := styles.DimStyle.Render(fmt.Sprintf("Last refresh: %s │ Panel: %s │ Tab to switch panels", lastRefresh, panelName))
	sections = append(sections, "")
	sections = append(sections, footer)

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *MonitorPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *MonitorPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints
func (p *MonitorPlugin) KeyHints() []plugin.KeyHint {
	hints := []plugin.KeyHint{
		{Key: "tab", Description: "switch panel"},
		{Key: "r", Description: "refresh"},
	}

	switch p.state.FocusedPanel {
	case PanelHistory:
		hints = append(hints, plugin.KeyHint{Key: "j/k", Description: "navigate"})
		hints = append(hints, plugin.KeyHint{Key: "enter", Description: "view detail"})
	case PanelGates:
		hints = append(hints, plugin.KeyHint{Key: "j/k", Description: "navigate"})
		hints = append(hints, plugin.KeyHint{Key: "enter", Description: "run gate"})
		hints = append(hints, plugin.KeyHint{Key: "o", Description: "view output"})
		hints = append(hints, plugin.KeyHint{Key: "R", Description: "run all"})
	}

	hints = append(hints, plugin.KeyHint{Key: "esc", Description: "home"})
	return hints
}

// handleKeyPress handles keyboard input with panel-aware navigation (M-1)
func (p *MonitorPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	switch key {
	case "tab":
		// Cycle focus: Health → History → Gates → Health (M-1)
		p.state.FocusedPanel = (p.state.FocusedPanel + 1) % 3
		return p, nil

	case "shift+tab":
		p.state.FocusedPanel = (p.state.FocusedPanel + 2) % 3
		return p, nil

	case "r":
		// Manual refresh (lowercase r)
		p.updateHealthStats()
		p.state.LastRefresh = time.Now()
		return p, nil

	case "R":
		// Run all quality gates (M-2)
		var cmds []tea.Cmd
		for i := range p.state.QualityGates {
			p.state.QualityGates[i].Status = "running"
			cmds = append(cmds, p.runGateCmd(p.state.QualityGates[i].Name, p.state.QualityGates[i].Command))
		}
		return p, tea.Batch(cmds...)

	case "j", "down":
		// Navigate within focused panel (M-1)
		switch p.state.FocusedPanel {
		case PanelHistory:
			if len(p.state.History) > 0 {
				p.state.SelectedRow = (p.state.SelectedRow + 1) % len(p.state.History)
			}
		case PanelGates:
			if len(p.state.QualityGates) > 0 {
				p.state.GatesSelected = (p.state.GatesSelected + 1) % len(p.state.QualityGates)
			}
		}
		return p, nil

	case "k", "up":
		switch p.state.FocusedPanel {
		case PanelHistory:
			if len(p.state.History) > 0 {
				p.state.SelectedRow = (p.state.SelectedRow - 1 + len(p.state.History)) % len(p.state.History)
			}
		case PanelGates:
			if len(p.state.QualityGates) > 0 {
				p.state.GatesSelected = (p.state.GatesSelected - 1 + len(p.state.QualityGates)) % len(p.state.QualityGates)
			}
		}
		return p, nil

	case "enter":
		// Run selected gate when Gates panel is focused (M-2)
		if p.state.FocusedPanel == PanelGates && len(p.state.QualityGates) > 0 {
			gate := &p.state.QualityGates[p.state.GatesSelected]
			gate.Status = "running"
			return p, p.runGateCmd(gate.Name, gate.Command)
		}
		// Open history detail when History panel is focused (M-4)
		if p.state.FocusedPanel == PanelHistory && p.state.SelectedRow < len(p.state.History) {
			return p, p.openHistoryDetailModal(p.state.History[p.state.SelectedRow])
		}
		return p, nil

	case "o":
		// View gate output when Gates panel is focused (M-3)
		if p.state.FocusedPanel == PanelGates && len(p.state.QualityGates) > 0 {
			gate := p.state.QualityGates[p.state.GatesSelected]
			if gate.Output != "" {
				return p, p.openGateOutputModal(gate)
			}
		}
		return p, nil

	case "esc", "backspace":
		// Return to home
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// panelBorderColor returns the border color for a panel based on focus state (M-1)
func (p *MonitorPlugin) panelBorderColor(panel MonitorPanel, defaultColor lipgloss.Color) lipgloss.Color {
	if p.focused && p.state.FocusedPanel == panel {
		return lipgloss.Color("#7C3AED") // Purple highlight for focused panel
	}
	return defaultColor
}

// renderHealthPanel renders the system health dashboard
func (p *MonitorPlugin) renderHealthPanel(width, height int) string {
	var lines []string

	// Panel title
	title := styles.StoriesTitleStyle.Render("⚡ System Health")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	// Health metrics
	lines = append(lines, fmt.Sprintf("  Goroutines:    %s", styles.InfoStyle.Render(fmt.Sprintf("%d", p.state.Goroutines))))
	lines = append(lines, fmt.Sprintf("  Memory Alloc:  %s", styles.InfoStyle.Render(fmt.Sprintf("%.1f MB", p.state.MemAllocMB))))
	lines = append(lines, fmt.Sprintf("  Memory Total:  %s", styles.InfoStyle.Render(fmt.Sprintf("%.1f MB", p.state.MemTotalMB))))
	lines = append(lines, fmt.Sprintf("  GC Runs:       %s", styles.InfoStyle.Render(fmt.Sprintf("%d", p.state.GCCount))))
	lines = append(lines, fmt.Sprintf("  Last GC Pause: %s", styles.InfoStyle.Render(p.state.LastGCPause.String())))
	lines = append(lines, "")

	// Status indicator
	status := "🟢 Healthy"
	if p.state.Goroutines > 100 {
		status = "🟡 High Goroutines"
	}
	if p.state.MemAllocMB > 500 {
		status = "🟠 High Memory"
	}
	lines = append(lines, "  "+styles.SuccessStyle.Render(status))
	lines = append(lines, "")

	// Agent health section (M-5)
	lines = append(lines, "  "+styles.DimStyle.Render(fmt.Sprintf("─── Agents (%d) ───", len(p.state.ActiveAgents))))
	if len(p.state.ActiveAgents) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No agents running"))
	} else {
		for _, agent := range p.state.ActiveAgents {
			// Status icon
			var statusIcon string
			switch agent.Status {
			case "active":
				statusIcon = styles.SuccessStyle.Render("●")
			case "thinking":
				statusIcon = styles.InfoStyle.Render("◉")
			case "waiting":
				statusIcon = styles.WarningStyle.Render("○")
			case "paused":
				statusIcon = styles.DimStyle.Render("⏸")
			default:
				statusIcon = styles.DimStyle.Render("?")
			}
			agentType := agent.AgentType
			if agentType == "" {
				agentType = "unknown"
			}
			// Show worktree basename for brevity
			wtName := filepath.Base(agent.WorktreePath)
			lines = append(lines, fmt.Sprintf("  %s %-8s %s", statusIcon, agentType, styles.DimStyle.Render(wtName)))
		}
	}

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	borderColor := p.panelBorderColor(PanelHealth, styles.Info)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// renderHistoryPanel renders the execution history table
func (p *MonitorPlugin) renderHistoryPanel(width, height int) string {
	isFocused := p.focused && p.state.FocusedPanel == PanelHistory
	var lines []string

	// Panel title
	title := styles.ActivityTitleStyle.Render("📜 Execution History")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(p.state.History) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No executions yet"))
	} else {
		// Responsive table: show Time column only when panel is wide enough.
		tableW := width - 2
		showTime := tableW >= 40

		// Table header
		var header string
		if showTime {
			header = fmt.Sprintf("  %-10s    %-7s %6s  %-8s", "Story", "Result", "Dur.", "Time")
		} else {
			header = fmt.Sprintf("  %-10s    %-7s %6s", "Story", "Result", "Dur.")
		}
		lines = append(lines, styles.DimStyle.Render(header))
		sepW := tableW
		if sepW < 1 {
			sepW = 1
		}
		lines = append(lines, "  "+strings.Repeat("─", sepW))

		// Show last 10 executions (most recent first)
		start := 0
		if len(p.state.History) > 10 {
			start = len(p.state.History) - 10
		}

		for i := len(p.state.History) - 1; i >= start; i-- {
			record := p.state.History[i]

			// Status icon
			statusIcon := "✓"
			statusStyle := styles.SuccessStyle
			if record.Result == "error" {
				statusIcon = "✗"
				statusStyle = styles.ErrorStyle
			} else if record.Result == "blocked" {
				statusIcon = "⊘"
				statusStyle = styles.WarningStyle
			}

			durationStr := record.Duration.Truncate(time.Second).String()

			storyID := record.StoryID
			if len(storyID) > 10 {
				storyID = storyID[:10]
			}

			var row string
			if showTime {
				timeStr := record.Timestamp.Format("15:04:05")
				row = fmt.Sprintf("  %10s  %s %-7s %6s  %s",
					storyID,
					statusStyle.Render(statusIcon),
					record.Result,
					durationStr,
					timeStr,
				)
			} else {
				row = fmt.Sprintf("  %10s  %s %-7s %6s",
					storyID,
					statusStyle.Render(statusIcon),
					record.Result,
					durationStr,
				)
			}

			// Highlight selected row only when this panel is focused (M-1)
			if i == p.state.SelectedRow && isFocused {
				row = styles.CurrentStyle.Render(row)
			}

			lines = append(lines, row)
		}
	}

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	borderColor := p.panelBorderColor(PanelHistory, styles.Success)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// renderQualityGatesPanel renders the quality gates status
func (p *MonitorPlugin) renderQualityGatesPanel(width, height int) string {
	isFocused := p.focused && p.state.FocusedPanel == PanelGates
	var lines []string

	// Panel title
	title := styles.LogTitleStyle.Render("🎯 Quality Gates")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	// Quality gates list
	for i, gate := range p.state.QualityGates {
		// Status icon and style
		var statusIcon string
		var statusStyle lipgloss.Style

		switch gate.Status {
		case "pass":
			statusIcon = "✓"
			statusStyle = styles.SuccessStyle
		case "fail":
			statusIcon = "✗"
			statusStyle = styles.ErrorStyle
		case "pending":
			statusIcon = "⏳"
			statusStyle = styles.WarningStyle
		case "running":
			statusIcon = "⟳"
			statusStyle = styles.InfoStyle
		default:
			statusIcon = "?"
			statusStyle = styles.DimStyle
		}

		// Gate name and status — browser gates use teal accent
		nameStyle := lipgloss.NewStyle()
		if gate.Category == "browser" {
			nameStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#0D9488"))
		}
		gateLine := fmt.Sprintf("  %s %s",
			statusStyle.Render(statusIcon),
			nameStyle.Render(gate.Name),
		)

		// Highlight selected gate when this panel is focused (M-1)
		if i == p.state.GatesSelected && isFocused {
			gateLine = styles.CurrentStyle.Render(gateLine)
		}

		lines = append(lines, gateLine)

		// Command (dimmed)
		cmdLine := fmt.Sprintf("    %s", gate.Command)
		lines = append(lines, styles.DimStyle.Render(cmdLine))

		// Last run time
		if !gate.LastRun.IsZero() {
			lastRun := time.Since(gate.LastRun).Truncate(time.Second)
			lines = append(lines, styles.DimStyle.Render(fmt.Sprintf("    Last run: %s ago", lastRun)))
		} else {
			lines = append(lines, styles.DimStyle.Render("    Never run"))
		}

		lines = append(lines, "")
	}

	// Hint
	hint := "Enter: run selected │ R: run all"
	maxHint := width - 2
	if maxHint > 0 && len(hint) > maxHint {
		hint = hint[:maxHint-1] + "…"
	}
	lines = append(lines, "  "+styles.DimStyle.Render(hint))

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	borderColor := p.panelBorderColor(PanelGates, styles.Warning)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// updateHealthStats updates runtime health statistics
func (p *MonitorPlugin) updateHealthStats() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	p.state.Goroutines = runtime.NumGoroutine()
	p.state.MemAllocMB = float64(m.Alloc) / 1024 / 1024
	p.state.MemTotalMB = float64(m.TotalAlloc) / 1024 / 1024
	p.state.GCCount = m.NumGC
	p.state.LastGCPause = time.Duration(m.PauseNs[(m.NumGC+255)%256])
}

// waitForRefresh waits for the next refresh tick
func (p *MonitorPlugin) waitForRefresh() tea.Cmd {
	return func() tea.Msg {
		if p.state.RefreshTicker != nil {
			<-p.state.RefreshTicker.C
		}
		return RefreshMonitorMsg{}
	}
}

// RefreshMonitorMsg signals that the monitor should refresh its data
type RefreshMonitorMsg struct{}

// GateResultMsg carries the result of a quality gate execution (M-2)
type GateResultMsg struct {
	GateName string
	Status   string // "pass" or "fail"
	Output   string
	Duration int64 // milliseconds
}

// runGateCmd executes a quality gate command asynchronously (M-2)
func (p *MonitorPlugin) runGateCmd(name, command string) tea.Cmd {
	projectDir := p.ctx.ProjectDir
	return func() tea.Msg {
		start := time.Now()

		// Split command for exec
		parts := strings.Fields(command)
		if len(parts) == 0 {
			return GateResultMsg{
				GateName: name,
				Status:   "fail",
				Output:   "empty command",
				Duration: 0,
			}
		}

		cmd := exec.Command(parts[0], parts[1:]...)
		if projectDir != "" && projectDir != "demo" {
			cmd.Dir = projectDir
		}

		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()
		duration := time.Since(start).Milliseconds()

		output := stdout.String()
		if stderr.Len() > 0 {
			if output != "" {
				output += "\n"
			}
			output += stderr.String()
		}

		// Trim to last 50 lines
		lines := strings.Split(output, "\n")
		if len(lines) > 50 {
			lines = lines[len(lines)-50:]
			output = "...(truncated)\n" + strings.Join(lines, "\n")
		}

		status := "pass"
		if err != nil {
			status = "fail"
		}

		return GateResultMsg{
			GateName: name,
			Status:   status,
			Output:   output,
			Duration: duration,
		}
	}
}

// AddExecutionRecord adds a new execution record to the history
func (p *MonitorPlugin) AddExecutionRecord(storyID, storyName string, duration time.Duration, result string) {
	record := ExecutionRecord{
		StoryID:   storyID,
		StoryName: storyName,
		Duration:  duration,
		Result:    result,
		Timestamp: time.Now(),
	}
	p.state.History = append(p.state.History, record)

	// Keep only last 100 records
	if len(p.state.History) > 100 {
		p.state.History = p.state.History[len(p.state.History)-100:]
	}
}

// UpdateQualityGate updates the status of a quality gate
func (p *MonitorPlugin) UpdateQualityGate(name, status, output string) {
	for i := range p.state.QualityGates {
		if p.state.QualityGates[i].Name == name {
			p.state.QualityGates[i].Status = status
			p.state.QualityGates[i].Output = output
			p.state.QualityGates[i].LastRun = time.Now()
			break
		}
	}
}

// updateAgentStatus updates or removes an agent entry based on status event (M-5).
func (p *MonitorPlugin) updateAgentStatus(e plugin.AgentStatusEvent) {
	// Find existing agent by worktree path
	for i, a := range p.state.ActiveAgents {
		if a.WorktreePath == e.WorktreePath {
			if e.Status == "done" || e.Status == "error" {
				// Remove completed/errored agents
				p.state.ActiveAgents = append(p.state.ActiveAgents[:i], p.state.ActiveAgents[i+1:]...)
			} else {
				// Update status
				p.state.ActiveAgents[i].Status = e.Status
				p.state.ActiveAgents[i].AgentType = e.AgentType
			}
			return
		}
	}

	// New agent — add if not done/error
	if e.Status != "done" && e.Status != "error" {
		p.state.ActiveAgents = append(p.state.ActiveAgents, AgentInfo{
			WorktreePath: e.WorktreePath,
			AgentType:    e.AgentType,
			Status:       e.Status,
		})
	}
}

// openGateOutputModal opens a scrollable modal showing gate output (M-3).
func (p *MonitorPlugin) openGateOutputModal(gate QualityGate) tea.Cmd {
	// Status badge
	var statusBadge string
	switch gate.Status {
	case "pass":
		statusBadge = "PASS"
	case "fail":
		statusBadge = "FAIL"
	default:
		statusBadge = strings.ToUpper(gate.Status)
	}

	header := fmt.Sprintf("%s — %s\nCommand: %s", gate.Name, statusBadge, gate.Command)
	if !gate.LastRun.IsZero() {
		elapsed := time.Since(gate.LastRun).Truncate(time.Second)
		header += fmt.Sprintf("\nLast run: %s ago", elapsed)
	}

	// Trim output to reasonable length for modal display
	output := gate.Output
	if output == "" {
		output = "(no output captured)"
	}

	variant := modal.VariantInfo
	if gate.Status == "fail" {
		variant = modal.VariantDanger
	}

	return func() tea.Msg {
		m := modal.New("Gate Output: "+gate.Name, modal.WithWidth(80), modal.WithVariant(variant)).
			AddSection(modal.Text(header)).
			AddSection(modal.Spacer()).
			AddSection(modal.Text(output)).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(modal.Btn("Close", "cancel")))
		return OpenModalMsg{Modal: m}
	}
}

// openHistoryDetailModal opens a modal showing execution record details (M-4).
func (p *MonitorPlugin) openHistoryDetailModal(record ExecutionRecord) tea.Cmd {
	// Result badge
	var resultBadge string
	switch record.Result {
	case "success":
		resultBadge = "SUCCESS"
	case "error":
		resultBadge = "ERROR"
	case "blocked":
		resultBadge = "BLOCKED"
	default:
		resultBadge = strings.ToUpper(record.Result)
	}

	detail := fmt.Sprintf("Story:     %s\nName:      %s\nResult:    %s\nDuration:  %s\nTimestamp: %s",
		record.StoryID,
		record.StoryName,
		resultBadge,
		record.Duration.Truncate(time.Millisecond).String(),
		record.Timestamp.Format("2006-01-02 15:04:05"),
	)

	variant := modal.VariantInfo
	if record.Result == "error" {
		variant = modal.VariantDanger
	} else if record.Result == "blocked" {
		variant = modal.VariantWarning
	}

	return func() tea.Msg {
		m := modal.New("Execution Detail", modal.WithWidth(60), modal.WithVariant(variant)).
			AddSection(modal.Text(detail)).
			AddSection(modal.Spacer()).
			AddSection(modal.Buttons(modal.Btn("Close", "cancel")))
		return OpenModalMsg{Modal: m}
	}
}
