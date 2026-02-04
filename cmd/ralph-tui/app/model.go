package app

import (
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
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

// Model is the main application state
type Model struct {
	// Configuration
	StoriesPath  string
	ProgressPath string
	ProjectDir   string

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

	// UI components
	Spinner  spinner.Model
	Progress progress.Model
	Viewport viewport.Model

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
func NewModel(storiesPath, projectDir string, maxIter, pause int) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot

	p := progress.New(
		progress.WithDefaultGradient(),
		progress.WithoutPercentage(),
	)

	return Model{
		StoriesPath:        storiesPath,
		ProjectDir:         projectDir,
		MaxIterations:      maxIter,
		MaxConsecutiveErrs: 3,
		Pause:              pause,
		State:              StateIdle,
		Spinner:            s,
		Progress:           p,
		LogLines:           make([]LogEntry, 0, 1000),
		RecentOutput:       make([]string, 0, 10),
		Stories:            []StoryView{},
	}
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
