package domain

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

// StoriesFile represents the root structure of stories.json
type StoriesFile struct {
	Plan    Plan    `json:"plan"`
	Stories []Story `json:"stories"`
}

// Plan contains metadata and configuration for the execution
type Plan struct {
	Name         string   `json:"name"`
	Source       string   `json:"source"`
	CreatedAt    string   `json:"createdAt"`
	QualityGates []string `json:"qualityGates"`
}

// Story represents a single executable story
type Story struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Priority    int      `json:"priority"`
	Status      string   `json:"status"` // pending, in_progress, complete
	BlockedBy   *string  `json:"blockedBy"`
	Files       []File   `json:"files"`
	Steps       []Step   `json:"steps"`
	CompletedAt *string  `json:"completedAt,omitempty"`
	CommitHash  *string  `json:"commitHash,omitempty"`
}

// File identifies a file to be created/modified
type File struct {
	Path   string `json:"path"`
	Action string `json:"action"` // create, modify, delete
}

// Step represents a single implementation step
type Step struct {
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// LoadStoriesFile reads and parses a stories.json file
func LoadStoriesFile(path string) (*StoriesFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read stories file: %w", err)
	}

	var sf StoriesFile
	if err := json.Unmarshal(data, &sf); err != nil {
		return nil, fmt.Errorf("failed to parse stories file: %w", err)
	}

	return &sf, nil
}

// SaveStoriesFile writes the stories file back to disk
func (sf *StoriesFile) SaveStoriesFile(path string) error {
	data, err := json.MarshalIndent(sf, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal stories: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write stories file: %w", err)
	}

	return nil
}

// IsBlocked checks if a story is blocked by an incomplete dependency
func (s *Story) IsBlocked(stories []Story) bool {
	if s.BlockedBy == nil {
		return false
	}

	for _, other := range stories {
		if other.ID == *s.BlockedBy {
			return other.Status != "complete"
		}
	}

	// If blocking story not found, assume not blocked
	return false
}

// GetNextStory returns the next story to execute based on priority
// Returns nil if no stories are available (all complete or blocked)
func (sf *StoriesFile) GetNextStory() *Story {
	var candidates []Story

	for _, s := range sf.Stories {
		if s.Status == "complete" {
			continue
		}
		if s.IsBlocked(sf.Stories) {
			continue
		}
		candidates = append(candidates, s)
	}

	if len(candidates) == 0 {
		return nil
	}

	// Sort by priority (lower = higher priority)
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Priority < candidates[j].Priority
	})

	return &candidates[0]
}

// CompletedCount returns the number of completed stories
func (sf *StoriesFile) CompletedCount() int {
	count := 0
	for _, s := range sf.Stories {
		if s.Status == "complete" {
			count++
		}
	}
	return count
}

// RemainingCount returns the number of non-complete stories
func (sf *StoriesFile) RemainingCount() int {
	return len(sf.Stories) - sf.CompletedCount()
}

// AllComplete returns true if all stories are complete
func (sf *StoriesFile) AllComplete() bool {
	return sf.RemainingCount() == 0
}

// MarkStoryComplete updates a story's status to complete
func (sf *StoriesFile) MarkStoryComplete(storyID string, commitHash string) {
	for i := range sf.Stories {
		if sf.Stories[i].ID == storyID {
			sf.Stories[i].Status = "complete"
			sf.Stories[i].CommitHash = &commitHash
			// Mark all steps as done
			for j := range sf.Stories[i].Steps {
				sf.Stories[i].Steps[j].Done = true
			}
			return
		}
	}
}

// MarkStoryInProgress updates a story's status to in_progress
func (sf *StoriesFile) MarkStoryInProgress(storyID string) {
	for i := range sf.Stories {
		if sf.Stories[i].ID == storyID {
			sf.Stories[i].Status = "in_progress"
			return
		}
	}
}

// GetStoryByID finds a story by its ID
func (sf *StoriesFile) GetStoryByID(id string) *Story {
	for i := range sf.Stories {
		if sf.Stories[i].ID == id {
			return &sf.Stories[i]
		}
	}
	return nil
}
