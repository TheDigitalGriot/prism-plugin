package app

import (
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/prism-cli/modal"
)

// FileMatch represents a fuzzy-matched file with score
type FileMatch struct {
	RelPath string // Relative path from project root (forward slashes)
	Name    string // Filename (basename)
	Score   int    // Fuzzy match score (higher = better)
}

// FileFinder provides a project-wide fuzzy file search overlay (F-4).
// Follows the same overlay pattern as CommandPalette.
type FileFinder struct {
	allFiles      []string // All project file paths (relative, forward slashes)
	filtered      []FileMatch
	filterText    string
	selectedIndex int
	projectDir    string
}

// NewFileFinder creates a file finder with pre-built file cache
func NewFileFinder(projectDir string, fileCache []string) *FileFinder {
	ff := &FileFinder{
		allFiles:   fileCache,
		projectDir: projectDir,
	}
	// Show top files initially (first 20)
	ff.showInitial()
	return ff
}

// showInitial populates filtered with the first N files (no query)
func (ff *FileFinder) showInitial() {
	max := 20
	if len(ff.allFiles) < max {
		max = len(ff.allFiles)
	}
	ff.filtered = make([]FileMatch, max)
	for i := 0; i < max; i++ {
		ff.filtered[i] = FileMatch{
			RelPath: ff.allFiles[i],
			Name:    filepath.Base(ff.allFiles[i]),
			Score:   0,
		}
	}
	ff.selectedIndex = 0
}

// Filter updates the filtered list based on fuzzy matching
func (ff *FileFinder) Filter(text string) {
	ff.filterText = text
	ff.selectedIndex = 0

	if text == "" {
		ff.showInitial()
		return
	}

	query := strings.ToLower(text)

	// Score all files
	var matches []FileMatch
	for _, path := range ff.allFiles {
		score := fuzzyScore(query, strings.ToLower(path))
		if score > 0 {
			matches = append(matches, FileMatch{
				RelPath: path,
				Name:    filepath.Base(path),
				Score:   score,
			})
		}
	}

	// Sort by score descending
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].Score != matches[j].Score {
			return matches[i].Score > matches[j].Score
		}
		// Tiebreak: shorter paths first
		return len(matches[i].RelPath) < len(matches[j].RelPath)
	})

	// Limit to top 20
	if len(matches) > 20 {
		matches = matches[:20]
	}

	ff.filtered = matches
}

// SelectNext moves selection down
func (ff *FileFinder) SelectNext() {
	if len(ff.filtered) == 0 {
		return
	}
	ff.selectedIndex = (ff.selectedIndex + 1) % len(ff.filtered)
}

// SelectPrev moves selection up
func (ff *FileFinder) SelectPrev() {
	if len(ff.filtered) == 0 {
		return
	}
	ff.selectedIndex = (ff.selectedIndex - 1 + len(ff.filtered)) % len(ff.filtered)
}

// SelectedFile returns the currently selected file match, or nil
func (ff *FileFinder) SelectedFile() *FileMatch {
	if len(ff.filtered) == 0 || ff.selectedIndex < 0 || ff.selectedIndex >= len(ff.filtered) {
		return nil
	}
	return &ff.filtered[ff.selectedIndex]
}

// BuildModal constructs a modal for the file finder overlay
func (ff *FileFinder) BuildModal() *modal.Modal {
	m := modal.New("Find File", modal.WithWidth(70), modal.WithHints(true))

	// Search input
	m.AddSection(modal.Input("finder-filter", "Type to search files...", ff.filterText))
	m.AddSection(modal.Spacer())

	// Result list
	listItems := make([]string, len(ff.filtered))
	for i, match := range ff.filtered {
		listItems[i] = match.RelPath
	}

	if len(listItems) == 0 {
		m.AddSection(modal.Text("No matching files"))
	} else {
		m.AddSection(modal.List("finder-results", listItems, &ff.selectedIndex))
	}

	m.AddSection(modal.Spacer())
	m.AddSection(modal.Text("↑/↓ navigate • enter open • esc close"))

	return m
}

// --- Fuzzy Scoring Algorithm ---

// fuzzyScore computes a fuzzy match score for query against target.
// Returns 0 if the query is not a subsequence of target.
// Higher score = better match.
//
// Scoring rules:
//   - +10 per matched character
//   - +5 bonus for consecutive matches
//   - +8 bonus for matching after separator (/, ., _, -)
//   - +6 bonus for matching at start of a "word" (lowercase after uppercase)
//   - -2 penalty per gap character between matches
//   - +15 bonus for matching at start of filename (last path segment)
func fuzzyScore(query, target string) int {
	if len(query) == 0 {
		return 1 // Empty query matches everything with minimal score
	}

	queryRunes := []rune(query)
	targetRunes := []rune(target)

	qi := 0 // query index
	score := 0
	lastMatchIdx := -1
	filenameStart := -1

	// Find where the filename starts (after last /)
	for i := len(targetRunes) - 1; i >= 0; i-- {
		if targetRunes[i] == '/' {
			filenameStart = i + 1
			break
		}
	}
	if filenameStart < 0 {
		filenameStart = 0
	}

	for ti := 0; ti < len(targetRunes) && qi < len(queryRunes); ti++ {
		if targetRunes[ti] == queryRunes[qi] {
			score += 10 // Base match

			// Consecutive match bonus
			if lastMatchIdx >= 0 && ti == lastMatchIdx+1 {
				score += 5
			}

			// Separator bonus
			if ti > 0 && isSeparator(targetRunes[ti-1]) {
				score += 8
			}

			// Word boundary bonus (camelCase)
			if ti > 0 && unicode.IsUpper(rune(target[ti])) && unicode.IsLower(rune(target[ti-1])) {
				score += 6
			}

			// Start of filename bonus
			if ti == filenameStart {
				score += 15
			}

			// Gap penalty
			if lastMatchIdx >= 0 {
				gap := ti - lastMatchIdx - 1
				if gap > 0 {
					score -= gap * 2
				}
			}

			lastMatchIdx = ti
			qi++
		}
	}

	// Not all query characters matched → no match
	if qi < len(queryRunes) {
		return 0
	}

	// Bonus for shorter overall path (prefer less deeply nested)
	score += max(0, 20-len(targetRunes)/5)

	return score
}

func isSeparator(r rune) bool {
	return r == '/' || r == '.' || r == '_' || r == '-' || r == '\\'
}

// --- File Cache Building ---

// FileCacheLoadedMsg carries the result of async file cache building
type FileCacheLoadedMsg struct {
	Files []string // Relative paths (forward slashes)
	Error error
}

// buildFileCacheCmd builds a project-wide file cache asynchronously.
// Uses `git ls-files` for speed and .gitignore respect, with fallback to directory walk.
func buildFileCacheCmd(projectDir string) tea.Cmd {
	return func() tea.Msg {
		if projectDir == "" || projectDir == "demo" {
			return FileCacheLoadedMsg{Files: nil}
		}

		// Try git ls-files first (fast, respects .gitignore)
		files, err := gitLsFiles(projectDir)
		if err == nil && len(files) > 0 {
			return FileCacheLoadedMsg{Files: files}
		}

		// Fallback: walk directory
		files, err = walkProjectFiles(projectDir)
		return FileCacheLoadedMsg{Files: files, Error: err}
	}
}

// gitLsFiles uses git to list tracked files
func gitLsFiles(projectDir string) ([]string, error) {
	cmd := exec.Command("git", "-C", projectDir, "ls-files", "--cached", "--others", "--exclude-standard")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var files []string
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			// Normalize to forward slashes
			files = append(files, filepath.ToSlash(line))
		}
	}
	return files, nil
}

// walkProjectFiles walks the project directory to build file list (fallback)
func walkProjectFiles(projectDir string) ([]string, error) {
	var files []string

	skipDirs := map[string]bool{
		".git": true, "node_modules": true, "vendor": true,
		"dist": true, "build": true, "__pycache__": true,
		".next": true, ".cache": true,
	}

	err := filepath.Walk(projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip unreadable
		}
		name := info.Name()

		// Skip hidden dirs (except .prism) and known large dirs
		if info.IsDir() {
			if skipDirs[name] {
				return filepath.SkipDir
			}
			if strings.HasPrefix(name, ".") && name != "." && name != ".prism" {
				return filepath.SkipDir
			}
			return nil
		}

		// Skip hidden files
		if strings.HasPrefix(name, ".") {
			return nil
		}

		rel, err := filepath.Rel(projectDir, path)
		if err != nil {
			return nil
		}
		files = append(files, filepath.ToSlash(rel))
		return nil
	})

	return files, err
}
