package adapter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/prism-plugin/prism-cli/app/chat"
)

// CursorAdapter scans Cursor editor conversation files from the Cursor storage directory.
type CursorAdapter struct {
	baseDir string // Resolved path to the Cursor conversations directory
}

// NewCursorAdapter creates a new Cursor adapter.
// If baseDir is empty, it auto-detects from the user's home directory.
func NewCursorAdapter(baseDir string) *CursorAdapter {
	if baseDir == "" {
		baseDir = defaultCursorDir()
	}
	return &CursorAdapter{baseDir: baseDir}
}

func (a *CursorAdapter) ID() string          { return "cursor" }
func (a *CursorAdapter) Name() string        { return "Cursor" }
func (a *CursorAdapter) SupportsWrite() bool { return false }

func (a *CursorAdapter) Available() bool {
	info, err := os.Stat(a.baseDir)
	return err == nil && info.IsDir()
}

// ScanSessions discovers all Cursor session files.
func (a *CursorAdapter) ScanSessions() ([]Session, error) {
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
		if !strings.HasSuffix(name, ".json") {
			continue
		}

		sessionID := strings.TrimSuffix(name, ".json")
		filePath := filepath.Join(a.baseDir, name)

		info, err := entry.Info()
		if err != nil {
			continue
		}

		session := scanCursorSessionMetadata(filePath, sessionID, info.ModTime())
		session.Adapter = "cursor"
		sessions = append(sessions, session)
	}

	// Sort by most recently updated.
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})

	return sessions, nil
}

// LoadMessages loads all user and assistant messages from a Cursor session file.
func (a *CursorAdapter) LoadMessages(sessionPath string) ([]chat.Message, error) {
	data, err := os.ReadFile(sessionPath)
	if err != nil {
		return nil, err
	}

	var session cursorSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}

	var messages []chat.Message
	for _, msg := range session.Messages {
		chatMsg := cursorMsgToChatMsg(msg)
		if chatMsg.Content != "" {
			messages = append(messages, chatMsg)
		}
	}

	return messages, nil
}

// ── Internal types ────────────────────────────────────────────────────────────

// cursorSession represents a Cursor conversation file (JSON format).
type cursorSession struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	CreatedAt int64           `json:"createdAt"` // Unix ms timestamp
	UpdatedAt int64           `json:"updatedAt"` // Unix ms timestamp
	Messages  []cursorMessage `json:"messages"`
}

// cursorMessage represents a single message in a Cursor session.
type cursorMessage struct {
	Role      string `json:"role"`    // "user" or "assistant"
	Content   string `json:"content"` // Message text
	Timestamp int64  `json:"timestamp"` // Unix ms (optional)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func defaultCursorDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(home, "AppData", "Roaming")
		}
		// Cursor stores data in AppData/Roaming/Cursor/User/workspaceStorage/<hash>/conversation/
		// For simplicity, we check ~/.cursor/conversations as a common alternative.
		candidates := []string{
			filepath.Join(appData, "Cursor", "conversations"),
			filepath.Join(home, ".cursor", "conversations"),
		}
		for _, c := range candidates {
			if info, err := os.Stat(c); err == nil && info.IsDir() {
				return c
			}
		}
		return filepath.Join(home, ".cursor", "conversations")

	case "darwin":
		candidates := []string{
			filepath.Join(home, "Library", "Application Support", "Cursor", "conversations"),
			filepath.Join(home, ".cursor", "conversations"),
		}
		for _, c := range candidates {
			if info, err := os.Stat(c); err == nil && info.IsDir() {
				return c
			}
		}
		return filepath.Join(home, ".cursor", "conversations")

	default:
		return filepath.Join(home, ".cursor", "conversations")
	}
}

// scanCursorSessionMetadata reads metadata from a Cursor session JSON file.
func scanCursorSessionMetadata(path, sessionID string, modTime time.Time) Session {
	session := Session{
		ID:        sessionID,
		Path:      path,
		UpdatedAt: modTime,
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return session
	}

	var cs cursorSession
	if err := json.Unmarshal(data, &cs); err != nil {
		// File may be malformed; return minimal metadata.
		session.Title = "Untitled session"
		return session
	}

	if cs.CreatedAt > 0 {
		session.CreatedAt = time.UnixMilli(cs.CreatedAt)
	}
	if cs.UpdatedAt > 0 {
		session.UpdatedAt = time.UnixMilli(cs.UpdatedAt)
	}

	session.MessageCount = len(cs.Messages)

	if cs.Title != "" {
		session.Title = cs.Title
	} else {
		// Derive title from first user message.
		for _, msg := range cs.Messages {
			if msg.Role == "user" && msg.Content != "" {
				title := strings.ReplaceAll(msg.Content, "\n", " ")
				if len(title) > 80 {
					title = title[:77] + "..."
				}
				session.Title = title
				break
			}
		}
		if session.Title == "" {
			session.Title = "Untitled session"
		}
	}

	return session
}

// cursorMsgToChatMsg converts a Cursor message to a chat.Message.
func cursorMsgToChatMsg(msg cursorMessage) chat.Message {
	switch msg.Role {
	case "user":
		return chat.Message{Type: chat.MessageTypeUser, Content: msg.Content}
	case "assistant":
		return chat.Message{Type: chat.MessageTypeAssistant, Content: msg.Content}
	default:
		return chat.Message{}
	}
}
