package adapter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestCursorAdapterUnavailable(t *testing.T) {
	a := NewCursorAdapter("/nonexistent/path/that/does/not/exist")
	if a.Available() {
		t.Error("expected Available() to return false for missing directory")
	}
	sessions, err := a.ScanSessions()
	if err != nil {
		t.Errorf("ScanSessions should return nil error when unavailable, got: %v", err)
	}
	if len(sessions) != 0 {
		t.Errorf("ScanSessions should return 0 sessions when unavailable, got %d", len(sessions))
	}
}

func TestCursorAdapterScanSessions(t *testing.T) {
	dir := t.TempDir()

	// Write a valid Cursor session JSON file.
	session := cursorSession{
		ID:        "cursor-session-1",
		Title:     "Fix the login bug",
		CreatedAt: 1704067200000,
		UpdatedAt: 1704067200000,
		Messages: []cursorMessage{
			{Role: "user", Content: "Please help me fix the login bug."},
			{Role: "assistant", Content: "Sure! Let me look at the code."},
		},
	}
	data, err := json.Marshal(session)
	if err != nil {
		t.Fatalf("failed to marshal session: %v", err)
	}
	sessionFile := filepath.Join(dir, "cursor-session-1.json")
	if err := os.WriteFile(sessionFile, data, 0644); err != nil {
		t.Fatalf("failed to write session file: %v", err)
	}

	a := NewCursorAdapter(dir)
	if !a.Available() {
		t.Error("expected Available() to return true for valid directory")
	}

	sessions, err := a.ScanSessions()
	if err != nil {
		t.Fatalf("ScanSessions failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	s := sessions[0]
	if s.Adapter != "cursor" {
		t.Errorf("expected adapter 'cursor', got %q", s.Adapter)
	}
	if s.Title != "Fix the login bug" {
		t.Errorf("unexpected title: %q", s.Title)
	}
	if s.MessageCount != 2 {
		t.Errorf("expected 2 messages, got %d", s.MessageCount)
	}
}

func TestCursorAdapterLoadMessages(t *testing.T) {
	dir := t.TempDir()

	session := cursorSession{
		ID: "test-session",
		Messages: []cursorMessage{
			{Role: "user", Content: "What is Go?"},
			{Role: "assistant", Content: "Go is a compiled language."},
			{Role: "system", Content: "should be skipped"},
		},
	}
	data, _ := json.Marshal(session)
	sessionFile := filepath.Join(dir, "test-session.json")
	_ = os.WriteFile(sessionFile, data, 0644)

	a := NewCursorAdapter(dir)
	msgs, err := a.LoadMessages(sessionFile)
	if err != nil {
		t.Fatalf("LoadMessages failed: %v", err)
	}
	// System message should be filtered out.
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages (system filtered), got %d", len(msgs))
	}
	if msgs[0].Content != "What is Go?" {
		t.Errorf("unexpected user message: %q", msgs[0].Content)
	}
}

func TestCursorAdapterTitleFromFirstMessage(t *testing.T) {
	dir := t.TempDir()

	session := cursorSession{
		ID: "no-title",
		Messages: []cursorMessage{
			{Role: "user", Content: "Hello, this is a long first message that should become the title"},
			{Role: "assistant", Content: "Hello!"},
		},
	}
	data, _ := json.Marshal(session)
	sessionFile := filepath.Join(dir, "no-title.json")
	_ = os.WriteFile(sessionFile, data, 0644)

	a := NewCursorAdapter(dir)
	sessions, _ := a.ScanSessions()
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].Title == "" || sessions[0].Title == "Untitled session" {
		t.Errorf("expected title from first message, got %q", sessions[0].Title)
	}
}

func TestCursorAdapterSupportsWrite(t *testing.T) {
	a := NewCursorAdapter("")
	if a.SupportsWrite() {
		t.Error("Cursor adapter should not support write")
	}
}
