package app

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/ralph-tui/claude"
	"github.com/prism-plugin/ralph-tui/domain"
)

// Init initializes the model
func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.Spinner.Tick,
		tickCmd(),
		LoadStoriesCmd(m.StoriesPath),
	)
}

// Update handles all messages
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleKeyPress(msg)

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.Ready = true
		return m, nil

	case TickMsg:
		// Update spinner
		var cmd tea.Cmd
		m.Spinner, cmd = m.Spinner.Update(spinner.TickMsg{})
		cmds = append(cmds, cmd, tickCmd())

	case InitCompleteMsg:
		if msg.Error != nil {
			m.State = StateError
			m.LastError = msg.Error.Error()
			m.AddLog(LogError, "Failed to load stories: "+msg.Error.Error())
		} else {
			m.PlanName = msg.PlanName
			m.Stories = msg.Stories
			m.TotalStories = len(msg.Stories)
			m.AddLog(LogInfo, fmt.Sprintf("Loaded %d stories from plan: %s", len(msg.Stories), msg.PlanName))
		}
		return m, nil

	case StoriesReloadedMsg:
		if msg.Error != nil {
			m.AddLog(LogWarning, "Failed to reload stories: "+msg.Error.Error())
		} else {
			m.Stories = msg.Stories
			m.TotalStories = len(msg.Stories)
		}
		return m, nil

	case ClaudeStartedMsg:
		m.CurrentStoryID = msg.StoryID
		m.Iteration = msg.Iteration
		m.IterationStart = time.Now()
		m.AddLog(LogInfo, fmt.Sprintf("Starting iteration %d", msg.Iteration))
		return m, nil

	case claude.ToolActivityMsg:
		// Update current tool activity for display
		m.CurrentTool = msg.ToolName
		m.CurrentActivity = msg.Description

		// Add to recent activities history (avoid duplicates)
		if msg.Description != "" && (len(m.RecentActivities) == 0 || m.RecentActivities[len(m.RecentActivities)-1] != msg.Description) {
			m.RecentActivities = append(m.RecentActivities, msg.Description)
			if len(m.RecentActivities) > 10 {
				m.RecentActivities = m.RecentActivities[1:]
			}
		}

		if msg.IsComplete {
			m.CurrentTool = ""
			m.CurrentActivity = ""
		}
		// Continue listening for more output
		if m.OutputChan != nil {
			return m, claude.ListenToOutput(m.OutputChan)
		}
		return m, nil

	case claude.ClaudeOutputMsg:
		// Add to recent output for activity panel (raw JSON for debugging)
		// Don't show raw JSON in recent output - it's not human readable
		// The ToolActivityMsg handler above captures the meaningful info
		// Continue listening for more output
		if m.OutputChan != nil {
			return m, claude.ListenToOutput(m.OutputChan)
		}
		return m, nil

	case claude.ClaudeFinishedMsg:
		m.OutputChan = nil // Stop listening for more output
		m.CurrentTool = ""
		m.CurrentActivity = ""
		duration := msg.Duration.Round(time.Second)
		m.AddLog(LogInfo, fmt.Sprintf("Iteration completed in %s", duration))

		if msg.Error != nil {
			m.ConsecutiveErrs++
			m.AddLog(LogError, "Claude error: "+msg.Error.Error())

			if m.ConsecutiveErrs >= m.MaxConsecutiveErrs {
				m.State = StateError
				m.LastError = "Too many consecutive errors"
				m.AddLog(LogError, "Too many consecutive errors, stopping")
				return m, nil
			}

			// Retry with backoff
			delay := time.Duration(m.ConsecutiveErrs) * 2 * time.Second
			m.AddLog(LogWarning, fmt.Sprintf("Retrying in %s...", delay))
			return m, tea.Tick(delay, func(t time.Time) tea.Msg {
				return RetryIterationMsg{}
			})
		}

		// Success - reset error count
		m.ConsecutiveErrs = 0

		// Parse signal from output
		signal := domain.ParseSignal(msg.Output)
		signalMsg := SignalDetectedMsg{
			Type:    convertSignalType(signal.Type),
			Content: signal.Content,
			StoryID: m.CurrentStoryID,
		}

		// Also reload stories to get updated status
		return m, tea.Batch(
			ReloadStoriesCmd(m.StoriesPath),
			func() tea.Msg { return signalMsg },
		)

	case SignalDetectedMsg:
		return m.handleSignal(msg)

	case StoryStartedMsg:
		m.CurrentStoryID = msg.StoryID
		m.CurrentStoryTitle = msg.Title
		m.AddLog(LogInfo, "Starting story: "+msg.StoryID+" - "+msg.Title)
		return m, nil

	case StoryCompletedMsg:
		m.AddLog(LogSuccess, "Story complete: "+msg.StoryID)
		// Update story status in local list
		for i := range m.Stories {
			if m.Stories[i].ID == msg.StoryID {
				m.Stories[i].Status = "complete"
				break
			}
		}
		m.CurrentStoryID = ""
		m.CurrentStoryTitle = ""
		return m, nil

	case StartNextIterationMsg:
		if m.State == StatePaused {
			m.AddLog(LogInfo, "Execution paused, press 'p' to resume...")
			return m, nil
		}
		if m.State != StateRunning {
			return m, nil
		}

		// Check if we've hit max iterations
		if m.Iteration >= m.MaxIterations {
			m.State = StateError
			m.LastError = fmt.Sprintf("Reached max iterations (%d)", m.MaxIterations)
			m.AddLog(LogWarning, m.LastError)
			return m, nil
		}

		// Start next iteration
		m.Iteration++
		m.IterationStart = time.Now()
		m.RecentOutput = []string{}     // Clear recent output
		m.RecentActivities = []string{} // Clear recent activities
		m.AddLog(LogInfo, fmt.Sprintf("Starting iteration %d/%d", m.Iteration, m.MaxIterations))

		// Use streaming execution for real-time activity display
		m.OutputChan = make(chan tea.Msg, 100)
		return m, tea.Batch(
			claude.RunClaudeStreamingCmd(m.ProjectDir, m.StoriesPath, m.Iteration, m.OutputChan),
			claude.ListenToOutput(m.OutputChan),
		)

	case RetryIterationMsg:
		if m.State != StateRunning && m.State != StatePaused {
			return m, nil
		}
		if m.State == StatePaused {
			m.AddLog(LogInfo, "Retry deferred, execution paused...")
			return m, nil
		}

		m.RecentOutput = []string{}
		m.RecentActivities = []string{}
		m.AddLog(LogInfo, fmt.Sprintf("Retrying iteration %d", m.Iteration))

		// Use streaming execution for real-time activity display
		m.OutputChan = make(chan tea.Msg, 100)
		return m, tea.Batch(
			claude.RunClaudeStreamingCmd(m.ProjectDir, m.StoriesPath, m.Iteration, m.OutputChan),
			claude.ListenToOutput(m.OutputChan),
		)

	case StartExecutionMsg:
		if m.State == StateIdle {
			m.State = StateRunning
			m.StartTime = time.Now()
			m.Iteration = 0
			m.AddLog(LogInfo, "Starting Ralph execution...")

			// Trigger first iteration
			return m, func() tea.Msg { return StartNextIterationMsg{} }
		}
		return m, nil

	case PauseToggleMsg:
		if m.State == StateRunning {
			m.State = StatePaused
			m.AddLog(LogWarning, "Pausing after current story...")
		} else if m.State == StatePaused {
			m.State = StateRunning
			m.AddLog(LogInfo, "Resuming execution...")
		}
		return m, nil
	}

	return m, tea.Batch(cmds...)
}

func (m Model) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Global keys (always active)
	switch msg.String() {
	case "q", "ctrl+c":
		// Graceful shutdown
		if m.State == StateRunning {
			m.AddLog(LogWarning, "Shutting down...")
			// Would cancel Claude process here - Phase 4
		}
		return m, tea.Quit

	case "?":
		m.ShowHelp = !m.ShowHelp
		return m, nil
	}

	// State-dependent keys
	switch m.State {
	case StateIdle:
		switch msg.String() {
		case "enter", " ":
			return m, func() tea.Msg { return StartExecutionMsg{} }
		}

	case StateRunning:
		switch msg.String() {
		case "p":
			return m, func() tea.Msg { return PauseToggleMsg{} }
		case "s":
			m.AddLog(LogWarning, "Skip requested - will skip after current story")
			// Skip implementation in Phase 5
			return m, nil
		}

	case StatePaused:
		switch msg.String() {
		case "p", "enter", " ":
			return m, func() tea.Msg { return PauseToggleMsg{} }
		}

	case StateComplete, StateError:
		switch msg.String() {
		case "enter", " ":
			return m, tea.Quit
		}
	}

	// Viewport scrolling (would be used with viewport in Phase 3)
	switch msg.String() {
	case "up", "k":
		// m.Viewport.LineUp(1)
	case "down", "j":
		// m.Viewport.LineDown(1)
	case "pgup":
		// m.Viewport.HalfViewUp()
	case "pgdown":
		// m.Viewport.HalfViewDown()
	}

	return m, nil
}

func (m Model) handleSignal(msg SignalDetectedMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case SignalComplete:
		m.State = StateComplete
		m.AddLog(LogSuccess, "All stories complete!")
		return m, nil

	case SignalContinue:
		m.AddLog(LogInfo, "Story complete, continuing...")
		// Pause before next iteration
		return m, tea.Tick(time.Duration(m.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalRetry:
		m.ConsecutiveErrs++
		m.AddLog(LogWarning, "Retry requested: "+msg.Content)
		if m.ConsecutiveErrs >= m.MaxConsecutiveErrs {
			m.State = StateError
			m.LastError = "Too many retries"
			return m, nil
		}
		return m, tea.Tick(time.Duration(m.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalBlocked:
		m.AddLog(LogWarning, "Story blocked: "+msg.Content)
		return m, tea.Tick(time.Duration(m.Pause)*time.Second, func(t time.Time) tea.Msg {
			return StartNextIterationMsg{}
		})

	case SignalError:
		m.State = StateError
		m.LastError = msg.Content
		m.AddLog(LogError, "Fatal error: "+msg.Content)
		return m, nil
	}

	// No explicit signal - assume continue
	return m, tea.Tick(time.Duration(m.Pause)*time.Second, func(t time.Time) tea.Msg {
		return StartNextIterationMsg{}
	})
}

// tickCmd returns a command that sends a tick message
func tickCmd() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// splitLines splits text into lines
func splitLines(text string) []string {
	var lines []string
	current := ""
	for _, r := range text {
		if r == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(r)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}
