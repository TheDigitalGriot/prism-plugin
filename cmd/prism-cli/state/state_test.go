package state

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewStore(t *testing.T) {
	s := NewStore("/tmp/test-config")
	if s == nil {
		t.Fatal("expected non-nil store")
	}
	if s.configDir != "/tmp/test-config" {
		t.Fatalf("expected configDir=/tmp/test-config, got %s", s.configDir)
	}
}

func TestProjectHash(t *testing.T) {
	h1 := projectHash("/home/user/project-a")
	h2 := projectHash("/home/user/project-b")
	if h1 == h2 {
		t.Fatal("expected different hashes for different projects")
	}
	if len(h1) != 12 {
		t.Fatalf("expected 12-char hash, got %d chars: %s", len(h1), h1)
	}
}

func TestLoadMissing(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(dir)

	state, err := s.Load("/nonexistent/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if state == nil {
		t.Fatal("expected non-nil state")
	}
	if state.ActivePlugin != "" {
		t.Fatalf("expected empty ActivePlugin, got %q", state.ActivePlugin)
	}
}

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(dir)

	projectDir := "/home/user/my-project"
	original := &ProjectState{
		ActivePlugin: "files",
		Files: FilesPersistedState{
			OpenTabs:     []string{"main.go", "go.mod"},
			ExpandedDirs: []string{"cmd/", "pkg/"},
			SidebarWidth: 35,
		},
		Git: GitPersistedState{
			SidebarWidth: 30,
			DiffViewMode: "side-by-side",
		},
		Workspaces: WorkspacesPersistedState{
			LinkedTasks: map[string]string{
				"/worktree/feat": "STORY-001",
			},
		},
	}

	// Save
	err := s.Save(projectDir, original)
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}

	// Verify file exists
	stateFile := filepath.Join(dir, "state", projectHash(projectDir)+".json")
	if _, err := os.Stat(stateFile); os.IsNotExist(err) {
		t.Fatal("state file was not created")
	}

	// Load
	loaded, err := s.Load(projectDir)
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}

	if loaded.ActivePlugin != "files" {
		t.Fatalf("expected ActivePlugin=files, got %q", loaded.ActivePlugin)
	}
	if len(loaded.Files.OpenTabs) != 2 {
		t.Fatalf("expected 2 open tabs, got %d", len(loaded.Files.OpenTabs))
	}
	if loaded.Git.DiffViewMode != "side-by-side" {
		t.Fatalf("expected DiffViewMode=side-by-side, got %q", loaded.Git.DiffViewMode)
	}
	if loaded.Workspaces.LinkedTasks["/worktree/feat"] != "STORY-001" {
		t.Fatal("linked task not preserved")
	}
}

func TestEmptyConfigDir(t *testing.T) {
	s := NewStore("")

	// Load should return defaults without error
	state, err := s.Load("/some/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if state == nil {
		t.Fatal("expected non-nil state")
	}

	// Save should return error
	err = s.Save("/some/project", &ProjectState{})
	if err == nil {
		t.Fatal("expected error on save with empty config dir")
	}
}
