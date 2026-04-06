package registry

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// withTempHome overrides the HOME directory for tests so we don't touch
// the real ~/.prism/workspaces.json.
func withTempHome(t *testing.T) {
	t.Helper()
	tmp := t.TempDir()

	// Override HOME (Unix) and USERPROFILE (Windows)
	t.Setenv("HOME", tmp)
	t.Setenv("USERPROFILE", tmp)

	// Create ~/.prism/ so the registry has somewhere to write
	os.MkdirAll(filepath.Join(tmp, ".prism"), 0755)
}

func TestRegisterAndLoadAll(t *testing.T) {
	withTempHome(t)

	projectDir := filepath.Join(t.TempDir(), "my-project")
	os.MkdirAll(filepath.Join(projectDir, ".prism"), 0755)

	// Register a project
	err := Register(projectDir, "2.1.5")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	// Load and verify
	entries, err := LoadAll()
	if err != nil {
		t.Fatalf("LoadAll failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Name != "my-project" {
		t.Errorf("expected name 'my-project', got '%s'", entries[0].Name)
	}
	if entries[0].Version != "2.1.5" {
		t.Errorf("expected version '2.1.5', got '%s'", entries[0].Version)
	}
	if entries[0].LastAccessed == "" {
		t.Error("expected lastAccessed to be set")
	}
}

func TestRegisterDeduplicates(t *testing.T) {
	withTempHome(t)

	projectDir := filepath.Join(t.TempDir(), "dup-project")
	os.MkdirAll(filepath.Join(projectDir, ".prism"), 0755)

	// Register same project twice
	Register(projectDir, "1.0.0")
	Register(projectDir, "2.0.0")

	entries, _ := LoadAll()
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry after dedup, got %d", len(entries))
	}
	if entries[0].Version != "2.0.0" {
		t.Errorf("expected version '2.0.0' after update, got '%s'", entries[0].Version)
	}
}

func TestRegisterPreservesVersionOnEmpty(t *testing.T) {
	withTempHome(t)

	projectDir := filepath.Join(t.TempDir(), "versioned-project")
	os.MkdirAll(filepath.Join(projectDir, ".prism"), 0755)

	// Register with version, then re-register with empty version
	Register(projectDir, "1.5.0")
	Register(projectDir, "")

	entries, _ := LoadAll()
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Version != "1.5.0" {
		t.Errorf("expected version '1.5.0' preserved, got '%s'", entries[0].Version)
	}
}

func TestMultipleProjects(t *testing.T) {
	withTempHome(t)

	tmp := t.TempDir()
	proj1 := filepath.Join(tmp, "project-a")
	proj2 := filepath.Join(tmp, "project-b")
	os.MkdirAll(filepath.Join(proj1, ".prism"), 0755)
	os.MkdirAll(filepath.Join(proj2, ".prism"), 0755)

	Register(proj1, "1.0.0")
	Register(proj2, "2.0.0")

	entries, _ := LoadAll()
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
}

func TestPrune(t *testing.T) {
	withTempHome(t)

	tmp := t.TempDir()
	existing := filepath.Join(tmp, "existing")
	deleted := filepath.Join(tmp, "deleted")
	os.MkdirAll(filepath.Join(existing, ".prism"), 0755)
	os.MkdirAll(filepath.Join(deleted, ".prism"), 0755)

	Register(existing, "1.0.0")
	Register(deleted, "1.0.0")

	// Remove .prism/ from one project
	os.RemoveAll(filepath.Join(deleted, ".prism"))

	removed, err := Prune()
	if err != nil {
		t.Fatalf("Prune failed: %v", err)
	}
	if removed != 1 {
		t.Errorf("expected 1 removed, got %d", removed)
	}

	entries, _ := LoadAll()
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry after prune, got %d", len(entries))
	}
	if entries[0].Name != "existing" {
		t.Errorf("expected 'existing' project to survive prune, got '%s'", entries[0].Name)
	}
}

func TestLoadAllEmptyFile(t *testing.T) {
	withTempHome(t)

	entries, err := LoadAll()
	if err != nil {
		t.Fatalf("LoadAll on empty should not error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}
}

func TestLoadAllCorruptFile(t *testing.T) {
	withTempHome(t)

	// Write garbage to the registry file
	home, _ := os.UserHomeDir()
	rp := filepath.Join(home, ".prism", registryFilename)
	os.WriteFile(rp, []byte("not json"), 0644)

	entries, err := LoadAll()
	if err != nil {
		t.Fatalf("LoadAll on corrupt file should not error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries on corrupt file, got %d", len(entries))
	}
}

func TestRegistryJSONFormat(t *testing.T) {
	withTempHome(t)

	projectDir := filepath.Join(t.TempDir(), "json-test")
	os.MkdirAll(filepath.Join(projectDir, ".prism"), 0755)
	Register(projectDir, "3.0.0")

	// Read raw JSON and verify structure
	home, _ := os.UserHomeDir()
	rp := filepath.Join(home, ".prism", registryFilename)
	data, err := os.ReadFile(rp)
	if err != nil {
		t.Fatalf("failed to read registry: %v", err)
	}

	var wf workspacesFile
	if err := json.Unmarshal(data, &wf); err != nil {
		t.Fatalf("failed to parse registry JSON: %v", err)
	}
	if len(wf.Projects) != 1 {
		t.Fatalf("expected 1 project in JSON, got %d", len(wf.Projects))
	}
}
