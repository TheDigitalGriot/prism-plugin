package adapter

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/prism-plugin/prism-cli/app/chat"
)

// ClaudeAdapter scans Claude Code conversation files from ~/.claude/projects/
type ClaudeAdapter struct {
	baseDir string // Resolved path to ~/.claude/projects/
}

// NewClaudeAdapter creates a new Claude Code adapter.
// If baseDir is empty, it auto-detects from the user's home directory.
func NewClaudeAdapter(baseDir string) *ClaudeAdapter {
	if baseDir == "" {
		baseDir = defaultClaudeDir()
	}
	return &ClaudeAdapter{baseDir: baseDir}
}

func (a *ClaudeAdapter) ID() string           { return "claude" }
func (a *ClaudeAdapter) Name() string         { return "Claude Code" }
func (a *ClaudeAdapter) SupportsWrite() bool  { return true }

func (a *ClaudeAdapter) Available() bool {
	info, err := os.Stat(a.baseDir)
	return err == nil && info.IsDir()
}

// ScanSessions discovers all .jsonl conversation files across all projects.
func (a *ClaudeAdapter) ScanSessions() ([]Session, error) {
	if !a.Available() {
		return nil, nil
	}

	projectDirs, err := os.ReadDir(a.baseDir)
	if err != nil {
		return nil, err
	}

	var sessions []Session

	for _, pd := range projectDirs {
		if !pd.IsDir() {
			continue
		}

		projectPath := decodeProjectPath(pd.Name())
		projectDir := filepath.Join(a.baseDir, pd.Name())

		entries, err := os.ReadDir(projectDir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".jsonl") {
				continue
			}

			sessionID := strings.TrimSuffix(entry.Name(), ".jsonl")
			filePath := filepath.Join(projectDir, entry.Name())

			info, err := entry.Info()
			if err != nil {
				continue
			}

			// Quick scan: read first few lines for metadata
			session := scanSessionMetadata(filePath, sessionID, projectPath, info.ModTime())
			session.Adapter = "claude"
			sessions = append(sessions, session)
		}
	}

	// Sort by most recently updated
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})

	return sessions, nil
}

// LoadMessages loads all user and assistant messages from a session JSONL file.
func (a *ClaudeAdapter) LoadMessages(sessionPath string) ([]chat.Message, error) {
	f, err := os.Open(sessionPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var messages []chat.Message
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024) // 1MB max line

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry jsonlEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		// Only process user and assistant message types
		if entry.Type != "user" && entry.Type != "assistant" {
			continue
		}

		msg := entryToMessage(entry)
		if msg.Content != "" || msg.Type == chat.MessageTypeTool {
			messages = append(messages, msg)
		}
	}

	return messages, scanner.Err()
}

// ── Internal types ────────────────────────────────────────────────────────────

// jsonlEntry represents a single line in a Claude Code .jsonl conversation file
type jsonlEntry struct {
	Type      string          `json:"type"`      // "user", "assistant", "queue-operation", etc.
	UUID      string          `json:"uuid"`
	Timestamp string          `json:"timestamp"` // ISO 8601
	SessionID string          `json:"sessionId"`
	Message   json.RawMessage `json:"message"`   // Nested message object
}

// messagePayload represents the nested message object
type messagePayload struct {
	Role    string           `json:"role"` // "user" or "assistant"
	Model   string           `json:"model"`
	Content []contentBlock   `json:"content"`
}

// contentBlock represents a content block within a message
type contentBlock struct {
	Type    string `json:"type"`    // "text", "thinking", "tool_use", "tool_result"
	Text    string `json:"text"`    // For "text" type
	Name    string `json:"name"`    // For "tool_use" type
	Input   json.RawMessage `json:"input"` // For "tool_use" type
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// defaultClaudeDir returns the default Claude Code projects directory
func defaultClaudeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	if runtime.GOOS == "windows" {
		return filepath.Join(home, ".claude", "projects")
	}
	return filepath.Join(home, ".claude", "projects")
}

// decodeProjectPath converts a Claude project directory name back to a path.
// Claude encodes paths like: c--Users-digit-Developer-prism-plugin
func decodeProjectPath(dirName string) string {
	// Replace double hyphens with path separator, single hyphens with path separator
	// The encoding is: path separators become '-', drive colons become '-'
	// e.g., c--Users-digit-Developer -> C:\Users\digit\Developer (on Windows)
	parts := strings.Split(dirName, "-")
	if len(parts) < 2 {
		return dirName
	}

	if runtime.GOOS == "windows" {
		// First part is drive letter: "c" -> "C:"
		result := strings.ToUpper(parts[0]) + ":"
		for i := 1; i < len(parts); i++ {
			if parts[i] == "" {
				// Double hyphen was a path separator in the drive part
				continue
			}
			result += string(filepath.Separator) + parts[i]
		}
		return result
	}
	// Unix: join with /
	return "/" + strings.Join(parts, "/")
}

// scanSessionMetadata reads the first few lines of a JSONL file to extract metadata.
func scanSessionMetadata(path, sessionID, projectPath string, modTime time.Time) Session {
	session := Session{
		ID:          sessionID,
		Path:        path,
		ProjectPath: projectPath,
		UpdatedAt:   modTime,
	}

	f, err := os.Open(path)
	if err != nil {
		return session
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	msgCount := 0
	var firstUserMsg string
	var firstTimestamp time.Time
	var lastTimestamp time.Time
	var model string

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry jsonlEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		// Parse timestamp
		if entry.Timestamp != "" {
			if t, err := time.Parse(time.RFC3339Nano, entry.Timestamp); err == nil {
				if firstTimestamp.IsZero() {
					firstTimestamp = t
				}
				lastTimestamp = t
			}
		}

		if entry.Type == "user" || entry.Type == "assistant" {
			msgCount++

			// Extract first user message as title
			if entry.Type == "user" && firstUserMsg == "" {
				var payload messagePayload
				if err := json.Unmarshal(entry.Message, &payload); err == nil {
					for _, block := range payload.Content {
						if block.Type == "text" && block.Text != "" {
							firstUserMsg = block.Text
							break
						}
					}
				}
			}

			// Extract model from assistant messages
			if entry.Type == "assistant" && model == "" {
				var payload messagePayload
				if err := json.Unmarshal(entry.Message, &payload); err == nil {
					if payload.Model != "" {
						model = payload.Model
					}
				}
			}
		}
	}

	session.MessageCount = msgCount
	session.Model = model
	if !firstTimestamp.IsZero() {
		session.CreatedAt = firstTimestamp
	}
	if !lastTimestamp.IsZero() {
		session.UpdatedAt = lastTimestamp
	}

	// Title: truncated first user message
	if firstUserMsg != "" {
		title := strings.ReplaceAll(firstUserMsg, "\n", " ")
		if len(title) > 80 {
			title = title[:77] + "..."
		}
		session.Title = title
	} else {
		session.Title = "Untitled session"
	}

	return session
}

// entryToMessage converts a JSONL entry to a chat.Message
func entryToMessage(entry jsonlEntry) chat.Message {
	var payload messagePayload
	if err := json.Unmarshal(entry.Message, &payload); err != nil {
		return chat.Message{}
	}

	msgType := chat.MessageTypeUser
	if entry.Type == "assistant" || payload.Role == "assistant" {
		msgType = chat.MessageTypeAssistant
	}

	// Collect text content blocks
	var textParts []string
	var toolMessages []chat.Message

	for _, block := range payload.Content {
		switch block.Type {
		case "text":
			if block.Text != "" {
				textParts = append(textParts, block.Text)
			}
		case "tool_use":
			toolMessages = append(toolMessages, chat.Message{
				Type:   chat.MessageTypeTool,
				ToolID: block.Name,
				Status: "complete",
			})
		}
	}

	msg := chat.Message{
		Type:    msgType,
		Content: strings.Join(textParts, "\n"),
	}

	// If the message is only tool calls with no text, return first tool call
	if msg.Content == "" && len(toolMessages) > 0 {
		return toolMessages[0]
	}

	return msg
}
