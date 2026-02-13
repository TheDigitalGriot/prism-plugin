package app

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/paginator"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/harmonica"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/claude"
	"github.com/prism-plugin/prism-tui/domain"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/prism"
	"github.com/prism-plugin/prism-tui/styles"
)

// SpectrumAnimState holds animation state for Spectrum plugin.
type SpectrumAnimState struct {
	// Progress bar spring (overshoots then settles)
	ProgressSpring harmonica.Spring
	ProgressPos    float64
	ProgressVel    float64
	ProgressTarget float64

	// Story completion pop animations (per-story index)
	StoryPopSpring harmonica.Spring
	StoryPopScales map[int]float64
	StoryPopVels   map[int]float64

	// Active story pulse (breathing 0.6 → 1.0 → 0.6)
	PulsePhase float64 // 0 to 2π

	// Log entry slide-in (per-entry x-offset)
	LogSlideSpring  harmonica.Spring
	LogEntryOffsets []float64
	LogEntryVels    []float64

	// Prism animation frame (for fallback rendering)
	PrismFrame int

	// Ray animation for gradient prism
	RaySpring  harmonica.Spring
	RayLengths [4]float64
	RayVels    [4]float64
	RayTargets [4]float64

	// Shimmer phase
	ShimmerPhase float64
}

// SpectrumPlugin implements the Spectrum autonomous execution dashboard.
// This is the largest plugin, owning all execution state, stories, logs, and animations.
type SpectrumPlugin struct {
	ctx     *plugin.Context
	focused bool

	// Stories data
	planName     string
	stories      []StoryView
	totalStories int

	// Execution state
	state              AppState
	currentStoryID     string
	currentStoryTitle  string
	iteration          int
	consecutiveErrs    int
	maxConsecutiveErrs int

	// Output capture
	logLines      []LogEntry
	currentOutput strings.Builder
	recentOutput  []string // Last N lines for activity panel

	// Current tool activity
	currentTool      string
	currentActivity  string
	recentActivities []string

	// UI components
	spinner        spinner.Model
	progressBar    progress.Model
	storyPaginator paginator.Model
	logPaginator   paginator.Model

	// Pagination config
	storiesPerPage int
	logsPerPage    int

	// Timing
	startTime      time.Time
	iterationStart time.Time

	// Error info
	lastError string

	// Streaming output channel
	outputChan chan tea.Msg

	// Animation state (Spectrum-specific)
	anim SpectrumAnimState

	// Prism framebuffer animation (shared reference)
	prismRenderer *prism.Renderer

	// Epic state
	epic EpicState

	// Demo mode
	demoStoryIndex int
}

// NewSpectrumPlugin creates a new Spectrum plugin instance.
func NewSpectrumPlugin(prismRenderer *prism.Renderer) *SpectrumPlugin {
	s := spinner.New()
	s.Spinner = spinner.Dot

	p := progress.New(
		progress.WithGradient("#3B82F6", "#F59E0B"),
		progress.WithoutPercentage(),
	)

	// Create story paginator (dots style)
	storyPag := paginator.New()
	storyPag.Type = paginator.Dots
	storyPag.PerPage = 12
	storyPag.ActiveDot = "●"
	storyPag.InactiveDot = "○"

	// Create log paginator (dots style)
	logPag := paginator.New()
	logPag.Type = paginator.Dots
	logPag.PerPage = 6
	logPag.ActiveDot = "●"
	logPag.InactiveDot = "○"

	return &SpectrumPlugin{
		state:              StateIdle,
		maxConsecutiveErrs: 3,
		spinner:            s,
		progressBar:        p,
		storyPaginator:     storyPag,
		logPaginator:       logPag,
		storiesPerPage:     12,
		logsPerPage:        6,
		logLines:           make([]LogEntry, 0, 1000),
		recentOutput:       make([]string, 0, 10),
		stories:            []StoryView{},
		prismRenderer:      prismRenderer,
		anim: SpectrumAnimState{
			// Progress: snappy with slight overshoot
			ProgressSpring: harmonica.NewSpring(harmonica.FPS(60), 6.0, 0.7),
			// Story pop: bouncy
			StoryPopSpring: harmonica.NewSpring(harmonica.FPS(60), 8.0, 0.5),
			StoryPopScales: make(map[int]float64),
			StoryPopVels:   make(map[int]float64),
			// Log slide: smooth
			LogSlideSpring:  harmonica.NewSpring(harmonica.FPS(60), 5.0, 0.8),
			LogEntryOffsets: make([]float64, 0),
			LogEntryVels:    make([]float64, 0),
			RaySpring:  harmonica.NewSpring(harmonica.FPS(60), 4.0, 0.3),
			RayLengths: [4]float64{6, 5, 4, 3},
			RayTargets: [4]float64{6, 7, 5, 8},
		},
	}
}

// ID returns the plugin identifier.
func (p *SpectrumPlugin) ID() string {
	return "spectrum"
}

// Name returns the display name.
func (p *SpectrumPlugin) Name() string {
	return "Spectrum"
}

// Icon returns the tab icon.
func (p *SpectrumPlugin) Icon() string {
	return "▶"
}

// Init initializes the plugin with context.
func (p *SpectrumPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx
	// Initialize animation targets
	p.anim.ProgressPos = p.progressPercent()
	p.anim.ProgressTarget = p.progressPercent()
	return nil
}

// Start is called when the plugin is first activated.
func (p *SpectrumPlugin) Start() tea.Cmd {
	// Load stories or discover epics
	if p.ctx.DemoMode {
		return nil
	}
	if p.ctx.StoriesPath != "" {
		return LoadStoriesCmd(p.ctx.StoriesPath)
	}
	return DiscoverEpicsCmd(p.ctx.PrismDir)
}

// Stop is called when deactivated.
func (p *SpectrumPlugin) Stop() {
	// Could stop execution here if needed
}

// Update handles messages.
func (p *SpectrumPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case TickMsg:
		// Update spinner
		var cmd tea.Cmd
		p.spinner, cmd = p.spinner.Update(spinner.TickMsg{})
		cmds = append(cmds, cmd)

		// Advance animations
		p.updateAnimations()

	case InitCompleteMsg:
		if msg.Error != nil {
			p.state = StateError
			p.lastError = msg.Error.Error()
			p.addLog(LogError, "Failed to load stories: "+msg.Error.Error())
		} else {
			p.planName = msg.PlanName
			p.stories = msg.Stories
			p.totalStories = len(msg.Stories)
			p.storyPaginator.TotalPages = (len(msg.Stories) + p.storiesPerPage - 1) / p.storiesPerPage
			p.storyPaginator.Page = 0
			p.anim.ProgressPos = p.progressPercent()
			p.anim.ProgressTarget = p.progressPercent()
			p.addLog(LogInfo, fmt.Sprintf("Loaded %d stories from plan: %s", len(msg.Stories), msg.PlanName))
		}

	case StoriesReloadedMsg:
		if msg.Error != nil {
			p.addLog(LogWarning, "Failed to reload stories: "+msg.Error.Error())
		} else {
			p.stories = msg.Stories
			p.totalStories = len(msg.Stories)
			p.storyPaginator.TotalPages = (len(msg.Stories) + p.storiesPerPage - 1) / p.storiesPerPage
			p.anim.ProgressTarget = p.progressPercent()
		}

	case claude.ToolActivityMsg:
		p.currentTool = msg.ToolName
		p.currentActivity = msg.Description
		if msg.Description != "" && (len(p.recentActivities) == 0 || p.recentActivities[len(p.recentActivities)-1] != msg.Description) {
			p.recentActivities = append(p.recentActivities, msg.Description)
			if len(p.recentActivities) > 10 {
				p.recentActivities = p.recentActivities[1:]
			}
		}
		if msg.IsComplete {
			p.currentTool = ""
			p.currentActivity = ""
		}
		if p.outputChan != nil {
			cmds = append(cmds, claude.ListenToOutput(p.outputChan))
		}

	case claude.ClaudeOutputMsg:
		if p.outputChan != nil {
			cmds = append(cmds, claude.ListenToOutput(p.outputChan))
		}

	case claude.ClaudeFinishedMsg:
		p.outputChan = nil
		p.currentTool = ""
		p.currentActivity = ""
		duration := msg.Duration.Round(time.Second)
		p.addLog(LogInfo, fmt.Sprintf("Iteration completed in %s", duration))

		if msg.Error != nil {
			p.consecutiveErrs++
			p.addLog(LogError, "Claude error: "+msg.Error.Error())

			if p.consecutiveErrs >= p.maxConsecutiveErrs {
				p.state = StateError
				p.lastError = "Too many consecutive errors"
				p.addLog(LogError, "Too many consecutive errors, stopping")
				return p, nil
			}

			delay := time.Duration(p.consecutiveErrs) * 2 * time.Second
			p.addLog(LogWarning, fmt.Sprintf("Retrying in %s...", delay))
			return p, tea.Tick(delay, func(t time.Time) tea.Msg {
				return RetryIterationMsg{}
			})
		}

		// Success - reset error count
		p.consecutiveErrs = 0

		// Parse signal from output
		signal := domain.ParseSignal(msg.Output)
		signalMsg := SignalDetectedMsg{
			Type:    convertSignalType(signal.Type),
			Content: signal.Content,
			StoryID: p.currentStoryID,
		}

		return p, tea.Batch(
			ReloadStoriesCmd(p.ctx.StoriesPath),
			func() tea.Msg { return signalMsg },
		)

	case SignalDetectedMsg:
		return p.handleSignal(msg)

	case StoryCompletedMsg:
		p.addLog(LogSuccess, "Story complete: "+msg.StoryID)
		for i := range p.stories {
			if p.stories[i].ID == msg.StoryID {
				p.stories[i].Status = "complete"
				p.anim.StoryPopScales[i] = 0.3
				p.anim.StoryPopVels[i] = 0
				break
			}
		}
		p.anim.ProgressTarget = p.progressPercent()
		p.currentStoryID = ""
		p.currentStoryTitle = ""

	case StartNextIterationMsg:
		if p.state == StatePaused {
			p.addLog(LogInfo, "Execution paused, press 'p' to resume...")
			return p, nil
		}
		if p.state != StateRunning {
			return p, nil
		}

		if p.iteration >= p.ctx.MaxIterations {
			p.state = StateMaxIterations
			p.lastError = fmt.Sprintf("Iteration limit reached (%d) - increase with -n flag to continue", p.ctx.MaxIterations)
			p.addLog(LogWarning, fmt.Sprintf("Reached max iterations (%d)", p.ctx.MaxIterations))
			return p, nil
		}

		p.iteration++
		p.iterationStart = time.Now()
		p.recentOutput = []string{}
		p.recentActivities = []string{}
		p.addLog(LogInfo, fmt.Sprintf("Starting iteration %d/%d", p.iteration, p.ctx.MaxIterations))

		p.outputChan = make(chan tea.Msg, 100)
		return p, tea.Batch(
			claude.RunClaudeStreamingCmd(p.ctx.ProjectDir, p.ctx.StoriesPath, p.iteration, p.outputChan),
			claude.ListenToOutput(p.outputChan),
		)

	case RetryIterationMsg:
		if p.state != StateRunning && p.state != StatePaused {
			return p, nil
		}
		if p.state == StatePaused {
			p.addLog(LogInfo, "Retry deferred, execution paused...")
			return p, nil
		}

		p.recentOutput = []string{}
		p.recentActivities = []string{}
		p.addLog(LogInfo, fmt.Sprintf("Retrying iteration %d", p.iteration))

		p.outputChan = make(chan tea.Msg, 100)
		return p, tea.Batch(
			claude.RunClaudeStreamingCmd(p.ctx.ProjectDir, p.ctx.StoriesPath, p.iteration, p.outputChan),
			claude.ListenToOutput(p.outputChan),
		)

	case StartExecutionMsg:
		if p.state == StateIdle {
			p.state = StateRunning
			p.startTime = time.Now()
			p.iteration = 0

			if p.ctx.DemoMode {
				p.addLog(LogInfo, "Starting DEMO simulation...")
				p.addLog(LogInfo, "Watch the animations!")
				for i, s := range p.stories {
					if s.Status == "pending" {
						p.demoStoryIndex = i
						p.currentStoryID = s.ID
						p.currentStoryTitle = s.Title
						break
					}
				}
				return p, tea.Batch(
					tea.Tick(2500*time.Millisecond, func(t time.Time) tea.Msg {
						return DemoTickMsg{}
					}),
					tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
						return DemoActivityMsg{ActivityIndex: 0}
					}),
				)
			}

			p.addLog(LogInfo, "Starting Spectrum execution...")
			return p, func() tea.Msg { return StartNextIterationMsg{} }
		}

	case DemoTickMsg:
		if !p.ctx.DemoMode || p.state != StateRunning {
			return p, nil
		}
		if p.demoStoryIndex < len(p.stories) {
			p.iteration++
			return p, func() tea.Msg {
				return DemoCompleteStoryMsg{StoryIndex: p.demoStoryIndex}
			}
		}

	case DemoCompleteStoryMsg:
		if !p.ctx.DemoMode {
			return p, nil
		}
		idx := msg.StoryIndex
		if idx >= len(p.stories) {
			return p, nil
		}

		p.stories[idx].Status = "complete"
		p.anim.StoryPopScales[idx] = 0.3
		p.anim.StoryPopVels[idx] = 0
		p.anim.ProgressTarget = p.progressPercent()
		p.addLog(LogSuccess, fmt.Sprintf("Story complete: %s", p.stories[idx].ID))

		p.demoStoryIndex = -1
		for i, s := range p.stories {
			if s.Status == "pending" {
				p.demoStoryIndex = i
				p.currentStoryID = s.ID
				p.currentStoryTitle = s.Title
				p.addLog(LogInfo, fmt.Sprintf("Starting: %s - %s", s.ID, s.Title))
				break
			}
		}

		if p.demoStoryIndex == -1 {
			p.state = StateComplete
			p.currentStoryID = ""
			p.currentStoryTitle = ""
			p.currentTool = ""
			p.currentActivity = ""
			p.addLog(LogSuccess, "All demo stories complete!")
			return p, nil
		}

		delay := 2000 + (p.demoStoryIndex%3)*500
		return p, tea.Tick(time.Duration(delay)*time.Millisecond, func(t time.Time) tea.Msg {
			return DemoTickMsg{}
		})

	case DemoActivityMsg:
		if !p.ctx.DemoMode || p.state != StateRunning {
			return p, nil
		}
		idx := msg.ActivityIndex % len(demoActivities)
		activity := demoActivities[idx]
		p.currentTool = activity.Tool
		p.currentActivity = activity.Description
		if len(p.recentActivities) == 0 || p.recentActivities[len(p.recentActivities)-1] != activity.Description {
			p.recentActivities = append(p.recentActivities, activity.Description)
			if len(p.recentActivities) > 10 {
				p.recentActivities = p.recentActivities[1:]
			}
		}
		delay := 300 + rand.Intn(300)
		return p, tea.Tick(time.Duration(delay)*time.Millisecond, func(t time.Time) tea.Msg {
			return DemoActivityMsg{ActivityIndex: idx + 1}
		})

	case EpicsDiscoveredMsg:
		if msg.Error != nil {
			p.addLog(LogError, "Failed to discover epics: "+msg.Error.Error())
			return p, nil
		}
		p.epic.Epics = msg.Epics
		p.epic.IsLegacy = len(msg.Epics) == 0
		if len(msg.Epics) > 0 {
			p.epic.SelectedIndex = 0
			return p, LoadStoriesCmd(msg.Epics[0].StoriesPath)
		}
		if p.ctx.StoriesPath != "" {
			return p, LoadStoriesCmd(p.ctx.StoriesPath)
		}

	case EpicSelectedMsg:
		if msg.EpicIndex >= 0 && msg.EpicIndex < len(p.epic.Epics) {
			p.epic.SelectedIndex = msg.EpicIndex
			epic := p.epic.Epics[msg.EpicIndex]
			p.state = StateIdle
			p.stories = []StoryView{}
			p.totalStories = 0
			p.currentStoryID = ""
			p.currentStoryTitle = ""
			p.iteration = 0
			return p, LoadStoriesCmd(epic.StoriesPath)
		}

	case PauseToggleMsg:
		if p.state == StateRunning {
			p.state = StatePaused
			p.addLog(LogWarning, "Pausing after current story...")
		} else if p.state == StatePaused {
			p.state = StateRunning
			p.addLog(LogInfo, "Resuming execution...")
		}
	}

	return p, tea.Batch(cmds...)
}

// View renders the Spectrum dashboard.
func (p *SpectrumPlugin) View(width, height int) string {
	var sections []string

	// Epic selector bar (if multiple epics)
	if len(p.epic.Epics) > 1 {
		sections = append(sections, p.renderEpicSelector(width))
	}

	// Header
	sections = append(sections, p.renderHeader(width))

	// Progress bar with prism animation
	sections = append(sections, p.renderProgressBar(width))

	// Main content (stories + activity panels)
	sections = append(sections, p.renderMainPanels(width))

	// Log viewport
	sections = append(sections, p.renderLogPanel(width))

	// Status bar
	sections = append(sections, p.renderStatusBar(width))

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active.
func (p *SpectrumPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state.
func (p *SpectrumPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints.
func (p *SpectrumPlugin) KeyHints() []plugin.KeyHint {
	switch p.state {
	case StateIdle:
		return []plugin.KeyHint{
			{Key: "enter", Description: "start"},
			{Key: "a/s", Description: "page stories"},
			{Key: "z/x", Description: "page logs"},
		}
	case StateRunning:
		return []plugin.KeyHint{
			{Key: "p", Description: "pause"},
			{Key: "/", Description: "skip"},
			{Key: "a/s", Description: "page stories"},
			{Key: "z/x", Description: "page logs"},
		}
	case StatePaused:
		return []plugin.KeyHint{
			{Key: "p", Description: "resume"},
		}
	case StateComplete, StateMaxIterations, StateError:
		return []plugin.KeyHint{
			{Key: "enter", Description: "quit"},
		}
	}
	return []plugin.KeyHint{}
}

// Helper methods

func (p *SpectrumPlugin) completedCount() int {
	count := 0
	for _, s := range p.stories {
		if s.Status == "complete" {
			count++
		}
	}
	return count
}

func (p *SpectrumPlugin) remainingCount() int {
	return p.totalStories - p.completedCount()
}

func (p *SpectrumPlugin) progressPercent() float64 {
	if p.totalStories == 0 {
		return 0
	}
	return float64(p.completedCount()) / float64(p.totalStories)
}

func (p *SpectrumPlugin) addLog(level LogLevel, message string) {
	entry := LogEntry{
		Time:    time.Now(),
		Level:   level,
		Message: message,
		StoryID: p.currentStoryID,
	}
	p.logLines = append(p.logLines, entry)

	totalPages := (len(p.logLines) + p.logsPerPage - 1) / p.logsPerPage
	if totalPages < 1 {
		totalPages = 1
	}
	p.logPaginator.TotalPages = totalPages
	p.logPaginator.Page = totalPages - 1

	p.anim.LogEntryOffsets = append(p.anim.LogEntryOffsets, 20.0)
	p.anim.LogEntryVels = append(p.anim.LogEntryVels, 0)

	if len(p.anim.LogEntryOffsets) > p.logsPerPage {
		p.anim.LogEntryOffsets = p.anim.LogEntryOffsets[1:]
		p.anim.LogEntryVels = p.anim.LogEntryVels[1:]
	}
}

func (p *SpectrumPlugin) elapsedTime() time.Duration {
	if p.startTime.IsZero() {
		return 0
	}
	return time.Since(p.startTime)
}

func (p *SpectrumPlugin) updateAnimations() {
	// Progress bar
	p.anim.ProgressPos, p.anim.ProgressVel = p.anim.ProgressSpring.Update(
		p.anim.ProgressPos,
		p.anim.ProgressVel,
		p.anim.ProgressTarget,
	)

	// Story pop animations
	for idx := range p.anim.StoryPopScales {
		scale, vel := p.anim.StoryPopSpring.Update(
			p.anim.StoryPopScales[idx],
			p.anim.StoryPopVels[idx],
			1.0,
		)
		p.anim.StoryPopScales[idx] = scale
		p.anim.StoryPopVels[idx] = vel

		if math.Abs(scale-1.0) < 0.01 && math.Abs(vel) < 0.01 {
			delete(p.anim.StoryPopScales, idx)
			delete(p.anim.StoryPopVels, idx)
		}
	}

	// Pulse
	p.anim.PulsePhase += 0.15
	if p.anim.PulsePhase > 2*math.Pi {
		p.anim.PulsePhase -= 2 * math.Pi
	}

	// Log slide-ins
	for i := range p.anim.LogEntryOffsets {
		offset, vel := p.anim.LogSlideSpring.Update(
			p.anim.LogEntryOffsets[i],
			p.anim.LogEntryVels[i],
			0.0,
		)
		p.anim.LogEntryOffsets[i] = offset
		p.anim.LogEntryVels[i] = vel
	}

	// Ray springs
	for i := range p.anim.RayLengths {
		p.anim.RayLengths[i], p.anim.RayVels[i] = p.anim.RaySpring.Update(
			p.anim.RayLengths[i],
			p.anim.RayVels[i],
			p.anim.RayTargets[i],
		)

		if math.Abs(p.anim.RayLengths[i]-p.anim.RayTargets[i]) < 0.1 && math.Abs(p.anim.RayVels[i]) < 0.1 {
			p.anim.RayTargets[i] = 4 + rand.Float64()*4
		}
	}

	// Shimmer
	p.anim.ShimmerPhase += 0.08
	if p.anim.ShimmerPhase > 2*math.Pi {
		p.anim.ShimmerPhase -= 2 * math.Pi
	}
}

func (p *SpectrumPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	key := msg.String()

	// Pagination keys
	switch key {
	case "a":
		if p.storyPaginator.Page > 0 {
			p.storyPaginator.Page--
		}
		return p, nil
	case "s":
		if p.storyPaginator.Page < p.storyPaginator.TotalPages-1 {
			p.storyPaginator.Page++
		}
		return p, nil
	case "z":
		if p.logPaginator.Page > 0 {
			p.logPaginator.Page--
		}
		return p, nil
	case "x":
		if p.logPaginator.Page < p.logPaginator.TotalPages-1 {
			p.logPaginator.Page++
		}
		return p, nil
	}

	// Epic switching
	if len(p.epic.Epics) > 1 {
		switch key {
		case "tab":
			p.epic.SelectedIndex = (p.epic.SelectedIndex + 1) % len(p.epic.Epics)
			epic := p.epic.Epics[p.epic.SelectedIndex]
			return p, LoadStoriesCmd(epic.StoriesPath)
		case "shift+tab":
			p.epic.SelectedIndex = (p.epic.SelectedIndex - 1 + len(p.epic.Epics)) % len(p.epic.Epics)
			epic := p.epic.Epics[p.epic.SelectedIndex]
			return p, LoadStoriesCmd(epic.StoriesPath)
		}
	}

	// State-dependent keys
	switch p.state {
	case StateIdle:
		switch key {
		case "enter", " ":
			return p, func() tea.Msg { return StartExecutionMsg{} }
		}

	case StateRunning:
		switch key {
		case "p":
			return p, func() tea.Msg { return PauseToggleMsg{} }
		case "/":
			p.addLog(LogWarning, "Skip requested - will skip after current story")
			return p, nil
		}

	case StatePaused:
		switch key {
		case "p", "enter", " ":
			return p, func() tea.Msg { return PauseToggleMsg{} }
		}

	case StateComplete, StateMaxIterations, StateError:
		switch key {
		case "enter", " ":
			return p, tea.Quit
		}
	}

	return p, nil
}

func (p *SpectrumPlugin) handleSignal(msg SignalDetectedMsg) (plugin.Plugin, tea.Cmd) {
	switch msg.Type {
	case SignalComplete:
		remaining := p.remainingCount()
		if remaining > 0 {
			p.addLog(LogWarning, fmt.Sprintf("⚠️ COMPLETE signal received but %d stories remain - ignoring and continuing", remaining))
			p.addLog(LogInfo, "This is likely a skill bug - prism-spectrum should output <spectrum-continue> when stories remain")
			return p, tea.Tick(time.Duration(p.ctx.Pause)*time.Second, func(t time.Time) tea.Msg {
				return StartNextIterationMsg{}
			})
		}
		p.state = StateComplete
		p.addLog(LogSuccess, "All stories complete!")
		return p, nil

	case SignalContinue:
		p.addLog(LogInfo, "Story complete, continuing...")
		return p, tea.Tick(time.Duration(p.ctx.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalRetry:
		p.consecutiveErrs++
		p.addLog(LogWarning, "Retry requested: "+msg.Content)
		if p.consecutiveErrs >= p.maxConsecutiveErrs {
			p.state = StateError
			p.lastError = "Too many retries"
			return p, nil
		}
		return p, tea.Tick(time.Duration(p.ctx.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalBlocked:
		p.addLog(LogWarning, "Story blocked: "+msg.Content)
		return p, tea.Tick(time.Duration(p.ctx.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalError:
		p.state = StateError
		p.lastError = msg.Content
		p.addLog(LogError, "Fatal error: "+msg.Content)
		return p, nil
	}

	return p, tea.Tick(time.Duration(p.ctx.Pause)*time.Second, func(t time.Time) tea.Msg {
		return StartNextIterationMsg{}
	})
}

// Rendering methods

func (p *SpectrumPlugin) renderHeader(width int) string {
	iterInfo := fmt.Sprintf("Iteration: %d/%d", p.iteration, p.ctx.MaxIterations)
	spacerWidth := width - lipgloss.Width(iterInfo) - 4
	if spacerWidth < 1 {
		spacerWidth = 1
	}
	spacer := strings.Repeat(" ", spacerWidth)
	header := lipgloss.JoinHorizontal(lipgloss.Center, iterInfo, spacer)
	return styles.PanelStyle.Width(width - 2).Render(header)
}

func (p *SpectrumPlugin) renderProgressBar(width int) string {
	planName := p.planName
	if planName == "" {
		planName = "Loading..."
	}

	completed := p.completedCount()
	total := p.totalStories
	if total == 0 {
		total = 1
	}

	stats := fmt.Sprintf("%d/%d (%d%%)", completed, p.totalStories, int(p.progressPercent()*100))

	// Render framebuffer prism animation with ASCII logo
	if p.prismRenderer != nil {
		prismStr := p.prismRenderer.String()
		logo := renderPrismLogoStatic()

		topSection := lipgloss.JoinHorizontal(lipgloss.Center, prismStr, "  ", logo)

		barWidth := width - 20
		if barWidth < 20 {
			barWidth = 20
		}
		progressStr := renderSpectrumProgressBar(p.anim.ProgressPos, barWidth)
		infoLine := fmt.Sprintf("  Plan: %s  %s  %s", planName, progressStr, stats)

		content := lipgloss.JoinVertical(lipgloss.Left, topSection, infoLine)
		return styles.PanelStyle.Width(width - 2).Render(content)
	}

	// Fallback: text-based prism
	barWidth := width - 50
	if barWidth < 20 {
		barWidth = 20
	}
	progressStr := renderSpectrumProgressBar(p.anim.ProgressPos, barWidth)
	prism := styles.RenderPrismGradientSpring(p.anim.PrismFrame, p.anim.RayLengths, p.anim.ShimmerPhase)
	line := fmt.Sprintf("%s  Plan: %s  %s  %s", prism, planName, progressStr, stats)
	return styles.PanelStyle.Width(width - 2).Render(line)
}

func (p *SpectrumPlugin) renderMainPanels(width int) string {
	totalWidth := width - 4
	storyWidth := totalWidth * 40 / 100
	activityWidth := totalWidth - storyWidth - 3

	storyPanel := p.renderStoryList(storyWidth)
	activityPanel := p.renderActivityPanel(activityWidth)

	return lipgloss.JoinHorizontal(lipgloss.Top, storyPanel, activityPanel)
}

func (p *SpectrumPlugin) renderStoryList(width int) string {
	var lines []string

	title := styles.StoriesTitleStyle.Render("STORIES")
	lines = append(lines, title)
	lines = append(lines, styles.HorizontalLine(width-4))

	start, end := p.storyPaginator.GetSliceBounds(len(p.stories))

	for i := start; i < end && i < len(p.stories); i++ {
		story := p.stories[i]
		icon := p.getStoryIcon(story, i)
		style := p.getStoryStyle(story)

		maxTitleLen := width - 20
		storyTitle := story.Title
		if len(storyTitle) > maxTitleLen && maxTitleLen > 3 {
			storyTitle = storyTitle[:maxTitleLen-3] + "..."
		}

		line := fmt.Sprintf("%s %s %s", icon, story.ID, storyTitle)
		lines = append(lines, style.Render(line))
	}

	for len(lines) < p.storiesPerPage+2 {
		lines = append(lines, "")
	}

	totalPages := (len(p.stories) + p.storiesPerPage - 1) / p.storiesPerPage
	if totalPages > 1 {
		pagInfo := fmt.Sprintf("  %s  [a/s]", p.storyPaginator.View())
		lines = append(lines, styles.DimStyle.Render(pagInfo))
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width).Render(content)
}

func (p *SpectrumPlugin) getStoryIcon(s StoryView, index int) string {
	if s.Status == "complete" {
		if scale, ok := p.anim.StoryPopScales[index]; ok {
			if scale < 0.7 {
				return "●"
			} else if scale > 1.1 {
				return "✔"
			}
		}
		return styles.CheckIcon
	}
	if s.ID == p.currentStoryID {
		brightness := 0.6 + 0.4*math.Sin(p.anim.PulsePhase)
		if brightness > 0.8 {
			return "▶"
		}
		return "▸"
	}
	if s.IsBlocked {
		return styles.BlockedIcon
	}
	return styles.PendingIcon
}

func (p *SpectrumPlugin) getStoryStyle(s StoryView) lipgloss.Style {
	if s.Status == "complete" {
		return styles.CompleteStyle
	}
	if s.ID == p.currentStoryID {
		return styles.CurrentStyle
	}
	if s.IsBlocked {
		return styles.BlockedStyle
	}
	return styles.PendingStyle
}

func (p *SpectrumPlugin) renderActivityPanel(width int) string {
	var lines []string

	title := styles.ActivityTitleStyle.Render("CURRENT ACTIVITY")
	lines = append(lines, title)
	lines = append(lines, styles.HorizontalLine(width-4))

	if p.currentStoryID != "" {
		storyLine := fmt.Sprintf("%s %s: %s", styles.PlayIcon, p.currentStoryID, p.currentStoryTitle)
		lines = append(lines, styles.CurrentStyle.Render(storyLine))
		lines = append(lines, "")

		status := "Working..."
		if p.state == StatePaused {
			status = "Paused"
		}
		statusLine := fmt.Sprintf("Status: %s %s", p.spinner.View(), status)
		lines = append(lines, statusLine)

		if p.currentActivity != "" {
			lines = append(lines, "")
			activityLine := p.currentActivity
			if len(activityLine) > width-6 {
				activityLine = activityLine[:width-9] + "..."
			}
			lines = append(lines, styles.HighlightStyle.Render(activityLine))
		}
		lines = append(lines, "")
	} else if p.state == StateRunning {
		statusLine := fmt.Sprintf("Status: %s Starting...", p.spinner.View())
		lines = append(lines, statusLine)
		if p.currentActivity != "" {
			lines = append(lines, "")
			activityLine := p.currentActivity
			if len(activityLine) > width-6 {
				activityLine = activityLine[:width-9] + "..."
			}
			lines = append(lines, styles.HighlightStyle.Render(activityLine))
		}
		lines = append(lines, "")
	} else if p.state == StateIdle {
		lines = append(lines, styles.DimStyle.Render("Press Enter to start execution"))
		lines = append(lines, "")
	} else if p.state == StateComplete {
		lines = append(lines, styles.SuccessStyle.Render("All stories complete!"))
		lines = append(lines, "")
	} else if p.state == StateMaxIterations {
		lines = append(lines, styles.WarningStyle.Render("Iteration limit reached"))
		if p.lastError != "" {
			lines = append(lines, styles.DimStyle.Render(p.lastError))
		}
		lines = append(lines, "")
	} else if p.state == StateError {
		lines = append(lines, styles.ErrorStyle.Render("Error occurred"))
		if p.lastError != "" {
			lines = append(lines, styles.DimStyle.Render(p.lastError))
		}
		lines = append(lines, "")
	}

	if len(p.recentActivities) > 0 {
		lines = append(lines, styles.DimStyle.Render("Recent:"))
		activityLines := p.recentActivities
		if len(activityLines) > 5 {
			activityLines = activityLines[len(activityLines)-5:]
		}
		for _, line := range activityLines {
			if len(line) > width-6 {
				line = line[:width-9] + "..."
			}
			lines = append(lines, styles.DimStyle.Render("  "+line))
		}
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width).Render(content)
}

func (p *SpectrumPlugin) renderLogPanel(width int) string {
	var lines []string

	title := styles.LogTitleStyle.Render("LOG OUTPUT")
	scrollHint := styles.DimStyle.Render("[z/x scroll]")
	header := lipgloss.JoinHorizontal(lipgloss.Center, title, strings.Repeat(" ", width-40), scrollHint)
	lines = append(lines, header)
	lines = append(lines, styles.HorizontalLine(width-4))

	start, end := p.logPaginator.GetSliceBounds(len(p.logLines))

	for i := start; i < end && i < len(p.logLines); i++ {
		entry := p.logLines[i]
		line := formatLogEntry(entry)

		offsetIdx := i - start
		if offsetIdx < len(p.anim.LogEntryOffsets) {
			offset := int(p.anim.LogEntryOffsets[offsetIdx])
			if offset > 0 {
				line = strings.Repeat(" ", offset) + line
			}
		}
		lines = append(lines, line)
	}

	for len(lines) < p.logsPerPage+2 {
		lines = append(lines, "")
	}

	totalPages := (len(p.logLines) + p.logsPerPage - 1) / p.logsPerPage
	if totalPages > 1 {
		pagInfo := fmt.Sprintf("  %s", p.logPaginator.View())
		lines = append(lines, styles.DimStyle.Render(pagInfo))
	}

	content := lipgloss.JoinVertical(lipgloss.Left, lines...)
	return styles.PanelStyle.Width(width - 2).Render(content)
}

func (p *SpectrumPlugin) renderStatusBar(width int) string {
	var stateStyle lipgloss.Style
	switch p.state {
	case StateRunning:
		stateStyle = styles.SuccessStyle
	case StatePaused:
		stateStyle = styles.WarningStyle
	case StateComplete:
		stateStyle = styles.SuccessStyle
	case StateMaxIterations:
		stateStyle = styles.WarningStyle
	case StateError:
		stateStyle = styles.ErrorStyle
	default:
		stateStyle = styles.DimStyle
	}

	stateStr := fmt.Sprintf("%s %s", styles.PlayIcon, p.state.String())
	if p.state == StatePaused || p.state == StateMaxIterations {
		stateStr = fmt.Sprintf("⏸ %s", p.state.String())
	}

	elapsed := ""
	if !p.startTime.IsZero() {
		d := p.elapsedTime()
		elapsed = fmt.Sprintf("Elapsed: %s", formatDuration(d))
	}

	controls := styles.DimStyle.Render("[q]uit [p]ause [/]skip")

	left := stateStyle.Render(stateStr)
	middle := elapsed
	right := controls

	leftWidth := lipgloss.Width(left)
	middleWidth := lipgloss.Width(middle)
	rightWidth := lipgloss.Width(right)
	spacer1Width := (width - leftWidth - middleWidth - rightWidth - 8) / 2
	if spacer1Width < 1 {
		spacer1Width = 1
	}

	statusLine := lipgloss.JoinHorizontal(
		lipgloss.Center,
		left,
		strings.Repeat(" ", spacer1Width),
		middle,
		strings.Repeat(" ", spacer1Width),
		right,
	)

	return styles.StatusBarStyle.Width(width - 2).Render(statusLine)
}

func (p *SpectrumPlugin) renderEpicSelector(width int) string {
	var tabs []string
	for i, epic := range p.epic.Epics {
		label := fmt.Sprintf(" %s (%d/%d) ", epic.Name, epic.CompletedCount, epic.StoryCount)
		if i == p.epic.SelectedIndex {
			tabs = append(tabs, styles.CurrentStyle.Bold(true).Render(label))
		} else {
			tabs = append(tabs, styles.DimStyle.Render(label))
		}
	}
	selector := lipgloss.JoinHorizontal(lipgloss.Center, tabs...)
	hint := styles.DimStyle.Render("  [tab] switch epic")
	content := lipgloss.JoinHorizontal(lipgloss.Center, selector, hint)
	return styles.PanelStyle.Width(width - 2).Render(content)
}

// formatLogEntry formats a single log entry for display
func formatLogEntry(e LogEntry) string {
	timestamp := e.Time.Format("15:04:05")
	var levelStyle lipgloss.Style
	var levelStr string

	switch e.Level {
	case LogInfo:
		levelStyle = styles.InfoStyle
		levelStr = "INFO "
	case LogSuccess:
		levelStyle = styles.SuccessStyle
		levelStr = "OK   "
	case LogWarning:
		levelStyle = styles.WarningStyle
		levelStr = "WARN "
	case LogError:
		levelStyle = styles.ErrorStyle
		levelStr = "ERROR"
	case LogClaudeOutput:
		levelStyle = styles.DimStyle
		levelStr = "     "
	}

	return fmt.Sprintf("[%s] %s %s",
		styles.DimStyle.Render(timestamp),
		levelStyle.Render(levelStr),
		e.Message,
	)
}
