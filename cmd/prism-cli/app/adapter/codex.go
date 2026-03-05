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

// CodexAdapter scans OpenAI Codex CLI conversation files from ~/.codex/sessions/
type CodexAdapter struct {
	baseDir string // Resolved path to ~/.codex/sessions/
}

// NewCodexAdapter creates a new Codex CLI adapter.
// If baseDir is empty, it auto-detects from the user's home directory.
func NewCodexAdapter(baseDir string) *CodexAdapter {
	if baseDir == "" {
		baseDir = defaultCodexDir()
	}
	return &CodexAdapter{baseDir: baseDir}
}

func (a *CodexAdapter) ID() string          { return "codex" }
func (a *CodexAdapter) Name() string        { return "Codex" }
func (a *CodexAdapter) SupportsWrite() bool { return false }

func (a *CodexAdapter) Available() bool {
	info, err := os.Stat(a.baseDir)
	return err == nil && info.IsDir()
}

// ScanSessions discovers all Codex session files.
func (a *CodexAdapter) ScanSessions() ([]Session, error) {
	if !a.Available() {
		return nil, nil
	}

	entries, err := os.ReadDir(a.baseDir)
	if err != nil {
		return nil, err
	}

	var sessions []Session

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		// Codex sessions are stored as .jsonl or .json files.
		if !strings.HasSuffix(name, ".jsonl") && !strings.HasSuffix(name, ".json") {
			continue
		}

		sessionID := strings.TrimSuffix(strings.TrimSuffix(name, ".json"), ".jsonl")
		filePath := filepath.Join(a.baseDir, name)

		info, err := entry.Info()
		if err != nil {
			continue
		}

		session := scanCodexSessionMetadata(filePath, sessionID, info.ModTime())
		session.Adapter = "codex"
		sessions = append(sessions, session)
	}

	// Sort by most recently updated.
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})

	return sessions, nil
}

// LoadMessages loads all user and assistant messages from a Codex session file.
func (a *CodexAdapter) LoadMessages(sessionPath string) ([]chat.Message, error) {
	f, err := os.Open(sessionPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var messages []chat.Message
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry codexEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		msg := codexEntryToMessage(entry)
		if msg.Content != "" {
			messages = append(messages, msg)
		}
	}

	return messages, scanner.Err()
}

// ── Internal types ────────────────────────────────────────────────────────────

// codexEntry represents a single line in a Codex JSONL file.
// Codex CLI uses OpenAI message format.
type codexEntry struct {
	Role      string           `json:"role"`      // "user", "assistant", "system", "tool"
	Content   json.RawMessage  `json:"content"`   // string or array of content blocks
	Timestamp string           `json:"timestamp"` // ISO 8601 (if present)
	Model     string           `json:"model"`     // Model used (if present)
}

// codexContentBlock represents a block in codex content array.
type codexContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func defaultCodexDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	if runtime.GOOS == "windows" {
		// Try AppData/Local/codex/sessions first, then ~/.codex/sessions
		appData := os.Getenv("APPDATA")
		if appData != "" {
			candidate := filepath.Join(appData, "codex", "sessions")
			if info, err := os.Stat(candidate); err == nil && info.IsDir() {
				return candidate
			}
		}
	}
	return filepath.Join(home, ".codex", "sessions")
}

// scanCodexSessionMetadata reads metadata from a Codex session file.
func scanCodexSessionMetadata(path, sessionID string, modTime time.Time) Session {
	session := Session{
		ID:        sessionID,
		Path:      path,
		UpdatedAt: modTime,
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
	var model string

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry codexEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		if entry.Role == "user" || entry.Role == "assistant" {
			msgCount++

			if entry.Role == "user" && firstUserMsg == "" {
				firstUserMsg = extractCodexText(entry.Content)
			}
			if entry.Role == "assistant" && model == "" && entry.Model != "" {
				model = entry.Model
			}
		}
	}

	session.MessageCount = msgCount
	session.Model = model

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

// extractCodexText extracts plain text from a Codex content field (string or array).
func extractCodexText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	// Try as plain string first.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}

	// Try as array of content blocks.
	var blocks []codexContentBlock
	if err := json.Unmarshal(raw, &blocks); err == nil {
		var parts []string
		for _, b := range blocks {
			if b.Type == "text" && b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
		return strings.Join(parts, "\n")
	}

	return ""
}

// codexEntryToMessage converts a Codex entry to a chat.Message.
func codexEntryToMessage(entry codexEntry) chat.Message {
	msgType := chat.MessageTypeUser
	if entry.Role == "assistant" {
		msgType = chat.MessageTypeAssistant
	} else if entry.Role != "user" {
		// Skip system/tool messages.
		return chat.Message{}
	}

	return chat.Message{
		Type:    msgType,
		Content: extractCodexText(entry.Content),
	}
}
