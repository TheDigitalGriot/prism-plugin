package agentbus

import (
	"github.com/prism-plugin/prism-cli/app/adapter"
	"github.com/prism-plugin/prism-cli/app/chat"
)

// SessionState tracks the lifecycle of a managed session.
type SessionState int

const (
	SessionIdle   SessionState = iota // Historical session (from adapter scan)
	SessionActive                     // Currently running conversation
	SessionPaused                     // Subprocess paused/disconnected
)

// ManagedSession wraps an adapter.Session with live execution state.
type ManagedSession struct {
	Session         adapter.Session
	State           SessionState
	Messages        []chat.Message // In-memory message buffer
	ProcessID       int            // Claude CLI PID (0 if not running)
	ClaudeSessionID string         // Claude's internal session ID for --resume
}
