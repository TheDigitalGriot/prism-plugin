package chat

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/styles"
)

// Message types
const (
	MessageTypeUser      = "user"
	MessageTypeAssistant = "assistant"
	MessageTypeTool      = "tool"
)

// PartType discriminates the kind of content within a structured message.
type PartType int

const (
	PartText       PartType = iota
	PartToolCall            // Tool invocation (start)
	PartToolResult          // Tool result
	PartThinking            // Extended thinking block
	PartAgent               // Subagent spawned via Task tool
)

// ContentPart is a structured unit within an assistant message.
type ContentPart struct {
	Type PartType

	// PartText / PartThinking
	Text string

	// PartToolCall / PartToolResult
	ToolName   string
	ToolInput  string // Human-readable summary of input
	ToolOutput string // For PartToolResult
	ToolStatus string // "running", "complete", "error"
	ToolID     string // Links tool_use to tool_result

	// PartAgent
	AgentID    string
	AgentName  string
	AgentType  string
	AgentParts []ContentPart // Nested content from the subagent
}

// Message represents a chat message.
type Message struct {
	Type    string        // "user", "assistant", "tool"
	Content string        // Legacy flat text (for user messages and backward compat)
	Parts   []ContentPart // Structured parts for assistant messages
	ToolID  string        // For tool messages
	Status  string        // "pending", "running", "complete", "error"
}

// ToolCall represents a tool invocation within a message (legacy helper).
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
		return renderAssistantMessage(msg, width)
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
// subtle background. If the message has structured Parts, each is rendered in
// order. Falls back to rendering Content as flat text for historical messages.
func renderAssistantMessage(msg Message, width int) string {
	barWidth := 2
	contentWidth := width - barWidth - 2
	if contentWidth < 20 {
		contentWidth = 20
	}

	barStyle := lipgloss.NewStyle().Foreground(styles.Primary)
	bgStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1f2e")).
		Width(width - barWidth)

	addBar := func(text string) string {
		lines := strings.Split(text, "\n")
		var result []string
		for _, line := range lines {
			bar := barStyle.Render("▎")
			padded := bgStyle.Render(" " + line)
			result = append(result, bar+padded)
		}
		return strings.Join(result, "\n")
	}

	// Part-based rendering for new messages.
	if len(msg.Parts) > 0 {
		var sections []string
		for _, part := range msg.Parts {
			sections = append(sections, renderPart(part, contentWidth, width))
		}
		return addBar(strings.Join(sections, "\n"))
	}

	// Backward compat: render flat Content string.
	rendered := renderMarkdownLite(msg.Content, contentWidth)
	return addBar(rendered)
}

// renderPart renders a single ContentPart.
func renderPart(part ContentPart, contentWidth, fullWidth int) string {
	switch part.Type {
	case PartText:
		return renderMarkdownLite(part.Text, contentWidth)

	case PartThinking:
		dimStyle := lipgloss.NewStyle().Foreground(styles.Dim).Italic(true)
		return dimStyle.Render("💭 " + truncatePart(part.Text, contentWidth-4))

	case PartToolCall:
		return renderToolPart(part, fullWidth, false)

	case PartToolResult:
		return renderToolResultPart(part, contentWidth)

	case PartAgent:
		return renderAgentPart(part, contentWidth, fullWidth, false)

	default:
		return ""
	}
}

// renderToolPart renders a PartToolCall as inline or block depending on complexity.
func renderToolPart(part ContentPart, width int, collapsed bool) string {
	var indicator string
	switch part.ToolStatus {
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
	header := indicator + toolStyle.Render(part.ToolName)

	if part.ToolInput != "" && !collapsed {
		descStyle := lipgloss.NewStyle().Foreground(styles.Dim)
		desc := truncatePart(part.ToolInput, width-lipgloss.Width(header)-4)
		header += " " + descStyle.Render(desc)
	}
	return header
}

// renderToolResultPart renders a PartToolResult (currently inline only).
func renderToolResultPart(part ContentPart, width int) string {
	if part.ToolOutput == "" {
		return ""
	}
	dimStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	return dimStyle.Render("  └ " + truncatePart(part.ToolOutput, width-6))
}

// renderAgentPart renders a PartAgent as a collapsible block.
func renderAgentPart(part ContentPart, contentWidth, fullWidth int, collapsed bool) string {
	statusIndicator := lipgloss.NewStyle().Foreground(styles.Info).Render("  • ")
	nameStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Info)
	header := statusIndicator + nameStyle.Render(part.AgentName)

	switch part.ToolStatus {
	case "complete":
		header = lipgloss.NewStyle().Foreground(styles.Success).Render("  ✓ ") +
			nameStyle.Render(part.AgentName)
	case "error":
		header = lipgloss.NewStyle().Foreground(styles.Error).Render("  ✗ ") +
			nameStyle.Render(part.AgentName)
	case "running":
		header = lipgloss.NewStyle().Foreground(styles.Info).Render("  ▸ ") +
			nameStyle.Render(part.AgentName)
	}

	if collapsed || len(part.AgentParts) == 0 {
		return header
	}

	// Expanded: render nested parts with indentation.
	var lines []string
	lines = append(lines, header)
	for _, nested := range part.AgentParts {
		inner := renderPart(nested, contentWidth-2, fullWidth-2)
		for _, l := range strings.Split(inner, "\n") {
			lines = append(lines, "    "+l)
		}
	}
	return strings.Join(lines, "\n")
}

// RenderParts renders a slice of ContentParts into a string suitable for
// appending below Glamour-rendered text in MarkdownMode.
func RenderParts(parts []ContentPart, width int, collapsed bool) string {
	if len(parts) == 0 {
		return ""
	}
	barWidth := 2
	contentWidth := width - barWidth - 2
	if contentWidth < 20 {
		contentWidth = 20
	}
	barStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#7c3aed"))
	bgStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1f2e")).
		Width(width - barWidth)

	addBar := func(text string) string {
		lines := strings.Split(text, "\n")
		var result []string
		for _, line := range lines {
			bar := barStyle.Render("▎")
			padded := bgStyle.Render(" " + line)
			result = append(result, bar+padded)
		}
		return strings.Join(result, "\n")
	}

	var sections []string
	for _, part := range parts {
		sections = append(sections, renderPart(part, contentWidth, width))
	}
	return addBar(strings.Join(sections, "\n"))
}

// truncatePart truncates text to fit within maxWidth visible characters.
func truncatePart(s string, maxWidth int) string {
	if maxWidth <= 0 {
		return ""
	}
	if lipgloss.Width(s) <= maxWidth {
		return s
	}
	// Trim runes until it fits with the ellipsis.
	runes := []rune(s)
	for len(runes) > 0 && lipgloss.Width(string(runes))+1 > maxWidth {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "…"
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
