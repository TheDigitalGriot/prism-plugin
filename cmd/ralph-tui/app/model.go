package app

import (
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/paginator"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/harmonica"
)

// AppState represents the running state of the TUI
type AppState int

const (
	StateIdle AppState = iota
	StateRunning
	StatePaused
	StateComplete
	StateError
)

func (s AppState) String() string {
	switch s {
	case StateIdle:
		return "IDLE"
	case StateRunning:
		return "RUNNING"
	case StatePaused:
		return "PAUSED"
	case StateComplete:
		return "COMPLETE"
	case StateError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// LogLevel represents the severity of a log entry
type LogLevel int

const (
	LogInfo LogLevel = iota
	LogSuccess
	LogWarning
	LogError
	LogClaudeOutput
)

// LogEntry represents a single log line with metadata
type LogEntry struct {
	Time    time.Time
	Level   LogLevel
	Message string
	StoryID string
}

// AnimState holds all animation state for smooth UI transitions
type AnimState struct {
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

	// Prism animation (rotating shimmer)
	PrismFrame int // Current animation frame (0-7)
	PrismTick  int // Sub-tick counter for slower animation

	// Spring-based ray animation for gradient prism
	RaySpring  harmonica.Spring
	RayLengths [4]float64 // Current animated length per ray
	RayVels    [4]float64 // Velocity per ray
	RayTargets [4]float64 // Target lengths (oscillates between 4-8)

	// Shimmer phase for gradient brightness
	ShimmerPhase float64
}

// Model is the main application state
type Model struct {
	// Configuration
	StoriesPath  string
	ProgressPath string
	ProjectDir   string
	PrismStyle   string // "gradient", "braille", or "ascii"

	// Stories data (will be populated by domain package)
	PlanName     string
	Stories      []StoryView // Simplified view of stories for display
	TotalStories int

	// Execution state
	State              AppState
	CurrentStoryID     string
	CurrentStoryTitle  string
	Iteration          int
	MaxIterations      int
	ConsecutiveErrs    int
	MaxConsecutiveErrs int
	Pause              int // seconds between iterations

	// Output capture
	LogLines      []LogEntry
	CurrentOutput strings.Builder
	RecentOutput  []string // Last N lines for activity panel

	// Current tool activity
	CurrentTool       string   // Name of currently executing tool
	CurrentActivity   string   // Human-readable description of current activity
	RecentActivities  []string // History of recent tool activities

	// UI components
	Spinner        spinner.Model
	Progress       progress.Model
	Viewport       viewport.Model
	StoryPaginator paginator.Model
	LogPaginator   paginator.Model

	// Pagination config
	StoriesPerPage int
	LogsPerPage    int

	// UI state
	Width    int
	Height   int
	ShowHelp bool
	Ready    bool // True once initial setup is complete

	// Timing
	StartTime      time.Time
	IterationStart time.Time

	// Error info
	LastError string

	// Streaming output channel
	OutputChan chan tea.Msg

	// Animation state
	Anim AnimState

	// Demo mode
	DemoMode       bool
	DemoStoryIndex int // Next story to auto-complete in demo
}

// StoryView is a simplified story representation for display
type StoryView struct {
	ID        string
	Title     string
	Status    string // pending, in_progress, complete
	IsBlocked bool
	Priority  int
}

// NewModel creates initial model state
func NewModel(storiesPath, projectDir string, maxIter, pause int, prismStyle string) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot

	p := progress.New(
		progress.WithDefaultGradient(),
		progress.WithoutPercentage(),
	)

	// Default prism style
	if prismStyle == "" {
		prismStyle = "gradient"
	}

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

	return Model{
		StoriesPath:        storiesPath,
		ProjectDir:         projectDir,
		MaxIterations:      maxIter,
		MaxConsecutiveErrs: 3,
		Pause:              pause,
		State:              StateIdle,
		PrismStyle:         prismStyle,
		Spinner:            s,
		Progress:           p,
		StoryPaginator:     storyPag,
		LogPaginator:       logPag,
		StoriesPerPage:     12,
		LogsPerPage:        6,
		LogLines:           make([]LogEntry, 0, 1000),
		RecentOutput:       make([]string, 0, 10),
		Stories:            []StoryView{},
		Anim: AnimState{
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
			// Ray spring: bouncy for organic light rays
			RaySpring:  harmonica.NewSpring(harmonica.FPS(60), 4.0, 0.3),
			RayLengths: [4]float64{6, 5, 4, 3}, // Start with staggered lengths
			RayTargets: [4]float64{6, 7, 5, 8}, // Initial targets
		},
	}
}

// NewDemoModel creates a model with fake stories for demo/testing
func NewDemoModel(prismStyle string) Model {
	m := NewModel("", "", 50, 2, prismStyle)
	m.PlanName = "Prism Animation Demo"
	m.Stories = []StoryView{
		{ID: "DEMO-001", Title: "Initialize spring physics engine", Status: "complete"},
		{ID: "DEMO-002", Title: "Implement progress bar animations", Status: "complete"},
		{ID: "DEMO-003", Title: "Add story completion pop effect", Status: "pending"},
		{ID: "DEMO-004", Title: "Create active story pulse animation", Status: "pending"},
		{ID: "DEMO-005", Title: "Implement log entry slide-in", Status: "pending"},
		{ID: "DEMO-006", Title: "Add prism logo with rainbow shimmer", Status: "pending"},
		{ID: "DEMO-007", Title: "Optimize animation frame rate", Status: "pending"},
		{ID: "DEMO-008", Title: "Test all animations together", Status: "pending"},
	}
	m.TotalStories = len(m.Stories)
	m.DemoMode = true
	// Initialize paginator for demo stories
	m.StoryPaginator.SetTotalPages(len(m.Stories))
	// Initialize progress to show completed stories
	m.Anim.ProgressPos = m.ProgressPercent()
	m.Anim.ProgressTarget = m.ProgressPercent()
	return m
}

// CompletedCount returns the number of completed stories
func (m Model) CompletedCount() int {
	count := 0
	for _, s := range m.Stories {
		if s.Status == "complete" {
			count++
		}
	}
	return count
}

// RemainingCount returns the number of non-complete stories
func (m Model) RemainingCount() int {
	return m.TotalStories - m.CompletedCount()
}

// ProgressPercent returns completion as a float between 0 and 1
func (m Model) ProgressPercent() float64 {
	if m.TotalStories == 0 {
		return 0
	}
	return float64(m.CompletedCount()) / float64(m.TotalStories)
}

// AddLog adds a new log entry
func (m *Model) AddLog(level LogLevel, message string) {
	entry := LogEntry{
		Time:    time.Now(),
		Level:   level,
		Message: message,
		StoryID: m.CurrentStoryID,
	}
	m.LogLines = append(m.LogLines, entry)

	// Update log paginator total pages and auto-scroll to last page
	totalPages := (len(m.LogLines) + m.LogsPerPage - 1) / m.LogsPerPage
	if totalPages < 1 {
		totalPages = 1
	}
	m.LogPaginator.SetTotalPages(totalPages)
	// Auto-scroll to last page to show newest logs
	for m.LogPaginator.Page < totalPages-1 {
		m.LogPaginator.NextPage()
	}

	// Trigger slide-in animation for new entry
	m.Anim.LogEntryOffsets = append(m.Anim.LogEntryOffsets, 20.0) // start offset
	m.Anim.LogEntryVels = append(m.Anim.LogEntryVels, 0)

	// Keep offsets array sized to match visible logs (max LogsPerPage)
	if len(m.Anim.LogEntryOffsets) > m.LogsPerPage {
		m.Anim.LogEntryOffsets = m.Anim.LogEntryOffsets[1:]
		m.Anim.LogEntryVels = m.Anim.LogEntryVels[1:]
	}
}

// ElapsedTime returns the duration since start
func (m Model) ElapsedTime() time.Duration {
	if m.StartTime.IsZero() {
		return 0
	}
	return time.Since(m.StartTime)
}

// FormatElapsed returns elapsed time as a human-readable string
func (m Model) FormatElapsed() string {
	d := m.ElapsedTime()
	minutes := int(d.Minutes())
	seconds := int(d.Seconds()) % 60
	if minutes > 0 {
		return strings.TrimSpace(strings.ReplaceAll(
			strings.ReplaceAll("%dm %ds", "%d", string(rune('0'+minutes%10))),
			"%d", string(rune('0'+seconds%10)),
		))
	}
	return strings.TrimSpace(strings.ReplaceAll("%ds", "%d", string(rune('0'+seconds%10))))
}
