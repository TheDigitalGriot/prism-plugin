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

// renderUserMessage renders a user message with "> " prompt prefix (opencode style)
func renderUserMessage(content string, width int) string {
	promptStyle := lipgloss.NewStyle().Foreground(styles.Info).Bold(true)
	contentStyle := lipgloss.NewStyle().Foreground(styles.White)

	contentWidth := width - 4
	if contentWidth < 20 {
		contentWidth = 20
	}
	wrapped := wrapText(content, contentWidth)
	lines := strings.Split(wrapped, "\n")

	var result []string
	for i, line := range lines {
		if i == 0 {
			result = append(result, promptStyle.Render("> ")+contentStyle.Render(line))
		} else {
			result = append(result, "  "+contentStyle.Render(line))
		}
	}
	return strings.Join(result, "\n")
}

// renderAssistantMessage renders assistant output with a colored left bar and
// subtle background, inspired by the opencode chat style.
func renderAssistantMessage(content string, width int) string {
	// The left accent bar is 1 char ("▎") + 1 space padding = 2 chars of chrome
	barWidth := 2
	contentWidth := width - barWidth - 2
	if contentWidth < 20 {
		contentWidth = 20
	}

	rendered := renderMarkdownLite(content, contentWidth)
	lines := strings.Split(rendered, "\n")

	barStyle := lipgloss.NewStyle().Foreground(styles.Primary)
	bgStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1f2e")).
		Width(width - barWidth)

	var result []string
	for _, line := range lines {
		bar := barStyle.Render("▎")
		padded := bgStyle.Render(" " + line)
		result = append(result, bar+padded)
	}
	return strings.Join(result, "\n")
}

// renderToolMessage renders a tool call as a compact single-line status indicator
func renderToolMessage(toolName, description, status string, width int, collapsed bool) string {
	var indicator string
	switch status {
	case "running":
		indicator = lipgloss.NewStyle().Foreground(styles.Info).Render("  ▸ ")
	case "complete":
		indicator = lipgloss.NewStyle().Foreground(styles.Success).Render("  ✓ ")
	case "error":
		indicator = lipgloss.NewStyle().Foreground(styles.Error).Render("  ✗ ")
	default:
		indicator = lipgloss.NewStyle().Foreground(styles.Dim).Render("  ○ ")
	}

	toolStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Info)
	header := indicator + toolStyle.Render(toolName)

	if description != "" && !collapsed {
		descStyle := lipgloss.NewStyle().Foreground(styles.Dim)
		desc := description
		maxDesc := width - lipgloss.Width(header) - 4
		if maxDesc > 0 && lipgloss.Width(desc) > maxDesc {
			desc = desc[:maxDesc-1] + "…"
		}
		header += " " + descStyle.Render(desc)
	}

	return header
}

// renderMarkdownLite renders basic markdown formatting
func renderMarkdownLite(content string, width int) string {
	lines := strings.Split(content, "\n")
	var rendered []string

	inCodeBlock := false
	codeBlockLines := []string{}

	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			if inCodeBlock {
				codeBlock := renderCodeBlock(codeBlockLines, width)
				rendered = append(rendered, codeBlock)
				codeBlockLines = []string{}
				inCodeBlock = false
				continue
			} else {
				inCodeBlock = true
				continue
			}
		}

		if inCodeBlock {
			codeBlockLines = append(codeBlockLines, line)
			continue
		}

		processed := processInlineMarkdown(line)

		if strings.HasPrefix(strings.TrimSpace(line), "- ") || strings.HasPrefix(strings.TrimSpace(line), "* ") {
			processed = "  • " + strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(strings.TrimSpace(line), "-"), "*"))
		}

		rendered = append(rendered, processed)
	}

	if inCodeBlock && len(codeBlockLines) > 0 {
		codeBlock := renderCodeBlock(codeBlockLines, width)
		rendered = append(rendered, codeBlock)
	}

	return strings.Join(rendered, "\n")
}

// processInlineMarkdown handles **bold** and `code` formatting
func processInlineMarkdown(text string) string {
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
		if lipgloss.Width(currentLine+" "+word) > width {
			lines = append(lines, currentLine)
			currentLine = word
		} else {
			currentLine += " " + word
		}
	}

	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return strings.Join(lines, "\n")
}
