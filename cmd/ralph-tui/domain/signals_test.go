package domain

import "testing"

func TestParseSignal(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected SignalType
		content  string
	}{
		{
			name:     "complete signal",
			input:    "Some output\n<promise>COMPLETE</promise>\nMore output",
			expected: SignalComplete,
		},
		{
			name:     "continue signal",
			input:    "<ralph-continue>STORY_COMPLETE: STORY-001</ralph-continue>",
			expected: SignalContinue,
			content:  "STORY_COMPLETE: STORY-001",
		},
		{
			name:     "retry signal",
			input:    `<ralph-retry reason="QUALITY_GATE_FAILED">npm test failed</ralph-retry>`,
			expected: SignalRetry,
			content:  "npm test failed",
		},
		{
			name:     "blocked signal",
			input:    `<ralph-blocked reason="UNCLEAR">Need clarification</ralph-blocked>`,
			expected: SignalBlocked,
			content:  "Need clarification",
		},
		{
			name:     "error signal",
			input:    `<ralph-error reason="MERGE_CONFLICT">Cannot merge</ralph-error>`,
			expected: SignalError,
			content:  "Cannot merge",
		},
		{
			name:     "no signal",
			input:    "Just regular output without any signals",
			expected: SignalNone,
		},
		{
			name:     "multiline complete",
			input:    "Line 1\nLine 2\n<promise>COMPLETE</promise>\nLine 3",
			expected: SignalComplete,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			signal := ParseSignal(tc.input)
			if signal.Type != tc.expected {
				t.Errorf("expected signal type %v, got %v", tc.expected, signal.Type)
			}
			if tc.content != "" && signal.Content != tc.content {
				t.Errorf("expected content %q, got %q", tc.content, signal.Content)
			}
		})
	}
}

func TestParseStoryAnnouncement(t *testing.T) {
	input := `<ralph-story>
ID: STORY-003
Title: Add user authentication
Priority: 5
Files:
- src/auth/login.ts
- src/types/auth.ts
</ralph-story>`

	announcement := ParseStoryAnnouncement(input)
	if announcement == nil {
		t.Fatal("expected announcement, got nil")
	}

	if announcement.ID != "STORY-003" {
		t.Errorf("expected ID STORY-003, got %s", announcement.ID)
	}
	if announcement.Title != "Add user authentication" {
		t.Errorf("expected title 'Add user authentication', got %s", announcement.Title)
	}
	if announcement.Priority != "5" {
		t.Errorf("expected priority 5, got %s", announcement.Priority)
	}
	if len(announcement.Files) != 2 {
		t.Errorf("expected 2 files, got %d", len(announcement.Files))
	}
}

func TestExtractStoryID(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"STORY_COMPLETE: STORY-001", "STORY-001"},
		{"Completed STORY-123 successfully", "STORY-123"},
		{"No story here", ""},
	}

	for _, tc := range tests {
		result := ExtractStoryID(tc.input)
		if result != tc.expected {
			t.Errorf("ExtractStoryID(%q) = %q, expected %q", tc.input, result, tc.expected)
		}
	}
}
