package adapter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCodexAdapterUnavailable(t *testing.T) {
	a := NewCodexAdapter("/nonexistent/path/that/does/not/exist")
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

func TestCodexAdapterScanSessions(t *testing.T) {
	dir := t.TempDir()

	// Write a valid session JSONL file.
	sessionFile := filepath.Join(dir, "session-abc123.jsonl")
	lines := []codexEntry{
		{Role: "user", Content: json.RawMessage(`"Hello Codex!"`), Model: ""},
		{Role: "assistant", Content: json.RawMessage(`"Hi there!"`), Model: "gpt-4o"},
	}
	f, err := os.Create(sessionFile)
	if err != nil {
		t.Fatalf("failed to create test session file: %v", err)
	}
	enc := json.NewEncoder(f)
	for _, l := range lines {
		_ = enc.Encode(l)
	}
	f.Close()

	a := NewCodexAdapter(dir)
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
	if s.Adapter != "codex" {
		t.Errorf("expected adapter 'codex', got %q", s.Adapter)
	}
	if s.Title != "Hello Codex!" {
		t.Errorf("unexpected title: %q", s.Title)
	}
	if s.MessageCount != 2 {
		t.Errorf("expected 2 messages, got %d", s.MessageCount)
	}
}

func TestCodexAdapterLoadMessages(t *testing.T) {
	dir := t.TempDir()

	sessionFile := filepath.Join(dir, "test.jsonl")
	lines := []codexEntry{
		{Role: "user", Content: json.RawMessage(`"What is 2+2?"`)},
		{Role: "assistant", Content: json.RawMessage(`"It is 4."`)},
	}
	f, err := os.Create(sessionFile)
	if err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}
	enc := json.NewEncoder(f)
	for _, l := range lines {
		_ = enc.Encode(l)
	}
	f.Close()

	a := NewCodexAdapter(dir)
	msgs, err := a.LoadMessages(sessionFile)
	if err != nil {
		t.Fatalf("LoadMessages failed: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
	if msgs[0].Content != "What is 2+2?" {
		t.Errorf("unexpected user message: %q", msgs[0].Content)
	}
	if msgs[1].Content != "It is 4." {
		t.Errorf("unexpected assistant message: %q", msgs[1].Content)
	}
}

func TestCodexAdapterSupportsWrite(t *testing.T) {
	a := NewCodexAdapter("")
	if a.SupportsWrite() {
		t.Error("Codex adapter should not support write")
	}
}

// Prevent unused import error
var _ = time.Now
