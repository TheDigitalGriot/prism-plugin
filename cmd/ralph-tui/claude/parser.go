package claude

import (
	"strings"

	"github.com/prism-plugin/ralph-tui/domain"
)

// OutputParser watches Claude output for signals and status changes
type OutputParser struct {
	buffer       strings.Builder
	lastSignal   domain.Signal
	currentPhase string
	storyID      string
	storyTitle   string
}

// NewOutputParser creates a new parser instance
func NewOutputParser() *OutputParser {
	return &OutputParser{}
}

// ParseEvent represents an event detected in Claude output
type ParseEvent struct {
	Type       ParseEventType
	StoryID    string
	StoryTitle string
	Phase      string
	Signal     domain.Signal
	Message    string
}

// ParseEventType categorizes detected events
type ParseEventType int

const (
	EventNone ParseEventType = iota
	EventStoryAnnounced
	EventPhaseChanged
	EventSignalDetected
	EventQualityGateStarted
	EventQualityGateResult
	EventCommitCreated
)

// ParseLine processes a line of output and returns any detected events
func (p *OutputParser) ParseLine(line string) []ParseEvent {
	events := []ParseEvent{}
	p.buffer.WriteString(line + "\n")

	// Check for story announcement
	if announcement := domain.ParseStoryAnnouncement(p.buffer.String()); announcement != nil {
		if announcement.ID != p.storyID {
			p.storyID = announcement.ID
			p.storyTitle = announcement.Title
			events = append(events, ParseEvent{
				Type:       EventStoryAnnounced,
				StoryID:    announcement.ID,
				StoryTitle: announcement.Title,
			})
		}
	}

	// Check for phase changes (heuristic based on common patterns)
	phase := detectPhase(line)
	if phase != "" && phase != p.currentPhase {
		p.currentPhase = phase
		events = append(events, ParseEvent{
			Type:  EventPhaseChanged,
			Phase: phase,
		})
	}

	// Check for quality gate indicators
	if strings.Contains(line, "Running quality gates") ||
		strings.Contains(line, "npm run typecheck") ||
		strings.Contains(line, "npm run lint") ||
		strings.Contains(line, "npm test") {
		events = append(events, ParseEvent{
			Type:    EventQualityGateStarted,
			Message: line,
		})
	}

	// Check for commit creation
	if strings.Contains(line, "git commit") || strings.Contains(line, "[STORY-") {
		events = append(events, ParseEvent{
			Type:    EventCommitCreated,
			Message: line,
		})
	}

	// Check for signal in accumulated buffer
	signal := domain.ParseSignal(p.buffer.String())
	if signal.Type != domain.SignalNone && signal.Type != p.lastSignal.Type {
		p.lastSignal = signal
		events = append(events, ParseEvent{
			Type:    EventSignalDetected,
			Signal:  signal,
			StoryID: p.storyID,
		})
	}

	return events
}

// GetLastSignal returns the last detected signal
func (p *OutputParser) GetLastSignal() domain.Signal {
	return p.lastSignal
}

// GetCurrentPhase returns the current detected phase
func (p *OutputParser) GetCurrentPhase() string {
	return p.currentPhase
}

// GetStoryInfo returns the current story ID and title
func (p *OutputParser) GetStoryInfo() (string, string) {
	return p.storyID, p.storyTitle
}

// Reset clears the parser state for a new iteration
func (p *OutputParser) Reset() {
	p.buffer.Reset()
	p.lastSignal = domain.Signal{}
	p.currentPhase = ""
	p.storyID = ""
	p.storyTitle = ""
}

// GetFullOutput returns all accumulated output
func (p *OutputParser) GetFullOutput() string {
	return p.buffer.String()
}

// detectPhase tries to identify the current execution phase from a line
func detectPhase(line string) string {
	line = strings.ToLower(line)

	// Research phase indicators
	if strings.Contains(line, "research") ||
		strings.Contains(line, "exploring") ||
		strings.Contains(line, "reading file") ||
		strings.Contains(line, "searching") {
		return "Research"
	}

	// Planning phase indicators
	if strings.Contains(line, "planning") ||
		strings.Contains(line, "designing") ||
		strings.Contains(line, "approach") {
		return "Planning"
	}

	// Implementation phase indicators
	if strings.Contains(line, "implementing") ||
		strings.Contains(line, "writing") ||
		strings.Contains(line, "creating") ||
		strings.Contains(line, "modifying") ||
		strings.Contains(line, "editing file") {
		return "Implementation"
	}

	// Quality gates phase
	if strings.Contains(line, "quality gate") ||
		strings.Contains(line, "typecheck") ||
		strings.Contains(line, "lint") ||
		strings.Contains(line, "test") ||
		strings.Contains(line, "npm run") {
		return "Quality Gates"
	}

	// Commit phase
	if strings.Contains(line, "commit") ||
		strings.Contains(line, "git add") {
		return "Committing"
	}

	return ""
}

// ExtractQualityGateResult parses a quality gate result from output
func ExtractQualityGateResult(output string) map[string]bool {
	results := make(map[string]bool)

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.ToLower(line)

		// Look for pass/fail indicators
		if strings.Contains(line, "typecheck") {
			results["typecheck"] = !strings.Contains(line, "fail") && !strings.Contains(line, "error")
		}
		if strings.Contains(line, "lint") {
			results["lint"] = !strings.Contains(line, "fail") && !strings.Contains(line, "error")
		}
		if strings.Contains(line, "test") {
			// Be more careful with test results
			if strings.Contains(line, "passed") || strings.Contains(line, "ok") {
				results["test"] = true
			} else if strings.Contains(line, "failed") || strings.Contains(line, "error") {
				results["test"] = false
			}
		}
	}

	return results
}
