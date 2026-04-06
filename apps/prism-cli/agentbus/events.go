package agentbus

import (
	"encoding/json"
	"time"

	"github.com/prism-plugin/prism-cli/domain"
)

// EventType is a discriminated event kind.
type EventType int

const (
	EventTextDelta        EventType = iota // Streaming text from assistant
	EventTextComplete                      // Full text block complete
	EventToolCallStart                     // Tool invocation begins
	EventToolCallComplete                  // Tool invocation ends (success/error)
	EventToolCallProgress                  // Intermediate tool status update
	EventAgentSpawnStart                   // Subagent started (Task tool)
	EventAgentSpawnFinish                  // Subagent completed
	EventPhaseChanged                      // Execution phase changed
	EventSignalDetected                    // Prism signal detected
	EventPermissionRequired                // Tool needs user approval
	EventPermissionResponse                // User responded to permission
	EventQuestionAsked                     // Claude asks user a question (AskUserQuestion)
	EventQuestionAnswered                  // User answered question
	EventSessionCreated                    // New session started
	EventSessionResumed                    // Existing session continued
	EventMessageComplete                   // Full assistant turn complete
	EventStreamError                       // Error during streaming
	EventProcessStarted                    // Claude CLI subprocess started
	EventProcessExited                     // Claude CLI subprocess exited
	EventCostUpdate                        // Token/cost information
	EventThinkingDelta                     // Streaming thinking/reasoning block
)

// Event is the unified event type published on the Bus.
// All fields are optional; set only what is relevant for the EventType.
type Event struct {
	Type      EventType
	Timestamp time.Time
	SessionID string

	// Text events
	Text string

	// Tool events
	ToolName   string
	ToolInput  json.RawMessage
	ToolOutput string
	ToolStatus string // "running", "complete", "error"
	ToolID     string

	// Agent events
	AgentID       string
	AgentType     string
	AgentDesc     string
	ParentAgentID string

	// Phase/signal events
	Phase  string
	Signal domain.Signal

	// Permission events
	Permission *PermissionRequest
	PermResp   *PermissionResponse

	// Question events
	Question  *QuestionRequest
	QuestResp *QuestionResponse

	// Process events
	ExitCode int
	Duration time.Duration
	Error    error

	// Cost events
	InputTokens  int
	OutputTokens int
	Model        string
}
