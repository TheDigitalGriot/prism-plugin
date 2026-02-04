package domain

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// ProgressFile handles reading and appending to progress.md
type ProgressFile struct {
	Path string
}

// NewProgressFile creates a ProgressFile from a stories.json path
// It derives the progress.md path from the stories.json location
func NewProgressFile(storiesPath string) *ProgressFile {
	// progress.md is in the same directory as stories.json
	dir := storiesPath[:strings.LastIndex(storiesPath, string(os.PathSeparator))]
	return &ProgressFile{
		Path: dir + string(os.PathSeparator) + "progress.md",
	}
}

// Exists checks if the progress file exists
func (pf *ProgressFile) Exists() bool {
	_, err := os.Stat(pf.Path)
	return err == nil
}

// Initialize creates a new progress file with YAML frontmatter
func (pf *ProgressFile) Initialize(planName string) error {
	content := fmt.Sprintf(`---
plan: %s
startedAt: %s
lastUpdated: %s
---

# Ralph Progress Log

## Codebase Patterns (Consolidated)

*Patterns will be added as iterations discover them*

---

`, planName, time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339))

	return os.WriteFile(pf.Path, []byte(content), 0644)
}

// AppendEntry adds a new iteration entry to the progress file
func (pf *ProgressFile) AppendEntry(entry ProgressEntry) error {
	content := fmt.Sprintf(`
---

## %s - %s Complete

**What was done**: %s

**Learnings**:
%s

**Files changed**:
%s

**Quality gates**: %s
%s
`,
		entry.Timestamp.Format(time.RFC3339),
		entry.StoryID,
		entry.Summary,
		formatLearnings(entry.Learnings),
		formatFiles(entry.Files),
		entry.QualityGatesStatus,
		formatQualityGates(entry.QualityGates),
	)

	f, err := os.OpenFile(pf.Path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return fmt.Errorf("failed to open progress file: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(content); err != nil {
		return fmt.Errorf("failed to write to progress file: %w", err)
	}

	return nil
}

// ProgressEntry represents a single entry in progress.md
type ProgressEntry struct {
	Timestamp          time.Time
	StoryID            string
	Summary            string
	Learnings          []string
	Files              []string
	QualityGatesStatus string // "All passed" or "Failed"
	QualityGates       map[string]string // gate name -> status
}

// NewProgressEntry creates a new progress entry
func NewProgressEntry(storyID, summary string) ProgressEntry {
	return ProgressEntry{
		Timestamp:          time.Now(),
		StoryID:            storyID,
		Summary:            summary,
		Learnings:          []string{},
		Files:              []string{},
		QualityGatesStatus: "All passed",
		QualityGates:       make(map[string]string),
	}
}

func formatLearnings(learnings []string) string {
	if len(learnings) == 0 {
		return "- No new patterns discovered"
	}
	var lines []string
	for _, l := range learnings {
		lines = append(lines, "- "+l)
	}
	return strings.Join(lines, "\n")
}

func formatFiles(files []string) string {
	if len(files) == 0 {
		return "- None"
	}
	var lines []string
	for _, f := range files {
		lines = append(lines, "- "+f)
	}
	return strings.Join(lines, "\n")
}

func formatQualityGates(gates map[string]string) string {
	if len(gates) == 0 {
		return ""
	}
	var lines []string
	for name, status := range gates {
		lines = append(lines, fmt.Sprintf("- %s: %s", name, status))
	}
	return strings.Join(lines, "\n")
}

// ReadPatterns extracts the consolidated patterns section from progress.md
func (pf *ProgressFile) ReadPatterns() ([]string, error) {
	if !pf.Exists() {
		return nil, nil
	}

	data, err := os.ReadFile(pf.Path)
	if err != nil {
		return nil, err
	}

	content := string(data)

	// Find the patterns section
	startMarker := "## Codebase Patterns (Consolidated)"
	endMarker := "---"

	startIdx := strings.Index(content, startMarker)
	if startIdx == -1 {
		return nil, nil
	}

	// Find the end of the section
	afterStart := content[startIdx+len(startMarker):]
	endIdx := strings.Index(afterStart, endMarker)
	if endIdx == -1 {
		endIdx = len(afterStart)
	}

	section := strings.TrimSpace(afterStart[:endIdx])

	// Parse patterns (lines starting with -)
	var patterns []string
	for _, line := range strings.Split(section, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "-") {
			pattern := strings.TrimSpace(strings.TrimPrefix(line, "-"))
			if pattern != "" && !strings.Contains(pattern, "Patterns will be added") {
				patterns = append(patterns, pattern)
			}
		}
	}

	return patterns, nil
}
