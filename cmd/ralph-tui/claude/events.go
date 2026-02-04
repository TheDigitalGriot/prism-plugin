package claude

import (
	"encoding/json"
	"strings"
)

// StreamEvent represents a parsed event from Claude's stream-json output
type StreamEvent struct {
	Type    string `json:"type"`
	Subtype string `json:"subtype,omitempty"`

	// For tool_use events
	ToolUseID string   `json:"tool_use_id,omitempty"`
	Tool      *ToolUse `json:"tool,omitempty"`

	// For assistant message events
	Message *AssistantMessage `json:"message,omitempty"`

	// For result events
	Result   string `json:"result,omitempty"`
	IsError  bool   `json:"is_error,omitempty"`
	Duration int    `json:"duration_ms,omitempty"`
}

// ToolUse represents a tool being used by Claude
type ToolUse struct {
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input,omitempty"`
}

// AssistantMessage represents Claude's response message
type AssistantMessage struct {
	Content []ContentBlock `json:"content,omitempty"`
}

// ContentBlock represents a content block in Claude's response
type ContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ToolUseID string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
}

// ToolInput common fields for tool inputs
type ToolInput struct {
	Command     string `json:"command,omitempty"`
	FilePath    string `json:"file_path,omitempty"`
	Pattern     string `json:"pattern,omitempty"`
	Description string `json:"description,omitempty"`
	Prompt      string `json:"prompt,omitempty"`
	URL         string `json:"url,omitempty"`
}

// ParseStreamEvent parses a JSON line from stream-json output
func ParseStreamEvent(line string) (*StreamEvent, error) {
	var event StreamEvent
	if err := json.Unmarshal([]byte(line), &event); err != nil {
		return nil, err
	}
	return &event, nil
}

// ExtractToolActivity extracts a human-readable description of tool activity
func ExtractToolActivity(event *StreamEvent) string {
	// Handle assistant messages with tool_use content blocks
	if event.Type == "assistant" && event.Message != nil {
		for _, block := range event.Message.Content {
			if block.Type == "tool_use" {
				return formatToolUse(block.Name, block.Input)
			}
		}
		// Check for text content
		for _, block := range event.Message.Content {
			if block.Type == "text" && block.Text != "" {
				// Return first line of text, truncated
				text := strings.Split(block.Text, "\n")[0]
				if len(text) > 80 {
					text = text[:77] + "..."
				}
				return text
			}
		}
	}

	// Handle tool_result events
	if event.Type == "tool_result" {
		return "Processing tool result..."
	}

	// Handle result events
	if event.Type == "result" {
		if event.IsError {
			return "Error: " + truncate(event.Result, 60)
		}
		return "Completed"
	}

	return ""
}

// formatToolUse creates a human-readable description of a tool being used
func formatToolUse(toolName string, inputRaw json.RawMessage) string {
	var input ToolInput
	json.Unmarshal(inputRaw, &input)

	switch toolName {
	case "Read":
		if input.FilePath != "" {
			return "Reading: " + shortenPath(input.FilePath)
		}
		return "Reading file..."

	case "Edit":
		if input.FilePath != "" {
			return "Editing: " + shortenPath(input.FilePath)
		}
		return "Editing file..."

	case "Write":
		if input.FilePath != "" {
			return "Writing: " + shortenPath(input.FilePath)
		}
		return "Writing file..."

	case "Bash":
		if input.Command != "" {
			cmd := truncate(input.Command, 50)
			return "Running: " + cmd
		}
		if input.Description != "" {
			return "Running: " + truncate(input.Description, 50)
		}
		return "Running command..."

	case "Glob":
		if input.Pattern != "" {
			return "Finding: " + input.Pattern
		}
		return "Searching files..."

	case "Grep":
		if input.Pattern != "" {
			return "Searching: " + truncate(input.Pattern, 40)
		}
		return "Searching content..."

	case "Task":
		if input.Description != "" {
			return "Agent: " + truncate(input.Description, 50)
		}
		return "Spawning agent..."

	case "WebFetch":
		if input.URL != "" {
			return "Fetching: " + truncate(input.URL, 50)
		}
		return "Fetching URL..."

	case "WebSearch":
		return "Web search..."

	case "TodoWrite":
		return "Updating tasks..."

	case "AskUserQuestion":
		return "Asking question..."

	default:
		return "Using: " + toolName
	}
}

// shortenPath shortens a file path for display
func shortenPath(path string) string {
	// Replace backslashes with forward slashes for consistency
	path = strings.ReplaceAll(path, "\\", "/")

	// If path is short enough, return as-is
	if len(path) <= 50 {
		return path
	}

	// Try to show just the filename or last few path components
	parts := strings.Split(path, "/")
	if len(parts) >= 2 {
		return ".../" + strings.Join(parts[len(parts)-2:], "/")
	}

	return truncate(path, 50)
}

// truncate truncates a string to max length with ellipsis
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}
