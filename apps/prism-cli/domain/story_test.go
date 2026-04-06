package domain

import "testing"

func TestStoryIsBlocked(t *testing.T) {
	stories := []Story{
		{ID: "STORY-001", Status: "complete"},
		{ID: "STORY-002", Status: "pending", BlockedBy: ptr("STORY-001")},
		{ID: "STORY-003", Status: "pending", BlockedBy: ptr("STORY-002")},
		{ID: "STORY-004", Status: "pending", BlockedBy: nil},
	}

	tests := []struct {
		storyID  string
		expected bool
	}{
		{"STORY-001", false}, // Complete, not blocked
		{"STORY-002", false}, // Blocked by STORY-001, but 001 is complete
		{"STORY-003", true},  // Blocked by STORY-002, which is pending
		{"STORY-004", false}, // No blocker
	}

	for _, tc := range tests {
		for _, s := range stories {
			if s.ID == tc.storyID {
				result := s.IsBlocked(stories)
				if result != tc.expected {
					t.Errorf("%s.IsBlocked() = %v, expected %v", tc.storyID, result, tc.expected)
				}
				break
			}
		}
	}
}

func TestGetNextStory(t *testing.T) {
	sf := &StoriesFile{
		Stories: []Story{
			{ID: "STORY-001", Priority: 1, Status: "complete"},
			{ID: "STORY-002", Priority: 2, Status: "pending", BlockedBy: ptr("STORY-001")},
			{ID: "STORY-003", Priority: 3, Status: "pending", BlockedBy: ptr("STORY-002")},
			{ID: "STORY-004", Priority: 10, Status: "pending"},
		},
	}

	next := sf.GetNextStory()
	if next == nil {
		t.Fatal("expected a story, got nil")
	}

	// STORY-002 should be next (lowest priority among non-blocked)
	if next.ID != "STORY-002" {
		t.Errorf("expected STORY-002, got %s", next.ID)
	}
}

func TestAllComplete(t *testing.T) {
	sfIncomplete := &StoriesFile{
		Stories: []Story{
			{ID: "STORY-001", Status: "complete"},
			{ID: "STORY-002", Status: "pending"},
		},
	}

	if sfIncomplete.AllComplete() {
		t.Error("expected AllComplete() = false for incomplete stories")
	}

	sfComplete := &StoriesFile{
		Stories: []Story{
			{ID: "STORY-001", Status: "complete"},
			{ID: "STORY-002", Status: "complete"},
		},
	}

	if !sfComplete.AllComplete() {
		t.Error("expected AllComplete() = true for complete stories")
	}
}

func TestCompletedCount(t *testing.T) {
	sf := &StoriesFile{
		Stories: []Story{
			{ID: "STORY-001", Status: "complete"},
			{ID: "STORY-002", Status: "complete"},
			{ID: "STORY-003", Status: "pending"},
			{ID: "STORY-004", Status: "in_progress"},
		},
	}

	if sf.CompletedCount() != 2 {
		t.Errorf("expected CompletedCount() = 2, got %d", sf.CompletedCount())
	}
}

func ptr(s string) *string {
	return &s
}
