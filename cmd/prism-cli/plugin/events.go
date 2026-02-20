package plugin

import (
	"sync"
)

// Event is the base interface for all events that can be published on the event bus.
type Event interface {
	// Type returns the event type identifier
	Type() string
}

// EventHandler is a function that handles an event
type EventHandler func(Event)

// EventBus provides pub/sub messaging between plugins without tight coupling.
// Plugins can subscribe to events and publish events for other plugins to react to.
type EventBus struct {
	mu        sync.RWMutex
	handlers  map[string][]EventHandler // Map event type -> list of handlers
}

// NewEventBus creates a new event bus
func NewEventBus() *EventBus {
	return &EventBus{
		handlers: make(map[string][]EventHandler),
	}
}

// Subscribe registers a handler for a specific event type.
// The handler will be called whenever an event of that type is published.
func (eb *EventBus) Subscribe(eventType string, handler EventHandler) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.handlers[eventType] = append(eb.handlers[eventType], handler)
}

// Publish sends an event to all registered handlers for that event type.
// Handlers are called synchronously in the order they were registered.
func (eb *EventBus) Publish(event Event) {
	eb.mu.RLock()
	handlers := eb.handlers[event.Type()]
	eb.mu.RUnlock()

	// Call handlers without holding the lock to prevent deadlocks
	for _, handler := range handlers {
		handler(event)
	}
}

// Unsubscribe removes all handlers for a specific event type (used during cleanup)
func (eb *EventBus) Unsubscribe(eventType string) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	delete(eb.handlers, eventType)
}

// Clear removes all event handlers (used during shutdown or testing)
func (eb *EventBus) Clear() {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.handlers = make(map[string][]EventHandler)
}

// --- Concrete Event Types ---

// StoryCompletedEvent is published when a Spectrum story completes execution.
// Monitor plugin subscribes to this to update execution history.
type StoryCompletedEvent struct {
	StoryID   string
	StoryName string
	Result    string // "success", "error", "blocked"
	Duration  int64  // Duration in milliseconds
}

func (e StoryCompletedEvent) Type() string {
	return "story.completed"
}

// FileChangedEvent is published when a file is modified in the file browser.
// Git plugin subscribes to this to refresh its status view.
type FileChangedEvent struct {
	FilePath string
	Action   string // "created", "modified", "deleted"
}

func (e FileChangedEvent) Type() string {
	return "file.changed"
}

// BranchChangedEvent is published when the git branch changes.
// Header/app shell subscribes to this to update the branch display.
type BranchChangedEvent struct {
	BranchName string
	Ahead      int
	Behind     int
}

func (e BranchChangedEvent) Type() string {
	return "branch.changed"
}

// EpicSwitchedEvent is published when the user switches to a different epic.
// Plugins that care about the active epic subscribe to this.
type EpicSwitchedEvent struct {
	EpicName    string
	StoriesPath string
}

func (e EpicSwitchedEvent) Type() string {
	return "epic.switched"
}

// ProjectSwitchedEvent is published when the user switches to a different project.
// All plugins should reinitialize when receiving this event.
type ProjectSwitchedEvent struct {
	ProjectDir  string
	PrismDir    string
	StoriesPath string
}

func (e ProjectSwitchedEvent) Type() string {
	return "project.switched"
}

// --- Sidecar Integration Event Types (SI-6) ---

// AgentStatusEvent is published by the Workspaces plugin when an agent's status changes.
// Monitor plugin subscribes to this for agent health display.
type AgentStatusEvent struct {
	WorktreePath string
	AgentType    string // "claude", "codex", "cursor", etc.
	Status       string // "active", "thinking", "waiting", "done", "paused", "error"
}

func (e AgentStatusEvent) Type() string {
	return "agent.status"
}

// ConversationChangedEvent is published by the watcher when conversation files change.
// Agent plugin subscribes to this to refresh its session list.
type ConversationChangedEvent struct {
	AdapterType string
	SessionPath string
}

func (e ConversationChangedEvent) Type() string {
	return "conversation.changed"
}

// QualityGateResultEvent is published by Monitor when a quality gate finishes execution.
type QualityGateResultEvent struct {
	GateName string
	Status   string // "pass", "fail"
	Output   string
	Duration int64 // milliseconds
}

func (e QualityGateResultEvent) Type() string {
	return "gate.result"
}

// WorktreeChangedEvent is published when worktrees are created or deleted.
type WorktreeChangedEvent struct {
	Action string // "created", "deleted"
	Path   string
	Branch string
}

func (e WorktreeChangedEvent) Type() string {
	return "worktree.changed"
}
