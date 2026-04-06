package app

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/prism-cli/domain"
)

// LoadStoriesCmd creates a command to load stories.json
func LoadStoriesCmd(path string) tea.Cmd {
	return func() tea.Msg {
		sf, err := domain.LoadStoriesFile(path)
		if err != nil {
			return InitCompleteMsg{Error: err}
		}

		// Convert to StoryView slice for display
		stories := make([]StoryView, len(sf.Stories))
		for i, s := range sf.Stories {
			stories[i] = StoryView{
				ID:        s.ID,
				Title:     s.Title,
				Status:    s.Status,
				IsBlocked: s.IsBlocked(sf.Stories),
				Priority:  s.Priority,
			}
		}

		return InitCompleteMsg{
			PlanName: sf.Epic.Name,
			Stories:  stories,
		}
	}
}

// ReloadStoriesCmd reloads stories.json to get updated status
func ReloadStoriesCmd(path string) tea.Cmd {
	return func() tea.Msg {
		sf, err := domain.LoadStoriesFile(path)
		if err != nil {
			return StoriesReloadedMsg{Error: err}
		}

		stories := make([]StoryView, len(sf.Stories))
		for i, s := range sf.Stories {
			stories[i] = StoryView{
				ID:        s.ID,
				Title:     s.Title,
				Status:    s.Status,
				IsBlocked: s.IsBlocked(sf.Stories),
				Priority:  s.Priority,
			}
		}

		return StoriesReloadedMsg{
			PlanName: sf.Epic.Name,
			Stories:  stories,
		}
	}
}

// GetNextStoryCmd determines the next story to execute
func GetNextStoryCmd(path string) tea.Cmd {
	return func() tea.Msg {
		sf, err := domain.LoadStoriesFile(path)
		if err != nil {
			return StoriesReloadedMsg{Error: err}
		}

		// Check if all complete
		if sf.AllComplete() {
			return SignalDetectedMsg{Type: SignalComplete}
		}

		// Get next story
		next := sf.GetNextStory()
		if next == nil {
			// All remaining stories are blocked
			return SignalDetectedMsg{
				Type:    SignalBlocked,
				Content: "All remaining stories are blocked",
			}
		}

		return StoryStartedMsg{
			StoryID: next.ID,
			Title:   next.Title,
		}
	}
}

// ParseSignalFromOutput checks Claude output for signals
func ParseSignalFromOutput(output string, currentStoryID string) SignalDetectedMsg {
	signal := domain.ParseSignal(output)

	return SignalDetectedMsg{
		Type:    convertSignalType(signal.Type),
		Content: signal.Content,
		StoryID: currentStoryID,
	}
}

// convertSignalType converts domain.SignalType to app.SignalType
func convertSignalType(dt domain.SignalType) SignalType {
	switch dt {
	case domain.SignalComplete:
		return SignalComplete
	case domain.SignalContinue:
		return SignalContinue
	case domain.SignalRetry:
		return SignalRetry
	case domain.SignalBlocked:
		return SignalBlocked
	case domain.SignalError:
		return SignalError
	default:
		return SignalNone
	}
}

// CheckForStoryAnnouncement looks for <spectrum-story> tag in output
func CheckForStoryAnnouncement(output string) *StoryStartedMsg {
	announcement := domain.ParseStoryAnnouncement(output)
	if announcement == nil {
		return nil
	}

	return &StoryStartedMsg{
		StoryID: announcement.ID,
		Title:   announcement.Title,
	}
}

// === Epic Commands ===

// DiscoverEpicsCmd scans .prism/stories/ for epic subdirectories
func DiscoverEpicsCmd(prismDir string) tea.Cmd {
	return func() tea.Msg {
		storiesDir := filepath.Join(prismDir, "stories")

		entries, err := os.ReadDir(storiesDir)
		if err != nil {
			// Check for legacy flat structure
			flatPath := filepath.Join(storiesDir, "stories.json")
			if _, statErr := os.Stat(flatPath); statErr == nil {
				return EpicsDiscoveredMsg{Epics: nil}
			}
			return EpicsDiscoveredMsg{Error: fmt.Errorf("failed to read stories directory: %w", err)}
		}

		var epics []EpicInfo
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			storiesPath := filepath.Join(storiesDir, entry.Name(), "stories.json")
			if _, err := os.Stat(storiesPath); err != nil {
				continue
			}

			// Load summary stats
			sf, err := domain.LoadStoriesFile(storiesPath)
			if err != nil {
				continue
			}

			epics = append(epics, EpicInfo{
				Name:           entry.Name(),
				StoriesPath:    storiesPath,
				StoryCount:     len(sf.Stories),
				CompletedCount: sf.CompletedCount(),
			})
		}

		// Sort by name
		sort.Slice(epics, func(i, j int) bool {
			return epics[i].Name < epics[j].Name
		})

		return EpicsDiscoveredMsg{Epics: epics}
	}
}

// === File Listing Commands ===

// LoadResearchFilesCmd lists .md files in .prism/shared/research/
func LoadResearchFilesCmd(prismDir string, epoch uint64) tea.Cmd {
	return func() tea.Msg {
		dir := filepath.Join(prismDir, "shared", "research")
		files, err := listMarkdownFiles(dir)
		if err != nil {
			return ResearchFilesLoadedMsg{Error: err, Epoch: epoch}
		}
		return ResearchFilesLoadedMsg{Files: files, Epoch: epoch}
	}
}

// LoadPlansFilesCmd lists .md files in .prism/shared/plans/
func LoadPlansFilesCmd(prismDir string, epoch uint64) tea.Cmd {
	return func() tea.Msg {
		dir := filepath.Join(prismDir, "shared", "plans")
		files, err := listMarkdownFiles(dir)
		if err != nil {
			return PlansFilesLoadedMsg{Error: err, Epoch: epoch}
		}
		return PlansFilesLoadedMsg{Files: files, Epoch: epoch}
	}
}

// LoadFileContentCmd reads full content of a markdown file
func LoadFileContentCmd(path string, forView ActiveView, epoch uint64) tea.Cmd {
	return func() tea.Msg {
		data, err := os.ReadFile(path)
		if err != nil {
			return FileContentLoadedMsg{Error: err, Path: path, ForView: forView, Epoch: epoch}
		}
		return FileContentLoadedMsg{Content: string(data), Path: path, ForView: forView, Epoch: epoch}
	}
}

// DecomposePlanCmd extracts epic name from plan and creates directory structure
func DecomposePlanCmd(prismDir, planPath string) tea.Cmd {
	return func() tea.Msg {
		// Extract epic name from filename: 2026-02-10-user-auth.md -> user-auth
		base := filepath.Base(planPath)
		name := strings.TrimSuffix(base, ".md")

		// Remove date prefix if present (YYYY-MM-DD-)
		if len(name) > 11 && name[4] == '-' && name[7] == '-' && name[10] == '-' {
			name = name[11:]
		}

		if name == "" {
			return DecomposePlanMsg{Error: fmt.Errorf("could not extract epic name from: %s", base)}
		}

		// Create epic directory
		epicDir := filepath.Join(prismDir, "stories", name)
		if err := os.MkdirAll(epicDir, 0755); err != nil {
			return DecomposePlanMsg{Error: fmt.Errorf("failed to create epic directory: %w", err)}
		}

		// Create spectrum progress directory
		spectrumDir := filepath.Join(prismDir, "shared", "spectrum", name)
		if err := os.MkdirAll(spectrumDir, 0755); err != nil {
			return DecomposePlanMsg{Error: fmt.Errorf("failed to create spectrum directory: %w", err)}
		}

		// Create minimal stories.json scaffold
		scaffold := fmt.Sprintf(`{
  "epic": {
    "name": "%s",
    "source": "%s",
    "createdAt": "%s",
    "qualityGates": []
  },
  "stories": []
}`, name, base, time.Now().Format(time.RFC3339))

		storiesPath := filepath.Join(epicDir, "stories.json")
		if err := os.WriteFile(storiesPath, []byte(scaffold), 0644); err != nil {
			return DecomposePlanMsg{Error: fmt.Errorf("failed to create stories.json: %w", err)}
		}

		return DecomposePlanMsg{EpicName: name}
	}
}

// === File Listing Helpers ===

func listMarkdownFiles(dir string) ([]FileEntry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // directory doesn't exist = empty list
		}
		return nil, err
	}

	var files []FileEntry
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		fullPath := filepath.Join(dir, entry.Name())
		preview := readPreview(fullPath, 3)

		files = append(files, FileEntry{
			Name:    strings.TrimSuffix(entry.Name(), ".md"),
			Path:    fullPath,
			ModTime: info.ModTime(),
			Preview: preview,
		})
	}

	// Sort by modification time, newest first
	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.After(files[j].ModTime)
	})

	return files, nil
}

func readPreview(path string, lines int) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	content := string(data)

	// Skip YAML frontmatter if present
	if strings.HasPrefix(content, "---") {
		endIdx := strings.Index(content[3:], "---")
		if endIdx != -1 {
			content = content[endIdx+6:]
		}
	}

	// Get first N non-empty lines
	var result []string
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
			if len(result) >= lines {
				break
			}
		}
	}
	return strings.Join(result, "\n")
}
