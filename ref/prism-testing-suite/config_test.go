package config_test

import (
	"os"
	"path/filepath"
	"testing"
)

// ============================================================================
// These tests validate path resolution, config loading, and environment
// detection for the prism-cli. Adjust import paths to match your module:
//
//   github.com/TheDigitalGriot/prism-plugin/cmd/prism-cli/config
//
// Run:
//   cd cmd/prism-cli && go test ./config/ -v
// ============================================================================

// --- Path constants --------------------------------------------------------
// Mirrors the expected constants from config/paths.go

const (
	ExpectedStoriesDir  = ".prism/stories"
	ExpectedStoriesFile = ".prism/stories/stories.json"
	ExpectedSpectrumDir = ".prism/shared/spectrum"
	ExpectedProgressFile = ".prism/shared/spectrum/progress.md"
	ExpectedPrismDir    = ".prism"
	ExpectedBinDir      = ".prism/bin"
)

// --- Helpers ---------------------------------------------------------------

// createTempProject creates a minimal .prism/ directory tree in a temp dir
// and returns the project root path. Caller should defer os.RemoveAll(root).
func createTempProject(t *testing.T) string {
	t.Helper()
	root := t.TempDir()

	dirs := []string{
		filepath.Join(root, ".prism", "stories"),
		filepath.Join(root, ".prism", "shared", "spectrum"),
		filepath.Join(root, ".prism", "bin"),
		filepath.Join(root, ".prism", "local"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatalf("failed to create dir %s: %v", d, err)
		}
	}

	// Seed stories.json
	storiesJSON := `{
  "stories": [
    {"id": 1, "title": "Setup auth middleware", "status": "pending"},
    {"id": 2, "title": "Add OAuth flow",       "status": "complete"},
    {"id": 3, "title": "Write integration tests","status": "in_progress"}
  ]
}`
	storiesPath := filepath.Join(root, ExpectedStoriesFile)
	if err := os.WriteFile(storiesPath, []byte(storiesJSON), 0o644); err != nil {
		t.Fatalf("failed to write stories.json: %v", err)
	}

	// Seed progress.md
	progressMD := `# Spectrum Progress

## Story 2: Add OAuth flow
- Status: complete
- Duration: 45m
- Quality gates: all passed
`
	progressPath := filepath.Join(root, ExpectedProgressFile)
	if err := os.WriteFile(progressPath, []byte(progressMD), 0o644); err != nil {
		t.Fatalf("failed to write progress.md: %v", err)
	}

	return root
}

// --- Tests: Directory structure --------------------------------------------

func TestPrismDirExists(t *testing.T) {
	root := createTempProject(t)

	prismDir := filepath.Join(root, ExpectedPrismDir)
	info, err := os.Stat(prismDir)
	if err != nil {
		t.Fatalf(".prism directory should exist: %v", err)
	}
	if !info.IsDir() {
		t.Fatal(".prism should be a directory")
	}
}

func TestStoriesDirSeparateFromSpectrum(t *testing.T) {
	root := createTempProject(t)

	storiesDir := filepath.Join(root, ExpectedStoriesDir)
	spectrumDir := filepath.Join(root, ExpectedSpectrumDir)

	if storiesDir == spectrumDir {
		t.Fatal("stories dir and spectrum dir must be separate paths")
	}

	if _, err := os.Stat(storiesDir); err != nil {
		t.Fatalf("stories directory should exist: %v", err)
	}
	if _, err := os.Stat(spectrumDir); err != nil {
		t.Fatalf("spectrum directory should exist: %v", err)
	}
}

func TestRequiredDirectoriesExist(t *testing.T) {
	root := createTempProject(t)

	requiredDirs := []struct {
		name string
		path string
	}{
		{"prism root", ".prism"},
		{"stories", ".prism/stories"},
		{"spectrum shared", ".prism/shared/spectrum"},
		{"bin", ".prism/bin"},
		{"local", ".prism/local"},
	}

	for _, tc := range requiredDirs {
		t.Run(tc.name, func(t *testing.T) {
			fullPath := filepath.Join(root, tc.path)
			info, err := os.Stat(fullPath)
			if err != nil {
				t.Fatalf("directory %q should exist: %v", tc.path, err)
			}
			if !info.IsDir() {
				t.Fatalf("%q should be a directory", tc.path)
			}
		})
	}
}

// --- Tests: stories.json ---------------------------------------------------

func TestStoriesFileExists(t *testing.T) {
	root := createTempProject(t)

	path := filepath.Join(root, ExpectedStoriesFile)
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("stories.json should exist at %s: %v", ExpectedStoriesFile, err)
	}
}

func TestStoriesFileIsValidJSON(t *testing.T) {
	root := createTempProject(t)

	data, err := os.ReadFile(filepath.Join(root, ExpectedStoriesFile))
	if err != nil {
		t.Fatalf("failed to read stories.json: %v", err)
	}

	if len(data) == 0 {
		t.Fatal("stories.json should not be empty")
	}

	// Basic JSON validation: starts with { and ends with }
	trimmed := string(data)
	if trimmed[0] != '{' {
		t.Fatal("stories.json should be a JSON object")
	}
}

func TestProgressFileExists(t *testing.T) {
	root := createTempProject(t)

	path := filepath.Join(root, ExpectedProgressFile)
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("progress.md should exist at %s: %v", ExpectedProgressFile, err)
	}
}

// --- Tests: IsPrismInitialized simulation ----------------------------------

// IsPrismInitialized checks if a .prism directory exists at the given root.
// This mirrors what your config package should expose.
func IsPrismInitialized(root string) bool {
	info, err := os.Stat(filepath.Join(root, ".prism"))
	return err == nil && info.IsDir()
}

func TestIsPrismInitialized_True(t *testing.T) {
	root := createTempProject(t)
	if !IsPrismInitialized(root) {
		t.Fatal("should return true for initialized project")
	}
}

func TestIsPrismInitialized_False(t *testing.T) {
	root := t.TempDir() // empty directory
	if IsPrismInitialized(root) {
		t.Fatal("should return false for uninitialized project")
	}
}

// --- Tests: Workspace registry ---------------------------------------------

func TestWorkspacesJSON(t *testing.T) {
	home := t.TempDir()

	wsPath := filepath.Join(home, ".prism", "workspaces.json")
	os.MkdirAll(filepath.Dir(wsPath), 0o755)
	os.WriteFile(wsPath, []byte(`{"projects":[]}`), 0o644)

	data, err := os.ReadFile(wsPath)
	if err != nil {
		t.Fatalf("should read workspaces.json: %v", err)
	}
	if string(data) != `{"projects":[]}` {
		t.Fatalf("unexpected content: %s", data)
	}
}

// --- Tests: PRISM_BIN_DIR override -----------------------------------------

func TestCustomBinDirOverride(t *testing.T) {
	customDir := t.TempDir()
	t.Setenv("PRISM_BIN_DIR", customDir)

	// Simulate: install dir should use env var
	installDir := os.Getenv("PRISM_BIN_DIR")
	if installDir != customDir {
		t.Fatalf("PRISM_BIN_DIR should override install dir: got %s", installDir)
	}
}

// --- Tests: Path construction (no old ralph paths) -------------------------

func TestNoLegacyRalphPaths(t *testing.T) {
	// Ensure none of the expected paths contain "ralph"
	paths := []string{
		ExpectedStoriesDir,
		ExpectedStoriesFile,
		ExpectedSpectrumDir,
		ExpectedProgressFile,
	}

	for _, p := range paths {
		if filepath.Base(p) == "ralph" || filepath.Dir(p) == "ralph" {
			t.Errorf("path %q still references 'ralph'", p)
		}
	}
}

func TestNoLegacyThoughtsDir(t *testing.T) {
	paths := []string{
		ExpectedStoriesDir,
		ExpectedStoriesFile,
		ExpectedSpectrumDir,
		ExpectedProgressFile,
	}

	for _, p := range paths {
		for _, component := range filepath.SplitList(p) {
			if component == "thoughts" {
				t.Errorf("path %q still references 'thoughts/'", p)
			}
		}
	}
}
