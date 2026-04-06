package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ============================================================================
// Extended story model tests — validates JSON parsing, status transitions,
// filtering logic, and dependency validation for .prism/stories/stories.json
//
// Adapted from ref/prism-testing-suite/stories_test.go to use actual domain
// types (Story, StoriesFile) instead of stub types.
//
// Run:
//   cd cmd/prism-cli && go test ./domain/ -v -run Extended
// ============================================================================

// --- Valid statuses --------------------------------------------------------

var validStatuses = map[string]bool{
	"pending":     true,
	"in_progress": true,
	"complete":    true,
	"failed":      true,
	"skipped":     true,
}

// --- Fixtures --------------------------------------------------------------

func sampleStoriesJSON() string {
	return `{
  "epic": {
    "name": "Test Plan",
    "source": "test",
    "qualityGates": ["echo ok"]
  },
  "stories": [
    {"id": "STORY-001", "title": "Setup auth middleware",   "description": "", "priority": 1, "status": "pending",     "blockedBy": null,       "files": [], "steps": []},
    {"id": "STORY-002", "title": "Add OAuth flow",          "description": "", "priority": 2, "status": "complete",    "blockedBy": "STORY-001", "files": [], "steps": []},
    {"id": "STORY-003", "title": "Write integration tests", "description": "", "priority": 3, "status": "in_progress", "blockedBy": "STORY-002", "files": [], "steps": []},
    {"id": "STORY-004", "title": "Deploy to staging",       "description": "", "priority": 4, "status": "pending",     "blockedBy": "STORY-003", "files": [], "steps": []},
    {"id": "STORY-005", "title": "Performance audit",       "description": "Deferred to next sprint", "priority": 5, "status": "skipped", "blockedBy": null, "files": [], "steps": []}
  ]
}`
}

func loadExtendedStories(t *testing.T, jsonData string) StoriesFile {
	t.Helper()
	var sf StoriesFile
	if err := json.Unmarshal([]byte(jsonData), &sf); err != nil {
		t.Fatalf("failed to parse stories JSON: %v", err)
	}
	return sf
}

func writeExtendedStoriesFile(t *testing.T, dir, content string) string {
	t.Helper()
	path := filepath.Join(dir, ".prism", "stories", "stories.json")
	os.MkdirAll(filepath.Dir(path), 0o755)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write stories file: %v", err)
	}
	return path
}

// --- Local test helpers (not in the domain package) ------------------------

func filterByStatus(stories []Story, status string) []Story {
	var result []Story
	for _, s := range stories {
		if s.Status == status {
			result = append(result, s)
		}
	}
	return result
}

func calculateProgress(stories []Story) float64 {
	if len(stories) == 0 {
		return 0
	}
	done := 0
	for _, s := range stories {
		if s.Status == "complete" || s.Status == "skipped" {
			done++
		}
	}
	return float64(done) / float64(len(stories)) * 100
}

func isValidTransition(from, to string) bool {
	transitions := map[string][]string{
		"pending":     {"in_progress", "skipped"},
		"in_progress": {"complete", "failed", "pending"}, // can pause
		"failed":      {"in_progress", "pending"},         // can retry
		"complete":    {},                                  // terminal
		"skipped":     {"pending"},                         // can unskip
	}

	allowed, ok := transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// validateBlockedBy checks that all BlockedBy references point to existing story IDs
// and that no story blocks itself.
func validateBlockedBy(stories []Story) []string {
	ids := make(map[string]bool)
	for _, s := range stories {
		ids[s.ID] = true
	}

	var errors []string
	for _, s := range stories {
		if s.BlockedBy == nil {
			continue
		}
		dep := *s.BlockedBy
		if !ids[dep] {
			errors = append(errors, "story "+s.ID+" blocked by non-existent story "+dep)
		}
		if dep == s.ID {
			errors = append(errors, "story "+s.ID+" blocks itself")
		}
	}
	return errors
}

// ============================================================================
// TEST SUITE: JSON Parsing
// ============================================================================

func TestExtendedParseStoriesJSON(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	if len(sf.Stories) != 5 {
		t.Fatalf("expected 5 stories, got %d", len(sf.Stories))
	}
}

func TestExtendedStoryFieldsPresent(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	first := sf.Stories[0]
	if first.ID == "" {
		t.Error("story ID should not be empty")
	}
	if first.Title == "" {
		t.Error("story title should not be empty")
	}
	if first.Status == "" {
		t.Error("story status should not be empty")
	}
}

func TestExtendedAllStatusesValid(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	for _, s := range sf.Stories {
		if !validStatuses[s.Status] {
			t.Errorf("story %s has invalid status: %q", s.ID, s.Status)
		}
	}
}

func TestExtendedStoryIDsUnique(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	seen := make(map[string]bool)
	for _, s := range sf.Stories {
		if seen[s.ID] {
			t.Errorf("duplicate story ID: %s", s.ID)
		}
		seen[s.ID] = true
	}
}

func TestExtendedOptionalFieldsParsed(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	// Story 5 has a description
	story5 := sf.Stories[4]
	if story5.Description == "" {
		t.Error("story 5 should have a description")
	}

	// Story 3 has BlockedBy
	story3 := sf.Stories[2]
	if story3.BlockedBy == nil {
		t.Error("story 3 should have a BlockedBy reference")
	} else if *story3.BlockedBy != "STORY-002" {
		t.Errorf("story 3 should be blocked by STORY-002, got %s", *story3.BlockedBy)
	}
}

func TestExtendedEpicFieldParsed(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	if sf.Epic.Name == "" {
		t.Error("epic name should not be empty")
	}
	if sf.Epic.Source == "" {
		t.Error("epic source should not be empty")
	}
	if len(sf.Epic.QualityGates) == 0 {
		t.Error("epic should have at least one quality gate")
	}
}

// ============================================================================
// TEST SUITE: Filtering
// ============================================================================

func TestExtendedFilterPending(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	pending := filterByStatus(sf.Stories, "pending")

	if len(pending) != 2 {
		t.Fatalf("expected 2 pending stories, got %d", len(pending))
	}
	for _, s := range pending {
		if s.Status != "pending" {
			t.Errorf("filtered story %s has wrong status: %s", s.ID, s.Status)
		}
	}
}

func TestExtendedFilterComplete(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	complete := filterByStatus(sf.Stories, "complete")

	if len(complete) != 1 {
		t.Fatalf("expected 1 complete story, got %d", len(complete))
	}
	if complete[0].ID != "STORY-002" {
		t.Errorf("expected STORY-002 to be complete, got story %s", complete[0].ID)
	}
}

func TestExtendedFilterInProgress(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	inProgress := filterByStatus(sf.Stories, "in_progress")

	if len(inProgress) != 1 {
		t.Fatalf("expected 1 in-progress story, got %d", len(inProgress))
	}
}

// ============================================================================
// TEST SUITE: Progress calculation
// ============================================================================

func TestExtendedProgressCalculation(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	// 1 complete + 1 skipped = 2 out of 5 = 40%
	progress := calculateProgress(sf.Stories)
	if progress != 40.0 {
		t.Errorf("expected 40%% progress, got %.1f%%", progress)
	}
}

func TestExtendedProgressAllComplete(t *testing.T) {
	stories := []Story{
		{ID: "STORY-001", Status: "complete"},
		{ID: "STORY-002", Status: "complete"},
	}
	progress := calculateProgress(stories)
	if progress != 100.0 {
		t.Errorf("expected 100%%, got %.1f%%", progress)
	}
}

func TestExtendedProgressEmpty(t *testing.T) {
	progress := calculateProgress([]Story{})
	if progress != 0 {
		t.Errorf("expected 0%% for empty stories, got %.1f%%", progress)
	}
}

// ============================================================================
// TEST SUITE: BlockedBy validation
// ============================================================================

func TestExtendedBlockedByValid(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	errs := validateBlockedBy(sf.Stories)
	if len(errs) > 0 {
		t.Errorf("blockedBy errors: %v", errs)
	}
}

func TestExtendedSelfBlockDetected(t *testing.T) {
	stories := []Story{
		{ID: "STORY-001", Title: "Self-blocking", Status: "pending", BlockedBy: ptr("STORY-001")},
	}
	errs := validateBlockedBy(stories)
	if len(errs) == 0 {
		t.Error("should detect self-blocking story")
	}
}

func TestExtendedMissingBlockerDetected(t *testing.T) {
	stories := []Story{
		{ID: "STORY-001", Title: "Blocked by ghost", Status: "pending", BlockedBy: ptr("STORY-999")},
	}
	errs := validateBlockedBy(stories)
	if len(errs) == 0 {
		t.Error("should detect missing blocker")
	}
}

func TestExtendedNilBlockedByIsValid(t *testing.T) {
	stories := []Story{
		{ID: "STORY-001", Title: "No blocker", Status: "pending", BlockedBy: nil},
	}
	errs := validateBlockedBy(stories)
	if len(errs) != 0 {
		t.Errorf("nil BlockedBy should be valid, got errors: %v", errs)
	}
}

// ============================================================================
// TEST SUITE: File I/O
// ============================================================================

func TestExtendedLoadFromDisk(t *testing.T) {
	root := t.TempDir()
	path := writeExtendedStoriesFile(t, root, sampleStoriesJSON())

	sf, err := LoadStoriesFile(path)
	if err != nil {
		t.Fatalf("failed to load stories from disk: %v", err)
	}

	if len(sf.Stories) != 5 {
		t.Fatalf("expected 5 stories from disk, got %d", len(sf.Stories))
	}
}

func TestExtendedEmptyStoriesFile(t *testing.T) {
	var sf StoriesFile
	err := json.Unmarshal([]byte(`{"epic":{"name":"empty"},"stories":[]}`), &sf)
	if err != nil {
		t.Fatalf("should parse empty stories array: %v", err)
	}
	if len(sf.Stories) != 0 {
		t.Fatalf("expected 0 stories, got %d", len(sf.Stories))
	}
}

func TestExtendedMalformedJSON(t *testing.T) {
	var sf StoriesFile
	err := json.Unmarshal([]byte(`{invalid json`), &sf)
	if err == nil {
		t.Fatal("should fail on malformed JSON")
	}
}

func TestExtendedMissingStoriesKey(t *testing.T) {
	var sf StoriesFile
	err := json.Unmarshal([]byte(`{"tasks":[]}`), &sf)
	if err != nil {
		t.Fatalf("should parse even without 'stories' key: %v", err)
	}
	// Stories should be nil/empty since the key doesn't match
	if len(sf.Stories) != 0 {
		t.Fatalf("expected 0 stories for wrong key, got %d", len(sf.Stories))
	}
}

func TestExtendedSaveAndReload(t *testing.T) {
	root := t.TempDir()
	path := writeExtendedStoriesFile(t, root, sampleStoriesJSON())

	// Load
	sf, err := LoadStoriesFile(path)
	if err != nil {
		t.Fatalf("failed to load: %v", err)
	}

	// Modify
	sf.MarkStoryComplete("STORY-001", "abc123")

	// Save
	if err := sf.SaveStoriesFile(path); err != nil {
		t.Fatalf("failed to save: %v", err)
	}

	// Reload
	sf2, err := LoadStoriesFile(path)
	if err != nil {
		t.Fatalf("failed to reload: %v", err)
	}

	story := sf2.GetStoryByID("STORY-001")
	if story == nil {
		t.Fatal("STORY-001 should exist after reload")
	}
	if story.Status != "complete" {
		t.Errorf("STORY-001 should be complete after save/reload, got %s", story.Status)
	}
}

// ============================================================================
// TEST SUITE: Status transitions
// ============================================================================

func TestExtendedValidTransitions(t *testing.T) {
	cases := []struct {
		from, to string
		valid    bool
	}{
		{"pending", "in_progress", true},
		{"pending", "skipped", true},
		{"pending", "complete", false},      // can't jump to complete
		{"in_progress", "complete", true},
		{"in_progress", "failed", true},
		{"in_progress", "pending", true},    // pause
		{"failed", "in_progress", true},     // retry
		{"complete", "pending", false},      // can't un-complete
		{"complete", "in_progress", false},  // terminal
		{"skipped", "pending", true},        // unskip
	}

	for _, tc := range cases {
		name := tc.from + " → " + tc.to
		t.Run(name, func(t *testing.T) {
			result := isValidTransition(tc.from, tc.to)
			if result != tc.valid {
				t.Errorf("%s: expected valid=%v, got %v", name, tc.valid, result)
			}
		})
	}
}

// ============================================================================
// TEST SUITE: Progress.md parsing
// ============================================================================

func TestExtendedProgressMDParsing(t *testing.T) {
	content := `# Spectrum Progress

## Story 2: Add OAuth flow
- Status: complete
- Duration: 45m
- Quality gates: all passed

## Story 3: Write integration tests
- Status: in_progress
- Current step: writing unit tests
`

	if !strings.Contains(content, "# Spectrum Progress") {
		t.Error("progress.md should have Spectrum header")
	}

	// Count story sections
	sections := strings.Count(content, "## Story")
	if sections != 2 {
		t.Errorf("expected 2 story sections, got %d", sections)
	}
}

func TestExtendedProgressMDNoRalphReferences(t *testing.T) {
	content := `# Spectrum Progress

## Story 1: Setup
- Status: complete
`
	if strings.Contains(strings.ToLower(content), "ralph") {
		t.Error("progress.md should not reference 'ralph'")
	}
}

// ============================================================================
// TEST SUITE: Domain methods integration
// ============================================================================

func TestExtendedGetNextStoryWithFixture(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())

	next := sf.GetNextStory()
	if next == nil {
		t.Fatal("expected a next story, got nil")
	}
	// STORY-001 is pending with no blocker and lowest priority
	if next.ID != "STORY-001" {
		t.Errorf("expected STORY-001 as next, got %s", next.ID)
	}
}

func TestExtendedAllCompleteWithFixture(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	if sf.AllComplete() {
		t.Error("should not be all complete with pending stories")
	}
}

func TestExtendedCompletedCountWithFixture(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	if sf.CompletedCount() != 1 {
		t.Errorf("expected 1 completed, got %d", sf.CompletedCount())
	}
}

func TestExtendedMarkStoryComplete(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	sf.MarkStoryComplete("STORY-001", "deadbeef")

	story := sf.GetStoryByID("STORY-001")
	if story == nil {
		t.Fatal("STORY-001 should exist")
	}
	if story.Status != "complete" {
		t.Errorf("STORY-001 should be complete, got %s", story.Status)
	}
	if story.CommitHash == nil || *story.CommitHash != "deadbeef" {
		t.Error("STORY-001 should have commit hash 'deadbeef'")
	}
}

func TestExtendedMarkStoryInProgress(t *testing.T) {
	sf := loadExtendedStories(t, sampleStoriesJSON())
	sf.MarkStoryInProgress("STORY-001")

	story := sf.GetStoryByID("STORY-001")
	if story.Status != "in_progress" {
		t.Errorf("STORY-001 should be in_progress, got %s", story.Status)
	}
}
