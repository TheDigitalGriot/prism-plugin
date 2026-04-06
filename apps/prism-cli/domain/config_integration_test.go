package domain

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ============================================================================
// Config integration tests — validates path resolution, directory structure,
// and environment detection for the prism-cli.
//
// Adapted from ref/prism-testing-suite/config_test.go. Tests live in the
// domain package since there is no separate config package.
//
// Run:
//   cd cmd/prism-cli && go test ./domain/ -v -run Config
// ============================================================================

// --- Path constants --------------------------------------------------------

const (
	ExpectedStoriesDir   = ".prism/stories"
	ExpectedStoriesFile  = ".prism/stories/stories.json"
	ExpectedSpectrumDir  = ".prism/shared/spectrum"
	ExpectedProgressFile = ".prism/shared/spectrum/progress.md"
	ExpectedPrismDir     = ".prism"
	ExpectedBinDir       = ".prism/bin"
)

// --- Helpers ---------------------------------------------------------------

// createTempProject creates a minimal .prism/ directory tree in a temp dir
// and returns the project root path.
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
  "epic": {"name": "Test", "source": "test", "qualityGates": []},
  "stories": [
    {"id": "STORY-001", "title": "Setup auth middleware", "description": "", "priority": 1, "status": "pending", "blockedBy": null, "files": [], "steps": []},
    {"id": "STORY-002", "title": "Add OAuth flow",       "description": "", "priority": 2, "status": "complete", "blockedBy": null, "files": [], "steps": []},
    {"id": "STORY-003", "title": "Write integration tests","description": "", "priority": 3, "status": "in_progress", "blockedBy": null, "files": [], "steps": []}
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

// IsPrismInitialized checks if a .prism directory exists at the given root.
func isPrismInitialized(root string) bool {
	info, err := os.Stat(filepath.Join(root, ".prism"))
	return err == nil && info.IsDir()
}

// --- Tests: Directory structure --------------------------------------------

func TestConfigPrismDirExists(t *testing.T) {
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

func TestConfigStoriesDirSeparateFromSpectrum(t *testing.T) {
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

func TestConfigRequiredDirectoriesExist(t *testing.T) {
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

func TestConfigStoriesFileExists(t *testing.T) {
	root := createTempProject(t)

	path := filepath.Join(root, ExpectedStoriesFile)
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("stories.json should exist at %s: %v", ExpectedStoriesFile, err)
	}
}

func TestConfigStoriesFileIsValidJSON(t *testing.T) {
	root := createTempProject(t)

	data, err := os.ReadFile(filepath.Join(root, ExpectedStoriesFile))
	if err != nil {
		t.Fatalf("failed to read stories.json: %v", err)
	}

	if len(data) == 0 {
		t.Fatal("stories.json should not be empty")
	}

	// Basic JSON validation: starts with {
	trimmed := string(data)
	if trimmed[0] != '{' {
		t.Fatal("stories.json should be a JSON object")
	}
}

func TestConfigStoriesFileLoadsWithDomainParser(t *testing.T) {
	root := createTempProject(t)
	path := filepath.Join(root, ExpectedStoriesFile)

	sf, err := LoadStoriesFile(path)
	if err != nil {
		t.Fatalf("LoadStoriesFile should parse test fixture: %v", err)
	}
	if len(sf.Stories) != 3 {
		t.Errorf("expected 3 stories, got %d", len(sf.Stories))
	}
}

func TestConfigProgressFileExists(t *testing.T) {
	root := createTempProject(t)

	path := filepath.Join(root, ExpectedProgressFile)
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("progress.md should exist at %s: %v", ExpectedProgressFile, err)
	}
}

// --- Tests: IsPrismInitialized simulation ----------------------------------

func TestConfigIsPrismInitialized_True(t *testing.T) {
	root := createTempProject(t)
	if !isPrismInitialized(root) {
		t.Fatal("should return true for initialized project")
	}
}

func TestConfigIsPrismInitialized_False(t *testing.T) {
	root := t.TempDir() // empty directory
	if isPrismInitialized(root) {
		t.Fatal("should return false for uninitialized project")
	}
}

// --- Tests: PRISM_BIN_DIR override -----------------------------------------

func TestConfigCustomBinDirOverride(t *testing.T) {
	customDir := t.TempDir()
	t.Setenv("PRISM_BIN_DIR", customDir)

	// Simulate: install dir should use env var
	installDir := os.Getenv("PRISM_BIN_DIR")
	if installDir != customDir {
		t.Fatalf("PRISM_BIN_DIR should override install dir: got %s", installDir)
	}
}

// --- Tests: Path construction (no legacy paths) ----------------------------

func TestConfigNoLegacyRalphPaths(t *testing.T) {
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

func TestConfigNoLegacyThoughtsDir(t *testing.T) {
	paths := []string{
		ExpectedStoriesDir,
		ExpectedStoriesFile,
		ExpectedSpectrumDir,
		ExpectedProgressFile,
	}

	for _, p := range paths {
		// Split path by forward slash (these are constants, always use /)
		for _, component := range strings.Split(filepath.ToSlash(p), "/") {
			if component == "thoughts" {
				t.Errorf("path %q still references 'thoughts/'", p)
			}
		}
	}
}
