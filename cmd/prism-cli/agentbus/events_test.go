package agentbus

import (
	"encoding/json"
	"testing"
	"time"
)

func TestEventTypesSerialize(t *testing.T) {
	// Verify all major event types serialize without error.
	events := []Event{
		{Type: EventTextDelta, Text: "hello"},
		{Type: EventToolCallStart, ToolName: "Bash", ToolInput: json.RawMessage(`{"command":"ls"}`)},
		{Type: EventToolCallComplete, ToolID: "abc", ToolStatus: "complete"},
		{Type: EventPermissionRequired, Permission: &PermissionRequest{ID: "perm-1", ToolName: "Bash"}},
		{Type: EventPermissionResponse, PermResp: &PermissionResponse{RequestID: "perm-1", Action: "allow"}},
		{Type: EventMessageComplete, Text: "done"},
		{Type: EventProcessStarted, SessionID: "s-1"},
		{Type: EventProcessExited, ExitCode: 0, SessionID: "s-1"},
		{Type: EventCostUpdate, InputTokens: 100, OutputTokens: 50, Model: "claude-opus-4-6"},
		{Type: EventPhaseChanged, Phase: "thinking"},
		{Type: EventStreamError, Error: nil},
		{Type: EventSessionCreated, SessionID: "s-2"},
	}

	for _, e := range events {
		data, err := e.ToJSON()
		if err != nil {
			t.Errorf("event type %d ToJSON error: %v", e.Type, err)
			continue
		}
		decoded, err := FromJSON(data)
		if err != nil {
			t.Errorf("event type %d FromJSON error: %v", e.Type, err)
			continue
		}
		if decoded.Type != e.Type {
			t.Errorf("event type %d roundtrip mismatch", e.Type)
		}
	}
}

func TestEventTimestampPreserved(t *testing.T) {
	ts := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	e := Event{Type: EventTextDelta, Timestamp: ts}
	data, _ := e.ToJSON()
	decoded, _ := FromJSON(data)
	if !decoded.Timestamp.Equal(ts) {
		t.Errorf("timestamp not preserved: got %v, want %v", decoded.Timestamp, ts)
	}
}
