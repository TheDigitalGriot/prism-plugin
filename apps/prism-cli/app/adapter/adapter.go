package adapter

import (
	"time"

	"github.com/prism-plugin/prism-cli/app/chat"
)

// Session represents a conversation session from any AI agent
type Session struct {
	ID          string    // Unique session ID (e.g., UUID)
	Title       string    // Summary/first message excerpt
	Adapter     string    // Adapter ID that owns this session ("claude", "codex", etc.)
	Path        string    // Path to session file on disk
	ProjectPath string    // Associated project directory
	CreatedAt   time.Time // When the session was started
	UpdatedAt   time.Time // When the last message was written
	MessageCount int      // Total messages in the session
	TokenCount   int      // Approximate token count (if available)
	Model        string   // Model used (e.g., "claude-opus-4-5")
}

// Adapter defines the interface for scanning AI agent conversation files
type Adapter interface {
	// ID returns the adapter identifier (e.g., "claude", "codex")
	ID() string
	// Name returns the display name (e.g., "Claude Code")
	Name() string
	// Available returns true if this adapter's data directory exists
	Available() bool
	// ScanSessions returns all sessions found by this adapter
	ScanSessions() ([]Session, error)
	// LoadMessages loads messages from a specific session file
	LoadMessages(sessionPath string) ([]chat.Message, error)
	// SupportsWrite returns true if the adapter can persist new messages back to disk
	SupportsWrite() bool
}
