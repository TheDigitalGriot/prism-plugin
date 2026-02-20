package domain

import (
	"path/filepath"
	"testing"
)

func TestNewProgressFile_LegacyFlat(t *testing.T) {
	// Legacy: .prism/stories/stories.json -> .prism/shared/spectrum/progress.md
	storiesPath := filepath.Join("project", ".prism", "stories", "stories.json")
	pf := NewProgressFile(storiesPath)

	expected := filepath.Join("project", ".prism", "shared", "spectrum", "progress.md")
	if pf.Path != expected {
		t.Errorf("legacy path: got %q, want %q", pf.Path, expected)
	}
}

func TestNewProgressFile_EpicScoped(t *testing.T) {
	// Epic: .prism/stories/<epic>/stories.json -> .prism/shared/spectrum/<epic>/progress.md
	storiesPath := filepath.Join("project", ".prism", "stories", "user-auth", "stories.json")
	pf := NewProgressFile(storiesPath)

	expected := filepath.Join("project", ".prism", "shared", "spectrum", "user-auth", "progress.md")
	if pf.Path != expected {
		t.Errorf("epic path: got %q, want %q", pf.Path, expected)
	}
}

func TestNewProgressFile_EpicWithDashes(t *testing.T) {
	storiesPath := filepath.Join("project", ".prism", "stories", "multi-view-dashboard", "stories.json")
	pf := NewProgressFile(storiesPath)

	expected := filepath.Join("project", ".prism", "shared", "spectrum", "multi-view-dashboard", "progress.md")
	if pf.Path != expected {
		t.Errorf("epic with dashes: got %q, want %q", pf.Path, expected)
	}
}

func TestNewProgressFile_AbsolutePath_Legacy(t *testing.T) {
	// Test with absolute-style path
	storiesPath := filepath.Join(string(filepath.Separator), "home", "user", "project", ".prism", "stories", "stories.json")
	pf := NewProgressFile(storiesPath)

	expected := filepath.Join(string(filepath.Separator), "home", "user", "project", ".prism", "shared", "spectrum", "progress.md")
	if pf.Path != expected {
		t.Errorf("absolute legacy: got %q, want %q", pf.Path, expected)
	}
}

func TestNewProgressFile_AbsolutePath_Epic(t *testing.T) {
	storiesPath := filepath.Join(string(filepath.Separator), "home", "user", "project", ".prism", "stories", "my-epic", "stories.json")
	pf := NewProgressFile(storiesPath)

	expected := filepath.Join(string(filepath.Separator), "home", "user", "project", ".prism", "shared", "spectrum", "my-epic", "progress.md")
	if pf.Path != expected {
		t.Errorf("absolute epic: got %q, want %q", pf.Path, expected)
	}
}
