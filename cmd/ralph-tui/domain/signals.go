package domain

import (
	"regexp"
	"strings"
)

// SignalType represents the type of signal detected in Claude output
type SignalType int

const (
	SignalNone SignalType = iota
	SignalComplete  // <promise>COMPLETE</promise>
	SignalContinue  // <ralph-continue>...</ralph-continue>
	SignalRetry     // <ralph-retry>...</ralph-retry>
	SignalBlocked   // <ralph-blocked>...</ralph-blocked>
	SignalError     // <ralph-error>...</ralph-error>
)

func (s SignalType) String() string {
	switch s {
	case SignalComplete:
		return "COMPLETE"
	case SignalContinue:
		return "CONTINUE"
	case SignalRetry:
		return "RETRY"
	case SignalBlocked:
		return "BLOCKED"
	case SignalError:
		return "ERROR"
	default:
		return "NONE"
	}
}

// Signal represents a parsed signal from Claude output
type Signal struct {
	Type    SignalType
	Content string
	Reason  string
}

// Signal pattern regexes
var (
	completeRe = regexp.MustCompile(`<promise>COMPLETE</promise>`)
	continueRe = regexp.MustCompile(`(?s)<ralph-continue>(.*?)</ralph-continue>`)
	retryRe    = regexp.MustCompile(`(?s)<ralph-retry[^>]*>(.*?)</ralph-retry>`)
	blockedRe  = regexp.MustCompile(`(?s)<ralph-blocked[^>]*>(.*?)</ralph-blocked>`)
	errorRe    = regexp.MustCompile(`(?s)<ralph-error[^>]*>(.*?)</ralph-error>`)
	storyRe    = regexp.MustCompile(`(?s)<ralph-story>(.*?)</ralph-story>`)
	reasonRe   = regexp.MustCompile(`reason="([^"]*)"`)
)

// ParseSignal detects and extracts the first signal found in output text
func ParseSignal(output string) Signal {
	// Check for completion first (highest priority)
	if completeRe.MatchString(output) {
		return Signal{Type: SignalComplete}
	}

	// Check for error (second highest - fatal)
	if match := errorRe.FindStringSubmatch(output); match != nil {
		reason := extractReason(output, errorRe)
		return Signal{
			Type:    SignalError,
			Content: strings.TrimSpace(match[1]),
			Reason:  reason,
		}
	}

	// Check for retry
	if match := retryRe.FindStringSubmatch(output); match != nil {
		reason := extractReason(output, retryRe)
		return Signal{
			Type:    SignalRetry,
			Content: strings.TrimSpace(match[1]),
			Reason:  reason,
		}
	}

	// Check for blocked
	if match := blockedRe.FindStringSubmatch(output); match != nil {
		reason := extractReason(output, blockedRe)
		return Signal{
			Type:    SignalBlocked,
			Content: strings.TrimSpace(match[1]),
			Reason:  reason,
		}
	}

	// Check for continue
	if match := continueRe.FindStringSubmatch(output); match != nil {
		return Signal{
			Type:    SignalContinue,
			Content: strings.TrimSpace(match[1]),
		}
	}

	return Signal{Type: SignalNone}
}

// extractReason extracts the reason attribute from a signal tag
func extractReason(output string, tagRe *regexp.Regexp) string {
	// Find the tag first
	tagMatch := tagRe.FindString(output)
	if tagMatch == "" {
		return ""
	}

	// Look for reason attribute
	if match := reasonRe.FindStringSubmatch(tagMatch); match != nil {
		return match[1]
	}

	return ""
}

// StoryAnnouncement represents a parsed <ralph-story> tag
type StoryAnnouncement struct {
	ID       string
	Title    string
	Priority string
	Files    []string
}

// ParseStoryAnnouncement extracts story info from <ralph-story> tag
func ParseStoryAnnouncement(output string) *StoryAnnouncement {
	match := storyRe.FindStringSubmatch(output)
	if match == nil {
		return nil
	}

	content := match[1]
	announcement := &StoryAnnouncement{}

	// Parse ID: line
	idRe := regexp.MustCompile(`ID:\s*(\S+)`)
	if m := idRe.FindStringSubmatch(content); m != nil {
		announcement.ID = m[1]
	}

	// Parse Title: line
	titleRe := regexp.MustCompile(`Title:\s*(.+)`)
	if m := titleRe.FindStringSubmatch(content); m != nil {
		announcement.Title = strings.TrimSpace(m[1])
	}

	// Parse Priority: line
	priorityRe := regexp.MustCompile(`Priority:\s*(\d+)`)
	if m := priorityRe.FindStringSubmatch(content); m != nil {
		announcement.Priority = m[1]
	}

	// Parse Files: section (multi-line)
	filesRe := regexp.MustCompile(`Files:\s*\n((?:\s*-\s*.+\n?)+)`)
	if m := filesRe.FindStringSubmatch(content); m != nil {
		fileLines := strings.Split(m[1], "\n")
		for _, line := range fileLines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "-") {
				file := strings.TrimSpace(strings.TrimPrefix(line, "-"))
				if file != "" {
					announcement.Files = append(announcement.Files, file)
				}
			}
		}
	}

	if announcement.ID == "" {
		return nil
	}

	return announcement
}

// ContainsSignal checks if the output contains any signal
func ContainsSignal(output string) bool {
	return ParseSignal(output).Type != SignalNone
}

// ExtractStoryID tries to extract a story ID from continue/complete signals
func ExtractStoryID(content string) string {
	// Look for patterns like "STORY_COMPLETE: STORY-001" or just "STORY-001"
	storyIDRe := regexp.MustCompile(`(STORY-\d+)`)
	if match := storyIDRe.FindStringSubmatch(content); match != nil {
		return match[1]
	}
	return ""
}
