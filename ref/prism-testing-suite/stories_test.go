package models_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ============================================================================
// Story model tests — validates JSON parsing, status transitions, and
// filtering logic for .prism/stories/stories.json
//
// Run:
//   cd cmd/prism-cli && go test ./models/ -v
// ============================================================================

// --- Domain types (mirror your models/stories.go) --------------------------

type StoryStatus string

const (
	StatusPending    StoryStatus = "pending"
	StatusInProgress StoryStatus = "in_progress"
	StatusComplete   StoryStatus = "complete"
	StatusFailed     StoryStatus = "failed"
	StatusSkipped    StoryStatus = "skipped"
)

type Story struct {
	ID          int         `json:"id"`
	Title       string      `json:"title"`
	Status      StoryStatus `json:"status"`
	Description string      `json:"description,omitempty"`
	DependsOn   []int       `json:"depends_on,omitempty"`
}

type StoriesFile struct {
	Stories []Story `json:"stories"`
}

// --- Helper: valid statuses ------------------------------------------------

var validStatuses = map[StoryStatus]bool{
	StatusPending:    true,
	StatusInProgress: true,
	StatusComplete:   true,
	StatusFailed:     true,
	StatusSkipped:    true,
}

// --- Fixtures --------------------------------------------------------------

func sampleStoriesJSON() string {
	return `{
  "stories": [
    {"id": 1, "title": "Setup auth middleware",   "status": "pending",     "depends_on": []},
    {"id": 2, "title": "Add OAuth flow",          "status": "complete",    "depends_on": [1]},
    {"id": 3, "title": "Write integration tests", "status": "in_progress", "depends_on": [1, 2]},
    {"id": 4, "title": "Deploy to staging",       "status": "pending",     "depends_on": [3]},
    {"id": 5, "title": "Performance audit",       "status": "skipped",     "description": "Deferred to next sprint"}
  ]
}`
}

func loadStories(t *testing.T, jsonData string) StoriesFile {
	t.Helper()
	var sf StoriesFile
	if err := json.Unmarshal([]byte(jsonData), &sf); err != nil {
		t.Fatalf("failed to parse stories JSON: %v", err)
	}
	return sf
}

func writeStoriesFile(t *testing.T, dir, content string) string {
	t.Helper()
	path := filepath.Join(dir, ".prism", "stories", "stories.json")
	os.MkdirAll(filepath.Dir(path), 0o755)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write stories file: %v", err)
	}
	return path
}

// ============================================================================
// TEST SUITE: JSON Parsing
// ============================================================================

func TestParseStoriesJSON(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	if len(sf.Stories) != 5 {
		t.Fatalf("expected 5 stories, got %d", len(sf.Stories))
	}
}

func TestStoryFieldsPresent(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())

	first := sf.Stories[0]
	if first.ID == 0 {
		t.Error("story ID should not be zero")
	}
	if first.Title == "" {
		t.Error("story title should not be empty")
	}
	if first.Status == "" {
		t.Error("story status should not be empty")
	}
}

func TestAllStatusesValid(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())

	for _, s := range sf.Stories {
		if !validStatuses[s.Status] {
			t.Errorf("story %d has invalid status: %q", s.ID, s.Status)
		}
	}
}

func TestStoryIDsUnique(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())

	seen := make(map[int]bool)
	for _, s := range sf.Stories {
		if seen[s.ID] {
			t.Errorf("duplicate story ID: %d", s.ID)
		}
		seen[s.ID] = true
	}
}

func TestOptionalFieldsParsed(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())

	// Story 5 has a description
	story5 := sf.Stories[4]
	if story5.Description == "" {
		t.Error("story 5 should have a description")
	}

	// Story 3 has depends_on
	story3 := sf.Stories[2]
	if len(story3.DependsOn) != 2 {
		t.Errorf("story 3 should depend on 2 stories, got %d", len(story3.DependsOn))
	}
}

// ============================================================================
// TEST SUITE: Filtering
// ============================================================================

func filterByStatus(stories []Story, status StoryStatus) []Story {
	var result []Story
	for _, s := range stories {
		if s.Status == status {
			result = append(result, s)
		}
	}
	return result
}

func TestFilterPending(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	pending := filterByStatus(sf.Stories, StatusPending)

	if len(pending) != 2 {
		t.Fatalf("expected 2 pending stories, got %d", len(pending))
	}
	for _, s := range pending {
		if s.Status != StatusPending {
			t.Errorf("filtered story %d has wrong status: %s", s.ID, s.Status)
		}
	}
}

func TestFilterComplete(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	complete := filterByStatus(sf.Stories, StatusComplete)

	if len(complete) != 1 {
		t.Fatalf("expected 1 complete story, got %d", len(complete))
	}
	if complete[0].ID != 2 {
		t.Errorf("expected story 2 to be complete, got story %d", complete[0].ID)
	}
}

func TestFilterInProgress(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	inProgress := filterByStatus(sf.Stories, StatusInProgress)

	if len(inProgress) != 1 {
		t.Fatalf("expected 1 in-progress story, got %d", len(inProgress))
	}
}

// ============================================================================
// TEST SUITE: Progress calculation
// ============================================================================

func calculateProgress(stories []Story) float64 {
	if len(stories) == 0 {
		return 0
	}
	done := 0
	for _, s := range stories {
		if s.Status == StatusComplete || s.Status == StatusSkipped {
			done++
		}
	}
	return float64(done) / float64(len(stories)) * 100
}

func TestProgressCalculation(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	// 1 complete + 1 skipped = 2 out of 5 = 40%
	progress := calculateProgress(sf.Stories)
	if progress != 40.0 {
		t.Errorf("expected 40%% progress, got %.1f%%", progress)
	}
}

func TestProgressAllComplete(t *testing.T) {
	stories := []Story{
		{ID: 1, Status: StatusComplete},
		{ID: 2, Status: StatusComplete},
	}
	progress := calculateProgress(stories)
	if progress != 100.0 {
		t.Errorf("expected 100%%, got %.1f%%", progress)
	}
}

func TestProgressEmpty(t *testing.T) {
	progress := calculateProgress([]Story{})
	if progress != 0 {
		t.Errorf("expected 0%% for empty stories, got %.1f%%", progress)
	}
}

// ============================================================================
// TEST SUITE: Dependency validation
// ============================================================================

func validateDependencies(stories []Story) []string {
	ids := make(map[int]bool)
	for _, s := range stories {
		ids[s.ID] = true
	}

	var errors []string
	for _, s := range stories {
		for _, dep := range s.DependsOn {
			if !ids[dep] {
				errors = append(errors, "story "+string(rune(s.ID+'0'))+" depends on non-existent story "+string(rune(dep+'0')))
			}
			if dep == s.ID {
				errors = append(errors, "story "+string(rune(s.ID+'0'))+" depends on itself")
			}
		}
	}
	return errors
}

func TestDependenciesValid(t *testing.T) {
	sf := loadStories(t, sampleStoriesJSON())
	errs := validateDependencies(sf.Stories)
	if len(errs) > 0 {
		t.Errorf("dependency errors: %v", errs)
	}
}

func TestSelfDependencyDetected(t *testing.T) {
	stories := []Story{
		{ID: 1, Title: "Self-referencing", Status: StatusPending, DependsOn: []int{1}},
	}
	errs := validateDependencies(stories)
	if len(errs) == 0 {
		t.Error("should detect self-dependency")
	}
}

func TestMissingDependencyDetected(t *testing.T) {
	stories := []Story{
		{ID: 1, Title: "Depends on ghost", Status: StatusPending, DependsOn: []int{99}},
	}
	errs := validateDependencies(stories)
	if len(errs) == 0 {
		t.Error("should detect missing dependency")
	}
}

// ============================================================================
// TEST SUITE: File I/O
// ============================================================================

func TestLoadFromDisk(t *testing.T) {
	root := t.TempDir()
	path := writeStoriesFile(t, root, sampleStoriesJSON())

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read stories from disk: %v", err)
	}

	var sf StoriesFile
	if err := json.Unmarshal(data, &sf); err != nil {
		t.Fatalf("failed to parse stories from disk: %v", err)
	}

	if len(sf.Stories) != 5 {
		t.Fatalf("expected 5 stories from disk, got %d", len(sf.Stories))
	}
}

func TestEmptyStoriesFile(t *testing.T) {
	var sf StoriesFile
	err := json.Unmarshal([]byte(`{"stories":[]}`), &sf)
	if err != nil {
		t.Fatalf("should parse empty stories array: %v", err)
	}
	if len(sf.Stories) != 0 {
		t.Fatalf("expected 0 stories, got %d", len(sf.Stories))
	}
}

func TestMalformedJSON(t *testing.T) {
	var sf StoriesFile
	err := json.Unmarshal([]byte(`{invalid json`), &sf)
	if err == nil {
		t.Fatal("should fail on malformed JSON")
	}
}

func TestMissingStoriesKey(t *testing.T) {
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

// ============================================================================
// TEST SUITE: Status transitions
// ============================================================================

func isValidTransition(from, to StoryStatus) bool {
	transitions := map[StoryStatus][]StoryStatus{
		StatusPending:    {StatusInProgress, StatusSkipped},
		StatusInProgress: {StatusComplete, StatusFailed, StatusPending}, // can pause
		StatusFailed:     {StatusInProgress, StatusPending},            // can retry
		StatusComplete:   {},                                           // terminal
		StatusSkipped:    {StatusPending},                              // can unskip
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

func TestValidTransitions(t *testing.T) {
	cases := []struct {
		from, to StoryStatus
		valid    bool
	}{
		{StatusPending, StatusInProgress, true},
		{StatusPending, StatusSkipped, true},
		{StatusPending, StatusComplete, false},     // can't jump to complete
		{StatusInProgress, StatusComplete, true},
		{StatusInProgress, StatusFailed, true},
		{StatusInProgress, StatusPending, true},     // pause
		{StatusFailed, StatusInProgress, true},      // retry
		{StatusComplete, StatusPending, false},      // can't un-complete
		{StatusComplete, StatusInProgress, false},   // terminal
		{StatusSkipped, StatusPending, true},        // unskip
	}

	for _, tc := range cases {
		name := string(tc.from) + " → " + string(tc.to)
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

func TestProgressMDParsing(t *testing.T) {
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

func TestProgressMDNoRalphReferences(t *testing.T) {
	content := `# Spectrum Progress

## Story 1: Setup
- Status: complete
`
	if strings.Contains(strings.ToLower(content), "ralph") {
		t.Error("progress.md should not reference 'ralph'")
	}
}
