package app

import "time"

// === Lifecycle Messages ===

// InitCompleteMsg indicates initialization finished
type InitCompleteMsg struct {
	PlanName string
	Stories  []StoryView
	Error    error
}

// TickMsg for periodic updates (spinner, elapsed time)
type TickMsg time.Time

// === Claude Process Messages ===

// ClaudeStartedMsg indicates Claude process has started
type ClaudeStartedMsg struct {
	StoryID   string
	Iteration int
}

// ClaudeOutputMsg carries streaming output from Claude
type ClaudeOutputMsg struct {
	Text     string
	IsStderr bool
}

// ClaudeFinishedMsg indicates Claude process completed
type ClaudeFinishedMsg struct {
	ExitCode int
	Output   string
	Duration time.Duration
	Error    error
}

// === Signal Messages ===

// SignalType represents the type of signal detected
type SignalType int

const (
	SignalNone SignalType = iota
	SignalComplete
	SignalContinue
	SignalRetry
	SignalBlocked
	SignalError
)

// SignalDetectedMsg when a signal is found in output
type SignalDetectedMsg struct {
	Type    SignalType
	Content string
	StoryID string
}

// === Story State Messages ===

// StoryStartedMsg when beginning a new story
type StoryStartedMsg struct {
	StoryID string
	Title   string
}

// StoryCompletedMsg when a story finishes successfully
type StoryCompletedMsg struct {
	StoryID string
}

// === File Operation Messages ===

// StoriesReloadedMsg after re-reading stories.json
type StoriesReloadedMsg struct {
	PlanName string
	Stories  []StoryView
	Error    error
}

// === User Action Messages ===

// StartExecutionMsg user pressed Enter to start
type StartExecutionMsg struct{}

// PauseToggleMsg user pressed 'p'
type PauseToggleMsg struct{}

// SkipStoryMsg user pressed 's'
type SkipStoryMsg struct{}

// StartNextIterationMsg signals to start the next iteration
type StartNextIterationMsg struct{}

// RetryIterationMsg signals to retry with backoff
type RetryIterationMsg struct{}

// === Demo Mode Messages ===

// DemoTickMsg triggers auto-progression in demo mode
type DemoTickMsg struct{}

// DemoCompleteStoryMsg simulates a story completion
type DemoCompleteStoryMsg struct {
	StoryIndex int
}

// DemoActivityMsg cycles through fake tool activities
type DemoActivityMsg struct {
	ActivityIndex int
}
