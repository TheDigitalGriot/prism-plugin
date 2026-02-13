package chat

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/styles"
)

// Message types
const (
	MessageTypeUser      = "user"
	MessageTypeAssistant = "assistant"
	MessageTypeTool      = "tool"
)

// Message represents a chat message
type Message struct {
	Type    string // "user", "assistant", "tool"
	Content string
	ToolID  string // For tool messages
	Status  string // "pending", "running", "complete", "error"
}

// ToolCall represents a tool invocation within a message
type ToolCall struct {
	Name        string
	Description string
	Status      string // "pending", "running", "complete", "error"
	Collapsed   bool
}

// RenderMessage renders a single chat message based on type
func RenderMessage(msg Message, width int, collapsed bool) string {
	switch msg.Type {
	case MessageTypeUser:
		return renderUserMessage(msg.Content, width)
	case MessageTypeAssistant:
		return renderAssistantMessage(msg.Content, width)
	case MessageTypeTool:
		return renderToolMessage(msg.ToolID, msg.Content, msg.Status, width, collapsed)
	default:
		return ""
	}
}

// renderUserMessage renders a user message as a right-aligned bubble with blue border
func renderUserMessage(content string, width int) string {
	// User message style: blue border, right-aligned
	bubbleWidth := width - 20 // Leave space on the left for right-alignment
	if bubbleWidth < 30 {
		bubbleWidth = 30
	}
	if bubbleWidth > 60 {
		bubbleWidth = 60
	}

	// Wrap content to fit bubble width
	wrapped := wrapText(content, bubbleWidth-4)

	// Create bubble with blue border
	bubbleStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Info).
		Padding(0, 1).
		Width(bubbleWidth).
		Align(lipgloss.Left)

	bubble := bubbleStyle.Render(wrapped)

	// Right-align the bubble
	leftPadding := width - lipgloss.Width(bubble) - 2
	if leftPadding < 0 {
		leftPadding = 0
	}

	return strings.Repeat(" ", leftPadding) + bubble
}

// renderAssistantMessage renders an assistant message as left-aligned content
func renderAssistantMessage(content string, width int) string {
	// Assistant message style: left-aligned, subtle border
	bubbleWidth := width - 10
	if bubbleWidth < 40 {
		bubbleWidth = 40
	}
	if bubbleWidth > 80 {
		bubbleWidth = 80
	}

	// Parse and render markdown-lite
	rendered := renderMarkdownLite(content, bubbleWidth-4)

	// Create content area with subtle border
	bubbleStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Dim).
		Padding(0, 1).
		Width(bubbleWidth).
		Align(lipgloss.Left)

	return "  " + bubbleStyle.Render(rendered)
}

// renderToolMessage renders a tool call with icon, name, and status
func renderToolMessage(toolName, description, status string, width int, collapsed bool) string {
	// Icon based on status
	icon := "○"
	iconColor := styles.Dim
	switch status {
	case "running":
		icon = "▸"
		iconColor = styles.Info
	case "complete":
		icon = "✓"
		iconColor = styles.Success
	case "error":
		icon = "✗"
		iconColor = styles.Error
	}

	styledIcon := lipgloss.NewStyle().Foreground(iconColor).Render(icon)

	// Tool name styling
	toolStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Info)
	toolNameStyled := toolStyle.Render(toolName)

	// Status badge
	statusBadge := ""
	switch status {
	case "running":
		statusBadge = styles.InfoStyle.Render(" [running]")
	case "complete":
		statusBadge = styles.SuccessStyle.Render(" [done]")
	case "error":
		statusBadge = styles.ErrorStyle.Render(" [error]")
	}

	// Header line
	header := "  " + styledIcon + " " + toolNameStyled + statusBadge

	if collapsed || description == "" {
		return header
	}

	// Expanded view: show description/details
	detailStyle := lipgloss.NewStyle().
		Foreground(styles.Dim).
		PaddingLeft(4)

	wrapped := wrapText(description, width-8)
	details := detailStyle.Render(wrapped)

	return header + "\n" + details
}

// renderMarkdownLite renders basic markdown formatting
// Supports: **bold**, `code`, code blocks, and lists
func renderMarkdownLite(content string, width int) string {
	lines := strings.Split(content, "\n")
	var rendered []string

	inCodeBlock := false
	codeBlockLines := []string{}

	for _, line := range lines {
		// Code block detection
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			if inCodeBlock {
				// End code block
				codeBlock := renderCodeBlock(codeBlockLines, width)
				rendered = append(rendered, codeBlock)
				codeBlockLines = []string{}
				inCodeBlock = false
				continue
			} else {
				// Start code block
				inCodeBlock = true
				continue
			}
		}

		if inCodeBlock {
			codeBlockLines = append(codeBlockLines, line)
			continue
		}

		// Process inline markdown
		processed := processInlineMarkdown(line)

		// List detection
		if strings.HasPrefix(strings.TrimSpace(line), "- ") || strings.HasPrefix(strings.TrimSpace(line), "* ") {
			processed = "  • " + strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(strings.TrimSpace(line), "-"), "*"))
		}

		rendered = append(rendered, processed)
	}

	// Handle unclosed code block
	if inCodeBlock && len(codeBlockLines) > 0 {
		codeBlock := renderCodeBlock(codeBlockLines, width)
		rendered = append(rendered, codeBlock)
	}

	return strings.Join(rendered, "\n")
}

// processInlineMarkdown handles **bold** and `code` formatting
func processInlineMarkdown(text string) string {
	// Process **bold**
	result := text
	for strings.Contains(result, "**") {
		start := strings.Index(result, "**")
		if start == -1 {
			break
		}
		end := strings.Index(result[start+2:], "**")
		if end == -1 {
			break
		}
		end += start + 2

		boldText := result[start+2 : end]
		styledBold := lipgloss.NewStyle().Bold(true).Render(boldText)
		result = result[:start] + styledBold + result[end+2:]
	}

	// Process `code`
	for strings.Contains(result, "`") {
		start := strings.Index(result, "`")
		if start == -1 {
			break
		}
		end := strings.Index(result[start+1:], "`")
		if end == -1 {
			break
		}
		end += start + 1

		codeText := result[start+1 : end]
		styledCode := lipgloss.NewStyle().
			Foreground(lipgloss.Color("#F59E0B")).
			Background(lipgloss.Color("#1F2937")).
			Render(codeText)
		result = result[:start] + styledCode + result[end+1:]
	}

	return result
}

// renderCodeBlock renders a code block with syntax styling
func renderCodeBlock(lines []string, width int) string {
	codeStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#F59E0B")).
		Background(lipgloss.Color("#1F2937")).
		Padding(0, 1).
		Width(width)

	content := strings.Join(lines, "\n")
	return codeStyle.Render(content)
}

// wrapText wraps text to the specified width
func wrapText(text string, width int) string {
	if width <= 0 {
		width = 40
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return text
	}

	var lines []string
	currentLine := words[0]

	for _, word := range words[1:] {
		// Check if adding this word would exceed width
		if lipgloss.Width(currentLine+" "+word) > width {
			lines = append(lines, currentLine)
			currentLine = word
		} else {
			currentLine += " " + word
		}
	}

	// Add the last line
	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return strings.Join(lines, "\n")
}
