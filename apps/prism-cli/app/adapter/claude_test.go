package adapter

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDecodeProjectPath_Windows(t *testing.T) {
	// This test validates path decoding logic regardless of runtime OS
	input := "c--Users-digit-Developer-prism-plugin"
	result := decodeProjectPath(input)
	// On any OS, it should produce a non-empty result
	if result == "" {
		t.Fatal("expected non-empty decoded path")
	}
}

func TestClaudeAdapter_Available(t *testing.T) {
	// Non-existent directory
	a := NewClaudeAdapter("/nonexistent/path/that/doesnt/exist")
	if a.Available() {
		t.Fatal("expected Available() to return false for non-existent dir")
	}

	// Existing directory
	tmpDir := t.TempDir()
	a2 := NewClaudeAdapter(tmpDir)
	if !a2.Available() {
		t.Fatal("expected Available() to return true for temp dir")
	}
}

func TestClaudeAdapter_ScanSessions_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()
	a := NewClaudeAdapter(tmpDir)
	sessions, err := a.ScanSessions()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 0 {
		t.Fatalf("expected 0 sessions, got %d", len(sessions))
	}
}

func TestClaudeAdapter_ScanSessions_WithJSONL(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a project directory
	projectDir := filepath.Join(tmpDir, "c--Users-digit-Developer-test")
	os.MkdirAll(projectDir, 0755)

	// Create a JSONL session file
	sessionFile := filepath.Join(projectDir, "test-session-id.jsonl")
	lines := []map[string]interface{}{
		{
			"type":      "user",
			"uuid":      "msg-1",
			"timestamp": "2026-02-19T10:00:00.000Z",
			"sessionId": "test-session-id",
			"message": map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": "Hello, help me with my code"},
				},
			},
		},
		{
			"type":      "assistant",
			"uuid":      "msg-2",
			"timestamp": "2026-02-19T10:00:05.000Z",
			"sessionId": "test-session-id",
			"message": map[string]interface{}{
				"role":  "assistant",
				"model": "claude-opus-4-5",
				"content": []map[string]interface{}{
					{"type": "text", "text": "Sure, I can help you with that!"},
				},
			},
		},
	}

	f, err := os.Create(sessionFile)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range lines {
		data, _ := json.Marshal(line)
		f.Write(data)
		f.Write([]byte("\n"))
	}
	f.Close()

	a := NewClaudeAdapter(tmpDir)
	sessions, err := a.ScanSessions()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}

	s := sessions[0]
	if s.ID != "test-session-id" {
		t.Errorf("expected ID 'test-session-id', got %q", s.ID)
	}
	if s.Title != "Hello, help me with my code" {
		t.Errorf("expected title 'Hello, help me with my code', got %q", s.Title)
	}
	if s.MessageCount != 2 {
		t.Errorf("expected 2 messages, got %d", s.MessageCount)
	}
	if s.Model != "claude-opus-4-5" {
		t.Errorf("expected model 'claude-opus-4-5', got %q", s.Model)
	}
	if s.Adapter != "claude" {
		t.Errorf("expected adapter 'claude', got %q", s.Adapter)
	}
}

func TestClaudeAdapter_LoadMessages(t *testing.T) {
	tmpDir := t.TempDir()
	sessionFile := filepath.Join(tmpDir, "session.jsonl")

	lines := []map[string]interface{}{
		{
			"type":      "queue-operation",
			"timestamp": "2026-02-19T10:00:00.000Z",
		},
		{
			"type":      "user",
			"uuid":      "msg-1",
			"timestamp": "2026-02-19T10:00:01.000Z",
			"message": map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": "What is Go?"},
				},
			},
		},
		{
			"type":      "assistant",
			"uuid":      "msg-2",
			"timestamp": "2026-02-19T10:00:05.000Z",
			"message": map[string]interface{}{
				"role":  "assistant",
				"model": "claude-opus-4-5",
				"content": []map[string]interface{}{
					{"type": "text", "text": "Go is a programming language."},
				},
			},
		},
	}

	f, _ := os.Create(sessionFile)
	for _, line := range lines {
		data, _ := json.Marshal(line)
		f.Write(data)
		f.Write([]byte("\n"))
	}
	f.Close()

	a := NewClaudeAdapter(tmpDir)
	msgs, err := a.LoadMessages(sessionFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
	if msgs[0].Type != "user" {
		t.Errorf("expected first message to be 'user', got %q", msgs[0].Type)
	}
	if msgs[0].Content != "What is Go?" {
		t.Errorf("unexpected first message content: %q", msgs[0].Content)
	}
	if msgs[1].Type != "assistant" {
		t.Errorf("expected second message to be 'assistant', got %q", msgs[1].Type)
	}
	if msgs[1].Content != "Go is a programming language." {
		t.Errorf("unexpected second message content: %q", msgs[1].Content)
	}
}

func TestClaudeAdapter_LoadMessages_MissingFile(t *testing.T) {
	a := NewClaudeAdapter(t.TempDir())
	_, err := a.LoadMessages("/nonexistent/file.jsonl")
	if err == nil {
		t.Fatal("expected error for missing file")
	}
}
