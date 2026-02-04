package app

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/ralph-tui/domain"
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
			PlanName: sf.Plan.Name,
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
			PlanName: sf.Plan.Name,
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

// CheckForStoryAnnouncement looks for <ralph-story> tag in output
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
