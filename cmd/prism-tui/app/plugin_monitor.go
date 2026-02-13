package app

import (
	"fmt"
	"runtime"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
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
	Name      string
	Command   string
	Status    string // "pass", "fail", "pending", "unknown"
	LastRun   time.Time
	Output    string // Last few lines of output
}

// MonitorState holds state for the monitor dashboard
type MonitorState struct {
	// System health
	Goroutines   int
	MemAllocMB   float64
	MemTotalMB   float64
	GCCount      uint32
	LastGCPause  time.Duration

	// Execution history
	History       []ExecutionRecord
	SelectedRow   int

	// Quality gates
	QualityGates  []QualityGate
	GatesSelected int

	// Auto-refresh
	LastRefresh   time.Time
	RefreshTicker *time.Ticker
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
	return "📊"
}

// Init initializes the plugin with context
func (p *MonitorPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	p.updateHealthStats()
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
	}

	return p, nil
}

// View renders the monitor dashboard
func (p *MonitorPlugin) View(width, height int) string {
	var sections []string

	// Header
	title := styles.TitleStyle.Render("PRISM")
	breadcrumb := styles.DimStyle.Render(" > Monitor")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, breadcrumb)
	sections = append(sections, styles.HeaderStyle.Width(width).Render(header))
	sections = append(sections, "")

	// Main content: 3 panels side by side
	contentHeight := height - 6

	// Panel 1: System Health (left third)
	healthPanel := p.renderHealthPanel(width/3 - 2, contentHeight)

	// Panel 2: Execution History (middle third)
	historyPanel := p.renderHistoryPanel(width/3 - 2, contentHeight)

	// Panel 3: Quality Gates (right third)
	gatesPanel := p.renderQualityGatesPanel(width/3 - 2, contentHeight)

	// Combine panels horizontally
	panelsRow := lipgloss.JoinHorizontal(lipgloss.Top, healthPanel, "  ", historyPanel, "  ", gatesPanel)
	sections = append(sections, panelsRow)

	// Footer with last refresh time
	lastRefresh := p.state.LastRefresh.Format("15:04:05")
	footer := styles.DimStyle.Render(fmt.Sprintf("Last refresh: %s (auto-refresh every 5s)", lastRefresh))
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
	return []plugin.KeyHint{
		{Key: "r", Description: "refresh"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *MonitorPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	switch key {
	case "r":
		// Manual refresh
		p.updateHealthStats()
		p.state.LastRefresh = time.Now()
		return p, nil

	case "j", "down":
		// Navigate history
		if len(p.state.History) > 0 {
			p.state.SelectedRow = (p.state.SelectedRow + 1) % len(p.state.History)
		}
		return p, nil

	case "k", "up":
		// Navigate history
		if len(p.state.History) > 0 {
			p.state.SelectedRow = (p.state.SelectedRow - 1 + len(p.state.History)) % len(p.state.History)
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

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Info).
		Width(width).
		Height(height).
		Render(content)
}

// renderHistoryPanel renders the execution history table
func (p *MonitorPlugin) renderHistoryPanel(width, height int) string {
	var lines []string

	// Panel title
	title := styles.ActivityTitleStyle.Render("📜 Execution History")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(p.state.History) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No executions yet"))
	} else {
		// Table header
		header := fmt.Sprintf("  %-10s %-16s %8s %s", "Story", "Result", "Duration", "Time")
		lines = append(lines, styles.DimStyle.Render(header))
		lines = append(lines, "  "+strings.Repeat("─", width-4))

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

			// Format duration
			durationStr := record.Duration.Truncate(time.Second).String()

			// Format timestamp
			timeStr := record.Timestamp.Format("15:04:05")

			// Truncate story ID if needed
			storyID := record.StoryID
			if len(storyID) > 10 {
				storyID = storyID[:10]
			}

			row := fmt.Sprintf("  %-10s %s %-10s %8s %s",
				storyID,
				statusStyle.Render(statusIcon),
				record.Result,
				durationStr,
				timeStr,
			)

			// Highlight selected row
			if i == p.state.SelectedRow && p.focused {
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
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Success).
		Width(width).
		Height(height).
		Render(content)
}

// renderQualityGatesPanel renders the quality gates status
func (p *MonitorPlugin) renderQualityGatesPanel(width, height int) string {
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
		default:
			statusIcon = "?"
			statusStyle = styles.DimStyle
		}

		// Gate name and status
		gateLine := fmt.Sprintf("  %s %s",
			statusStyle.Render(statusIcon),
			gate.Name,
		)

		// Highlight selected
		if i == p.state.GatesSelected && p.focused {
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
	lines = append(lines, "  "+styles.DimStyle.Render("Run: make test, make lint, make build"))

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Warning).
		Width(width).
		Height(height).
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
