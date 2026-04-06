package app

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/styles"
)

// BrowserSessionInfo represents an active playwright browser session
type BrowserSessionInfo struct {
	SessionID string
	URL       string
	CreatedAt time.Time
	Action    string // "created", "closed", "error"
}

// BrowserVerificationRecord represents a completed browser verification check
type BrowserVerificationRecord struct {
	StoryID      string
	CheckType    string // "screenshot", "console", "snapshot", "network"
	Status       string // "pass", "fail"
	ArtifactPath string
	Details      string
	Timestamp    time.Time
}

// BrowserArtifact represents a verification artifact file on disk
type BrowserArtifact struct {
	Path      string
	Name      string
	Size      int64
	Timestamp time.Time
	StoryID   string
}

// BrowserPanel represents which panel has focus in the browser view
type BrowserPanel int

const (
	BrowserPanelSessions BrowserPanel = iota
	BrowserPanelHistory
	BrowserPanelArtifact
)

// BrowserState holds state for the browser verification plugin
type BrowserState struct {
	// Active playwright sessions
	Sessions    []BrowserSessionInfo
	SelectedSession int

	// Verification history
	History     []BrowserVerificationRecord
	SelectedRow int

	// Selected artifact metadata
	SelectedArtifact *BrowserArtifact

	// Panel focus
	FocusedPanel BrowserPanel

	// Scan state
	ArtifactDir   string
	LastScan      time.Time
	ScanTicker    *time.Ticker
}

// BrowserPlugin implements the browser verification dashboard
type BrowserPlugin struct {
	ctx     *plugin.Context
	state   BrowserState
	focused bool
}

// NewBrowserPlugin creates a new Browser plugin instance
func NewBrowserPlugin() *BrowserPlugin {
	return &BrowserPlugin{
		state: BrowserState{
			Sessions: []BrowserSessionInfo{},
			History:  []BrowserVerificationRecord{},
		},
	}
}

// ID returns the plugin identifier
func (p *BrowserPlugin) ID() string {
	return "browser"
}

// Name returns the display name
func (p *BrowserPlugin) Name() string {
	return "Browser"
}

// Icon returns the tab icon
func (p *BrowserPlugin) Icon() string {
	return "🌐"
}

// Init initializes the plugin with context
func (p *BrowserPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx

	// Set artifact directory
	if ctx.PrismDir != "" && ctx.PrismDir != "demo" {
		p.state.ArtifactDir = filepath.Join(ctx.PrismDir, "local", "verifications")
	}

	// Subscribe to browser events on EventBus
	if ctx.EventBus != nil {
		ctx.EventBus.Subscribe("browser.verification", func(event plugin.Event) {
			if e, ok := event.(plugin.BrowserVerificationEvent); ok {
				record := BrowserVerificationRecord{
					StoryID:      e.StoryID,
					CheckType:    e.CheckType,
					Status:       e.Status,
					ArtifactPath: e.ArtifactPath,
					Details:      e.Details,
					Timestamp:    time.Now(),
				}
				p.state.History = append([]BrowserVerificationRecord{record}, p.state.History...)
				// Keep only last 50 entries
				if len(p.state.History) > 50 {
					p.state.History = p.state.History[:50]
				}
			}
		})

		ctx.EventBus.Subscribe("browser.session", func(event plugin.Event) {
			if e, ok := event.(plugin.BrowserSessionEvent); ok {
				p.updateSessionState(e)
			}
		})
	}

	return nil
}

// Start is called when the plugin is first activated
func (p *BrowserPlugin) Start() tea.Cmd {
	if p.ctx.DemoMode || p.state.ArtifactDir == "" {
		return nil
	}
	// Start periodic scan and do an initial scan
	p.state.ScanTicker = time.NewTicker(10 * time.Second)
	return tea.Batch(
		scanVerificationsCmd(p.state.ArtifactDir),
		p.waitForBrowserTick(),
	)
}

// Stop is called when deactivated
func (p *BrowserPlugin) Stop() {
	if p.state.ScanTicker != nil {
		p.state.ScanTicker.Stop()
	}
}

// Update handles messages
func (p *BrowserPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case plugin.PluginResizeMsg:
		return p, nil

	case BrowserTickMsg:
		// Periodic refresh: re-scan verifications dir
		if p.state.ArtifactDir != "" {
			p.state.LastScan = time.Now()
			return p, tea.Batch(
				scanVerificationsCmd(p.state.ArtifactDir),
				p.waitForBrowserTick(),
			)
		}
		return p, p.waitForBrowserTick()

	case BrowserScanResultMsg:
		// Update artifact list from scan
		if msg.Error == nil {
			p.mergeArtifacts(msg.Artifacts)
		}
		return p, nil
	}

	return p, nil
}

// View renders the browser verification dashboard
func (p *BrowserPlugin) View(width, height int) string {
	var sections []string

	sections = append(sections, renderBreadcrumb("Browser", width, p.ctx.HasNerdFont))
	sections = append(sections, "")

	contentHeight := height - 4
	if contentHeight < 6 {
		contentHeight = 6
	}

	// Three-panel vertical stack
	panelH := contentHeight / 3
	if panelH < 4 {
		panelH = 4
	}

	sections = append(sections, p.renderSessionsPanel(width-2, panelH))
	sections = append(sections, "")
	sections = append(sections, p.renderHistoryPanel(width-2, panelH))
	sections = append(sections, "")
	sections = append(sections, p.renderArtifactPanel(width-2, panelH))

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *BrowserPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *BrowserPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints
func (p *BrowserPlugin) KeyHints() []plugin.KeyHint {
	return []plugin.KeyHint{
		{Key: "tab", Description: "switch panel"},
		{Key: "j/k", Description: "navigate"},
		{Key: "enter", Description: "view details"},
		{Key: "d", Description: "delete session"},
		{Key: "K", Description: "kill all sessions"},
		{Key: "s", Description: "screenshot"},
		{Key: "r", Description: "refresh"},
		{Key: "esc", Description: "home"},
	}
}

// handleKeyPress handles keyboard input
func (p *BrowserPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	switch msg.String() {
	case "tab":
		p.state.FocusedPanel = (p.state.FocusedPanel + 1) % 3
		return p, nil

	case "shift+tab":
		p.state.FocusedPanel = (p.state.FocusedPanel + 2) % 3
		return p, nil

	case "j", "down":
		switch p.state.FocusedPanel {
		case BrowserPanelSessions:
			if len(p.state.Sessions) > 0 {
				p.state.SelectedSession = (p.state.SelectedSession + 1) % len(p.state.Sessions)
			}
		case BrowserPanelHistory:
			if len(p.state.History) > 0 {
				p.state.SelectedRow = (p.state.SelectedRow + 1) % len(p.state.History)
				p.updateSelectedArtifact()
			}
		}
		return p, nil

	case "k", "up":
		switch p.state.FocusedPanel {
		case BrowserPanelSessions:
			if len(p.state.Sessions) > 0 {
				p.state.SelectedSession = (p.state.SelectedSession - 1 + len(p.state.Sessions)) % len(p.state.Sessions)
			}
		case BrowserPanelHistory:
			if len(p.state.History) > 0 {
				p.state.SelectedRow = (p.state.SelectedRow - 1 + len(p.state.History)) % len(p.state.History)
				p.updateSelectedArtifact()
			}
		}
		return p, nil

	case "enter":
		switch p.state.FocusedPanel {
		case BrowserPanelSessions:
			// Show selected session details in the artifact panel
			if p.state.SelectedSession < len(p.state.Sessions) {
				s := p.state.Sessions[p.state.SelectedSession]
				p.state.SelectedArtifact = &BrowserArtifact{
					Name:      s.SessionID,
					Path:      s.URL,
					Timestamp: s.CreatedAt,
					StoryID:   s.Action,
				}
				p.state.FocusedPanel = BrowserPanelArtifact
			}
		case BrowserPanelHistory:
			p.updateSelectedArtifact()
			if p.state.SelectedArtifact != nil {
				p.state.FocusedPanel = BrowserPanelArtifact
			}
		}
		return p, nil

	case "d":
		// Delete selected session from list
		if p.state.FocusedPanel == BrowserPanelSessions && len(p.state.Sessions) > 0 {
			idx := p.state.SelectedSession
			p.state.Sessions = append(p.state.Sessions[:idx], p.state.Sessions[idx+1:]...)
			if p.state.SelectedSession >= len(p.state.Sessions) && len(p.state.Sessions) > 0 {
				p.state.SelectedSession = len(p.state.Sessions) - 1
			} else if len(p.state.Sessions) == 0 {
				p.state.SelectedSession = 0
			}
		}
		return p, nil

	case "K":
		// Kill all sessions — clear session list
		p.state.Sessions = []BrowserSessionInfo{}
		p.state.SelectedSession = 0
		return p, nil

	case "s":
		// Take a quick screenshot via playwright-cli
		return p, takeScreenshotCmd(p.state.ArtifactDir)

	case "r":
		if p.state.ArtifactDir != "" {
			return p, scanVerificationsCmd(p.state.ArtifactDir)
		}
		return p, nil

	case "esc", "backspace":
		return p, func() tea.Msg {
			return plugin.FocusPluginMsg{ID: "home"}
		}
	}

	return p, nil
}

// renderSessionsPanel renders the active playwright sessions
func (p *BrowserPlugin) renderSessionsPanel(width, height int) string {
	isFocused := p.focused && p.state.FocusedPanel == BrowserPanelSessions
	var lines []string

	title := styles.StoriesTitleStyle.Render("🌐 Active Sessions")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(p.state.Sessions) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No active browser sessions"))
		lines = append(lines, "  "+styles.DimStyle.Render("Sessions appear when playwright-cli runs"))
	} else {
		for i, session := range p.state.Sessions {
			icon := "●"
			iconStyle := styles.SuccessStyle
			if session.Action == "error" {
				icon = "✗"
				iconStyle = styles.ErrorStyle
			} else if session.Action == "closed" {
				icon = "○"
				iconStyle = styles.DimStyle
			}

			age := time.Since(session.CreatedAt).Truncate(time.Second)
			row := fmt.Sprintf("  %s %-30s %s",
				iconStyle.Render(icon),
				truncateStr(session.SessionID, 30),
				styles.DimStyle.Render(age.String()),
			)

			if i == p.state.SelectedSession && isFocused {
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
	borderColor := p.panelBorderColor(BrowserPanelSessions)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// renderHistoryPanel renders the verification history table
func (p *BrowserPlugin) renderHistoryPanel(width, height int) string {
	isFocused := p.focused && p.state.FocusedPanel == BrowserPanelHistory
	var lines []string

	title := styles.ActivityTitleStyle.Render("📋 Verification History")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if len(p.state.History) == 0 {
		lines = append(lines, "  "+styles.DimStyle.Render("No verification results yet"))
		lines = append(lines, "  "+styles.DimStyle.Render("Run /prism-verify to capture browser state"))
	} else {
		header := fmt.Sprintf("  %-10s  %-12s  %-8s  %s", "Story", "Check", "Status", "Time")
		lines = append(lines, styles.DimStyle.Render(header))
		lines = append(lines, "  "+strings.Repeat("─", width-4))

		for i, record := range p.state.History {
			statusIcon := "✓"
			statusStyle := styles.SuccessStyle
			if record.Status == "fail" {
				statusIcon = "✗"
				statusStyle = styles.ErrorStyle
			}

			storyID := record.StoryID
			if storyID == "" {
				storyID = "—"
			}
			if len(storyID) > 10 {
				storyID = storyID[:10]
			}

			timeStr := record.Timestamp.Format("15:04:05")
			row := fmt.Sprintf("  %-10s  %-12s  %s %-6s  %s",
				storyID,
				truncateStr(record.CheckType, 12),
				statusStyle.Render(statusIcon),
				record.Status,
				styles.DimStyle.Render(timeStr),
			)

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
	borderColor := p.panelBorderColor(BrowserPanelHistory)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// renderArtifactPanel renders metadata for the selected artifact
func (p *BrowserPlugin) renderArtifactPanel(width, height int) string {
	var lines []string

	title := styles.LogTitleStyle.Render("📁 Selected Artifact")
	lines = append(lines, "  "+title)
	lines = append(lines, "")

	if p.state.SelectedArtifact == nil {
		// Show artifact dir info instead
		if p.state.ArtifactDir != "" {
			lines = append(lines, "  "+styles.DimStyle.Render("Artifacts stored in:"))
			lines = append(lines, "  "+styles.InfoStyle.Render(p.state.ArtifactDir))
		} else {
			lines = append(lines, "  "+styles.DimStyle.Render("No artifact selected"))
		}
		if !p.state.LastScan.IsZero() {
			lines = append(lines, "  "+styles.DimStyle.Render(fmt.Sprintf("Last scan: %s", p.state.LastScan.Format("15:04:05"))))
		}
	} else {
		a := p.state.SelectedArtifact
		lines = append(lines, fmt.Sprintf("  %s %s", styles.DimStyle.Render("Path:"), a.Path))
		lines = append(lines, fmt.Sprintf("  %s %s", styles.DimStyle.Render("File:"), a.Name))
		if a.Size > 0 {
			lines = append(lines, fmt.Sprintf("  %s %s", styles.DimStyle.Render("Size:"), formatBytes(a.Size)))
		}
		lines = append(lines, fmt.Sprintf("  %s %s", styles.DimStyle.Render("Time:"), a.Timestamp.Format("2006-01-02 15:04:05")))
		if a.StoryID != "" {
			lines = append(lines, fmt.Sprintf("  %s %s", styles.DimStyle.Render("Story:"), a.StoryID))
		}
	}

	// Pad to height
	for len(lines) < height-2 {
		lines = append(lines, "")
	}

	content := strings.Join(lines, "\n")
	borderColor := p.panelBorderColor(BrowserPanelArtifact)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(width).
		Height(height - 2).
		Render(content)
}

// panelBorderColor returns the border color based on focus state
func (p *BrowserPlugin) panelBorderColor(panel BrowserPanel) lipgloss.Color {
	if p.focused && p.state.FocusedPanel == panel {
		return lipgloss.Color("#0D9488") // Teal for browser panel
	}
	return styles.Info
}

// updateSessionState handles a BrowserSessionEvent
func (p *BrowserPlugin) updateSessionState(e plugin.BrowserSessionEvent) {
	// Find existing session
	for i, s := range p.state.Sessions {
		if s.SessionID == e.SessionID {
			p.state.Sessions[i].Action = e.Action
			return
		}
	}
	// New session
	if e.Action == "created" {
		p.state.Sessions = append([]BrowserSessionInfo{
			{SessionID: e.SessionID, Action: e.Action, CreatedAt: time.Now()},
		}, p.state.Sessions...)
	}
}

// updateSelectedArtifact updates the artifact panel based on current history selection
func (p *BrowserPlugin) updateSelectedArtifact() {
	if p.state.SelectedRow >= len(p.state.History) {
		p.state.SelectedArtifact = nil
		return
	}
	record := p.state.History[p.state.SelectedRow]
	if record.ArtifactPath == "" {
		p.state.SelectedArtifact = nil
		return
	}
	info, err := os.Stat(record.ArtifactPath)
	if err != nil {
		p.state.SelectedArtifact = nil
		return
	}
	p.state.SelectedArtifact = &BrowserArtifact{
		Path:      record.ArtifactPath,
		Name:      filepath.Base(record.ArtifactPath),
		Size:      info.Size(),
		Timestamp: info.ModTime(),
		StoryID:   record.StoryID,
	}
}

// mergeArtifacts incorporates scan results into the history
func (p *BrowserPlugin) mergeArtifacts(artifacts []BrowserArtifact) {
	// For now just update the selected artifact if applicable
	p.updateSelectedArtifact()
}

// waitForBrowserTick waits for the next scan tick
func (p *BrowserPlugin) waitForBrowserTick() tea.Cmd {
	return func() tea.Msg {
		if p.state.ScanTicker != nil {
			<-p.state.ScanTicker.C
		}
		return BrowserTickMsg{}
	}
}

// BrowserTickMsg signals that the browser plugin should refresh
type BrowserTickMsg struct{}

// BrowserScanResultMsg carries the result of scanning the verifications directory
type BrowserScanResultMsg struct {
	Artifacts []BrowserArtifact
	Error     error
}

// scanVerificationsCmd scans the verifications directory for artifacts
func scanVerificationsCmd(dir string) tea.Cmd {
	return func() tea.Msg {
		var artifacts []BrowserArtifact

		if _, err := os.Stat(dir); os.IsNotExist(err) {
			return BrowserScanResultMsg{Artifacts: artifacts}
		}

		entries, err := os.ReadDir(dir)
		if err != nil {
			return BrowserScanResultMsg{Error: err}
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			subDir := filepath.Join(dir, entry.Name())
			subEntries, err := os.ReadDir(subDir)
			if err != nil {
				continue
			}
			for _, subEntry := range subEntries {
				if subEntry.IsDir() {
					continue
				}
				name := subEntry.Name()
				// Only collect PNGs and JSON
				if !strings.HasSuffix(name, ".png") && !strings.HasSuffix(name, ".json") {
					continue
				}
				info, err := subEntry.Info()
				if err != nil {
					continue
				}
				artifacts = append(artifacts, BrowserArtifact{
					Path:      filepath.Join(subDir, name),
					Name:      name,
					Size:      info.Size(),
					Timestamp: info.ModTime(),
				})
			}
		}

		return BrowserScanResultMsg{Artifacts: artifacts}
	}
}

// takeScreenshotCmd runs playwright-cli screenshot and returns a scan result
func takeScreenshotCmd(artifactDir string) tea.Cmd {
	return func() tea.Msg {
		// Check if playwright-cli is available
		if _, err := exec.LookPath("playwright-cli"); err != nil {
			return BrowserScanResultMsg{Error: fmt.Errorf("playwright-cli not installed: %w", err)}
		}

		timestamp := time.Now().Format("20060102-150405")
		sessionID := "screenshot-" + timestamp

		// Ensure output directory exists
		outputDir := filepath.Join(artifactDir, timestamp)
		if artifactDir != "" {
			os.MkdirAll(outputDir, 0755)
		}

		outputFile := filepath.Join(outputDir, "quick-capture.png")
		cmd := exec.Command("playwright-cli", "screenshot",
			"--session", sessionID,
			"http://localhost:3000",
			"--name", outputFile,
		)
		if err := cmd.Run(); err != nil {
			return BrowserScanResultMsg{Error: fmt.Errorf("screenshot failed: %w", err)}
		}

		// Close the session
		closeCmd := exec.Command("playwright-cli", "session-close", sessionID)
		closeCmd.Run() //nolint:errcheck // best-effort cleanup

		// Re-scan to pick up the new artifact
		if artifactDir != "" {
			return scanVerificationsCmd(artifactDir)()
		}
		return BrowserScanResultMsg{}
	}
}

// truncateStr truncates a string to max length
func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

// formatBytes formats a byte count for display
func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// UpdateQualityGateFromBrowserEvent converts a BrowserVerificationEvent into a browser quality gate entry.
// Used by the Monitor plugin to display browser checks alongside code quality gates.
func browserVerificationToGateName(checkType string) string {
	switch checkType {
	case "screenshot":
		return "Browser: Screenshot"
	case "console":
		return "Browser: Console"
	case "snapshot":
		return "Browser: Snapshot"
	case "network":
		return "Browser: Network"
	default:
		return "Browser: " + checkType
	}
}

// verificationResultFromJSON attempts to read verification-result.json from a directory
func verificationResultFromJSON(dir string) (map[string]interface{}, error) {
	path := filepath.Join(dir, "verification-result.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}
