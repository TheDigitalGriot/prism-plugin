package diff

import (
	"path/filepath"
	"strings"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/lexers"
	chromaStyles "github.com/alecthomas/chroma/v2/styles"
	"github.com/charmbracelet/lipgloss"
)

// defaultSyntaxTheme is the Chroma style used for syntax highlighting.
// "monokai" works well against dark terminal backgrounds.
const defaultSyntaxTheme = "monokai"

// SyntaxHighlighter provides syntax highlighting for diff content using Chroma.
type SyntaxHighlighter struct {
	lexer chroma.Lexer
	style *chroma.Style
}

// NewSyntaxHighlighter creates a highlighter for the given filename.
// Returns nil if no lexer is available for the file type.
func NewSyntaxHighlighter(filename string) *SyntaxHighlighter {
	lexer := lexers.Match(filename)
	if lexer == nil {
		ext := filepath.Ext(filename)
		if ext != "" {
			lexer = lexers.Get(ext)
		}
	}
	if lexer == nil {
		return nil
	}

	style := chromaStyles.Get(defaultSyntaxTheme)
	if style == nil {
		style = chromaStyles.Fallback
	}

	return &SyntaxHighlighter{
		lexer: chroma.Coalesce(lexer),
		style: style,
	}
}

// HighlightSegment represents a segment of highlighted text.
type HighlightSegment struct {
	Text  string
	Style lipgloss.Style
}

// Highlight tokenizes and highlights a line of code.
func (h *SyntaxHighlighter) Highlight(line string) []HighlightSegment {
	if h == nil || h.lexer == nil {
		return []HighlightSegment{{Text: line, Style: lipgloss.NewStyle()}}
	}

	iterator, err := h.lexer.Tokenise(nil, line)
	if err != nil {
		return []HighlightSegment{{Text: line, Style: lipgloss.NewStyle()}}
	}

	var segments []HighlightSegment
	for _, token := range iterator.Tokens() {
		text := strings.TrimSuffix(token.Value, "\n")
		if text == "" {
			continue
		}
		style := h.tokenStyle(token.Type)
		segments = append(segments, HighlightSegment{
			Text:  text,
			Style: style,
		})
	}

	return segments
}

// tokenStyle converts a Chroma token type to a lipgloss style.
func (h *SyntaxHighlighter) tokenStyle(tokenType chroma.TokenType) lipgloss.Style {
	entry := h.style.Get(tokenType)
	style := lipgloss.NewStyle()

	if entry.Colour.IsSet() {
		style = style.Foreground(lipgloss.Color(entry.Colour.String()))
	}
	if entry.Bold == chroma.Yes {
		style = style.Bold(true)
	}
	if entry.Underline == chroma.Yes {
		style = style.Underline(true)
	}

	return style
}

// HighlightLine highlights a single line of code, returning styled segments.
func (h *SyntaxHighlighter) HighlightLine(content string) []HighlightSegment {
	return h.Highlight(content)
}
