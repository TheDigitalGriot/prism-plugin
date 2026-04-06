package diff

import (
	"regexp"
	"strconv"
	"strings"
)

// LineType represents the type of a diff line.
type LineType int

const (
	LineContext LineType = iota
	LineAdd
	LineRemove
)

// WordSegment represents a segment of text with word-level diff highlighting.
type WordSegment struct {
	Text     string
	IsChange bool
}

// DiffLine represents a single line in a diff.
type DiffLine struct {
	Type      LineType
	OldLineNo int // 0 means not applicable
	NewLineNo int // 0 means not applicable
	Content   string
	WordDiff  []WordSegment
}

// Hunk represents a diff hunk.
type Hunk struct {
	OldStart int
	OldCount int
	NewStart int
	NewCount int
	Header   string
	Lines    []DiffLine
}

// ParsedDiff represents a fully parsed diff.
type ParsedDiff struct {
	OldFile string
	NewFile string
	Binary  bool
	Hunks   []Hunk
}

// FileDiffInfo holds a parsed diff with rendering position info.
type FileDiffInfo struct {
	Diff      *ParsedDiff
	StartLine int // Line position where this file starts in rendered output
	EndLine   int // Line position where this file ends
	Additions int // Number of added lines
	Deletions int // Number of deleted lines
}

// MultiFileDiff holds multiple file diffs with navigation info.
type MultiFileDiff struct {
	Files []FileDiffInfo
}

// DiffViewMode specifies the diff rendering mode.
type DiffViewMode int

const (
	DiffViewUnified    DiffViewMode = iota // Line-by-line unified view
	DiffViewSideBySide                     // Side-by-side split view
)

var hunkHeaderRegex = regexp.MustCompile(`^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@(.*)$`)

// ParseUnifiedDiff parses a unified diff format string.
func ParseUnifiedDiff(diff string) (*ParsedDiff, error) {
	lines := strings.Split(diff, "\n")
	parsed := &ParsedDiff{}

	var currentHunk *Hunk
	oldLineNo := 0
	newLineNo := 0

	for _, line := range lines {
		switch {
		case strings.HasPrefix(line, "Binary files"):
			parsed.Binary = true
			return parsed, nil

		case strings.HasPrefix(line, "--- "):
			parsed.OldFile = strings.TrimPrefix(line, "--- ")
			parsed.OldFile = strings.TrimPrefix(parsed.OldFile, "a/")

		case strings.HasPrefix(line, "+++ "):
			parsed.NewFile = strings.TrimPrefix(line, "+++ ")
			parsed.NewFile = strings.TrimPrefix(parsed.NewFile, "b/")

		case strings.HasPrefix(line, "@@"):
			match := hunkHeaderRegex.FindStringSubmatch(line)
			if match != nil {
				oldStart, _ := strconv.Atoi(match[1])
				oldCount := 1
				if match[2] != "" {
					oldCount, _ = strconv.Atoi(match[2])
				}
				newStart, _ := strconv.Atoi(match[3])
				newCount := 1
				if match[4] != "" {
					newCount, _ = strconv.Atoi(match[4])
				}

				currentHunk = &Hunk{
					OldStart: oldStart,
					OldCount: oldCount,
					NewStart: newStart,
					NewCount: newCount,
					Header:   match[5],
				}
				parsed.Hunks = append(parsed.Hunks, *currentHunk)
				currentHunk = &parsed.Hunks[len(parsed.Hunks)-1]
				oldLineNo = oldStart
				newLineNo = newStart
			}

		case currentHunk != nil:
			if len(line) == 0 {
				diffLine := DiffLine{
					Type:      LineContext,
					OldLineNo: oldLineNo,
					NewLineNo: newLineNo,
					Content:   "",
				}
				currentHunk.Lines = append(currentHunk.Lines, diffLine)
				oldLineNo++
				newLineNo++
				continue
			}

			prefix := line[0]
			content := ""
			if len(line) > 1 {
				content = line[1:]
			}

			switch prefix {
			case '+':
				diffLine := DiffLine{
					Type:      LineAdd,
					OldLineNo: 0,
					NewLineNo: newLineNo,
					Content:   content,
				}
				currentHunk.Lines = append(currentHunk.Lines, diffLine)
				newLineNo++

			case '-':
				diffLine := DiffLine{
					Type:      LineRemove,
					OldLineNo: oldLineNo,
					NewLineNo: 0,
					Content:   content,
				}
				currentHunk.Lines = append(currentHunk.Lines, diffLine)
				oldLineNo++

			case ' ':
				diffLine := DiffLine{
					Type:      LineContext,
					OldLineNo: oldLineNo,
					NewLineNo: newLineNo,
					Content:   content,
				}
				currentHunk.Lines = append(currentHunk.Lines, diffLine)
				oldLineNo++
				newLineNo++

			case '\\':
				// "\ No newline at end of file" — skip

			default:
				diffLine := DiffLine{
					Type:      LineContext,
					OldLineNo: oldLineNo,
					NewLineNo: newLineNo,
					Content:   line,
				}
				currentHunk.Lines = append(currentHunk.Lines, diffLine)
				oldLineNo++
				newLineNo++
			}
		}
	}

	// Compute word-level diffs for consecutive add/remove pairs
	for i := range parsed.Hunks {
		computeWordDiffs(&parsed.Hunks[i])
	}

	return parsed, nil
}

// ParseMultiFileDiff parses a git diff output containing multiple files.
func ParseMultiFileDiff(diff string) *MultiFileDiff {
	result := &MultiFileDiff{}
	fileDiffs := splitIntoFileDiffs(diff)

	for _, fileDiff := range fileDiffs {
		parsed, err := ParseUnifiedDiff(fileDiff)
		if err != nil || parsed == nil {
			continue
		}

		additions, deletions := 0, 0
		for _, hunk := range parsed.Hunks {
			for _, line := range hunk.Lines {
				switch line.Type {
				case LineAdd:
					additions++
				case LineRemove:
					deletions++
				}
			}
		}

		result.Files = append(result.Files, FileDiffInfo{
			Diff:      parsed,
			Additions: additions,
			Deletions: deletions,
		})
	}

	return result
}

// splitIntoFileDiffs splits a multi-file diff into individual file diffs.
func splitIntoFileDiffs(diff string) []string {
	var fileDiffs []string
	var current strings.Builder

	lines := strings.Split(diff, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "diff --git ") {
			if current.Len() > 0 {
				fileDiffs = append(fileDiffs, current.String())
				current.Reset()
			}
		}
		current.WriteString(line)
		current.WriteString("\n")
	}

	if current.Len() > 0 {
		fileDiffs = append(fileDiffs, current.String())
	}

	return fileDiffs
}

// ── Helpers on types ──────────────────────────────────────────────────────────

// FileName returns the display filename (prefers NewFile, falls back to OldFile).
func (f *FileDiffInfo) FileName() string {
	if f.Diff.NewFile != "" && f.Diff.NewFile != "/dev/null" {
		return f.Diff.NewFile
	}
	if f.Diff.OldFile != "" && f.Diff.OldFile != "/dev/null" {
		return f.Diff.OldFile
	}
	return "unknown"
}

// ChangeStats returns a formatted string like "+10/-5".
func (f *FileDiffInfo) ChangeStats() string {
	return "+" + strconv.Itoa(f.Additions) + "/-" + strconv.Itoa(f.Deletions)
}

// TotalLines returns the total number of content lines in the diff.
func (p *ParsedDiff) TotalLines() int {
	total := 0
	for _, hunk := range p.Hunks {
		total += len(hunk.Lines) + 1 // +1 for hunk header
	}
	return total
}

// MaxLineNumber returns the maximum line number in the diff.
func (p *ParsedDiff) MaxLineNumber() int {
	max := 0
	for _, hunk := range p.Hunks {
		for _, line := range hunk.Lines {
			if line.OldLineNo > max {
				max = line.OldLineNo
			}
			if line.NewLineNo > max {
				max = line.NewLineNo
			}
		}
	}
	return max
}

// TotalLines returns the total number of rendered lines for a multi-file diff.
func (mfd *MultiFileDiff) TotalLines() int {
	if mfd == nil {
		return 0
	}
	total := 0
	for i, file := range mfd.Files {
		total++ // File header
		total += file.Diff.TotalLines()
		if i < len(mfd.Files)-1 {
			total++ // Blank line between files
		}
	}
	return total
}

// FileAtLine returns the file index at the given line position, or -1 if none.
func (mfd *MultiFileDiff) FileAtLine(line int) int {
	if mfd == nil {
		return -1
	}
	for i, file := range mfd.Files {
		if line >= file.StartLine && line < file.EndLine {
			return i
		}
	}
	return -1
}

// FileCount returns the number of files in the diff.
func (mfd *MultiFileDiff) FileCount() int {
	if mfd == nil {
		return 0
	}
	return len(mfd.Files)
}

// ── Word-level diff computation ───────────────────────────────────────────────

// computeWordDiffs computes word-level diffs for a hunk.
func computeWordDiffs(hunk *Hunk) {
	lines := hunk.Lines
	for i := 0; i < len(lines); i++ {
		if lines[i].Type == LineRemove && i+1 < len(lines) && lines[i+1].Type == LineAdd {
			oldWords := tokenize(lines[i].Content)
			newWords := tokenize(lines[i+1].Content)
			lines[i].WordDiff = computeWordSegments(oldWords, newWords, false)
			lines[i+1].WordDiff = computeWordSegments(newWords, oldWords, true)
			i++
		}
	}
}

// tokenize splits a line into words and whitespace tokens.
func tokenize(s string) []string {
	var tokens []string
	var current strings.Builder
	inWord := false

	for _, r := range s {
		isWord := r != ' ' && r != '\t'
		if isWord {
			if !inWord && current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			current.WriteRune(r)
			inWord = true
		} else {
			if inWord && current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			current.WriteRune(r)
			inWord = false
		}
	}
	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}
	return tokens
}

// computeWordSegments computes word segments by comparing tokens.
func computeWordSegments(source, target []string, isAdd bool) []WordSegment {
	if len(source) == 0 {
		return nil
	}

	targetSet := make(map[string]bool)
	for _, t := range target {
		targetSet[t] = true
	}

	var segments []WordSegment
	for _, word := range source {
		isChange := !targetSet[word]
		if strings.TrimSpace(word) == "" {
			isChange = false
		}
		segments = append(segments, WordSegment{
			Text:     word,
			IsChange: isChange,
		})
	}

	return segments
}
