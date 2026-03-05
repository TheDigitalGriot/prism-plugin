package agentbus

import (
	"testing"
	"time"
)

func TestEventSerializeRoundtrip(t *testing.T) {
	original := Event{
		Type:       EventTextDelta,
		Timestamp:  time.Now().Truncate(time.Millisecond),
		SessionID:  "session-123",
		Text:       "Hello, world!",
		InputTokens: 42,
	}

	data, err := original.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}

	decoded, err := FromJSON(data)
	if err != nil {
		t.Fatalf("FromJSON failed: %v", err)
	}

	if decoded.Type != original.Type {
		t.Errorf("Type mismatch: got %v, want %v", decoded.Type, original.Type)
	}
	if decoded.SessionID != original.SessionID {
		t.Errorf("SessionID mismatch: got %q, want %q", decoded.SessionID, original.SessionID)
	}
	if decoded.Text != original.Text {
		t.Errorf("Text mismatch: got %q, want %q", decoded.Text, original.Text)
	}
	if decoded.InputTokens != original.InputTokens {
		t.Errorf("InputTokens mismatch: got %d, want %d", decoded.InputTokens, original.InputTokens)
	}
}

func TestFromJSONInvalid(t *testing.T) {
	_, err := FromJSON([]byte("not json"))
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}
