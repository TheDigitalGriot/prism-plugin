package app

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/ralph-tui/claude"
	"github.com/prism-plugin/ralph-tui/domain"
)

// demoActivities is a list of fake tool activities for demo mode
var demoActivities = []struct {
	Tool        string
	Description string
}{
	{"Read", "Reading: src/components/Button.tsx"},
	{"Glob", "Finding: **/*.test.ts"},
	{"Grep", "Searching: handleSubmit"},
	{"Read", "Reading: src/api/auth.go"},
	{"Edit", "Editing: src/services/user.ts"},
	{"Bash", "Running: npm run typecheck"},
	{"Task", "Agent: Exploring test patterns"},
	{"Read", "Reading: package.json"},
	{"Edit", "Editing: src/utils/validation.ts"},
	{"Bash", "Running: go test ./..."},
	{"Grep", "Searching: interface User"},
	{"Task", "Agent: Analyzing dependencies"},
	{"Edit", "Editing: src/components/Form.tsx"},
	{"Bash", "Running: npm run lint"},
	{"Read", "Reading: tsconfig.json"},
	{"TodoWrite", "Updating tasks..."},
}

// Init initializes the model
func (m Model) Init() tea.Cmd {
	cmds := []tea.Cmd{
		m.Spinner.Tick,
		tickCmd(),
	}

	// Only load stories if not in demo mode (path is set)
	if m.StoriesPath != "" {
		cmds = append(cmds, LoadStoriesCmd(m.StoriesPath))
	}

	return tea.Batch(cmds...)
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

		// Advance progress bar animation
		m.Anim.ProgressPos, m.Anim.ProgressVel = m.Anim.ProgressSpring.Update(
			m.Anim.ProgressPos,
			m.Anim.ProgressVel,
			m.Anim.ProgressTarget,
		)

		// Advance story pop animations
		for idx := range m.Anim.StoryPopScales {
			scale, vel := m.Anim.StoryPopSpring.Update(
				m.Anim.StoryPopScales[idx],
				m.Anim.StoryPopVels[idx],
				1.0, // target scale
			)
			m.Anim.StoryPopScales[idx] = scale
			m.Anim.StoryPopVels[idx] = vel

			// Clean up finished animations
			if math.Abs(scale-1.0) < 0.01 && math.Abs(vel) < 0.01 {
				delete(m.Anim.StoryPopScales, idx)
				delete(m.Anim.StoryPopVels, idx)
			}
		}

		// Advance pulse (continuous sine wave)
		m.Anim.PulsePhase += 0.15 // ~2.4 rad/sec at 100ms ticks
		if m.Anim.PulsePhase > 2*math.Pi {
			m.Anim.PulsePhase -= 2 * math.Pi
		}

		// Advance log entry slide-ins
		for i := range m.Anim.LogEntryOffsets {
			offset, vel := m.Anim.LogSlideSpring.Update(
				m.Anim.LogEntryOffsets[i],
				m.Anim.LogEntryVels[i],
				0.0, // target offset
			)
			m.Anim.LogEntryOffsets[i] = offset
			m.Anim.LogEntryVels[i] = vel
		}

		// Advance prism animation (slower, every 3 ticks = 300ms per frame for 4 colors)
		m.Anim.PrismTick++
		if m.Anim.PrismTick >= 3 {
			m.Anim.PrismTick = 0
			m.Anim.PrismFrame = (m.Anim.PrismFrame + 1) % 4
		}

		// Advance ray spring animations (for gradient prism)
		for i := range m.Anim.RayLengths {
			m.Anim.RayLengths[i], m.Anim.RayVels[i] = m.Anim.RaySpring.Update(
				m.Anim.RayLengths[i],
				m.Anim.RayVels[i],
				m.Anim.RayTargets[i],
			)

			// Set new random target when settled
			if math.Abs(m.Anim.RayLengths[i]-m.Anim.RayTargets[i]) < 0.1 && math.Abs(m.Anim.RayVels[i]) < 0.1 {
				m.Anim.RayTargets[i] = 4 + rand.Float64()*4 // Random 4-8
			}
		}

		// Advance shimmer phase (for gradient brightness effects)
		m.Anim.ShimmerPhase += 0.08 // Slower than pulse for subtle effect
		if m.Anim.ShimmerPhase > 2*math.Pi {
			m.Anim.ShimmerPhase -= 2 * math.Pi
		}

	case InitCompleteMsg:
		if msg.Error != nil {
			m.State = StateError
			m.LastError = msg.Error.Error()
			m.AddLog(LogError, "Failed to load stories: "+msg.Error.Error())
		} else {
			m.PlanName = msg.PlanName
			m.Stories = msg.Stories
			m.TotalStories = len(msg.Stories)
			// Update story paginator total pages
			m.StoryPaginator.SetTotalPages((len(msg.Stories) + m.StoriesPerPage - 1) / m.StoriesPerPage)
			// Initialize progress animation to current progress
			m.Anim.ProgressPos = m.ProgressPercent()
			m.Anim.ProgressTarget = m.ProgressPercent()
			m.AddLog(LogInfo, fmt.Sprintf("Loaded %d stories from plan: %s", len(msg.Stories), msg.PlanName))
		}
		return m, nil

	case StoriesReloadedMsg:
		if msg.Error != nil {
			m.AddLog(LogWarning, "Failed to reload stories: "+msg.Error.Error())
		} else {
			m.Stories = msg.Stories
			m.TotalStories = len(msg.Stories)
			// Update story paginator total pages
			m.StoryPaginator.SetTotalPages((len(msg.Stories) + m.StoriesPerPage - 1) / m.StoriesPerPage)
			// Update progress target for smooth animation
			m.Anim.ProgressTarget = m.ProgressPercent()
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
		// Update story status in local list and trigger pop animation
		for i := range m.Stories {
			if m.Stories[i].ID == msg.StoryID {
				m.Stories[i].Status = "complete"
				// Trigger pop animation: start compressed, spring to 1.0
				m.Anim.StoryPopScales[i] = 0.3
				m.Anim.StoryPopVels[i] = 0
				break
			}
		}
		// Update progress target for smooth progress bar animation
		m.Anim.ProgressTarget = m.ProgressPercent()
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

			if m.DemoMode {
				m.AddLog(LogInfo, "Starting DEMO simulation...")
				m.AddLog(LogInfo, "Watch the animations!")
				// Find first pending story for demo
				for i, s := range m.Stories {
					if s.Status == "pending" {
						m.DemoStoryIndex = i
						m.CurrentStoryID = s.ID
						m.CurrentStoryTitle = s.Title
						break
					}
				}
				// Start demo tick (2.5 seconds between completions)
				// Also start activity cycling
				return m, tea.Batch(
					tea.Tick(2500*time.Millisecond, func(t time.Time) tea.Msg {
						return DemoTickMsg{}
					}),
					tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
						return DemoActivityMsg{ActivityIndex: 0}
					}),
				)
			}

			m.AddLog(LogInfo, "Starting Ralph execution...")
			// Trigger first iteration
			return m, func() tea.Msg { return StartNextIterationMsg{} }
		}
		return m, nil

	case DemoTickMsg:
		if !m.DemoMode || m.State != StateRunning {
			return m, nil
		}

		// Complete current story
		if m.DemoStoryIndex < len(m.Stories) {
			m.Iteration++

			// Trigger story completion
			return m, func() tea.Msg {
				return DemoCompleteStoryMsg{StoryIndex: m.DemoStoryIndex}
			}
		}
		return m, nil

	case DemoCompleteStoryMsg:
		if !m.DemoMode {
			return m, nil
		}

		idx := msg.StoryIndex
		if idx >= len(m.Stories) {
			return m, nil
		}

		// Mark story complete with animation
		m.Stories[idx].Status = "complete"
		m.Anim.StoryPopScales[idx] = 0.3
		m.Anim.StoryPopVels[idx] = 0
		m.Anim.ProgressTarget = m.ProgressPercent()

		m.AddLog(LogSuccess, fmt.Sprintf("Story complete: %s", m.Stories[idx].ID))

		// Find next pending story
		m.DemoStoryIndex = -1
		for i, s := range m.Stories {
			if s.Status == "pending" {
				m.DemoStoryIndex = i
				m.CurrentStoryID = s.ID
				m.CurrentStoryTitle = s.Title
				m.AddLog(LogInfo, fmt.Sprintf("Starting: %s - %s", s.ID, s.Title))
				break
			}
		}

		// Check if all done
		if m.DemoStoryIndex == -1 {
			m.State = StateComplete
			m.CurrentStoryID = ""
			m.CurrentStoryTitle = ""
			m.CurrentTool = ""
			m.CurrentActivity = ""
			m.AddLog(LogSuccess, "All demo stories complete!")
			return m, nil
		}

		// Schedule next completion (randomish timing 2-3.5 seconds)
		delay := 2000 + (m.DemoStoryIndex%3)*500
		return m, tea.Tick(time.Duration(delay)*time.Millisecond, func(t time.Time) tea.Msg {
			return DemoTickMsg{}
		})

	case DemoActivityMsg:
		if !m.DemoMode || m.State != StateRunning {
			return m, nil
		}

		// Cycle through activities
		idx := msg.ActivityIndex % len(demoActivities)
		activity := demoActivities[idx]

		m.CurrentTool = activity.Tool
		m.CurrentActivity = activity.Description

		// Add to recent activities (avoid duplicates)
		if len(m.RecentActivities) == 0 || m.RecentActivities[len(m.RecentActivities)-1] != activity.Description {
			m.RecentActivities = append(m.RecentActivities, activity.Description)
			if len(m.RecentActivities) > 10 {
				m.RecentActivities = m.RecentActivities[1:]
			}
		}

		// Schedule next activity (300-600ms)
		delay := 300 + rand.Intn(300)
		return m, tea.Tick(time.Duration(delay)*time.Millisecond, func(t time.Time) tea.Msg {
			return DemoActivityMsg{ActivityIndex: idx + 1}
		})

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

	// Pagination keys (always active)
	switch msg.String() {
	case "a": // Story pagination - previous page
		m.StoryPaginator.PrevPage()
		return m, nil
	case "s": // Story pagination - next page
		m.StoryPaginator.NextPage()
		return m, nil
	case "z": // Log pagination - previous page
		m.LogPaginator.PrevPage()
		return m, nil
	case "x": // Log pagination - next page
		m.LogPaginator.NextPage()
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
		case "/":
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

	return m, nil
}

func (m Model) handleSignal(msg SignalDetectedMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case SignalComplete:
		// Safety check: verify that remaining stories count is actually 0
		remaining := m.RemainingCount()
		if remaining > 0 {
			// COMPLETE signal received but stories remain - this is a bug in the skill output
			m.AddLog(LogWarning, fmt.Sprintf("⚠️ COMPLETE signal received but %d stories remain - ignoring and continuing", remaining))
			m.AddLog(LogInfo, "This is likely a skill bug - prism-ralph should output <ralph-continue> when stories remain")
			// Continue instead of stopping
			return m, tea.Tick(time.Duration(m.Pause)*time.Second, func(t time.Time) tea.Msg {
				return StartNextIterationMsg{}
			})
		}
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
