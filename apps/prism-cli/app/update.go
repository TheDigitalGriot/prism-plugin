package app

import (
	"fmt"
	"math"
	"math/rand"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-cli/dialog"
	"github.com/prism-plugin/prism-cli/modal"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/registry"
)

// demoActivities is a list of fake tool activities for demo mode
var demoActivities = []struct {
	Tool        string
	Description string
}{
	{"Read", "Reading: src/components/Button.tsx"},
	{"Glob", "Finding: **/*.test.ts"},
	{"Grep", "Searching: handleSubmit"},
	{"Read", "Reading: src/api/auth.go"},
	{"Edit", "Editing: src/services/user.ts"},
	{"Bash", "Running: npm run typecheck"},
	{"Task", "Agent: Exploring test patterns"},
	{"Read", "Reading: package.json"},
	{"Edit", "Editing: src/utils/validation.ts"},
	{"Bash", "Running: go test ./..."},
	{"Grep", "Searching: interface User"},
	{"Task", "Agent: Analyzing dependencies"},
	{"Edit", "Editing: src/components/Form.tsx"},
	{"Bash", "Running: npm run lint"},
	{"Read", "Reading: tsconfig.json"},
	{"TodoWrite", "Updating tasks..."},
}

// Init initializes the model
func (m Model) Init() tea.Cmd {
	cmds := []tea.Cmd{
		tickCmd(),
		splashTimerCmd(),                       // Start 2-second splash auto-transition timer
		buildFileCacheCmd(m.ProjectDir),         // Build file cache for fuzzy finder (F-4)
	}

	return tea.Batch(cmds...)
}

// Update handles all messages
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleKeyPress(msg)

	case tea.MouseMsg:
		return m.handleMouseEvent(msg)

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.Ready = true
		// Resize prism animation panel (scales with terminal width, capped)
		if m.Prism != nil {
			prismCols := msg.Width / 4
			if prismCols < 20 {
				prismCols = 20
			}
			if prismCols > 40 {
				prismCols = 40
			}
			m.Prism.Resize(prismCols, 5)
		}
		// Resize splash screen to full terminal
		if m.Splash != nil {
			m.Splash.Resize(msg.Width, msg.Height)
		}
		// Update plugin context with new dimensions
		ctx := m.Registry.GetContext()
		ctx.Width = msg.Width
		ctx.Height = msg.Height
		m.Registry.UpdateContext(ctx)
		// Broadcast resize to all plugins
		resizeMsg := plugin.PluginResizeMsg{Width: msg.Width, Height: m.contentHeight()}
		broadcastCmds := m.Registry.Broadcast(resizeMsg)
		cmds = append(cmds, broadcastCmds...)
		return m, tea.Batch(cmds...)

	case TickMsg:
		cmds = append(cmds, tickCmd())

		// Advance splash screen animation
		if m.Splash != nil && !m.SplashDone {
			m.Splash.Tick()
		}

		// Advance prism framebuffer animation (shared across all views)
		if m.Prism != nil {
			m.Prism.Tick()
		}

		// Advance global prism ASCII animation (for fallback rendering)
		m.Anim.PrismTick++
		if m.Anim.PrismTick >= 3 {
			m.Anim.PrismTick = 0
			m.Anim.PrismFrame = (m.Anim.PrismFrame + 1) % 4
		}

		// Advance shimmer phase
		m.Anim.ShimmerPhase += 0.08
		if m.Anim.ShimmerPhase > 2*math.Pi {
			m.Anim.ShimmerPhase -= 2 * math.Pi
		}

		// Advance ray spring animations (no spring on global AnimState now, just simple oscillation)
		for i := range m.Anim.RayLengths {
			diff := m.Anim.RayTargets[i] - m.Anim.RayLengths[i]
			m.Anim.RayLengths[i] += diff * 0.1
			if math.Abs(diff) < 0.1 {
				m.Anim.RayTargets[i] = 4 + rand.Float64()*4
			}
		}

		// Broadcast tick to all plugins (for plugin-specific animations)
		broadcastCmds := m.Registry.Broadcast(msg)
		cmds = append(cmds, broadcastCmds...)

	case SplashDoneMsg:
		// Splash auto-timer completed
		m.SplashDone = true
		m.Splash = nil // Release splash resources
		if m.NeedsOnboarding && !m.OnboardingDone {
			// Transition to full-screen onboarding (between splash and dashboard)
			m.ActiveView = ViewOnboarding
			m.Registry.SetActive("onboarding")
		} else {
			// Transition to Home dashboard
			m.ActiveView = ViewHome
			m.Registry.SetActive("home")
		}
		// Cycle alt screen to fully reset terminal state — splash used raw
		// ANSI codes that corrupt charset/SGR state beyond what ClearScreen fixes.
		return m, tea.Sequence(tea.ExitAltScreen, tea.EnterAltScreen, tea.ClearScreen)

	case OnboardingCompleteMsg:
		// Onboarding completed — transition to Home dashboard
		m.OnboardingDone = true
		m.ActiveView = ViewHome
		m.Registry.SetActive("home")
		// Register project in global workspace registry
		if m.ProjectDir != "" {
			go registry.Register(m.ProjectDir, "")
		}
		return m, nil

	case SwitchProjectMsg:
		// Project switch from Workspaces plugin — update context and reinit all plugins
		if msg.Context != nil {
			m.PrismDir = msg.Context.PrismDir
			m.ProjectDir = msg.Context.ProjectDir
			m.StoriesPath = msg.Context.StoriesPath
			m.Registry.UpdateContext(msg.Context)
			m.Registry.Reinit()
			m.ActiveView = ViewHome
			m.Registry.SetActive("home")
			// Register in global workspace registry
			go registry.Register(msg.Context.ProjectDir, "")
		}
		return m, nil

	case plugin.FocusPluginMsg:
		// Switch active plugin by ID
		if err := m.Registry.SetActive(msg.ID); err == nil {
			// Map plugin ID to ActiveView for tab bar highlighting
			m.ActiveView = pluginIDToView(msg.ID)
			// Trigger data loading for the focused plugin
			return m, m.pluginFocusCmd(msg.ID)
		}
		return m, nil

	case NavigateToViewMsg:
		m.ActiveView = msg.View
		return m, nil

	case OpenDialogMsg:
		// Plugin requested opening a dialog
		if d, ok := msg.Dialog.(dialog.Dialog); ok {
			m.Dialogs.Open(d)
		}
		return m, nil

	case OpenModalMsg:
		// Plugin requested opening a modal
		if modal, ok := msg.Modal.(*modal.Modal); ok {
			m.ActiveModal = modal
		}
		return m, nil

	case FileCacheLoadedMsg:
		// File cache built (F-4)
		if msg.Error == nil && msg.Files != nil {
			m.FileCache = msg.Files
			m.FileCacheLoaded = true
		}
		return m, nil

	case SearchResultsMsg:
		// Content search results arrived (F-5)
		if m.ContentSearch != nil {
			m.ContentSearch.HandleResults(msg)
			m.ActiveModal = m.ContentSearch.BuildModal()
		}
		return m, nil

	default:
		// Broadcast all other messages to plugins (they handle their own state)
		broadcastCmds := m.Registry.Broadcast(msg)
		cmds = append(cmds, broadcastCmds...)
	}

	return m, tea.Batch(cmds...)
}

func (m Model) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// If splash screen is active, any key skips past it
	if !m.SplashDone {
		m.SplashDone = true
		m.Splash = nil // Release splash resources
		if m.NeedsOnboarding && !m.OnboardingDone {
			m.ActiveView = ViewOnboarding
			m.Registry.SetActive("onboarding")
		} else {
			m.ActiveView = ViewHome
			m.Registry.SetActive("home")
		}
		// Cycle alt screen to fully reset terminal state — splash used raw
		// ANSI codes that corrupt charset/SGR state beyond what ClearScreen fixes.
		return m, tea.Sequence(tea.ExitAltScreen, tea.EnterAltScreen, tea.ClearScreen)
	}

	// If onboarding is active, delegate keys to the onboarding plugin
	// (don't intercept with global handlers like tab switching)
	if m.ActiveView == ViewOnboarding && !m.OnboardingDone {
		return m.delegateToActivePlugin(msg)
	}

	// Allow q/ctrl+c even when dialog or modal is active
	if msg.String() == "q" || msg.String() == "ctrl+c" {
		return m, tea.Quit
	}

	// If dialog is active, route all input to dialog first (highest precedence)
	if m.Dialogs.HasDialogs() {
		action, cmd := m.Dialogs.Update(msg)

		// Handle dialog actions
		switch action {
		case dialog.ActionCancel, dialog.ActionDeny:
			// Close dialog and deny permission
			m.Dialogs.CloseFront()
			return m, cmd

		case dialog.ActionConfirm, dialog.ActionAllow, dialog.ActionAllowSession:
			// Close dialog and process action
			m.Dialogs.CloseFront()
			// TODO: In future, broadcast PermissionResponseMsg to plugins
			return m, cmd

		default:
			// Dialog is still processing input (no action yet)
			return m, cmd
		}
	}

	// If modal is active, route all input to modal next
	if m.ActiveModal != nil {
		action, cmd := m.ActiveModal.HandleKey(msg)

		// Handle modal actions
		switch action {
		case "cancel":
			// Close modal
			m.ActiveModal = nil
			m.CommandPalette = nil
			m.FileFinder = nil
			m.ContentSearch = nil
			return m, cmd

		case "":
			// No action, modal is still processing input (e.g., typing in input field)
			// If command palette is active, handle special navigation
			if m.CommandPalette != nil {
				switch msg.String() {
				case "down", "ctrl+j":
					m.CommandPalette.SelectNext()
					m.ActiveModal = m.CommandPalette.BuildModal()
					return m, nil
				case "up", "ctrl+k":
					m.CommandPalette.SelectPrev()
					m.ActiveModal = m.CommandPalette.BuildModal()
					return m, nil
				}
			}
			// File finder navigation + live filtering (F-4)
			if m.FileFinder != nil {
				switch msg.String() {
				case "down", "ctrl+j":
					m.FileFinder.SelectNext()
					m.ActiveModal = m.FileFinder.BuildModal()
					return m, nil
				case "up", "ctrl+k":
					m.FileFinder.SelectPrev()
					m.ActiveModal = m.FileFinder.BuildModal()
					return m, nil
				default:
					// Re-filter on any text change (input section handles the typing)
					newText := m.ActiveModal.InputValue("finder-filter")
					if newText != m.FileFinder.filterText {
						m.FileFinder.Filter(newText)
						m.ActiveModal = m.FileFinder.BuildModal()
					}
				}
				return m, nil
			}
			// Content search navigation + trigger search (F-5)
			if m.ContentSearch != nil {
				switch msg.String() {
				case "down", "ctrl+j":
					m.ContentSearch.SelectNext()
					m.ActiveModal = m.ContentSearch.BuildModal()
					return m, nil
				case "up", "ctrl+k":
					m.ContentSearch.SelectPrev()
					m.ActiveModal = m.ContentSearch.BuildModal()
					return m, nil
				default:
					// Check if query changed, trigger search
					newText := m.ActiveModal.InputValue("search-filter")
					if newText != m.ContentSearch.query && len(newText) >= 2 {
						m.ContentSearch.query = newText
						m.ActiveModal = m.ContentSearch.BuildModal()
						return m, m.ContentSearch.RunSearchCmd()
					}
				}
				return m, nil
			}
			return m, cmd

		default:
			// Modal returned an action (e.g., button click, list selection)
			// Check if this is a command palette action
			if m.CommandPalette != nil {
				selectedCmd := m.CommandPalette.SelectedCommand()
				if selectedCmd != nil {
					m.ActiveModal = nil
					m.CommandPalette = nil
					return m.executeCommand(*selectedCmd)
				}
			}
			// File finder: selection opens file in Files plugin (F-4)
			if m.FileFinder != nil {
				selected := m.FileFinder.SelectedFile()
				if selected != nil {
					absPath := filepath.Join(m.ProjectDir, filepath.FromSlash(selected.RelPath))
					m.ActiveModal = nil
					m.FileFinder = nil
					// Navigate to Files plugin and open the file
					m.ActiveView = ViewFiles
					m.Registry.SetActive("files")
					return m, func() tea.Msg {
						return FileFinderOpenMsg{Path: absPath, Name: selected.Name}
					}
				}
				m.ActiveModal = nil
				m.FileFinder = nil
				return m, nil
			}
			// Content search: selection navigates to file:line (F-5)
			if m.ContentSearch != nil {
				selected := m.ContentSearch.SelectedResult()
				if selected != nil {
					absPath := filepath.Join(m.ProjectDir, filepath.FromSlash(selected.File))
					m.ActiveModal = nil
					m.ContentSearch = nil
					// Navigate to Files plugin and open at line
					m.ActiveView = ViewFiles
					m.Registry.SetActive("files")
					return m, func() tea.Msg {
						return FileFinderOpenMsg{Path: absPath, Name: filepath.Base(selected.File)}
					}
				}
				m.ActiveModal = nil
				m.ContentSearch = nil
				return m, nil
			}
			// Capture input values from the modal before clearing it,
			// so plugins can access user-entered text (W-2, F-6, etc.)
			capturedAction := action
			var capturedInputs map[string]string
			if m.ActiveModal != nil {
				capturedInputs = m.ActiveModal.InputValues()
			}
			m.ActiveModal = nil
			return m, func() tea.Msg {
				return ModalActionMsg{Action: capturedAction, Inputs: capturedInputs}
			}
		}
	}

	// Global keys (always active regardless of view)
	switch msg.String() {
	case "q", "ctrl+c":
		// Already handled above, but keep for clarity
		return m, tea.Quit

	case "?":
		// Open help modal
		m.ActiveModal = createHelpModal()
		return m, nil

	case "ctrl+p":
		// Open fuzzy file finder (F-4)
		if m.FileCacheLoaded {
			m.FileFinder = NewFileFinder(m.ProjectDir, m.FileCache)
			m.ActiveModal = m.FileFinder.BuildModal()
		}
		return m, nil

	case ":":
		// Open command palette
		m.CommandPalette = NewCommandPalette(m.Registry)
		m.ActiveModal = m.CommandPalette.BuildModal()
		return m, nil

	case "ctrl+s":
		// Open content search (F-5)
		m.ContentSearch = NewContentSearch(m.ProjectDir)
		m.ActiveModal = m.ContentSearch.BuildModal()
		return m, nil

	case "ctrl+d":
		// Toggle sidebar visibility (like Crush's session details toggle)
		m.ForceSidebarOff = !m.ForceSidebarOff
		return m, nil

	// Number keys to switch tabs directly
	case "1":
		if len(m.TabOrder) >= 1 {
			return m.switchToTab(0)
		}
	case "2":
		if len(m.TabOrder) >= 2 {
			return m.switchToTab(1)
		}
	case "3":
		if len(m.TabOrder) >= 3 {
			return m.switchToTab(2)
		}
	case "4":
		if len(m.TabOrder) >= 4 {
			return m.switchToTab(3)
		}
	case "5":
		if len(m.TabOrder) >= 5 {
			return m.switchToTab(4)
		}
	case "6":
		if len(m.TabOrder) >= 6 {
			return m.switchToTab(5)
		}
	case "7":
		if len(m.TabOrder) >= 7 {
			return m.switchToTab(6)
		}
	case "8":
		if len(m.TabOrder) >= 8 {
			return m.switchToTab(7)
		}
	case "9":
		if len(m.TabOrder) >= 9 {
			return m.switchToTab(8)
		}

	// Tab/Shift+Tab to cycle through tabs
	case "tab":
		// Check if active plugin wants to consume tab (e.g., Spectrum epic switching)
		if sp, ok := m.Registry.ActivePlugin().(*SpectrumPlugin); ok && len(sp.epic.Epics) > 1 {
			// Let Spectrum handle tab for epic switching
			break
		}
		for i, view := range m.TabOrder {
			if view == m.ActiveView {
				nextIdx := (i + 1) % len(m.TabOrder)
				return m.switchToTab(nextIdx)
			}
		}
	case "shift+tab":
		if sp, ok := m.Registry.ActivePlugin().(*SpectrumPlugin); ok && len(sp.epic.Epics) > 1 {
			break
		}
		for i, view := range m.TabOrder {
			if view == m.ActiveView {
				prevIdx := (i - 1 + len(m.TabOrder)) % len(m.TabOrder)
				return m.switchToTab(prevIdx)
			}
		}
	}

	// Delegate to active plugin for view-specific key handling
	return m.delegateToActivePlugin(msg)
}

// delegateToActivePlugin sends a message to the active plugin and processes the result
func (m Model) delegateToActivePlugin(msg tea.Msg) (tea.Model, tea.Cmd) {
	active := m.Registry.ActivePlugin()
	if active == nil {
		return m, nil
	}

	updatedPlugin, cmd := active.Update(msg)

	// Update plugin in registry's internal state
	for i, p := range m.Registry.Plugins() {
		if p.ID() == active.ID() {
			m.Registry.Plugins()[i] = updatedPlugin
			break
		}
	}

	// Check if the plugin returned a FocusPluginMsg (from navigation)
	if cmd != nil {
		return m, cmd
	}

	return m, nil
}

// switchToTab switches to a tab by index
func (m Model) switchToTab(idx int) (tea.Model, tea.Cmd) {
	if idx < 0 || idx >= len(m.TabOrder) {
		return m, nil
	}
	view := m.TabOrder[idx]
	m.ActiveView = view
	pluginID := viewToPluginID(view)
	m.Registry.SetActive(pluginID)
	return m, m.pluginFocusCmd(pluginID)
}

// pluginFocusCmd returns a command to load data when a plugin is focused
func (m Model) pluginFocusCmd(pluginID string) tea.Cmd {
	if m.DemoMode {
		return nil
	}
	epoch := m.Registry.GetContext().Epoch
	switch pluginID {
	case "research":
		return LoadResearchFilesCmd(m.PrismDir, epoch)
	case "plans":
		return LoadPlansFilesCmd(m.PrismDir, epoch)
	case "spectrum":
		if m.StoriesPath != "" {
			return LoadStoriesCmd(m.StoriesPath)
		}
		return DiscoverEpicsCmd(m.PrismDir)
	}
	return nil
}

// pluginIDToView maps a plugin ID to its ActiveView enum value
func pluginIDToView(id string) ActiveView {
	switch id {
	case "home":
		return ViewHome
	case "research":
		return ViewResearch
	case "plans":
		return ViewPlans
	case "spectrum":
		return ViewSpectrum
	case "files":
		return ViewFiles
	case "git":
		return ViewGit
	case "agent":
		return ViewAgent
	case "monitor":
		return ViewMonitor
	case "browser":
		return ViewBrowser
	case "workspaces":
		return ViewWorkspaces
	case "onboarding":
		return ViewOnboarding
	default:
		return ViewHome
	}
}

// viewToPluginID maps an ActiveView to a plugin ID
func viewToPluginID(view ActiveView) string {
	switch view {
	case ViewHome:
		return "home"
	case ViewResearch:
		return "research"
	case ViewPlans:
		return "plans"
	case ViewSpectrum:
		return "spectrum"
	case ViewFiles:
		return "files"
	case ViewGit:
		return "git"
	case ViewAgent:
		return "agent"
	case ViewMonitor:
		return "monitor"
	case ViewBrowser:
		return "browser"
	case ViewWorkspaces:
		return "workspaces"
	case ViewOnboarding:
		return "onboarding"
	default:
		return "home"
	}
}

// tickCmd returns a command that sends a tick message
func tickCmd() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// splashTimerCmd returns a command that sends SplashDoneMsg after 5 seconds
func splashTimerCmd() tea.Cmd {
	return tea.Tick(5*time.Second, func(t time.Time) tea.Msg {
		return SplashDoneMsg{}
	})
}

// splitLines splits text into lines
func splitLines(text string) []string {
	var lines []string
	current := ""
	for _, r := range text {
		if r == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(r)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}

// executeCommand handles command palette command execution
func (m Model) executeCommand(cmd Command) (tea.Model, tea.Cmd) {
	// Parse command ID and execute appropriate action
	parts := splitCommandID(cmd.ID)
	if len(parts) < 2 {
		return m, nil
	}

	pluginID := parts[0]
	action := parts[1]

	switch action {
	case "focus":
		// Navigate to the plugin
		if err := m.Registry.SetActive(pluginID); err == nil {
			m.ActiveView = pluginIDToView(pluginID)
			return m, m.pluginFocusCmd(pluginID)
		}
		return m, nil

	case "start":
		// Start action (e.g., spectrum execution)
		if pluginID == "spectrum" {
			// Broadcast a message to start execution
			// The spectrum plugin will handle this
			return m, nil
		}
		return m, nil

	case "stop":
		// Stop action
		if pluginID == "spectrum" {
			// Broadcast stop message
			return m, nil
		}
		return m, nil

	default:
		// Other actions are plugin-specific
		// For now, just focus the plugin
		if err := m.Registry.SetActive(pluginID); err == nil {
			m.ActiveView = pluginIDToView(pluginID)
			return m, m.pluginFocusCmd(pluginID)
		}
		return m, nil
	}
}

// splitCommandID splits a command ID like "spectrum.start" into ["spectrum", "start"]
func splitCommandID(id string) []string {
	result := make([]string, 0)
	current := ""
	for _, r := range id {
		if r == '.' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(r)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// handleMouseEvent handles mouse clicks, scroll wheel, and motion events.
// Follows the same priority chain as keyboard: splash → dialog → modal → app-level → plugin.
func (m Model) handleMouseEvent(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	// Ignore mouse during splash
	if !m.SplashDone {
		return m, nil
	}

	// Ignore mouse during onboarding
	if m.ActiveView == ViewOnboarding && !m.OnboardingDone {
		return m, nil
	}

	// Handle scroll wheel globally (doesn't need zone detection)
	if msg.Button == tea.MouseButtonWheelUp || msg.Button == tea.MouseButtonWheelDown {
		return m.handleScrollWheel(msg)
	}

	// Only process left-click release (standard click)
	if msg.Action != tea.MouseActionRelease || msg.Button != tea.MouseButtonLeft {
		return m, nil
	}

	// Priority 1: Dialog clicks
	if m.Dialogs.HasDialogs() {
		action := m.Dialogs.HandleMouse(msg)
		switch action {
		case dialog.ActionCancel, dialog.ActionDeny:
			m.Dialogs.CloseFront()
			return m, nil
		case dialog.ActionConfirm, dialog.ActionAllow, dialog.ActionAllowSession:
			m.Dialogs.CloseFront()
			return m, nil
		}
		return m, nil
	}

	// Priority 2: Modal clicks
	if m.ActiveModal != nil {
		action, cmd := m.ActiveModal.HandleMouse(msg)
		if action == "cancel" {
			m.ActiveModal = nil
			m.CommandPalette = nil
			return m, cmd
		} else if action != "" {
			if m.CommandPalette != nil {
				selectedCmd := m.CommandPalette.SelectedCommand()
				if selectedCmd != nil {
					m.ActiveModal = nil
					m.CommandPalette = nil
					return m.executeCommand(*selectedCmd)
				}
			}
			m.ActiveModal = nil
			return m, cmd
		}
		return m, nil
	}

	// Priority 3: App-level zones (tabs)
	for i := range m.TabOrder {
		zoneID := fmt.Sprintf("tab-%d", i)
		if zone.Get(zoneID).InBounds(msg) {
			return m.switchToTab(i)
		}
	}

	// Priority 4: Delegate to active plugin
	return m.delegateToActivePlugin(msg)
}

// handleScrollWheel routes scroll wheel events to the appropriate component.
func (m Model) handleScrollWheel(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	// Priority 1: Modal scroll
	if m.ActiveModal != nil {
		delta := 3
		if msg.Button == tea.MouseButtonWheelUp {
			delta = -3
		}
		m.ActiveModal.ScrollBy(delta)
		return m, nil
	}

	// Priority 2: Dialog scroll
	if m.Dialogs.HasDialogs() {
		return m, nil
	}

	// Priority 3: Delegate to active plugin
	return m.delegateToActivePlugin(msg)
}

// createHelpModal creates a modal displaying keyboard shortcuts and help
func createHelpModal() *modal.Modal {
	helpText := `PRISM TUI - Keyboard Shortcuts

GLOBAL KEYS:
  ?         Toggle this help
  Ctrl+P    Find file (fuzzy search)
  Ctrl+S    Search content (ripgrep)
  :         Open command palette
  Ctrl+D    Toggle sidebar details
  q, Ctrl+C Quit application
  1-9       Switch to tab by number
  Tab       Next tab
  Shift+Tab Previous tab

NAVIGATION:
  ↑/k       Move up
  ↓/j       Move down
  Enter     Select / Confirm
  Esc       Back / Cancel

VIEW-SPECIFIC:
  Home      - Navigate to plugins
  Research  - Browse research files
  Plans     - Browse implementation plans
  Spectrum  - Execute stories autonomously
  Files     - Browse project files
  Git       - View git status, stage/commit
  Agent     - Chat interface
  Monitor   - System health & execution history
  Workspaces- Switch projects & epics

MODAL CONTROLS:
  Tab       Cycle focus
  Enter     Activate focused element
  Esc       Close modal`

	return modal.New("Help", modal.WithWidth(60)).
		AddSection(modal.Text(helpText)).
		AddSection(modal.Spacer()).
		AddSection(modal.Buttons(modal.Btn("Close", "cancel")))
}
