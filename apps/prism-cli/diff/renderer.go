package diff

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/styles"
)

// ── Diff display styles (adapted from Sidecar to Prism brand colors) ─────────

var (
	diffAddStyle     = lipgloss.NewStyle().Foreground(styles.Success)
	diffRemoveStyle  = lipgloss.NewStyle().Foreground(styles.Error)
	diffContextStyle = lipgloss.NewStyle().Foreground(styles.Dim)

	diffAddBg    = lipgloss.Color("#1a3a2a") // Subtle dark green background
	diffRemoveBg = lipgloss.Color("#3a1a1a") // Subtle dark red background

	wordDiffAddStyle = lipgloss.NewStyle().
				Foreground(styles.Success).
				Background(lipgloss.Color("#1a3a2a")).
				Bold(true)

	wordDiffRemoveStyle = lipgloss.NewStyle().
				Foreground(styles.Error).
				Background(lipgloss.Color("#3a1a1a")).
				Bold(true)

	hunkHeaderStyle = lipgloss.NewStyle().
			Foreground(styles.Info).
			Bold(true)

	sideBySideBorderStyle = lipgloss.NewStyle().
				Foreground(styles.BorderNormal)

	fileHeaderStyle = lipgloss.NewStyle().
			Foreground(styles.White).
			Bold(true)

	lineNoStyle = lipgloss.NewStyle().Foreground(styles.Dim)

	muted = lipgloss.NewStyle().Foreground(styles.Dim)
)

// ── Unified (line) diff renderer ─────────────────────────────────────────────

// RenderLineDiff renders a parsed diff in unified line-by-line format with line numbers.
// horizontalOffset scrolls the content horizontally (0 = no scroll).
// highlighter is optional — if nil, no syntax highlighting is applied.
// wrapEnabled wraps long lines instead of truncating them.
func RenderLineDiff(diff *ParsedDiff, width, startLine, maxLines, horizontalOffset int, highlighter *SyntaxHighlighter, wrapEnabled bool) string {
	if diff == nil || diff.Binary {
		if diff != nil && diff.Binary {
			return muted.Render(" Binary file differs")
		}
		return muted.Render(" No diff content")
	}

	var sb strings.Builder
	lineNum := 0
	rendered := 0

	maxLineNo := diff.MaxLineNumber()
	lineNoWidth := len(fmt.Sprintf("%d", maxLineNo))
	if lineNoWidth < 4 {
		lineNoWidth = 4
	}

	lnStyle := lineNoStyle.Width(lineNoWidth).Align(lipgloss.Right)

	contentWidth := width - (lineNoWidth*2 + 4) // Two line numbers + separators
	isFirstHunk := true

	for _, hunk := range diff.Hunks {
		if lineNum < startLine {
			lineNum++
			if lineNum > startLine {
				if !isFirstHunk && rendered < maxLines {
					sb.WriteString("\n")
					rendered++
				}
				header := truncateLine(fmt.Sprintf("@@ -%d,%d +%d,%d @@%s",
					hunk.OldStart, hunk.OldCount, hunk.NewStart, hunk.NewCount, hunk.Header), contentWidth)
				sb.WriteString(hunkHeaderStyle.Render(header))
				sb.WriteString("\n")
				rendered++
				isFirstHunk = false
			}
		} else {
			if !isFirstHunk && rendered < maxLines {
				sb.WriteString("\n")
				rendered++
			}
			header := truncateLine(fmt.Sprintf("@@ -%d,%d +%d,%d @@%s",
				hunk.OldStart, hunk.OldCount, hunk.NewStart, hunk.NewCount, hunk.Header), contentWidth)
			sb.WriteString(hunkHeaderStyle.Render(header))
			sb.WriteString("\n")
			rendered++
			isFirstHunk = false
		}

		if rendered >= maxLines {
			break
		}

		for _, line := range hunk.Lines {
			lineNum++
			if lineNum <= startLine {
				continue
			}
			if rendered >= maxLines {
				break
			}

			oldNo := " "
			newNo := " "
			if line.OldLineNo > 0 {
				oldNo = fmt.Sprintf("%d", line.OldLineNo)
			}
			if line.NewLineNo > 0 {
				newNo = fmt.Sprintf("%d", line.NewLineNo)
			}

			lineNos := fmt.Sprintf("%s %s │ ",
				lnStyle.Render(oldNo),
				lnStyle.Render(newNo))

			if wrapEnabled {
				content := renderDiffContent(line, contentWidth*10, highlighter)
				wrapped := lipgloss.NewStyle().Width(contentWidth).Render(content)
				wrappedLines := strings.Split(wrapped, "\n")
				lineNosPad := strings.Repeat(" ", lineNoWidth*2+4)
				for wi, wl := range wrappedLines {
					if rendered >= maxLines {
						break
					}
					if wi == 0 {
						sb.WriteString(lineNos)
					} else {
						sb.WriteString(lineNosPad)
					}
					sb.WriteString(wl)
					sb.WriteString("\n")
					rendered++
				}
			} else {
				content := renderDiffContentWithOffset(line, contentWidth, horizontalOffset, highlighter)
				sb.WriteString(lineNos)
				sb.WriteString(content)
				sb.WriteString("\n")
				rendered++
			}
		}

		if rendered >= maxLines {
			break
		}
	}

	return sb.String()
}

// ── Side-by-side diff renderer ───────────────────────────────────────────────

// linePair represents a pair of lines for side-by-side view.
type linePair struct {
	left  *DiffLine
	right *DiffLine
}

// RenderSideBySide renders a parsed diff in side-by-side format.
func RenderSideBySide(diff *ParsedDiff, width, startLine, maxLines, horizontalOffset int, highlighter *SyntaxHighlighter, wrapEnabled bool) string {
	if diff == nil || diff.Binary {
		if diff != nil && diff.Binary {
			return muted.Render(" Binary file differs")
		}
		return muted.Render(" No diff content")
	}

	var sb strings.Builder
	lineNum := 0
	rendered := 0

	panelWidth := (width - 3) / 2
	lnWidth := 5
	contentWidth := panelWidth - lnWidth - 2

	lnStyle := lineNoStyle.Width(lnWidth).Align(lipgloss.Right)

	isFirstHunk := true
	for _, hunk := range diff.Hunks {
		if rendered >= maxLines {
			break
		}

		if lineNum >= startLine {
			if !isFirstHunk && rendered < maxLines {
				sb.WriteString("\n")
				rendered++
			}
			header := fmt.Sprintf("@@ -%d,%d +%d,%d @@",
				hunk.OldStart, hunk.OldCount, hunk.NewStart, hunk.NewCount)
			sb.WriteString(hunkHeaderStyle.Render(padRight(header, width-1)))
			sb.WriteString("\n")
			rendered++
			isFirstHunk = false
		}
		lineNum++

		pairs := groupLinesForSideBySide(hunk.Lines)

		for _, pair := range pairs {
			if rendered >= maxLines {
				break
			}
			if lineNum <= startLine {
				lineNum++
				continue
			}

			leftLineNo := " "
			leftRendered := ""
			if pair.left != nil {
				if pair.left.OldLineNo > 0 {
					leftLineNo = fmt.Sprintf("%d", pair.left.OldLineNo)
				}
				if wrapEnabled {
					leftRendered = renderSideBySideContent(pair.left.Content, pair.left.Type, contentWidth*10, highlighter)
				} else {
					leftRendered = renderSideBySideContent(pair.left.Content, pair.left.Type, contentWidth+horizontalOffset, highlighter)
					if horizontalOffset > 0 {
						leftRendered = truncateLeft(leftRendered, horizontalOffset)
					}
				}
			}

			rightLineNo := " "
			rightRendered := ""
			if pair.right != nil {
				if pair.right.NewLineNo > 0 {
					rightLineNo = fmt.Sprintf("%d", pair.right.NewLineNo)
				}
				if wrapEnabled {
					rightRendered = renderSideBySideContent(pair.right.Content, pair.right.Type, contentWidth*10, highlighter)
				} else {
					rightRendered = renderSideBySideContent(pair.right.Content, pair.right.Type, contentWidth+horizontalOffset, highlighter)
					if horizontalOffset > 0 {
						rightRendered = truncateLeft(rightRendered, horizontalOffset)
					}
				}
			}

			if wrapEnabled {
				wrapStyle := lipgloss.NewStyle().Width(contentWidth)
				leftWrapped := wrapStyle.Render(leftRendered)
				rightWrapped := wrapStyle.Render(rightRendered)
				leftLines := strings.Split(leftWrapped, "\n")
				rightLines := strings.Split(rightWrapped, "\n")
				maxH := len(leftLines)
				if len(rightLines) > maxH {
					maxH = len(rightLines)
				}
				lineNoPad := strings.Repeat(" ", lnWidth)
				sep := sideBySideBorderStyle.Render(" │ ")
				for vi := 0; vi < maxH; vi++ {
					if rendered >= maxLines {
						break
					}
					lLine := ""
					if vi < len(leftLines) {
						lLine = leftLines[vi]
					}
					rLine := ""
					if vi < len(rightLines) {
						rLine = rightLines[vi]
					}
					lLine = padToWidth(lLine, contentWidth)
					rLine = padToWidth(rLine, contentWidth)
					if vi == 0 {
						sb.WriteString(fmt.Sprintf("%s │%s", lnStyle.Render(leftLineNo), lLine))
						sb.WriteString(sep)
						sb.WriteString(fmt.Sprintf("%s │%s", lnStyle.Render(rightLineNo), rLine))
					} else {
						sb.WriteString(fmt.Sprintf("%s │%s", lineNoPad, lLine))
						sb.WriteString(sep)
						sb.WriteString(fmt.Sprintf("%s │%s", lineNoPad, rLine))
					}
					sb.WriteString("\n")
					rendered++
				}
			} else {
				leftRendered = padToWidth(leftRendered, contentWidth)
				rightRendered = padToWidth(rightRendered, contentWidth)

				leftPanel := fmt.Sprintf("%s │%s",
					lnStyle.Render(leftLineNo), leftRendered)
				rightPanel := fmt.Sprintf("%s │%s",
					lnStyle.Render(rightLineNo), rightRendered)

				sb.WriteString(leftPanel)
				sb.WriteString(sideBySideBorderStyle.Render(" │ "))
				sb.WriteString(rightPanel)
				sb.WriteString("\n")
				rendered++
			}
			lineNum++
		}
	}

	return sb.String()
}

// groupLinesForSideBySide groups diff lines into pairs for side-by-side display.
func groupLinesForSideBySide(lines []DiffLine) []linePair {
	var pairs []linePair
	i := 0

	for i < len(lines) {
		line := &lines[i]
		switch line.Type {
		case LineContext:
			pairs = append(pairs, linePair{left: line, right: line})
			i++

		case LineRemove:
			removeStart := i
			for i < len(lines) && lines[i].Type == LineRemove {
				i++
			}
			removeEnd := i

			addStart := i
			for i < len(lines) && lines[i].Type == LineAdd {
				i++
			}
			addEnd := i

			removeCount := removeEnd - removeStart
			addCount := addEnd - addStart
			maxPairs := removeCount
			if addCount > maxPairs {
				maxPairs = addCount
			}

			for j := 0; j < maxPairs; j++ {
				var left, right *DiffLine
				if j < removeCount {
					left = &lines[removeStart+j]
				}
				if j < addCount {
					right = &lines[addStart+j]
				}
				pairs = append(pairs, linePair{left: left, right: right})
			}

		case LineAdd:
			pairs = append(pairs, linePair{left: nil, right: line})
			i++
		}
	}

	return pairs
}

// ── Multi-file diff renderer ─────────────────────────────────────────────────

// RenderFileHeader renders a file header bar for the diff.
func RenderFileHeader(filename, stats string, width int) string {
	prefix := "── "
	suffix := " "
	if stats != "" {
		suffix = " (" + stats + ") "
	}

	usedWidth := lipgloss.Width(prefix) + lipgloss.Width(filename) + lipgloss.Width(suffix)
	fillWidth := width - usedWidth
	if fillWidth < 0 {
		fillWidth = 0
	}

	fill := strings.Repeat("─", fillWidth)
	header := prefix + filename + suffix + fill
	return fileHeaderStyle.Width(width).Render(header)
}

// RenderMultiFileDiff renders a multi-file diff with file headers.
func RenderMultiFileDiff(mfd *MultiFileDiff, mode DiffViewMode, width, startLine, maxLines, horizontalOffset int, wrapEnabled bool) string {
	if mfd == nil || len(mfd.Files) == 0 {
		return muted.Render(" No diff content")
	}

	var sb strings.Builder
	currentLine := 0
	rendered := 0

	for i := range mfd.Files {
		file := &mfd.Files[i]
		file.StartLine = currentLine

		if currentLine >= startLine && rendered < maxLines {
			header := RenderFileHeader(file.FileName(), file.ChangeStats(), width)
			sb.WriteString(header)
			sb.WriteString("\n")
			rendered++
		}
		currentLine++

		var highlighter *SyntaxHighlighter
		if file.Diff.NewFile != "" {
			highlighter = NewSyntaxHighlighter(file.Diff.NewFile)
		}

		fileContent := renderSingleFileDiff(file.Diff, mode, width, startLine-currentLine, maxLines-rendered, horizontalOffset, highlighter, wrapEnabled)
		fileLines := strings.Split(fileContent, "\n")

		for _, line := range fileLines {
			if currentLine >= startLine && rendered < maxLines {
				sb.WriteString(line)
				sb.WriteString("\n")
				rendered++
			}
			currentLine++
			if rendered >= maxLines {
				break
			}
		}

		file.EndLine = currentLine

		if i < len(mfd.Files)-1 && rendered < maxLines {
			if currentLine >= startLine {
				sb.WriteString("\n")
				rendered++
			}
			currentLine++
		}

		if rendered >= maxLines {
			break
		}
	}

	return strings.TrimSuffix(sb.String(), "\n")
}

// renderSingleFileDiff renders a single file's diff without the file header.
func renderSingleFileDiff(diff *ParsedDiff, mode DiffViewMode, width, startLine, maxLines, horizontalOffset int, highlighter *SyntaxHighlighter, wrapEnabled bool) string {
	if startLine < 0 {
		startLine = 0
	}
	if maxLines <= 0 {
		return ""
	}
	if mode == DiffViewSideBySide {
		return RenderSideBySide(diff, width, startLine, maxLines, horizontalOffset, highlighter, wrapEnabled)
	}
	return RenderLineDiff(diff, width, startLine, maxLines, horizontalOffset, highlighter, wrapEnabled)
}

// ── Content rendering helpers ────────────────────────────────────────────────

// renderDiffContentWithOffset renders line content with horizontal scroll.
func renderDiffContentWithOffset(line DiffLine, maxWidth, horizontalOffset int, highlighter *SyntaxHighlighter) string {
	rendered := renderDiffContent(line, maxWidth+horizontalOffset, highlighter)
	if horizontalOffset > 0 {
		rendered = truncateLeft(rendered, horizontalOffset)
	}
	return rendered
}

// renderDiffContent renders line content with word-level and syntax highlighting.
func renderDiffContent(line DiffLine, maxWidth int, highlighter *SyntaxHighlighter) string {
	var baseStyle lipgloss.Style
	switch line.Type {
	case LineAdd:
		baseStyle = diffAddStyle
	case LineRemove:
		baseStyle = diffRemoveStyle
	default:
		baseStyle = diffContextStyle
	}

	// Word diff takes priority over syntax highlighting
	if len(line.WordDiff) > 0 {
		var sb strings.Builder
		for _, segment := range line.WordDiff {
			if segment.IsChange {
				if line.Type == LineAdd {
					sb.WriteString(wordDiffAddStyle.Render(segment.Text))
				} else {
					sb.WriteString(wordDiffRemoveStyle.Render(segment.Text))
				}
			} else {
				sb.WriteString(baseStyle.Render(segment.Text))
			}
		}
		content := sb.String()
		if lipgloss.Width(line.Content) > maxWidth && maxWidth > 3 {
			truncated := truncateLine(line.Content, maxWidth)
			return baseStyle.Render(truncated)
		}
		return content
	}

	// Apply syntax highlighting if available
	if highlighter != nil {
		segments := highlighter.HighlightLine(line.Content)
		if len(segments) > 0 {
			var sb strings.Builder
			for _, seg := range segments {
				style := blendSyntaxWithDiff(seg.Style, line.Type)
				sb.WriteString(style.Render(seg.Text))
			}
			result := sb.String()
			if lipgloss.Width(line.Content) > maxWidth && maxWidth > 3 {
				truncated := truncateLine(line.Content, maxWidth)
				return renderSyntaxHighlighted(truncated, line.Type, highlighter)
			}
			return result
		}
	}

	content := line.Content
	if lipgloss.Width(content) > maxWidth && maxWidth > 3 {
		content = truncateLine(content, maxWidth)
	}
	style := baseStyle
	switch line.Type {
	case LineAdd:
		style = style.Background(diffAddBg)
	case LineRemove:
		style = style.Background(diffRemoveBg)
	}
	return style.Render(content)
}

// renderSideBySideContent renders content for side-by-side view with syntax highlighting.
func renderSideBySideContent(content string, lineType LineType, maxWidth int, highlighter *SyntaxHighlighter) string {
	var baseStyle lipgloss.Style
	switch lineType {
	case LineAdd:
		baseStyle = diffAddStyle
	case LineRemove:
		baseStyle = diffRemoveStyle
	default:
		baseStyle = diffContextStyle
	}

	if lipgloss.Width(content) > maxWidth && maxWidth > 3 {
		content = truncateLine(content, maxWidth)
	}

	if highlighter != nil {
		highlighted := renderSyntaxHighlighted(content, lineType, highlighter)
		return lipgloss.NewStyle().MaxWidth(maxWidth).Render(highlighted)
	}

	style := baseStyle
	switch lineType {
	case LineAdd:
		style = style.Background(diffAddBg)
	case LineRemove:
		style = style.Background(diffRemoveBg)
	}
	return style.MaxWidth(maxWidth).Render(content)
}

// renderSyntaxHighlighted renders content with syntax highlighting blended with diff style.
func renderSyntaxHighlighted(content string, lineType LineType, highlighter *SyntaxHighlighter) string {
	getBaseStyle := func() lipgloss.Style {
		switch lineType {
		case LineAdd:
			return diffAddStyle.Background(diffAddBg)
		case LineRemove:
			return diffRemoveStyle.Background(diffRemoveBg)
		default:
			return diffContextStyle
		}
	}

	if highlighter == nil {
		return getBaseStyle().Render(content)
	}

	segments := highlighter.HighlightLine(content)
	if len(segments) == 0 {
		return getBaseStyle().Render(content)
	}

	var sb strings.Builder
	for _, seg := range segments {
		style := blendSyntaxWithDiff(seg.Style, lineType)
		sb.WriteString(style.Render(seg.Text))
	}
	return sb.String()
}

// blendSyntaxWithDiff blends syntax highlighting style with diff line style.
func blendSyntaxWithDiff(syntaxStyle lipgloss.Style, lineType LineType) lipgloss.Style {
	switch lineType {
	case LineAdd:
		return syntaxStyle.Background(diffAddBg)
	case LineRemove:
		return syntaxStyle.Background(diffRemoveBg)
	default:
		fg := syntaxStyle.GetForeground()
		_, isNoColor := fg.(lipgloss.NoColor)
		if isNoColor {
			return diffContextStyle
		}
		return syntaxStyle
	}
}

// ── Clip info (for horizontal scroll state) ──────────────────────────────────

// SideBySideClipInfo contains information about horizontal clipping state.
type SideBySideClipInfo struct {
	HasMoreLeft     bool
	HasMoreRight    bool
	MaxContentWidth int
}

// GetSideBySideClipInfo calculates clipping info for a side-by-side diff.
func GetSideBySideClipInfo(diff *ParsedDiff, contentWidth, horizontalOffset int) SideBySideClipInfo {
	if diff == nil || diff.Binary {
		return SideBySideClipInfo{}
	}

	maxWidth := 0
	for _, hunk := range diff.Hunks {
		for _, line := range hunk.Lines {
			lineWidth := lipgloss.Width(line.Content)
			if lineWidth > maxWidth {
				maxWidth = lineWidth
			}
		}
	}

	return SideBySideClipInfo{
		HasMoreLeft:     horizontalOffset > 0,
		HasMoreRight:    maxWidth > contentWidth+horizontalOffset,
		MaxContentWidth: maxWidth,
	}
}

// ── Text helpers ─────────────────────────────────────────────────────────────

// truncateLine truncates a line to fit within maxWidth using visual width.
func truncateLine(s string, maxWidth int) string {
	if lipgloss.Width(s) <= maxWidth {
		return s
	}
	if maxWidth <= 3 {
		runes := []rune(s)
		if len(runes) > maxWidth {
			return string(runes[:maxWidth])
		}
		return s
	}
	runes := []rune(s)
	for i := len(runes); i > 0; i-- {
		candidate := string(runes[:i]) + "..."
		if lipgloss.Width(candidate) <= maxWidth {
			return candidate
		}
	}
	return "..."
}

// padRight pads a string with spaces to reach the desired visual width.
func padRight(s string, width int) string {
	visualWidth := lipgloss.Width(s)
	if visualWidth >= width {
		return s
	}
	return s + strings.Repeat(" ", width-visualWidth)
}

// padToWidth pads a styled string (with ANSI codes) to exact visual width.
func padToWidth(s string, width int) string {
	visualWidth := lipgloss.Width(s)
	if visualWidth >= width {
		return s
	}
	return s + strings.Repeat(" ", width-visualWidth)
}

// truncateLeft removes the first `offset` visual characters from a string,
// preserving ANSI escape sequences.
func truncateLeft(s string, offset int) string {
	if offset <= 0 {
		return s
	}

	var result strings.Builder
	width := 0
	i := 0
	skipping := true

	for i < len(s) {
		// Preserve ANSI escape sequences
		if i < len(s)-1 && s[i] == '\x1b' && s[i+1] == '[' {
			start := i
			i += 2
			for i < len(s) && !((s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= 'a' && s[i] <= 'z')) {
				i++
			}
			if i < len(s) {
				i++
			}
			if !skipping {
				result.WriteString(s[start:i])
			}
			continue
		}

		_, size := utf8.DecodeRuneInString(s[i:])
		if skipping {
			width++
			if width >= offset {
				skipping = false
			}
		} else {
			result.WriteString(s[i : i+size])
		}
		i += size
	}

	return result.String()
}
