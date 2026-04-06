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

// === View Navigation Messages ===

// NavigateToViewMsg requests switching to a different view
type NavigateToViewMsg struct {
	View ActiveView
}

// SplashDoneMsg signals that splash screen auto-timer completed
type SplashDoneMsg struct{}

// === Epic Messages ===

// EpicsDiscoveredMsg carries the list of discovered epic directories
type EpicsDiscoveredMsg struct {
	Epics []EpicInfo
	Error error
}

// EpicSelectedMsg indicates user selected an epic
type EpicSelectedMsg struct {
	EpicIndex int
}

// === File Listing Messages ===

// ResearchFilesLoadedMsg carries research file entries
type ResearchFilesLoadedMsg struct {
	Files []FileEntry
	Error error
	Epoch uint64
}

// PlansFilesLoadedMsg carries plan file entries
type PlansFilesLoadedMsg struct {
	Files []FileEntry
	Error error
	Epoch uint64
}

// FileContentLoadedMsg carries full content of a file for viewing
type FileContentLoadedMsg struct {
	Content  string
	Path     string     // Path to the file
	ForView  ActiveView // which view requested this
	Error    error
	Epoch    uint64
}

// DecomposePlanMsg result of plan decomposition
type DecomposePlanMsg struct {
	EpicName string
	Error    error
}

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

// === Permission / Dialog Messages ===

// OpenDialogMsg requests opening a dialog (sent by plugins)
type OpenDialogMsg struct {
	Dialog interface{} // dialog.Dialog interface (imported in app package)
}

// PermissionRequestMsg requests user permission to execute a tool
type PermissionRequestMsg struct {
	ToolName    string
	Description string
	Preview     string // Command text, file diff, etc.
}

// PermissionResponseMsg carries the user's permission decision
type PermissionResponseMsg struct {
	Action       string // "allow", "allow_session", "deny"
	ToolName     string
	AllowSession bool // If true, remember this permission for the session
}

// === Modal Messages ===

// OpenModalMsg requests opening a modal (sent by plugins)
type OpenModalMsg struct {
	Modal interface{} // modal.Modal interface
}

// ModalActionMsg is dispatched to the active plugin when a modal button/list
// action is triggered. The plugin handles the action based on the ID.
// Inputs contains any text input/textarea values captured before the modal was closed.
type ModalActionMsg struct {
	Action string            // The action ID from the modal button/list
	Inputs map[string]string // Input/textarea values keyed by section ID
}

// FileFinderOpenMsg requests opening a file in the Files plugin (F-4, F-5)
type FileFinderOpenMsg struct {
	Path string // Absolute file path
	Name string // Filename (basename)
}

// === Workspace Messages (W-1, W-2, W-3) ===

// WorktreeListLoadedMsg carries parsed worktree data from `git worktree list --porcelain`
type WorktreeListLoadedMsg struct {
	Worktrees []WorktreeInfo
	Error     error
	Epoch     uint64
}

// WorktreeCreatedMsg signals that a worktree was created
type WorktreeCreatedMsg struct {
	Path   string
	Branch string
	Error  error
	Epoch  uint64
}

// WorktreeDeletedMsg signals that a worktree was deleted
type WorktreeDeletedMsg struct {
	Path  string
	Error error
	Epoch uint64
}

// === File Edit Messages (F-6) ===

// FileSavedMsg signals that a file was saved to disk
type FileSavedMsg struct {
	Path  string
	Error error
}
