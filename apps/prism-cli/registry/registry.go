// Package registry manages the global workspace registry at ~/.prism/workspaces.json.
// It tracks all prism-enabled projects on the machine, enabling the Workspaces tab
// to discover projects across different directories (not just siblings).
package registry

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	registryFilename = "workspaces.json"
	lockFilename     = "workspaces.json.lock"
)

// WorkspaceEntry represents a single registered project.
type WorkspaceEntry struct {
	Path         string `json:"path"`
	Name         string `json:"name"`
	LastAccessed string `json:"lastAccessed"`
	Version      string `json:"version,omitempty"`
}

// workspacesFile is the on-disk JSON structure.
type workspacesFile struct {
	Projects []WorkspaceEntry `json:"projects"`
}

// registryDir returns the ~/.prism/ directory path.
func registryDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".prism"), nil
}

// registryPath returns the full path to ~/.prism/workspaces.json.
func registryPath() (string, error) {
	dir, err := registryDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, registryFilename), nil
}

func lockPath() (string, error) {
	dir, err := registryDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, lockFilename), nil
}

// acquireLock creates an exclusive lockfile for cross-process safety.
// Returns a cleanup function to release the lock.
func acquireLock() (func(), error) {
	lp, err := lockPath()
	if err != nil {
		return func() {}, err
	}
	os.MkdirAll(filepath.Dir(lp), 0755)

	var f *os.File
	for i := 0; i < 10; i++ {
		f, err = os.OpenFile(lp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		// Stale lock — remove and retry once
		os.Remove(lp)
		f, err = os.OpenFile(lp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			return func() {}, err
		}
	}
	f.Close()
	return func() { os.Remove(lp) }, nil
}

// normalizePath returns a cleaned path suitable for deduplication.
// On Windows, paths are lowercased for case-insensitive comparison.
func normalizePath(p string) string {
	cleaned := filepath.Clean(p)
	if runtime.GOOS == "windows" {
		cleaned = strings.ToLower(cleaned)
	}
	return cleaned
}

// loadEntries reads the registry file, returning an empty slice if missing or corrupt.
func loadEntries() ([]WorkspaceEntry, error) {
	rp, err := registryPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(rp)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var wf workspacesFile
	if err := json.Unmarshal(data, &wf); err != nil {
		return nil, nil // Corrupt file, start fresh
	}
	return wf.Projects, nil
}

// saveEntries writes the registry file atomically.
func saveEntries(entries []WorkspaceEntry) error {
	rp, err := registryPath()
	if err != nil {
		return err
	}

	os.MkdirAll(filepath.Dir(rp), 0755)

	data, err := json.MarshalIndent(workspacesFile{Projects: entries}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(rp, data, 0644)
}

// Register adds or updates a project in the global workspace registry.
// If the project already exists (by normalized path), updates lastAccessed and version.
// Registration is best-effort; errors are non-fatal for callers.
func Register(projectDir string, version string) error {
	absPath, err := filepath.Abs(projectDir)
	if err != nil {
		return err
	}

	unlock, err := acquireLock()
	if err != nil {
		return err
	}
	defer unlock()

	entries, _ := loadEntries()

	now := time.Now().UTC().Format(time.RFC3339)
	name := filepath.Base(absPath)
	normalizedAbs := normalizePath(absPath)

	found := false
	for i, e := range entries {
		if normalizePath(e.Path) == normalizedAbs {
			entries[i].LastAccessed = now
			entries[i].Name = name
			if version != "" {
				entries[i].Version = version
			}
			found = true
			break
		}
	}
	if !found {
		entries = append(entries, WorkspaceEntry{
			Path:         absPath,
			Name:         name,
			LastAccessed: now,
			Version:      version,
		})
	}

	return saveEntries(entries)
}

// LoadAll reads and returns all registered projects.
func LoadAll() ([]WorkspaceEntry, error) {
	entries, err := loadEntries()
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// Prune removes entries where .prism/ no longer exists on disk.
// Returns the number of entries removed.
func Prune() (int, error) {
	unlock, err := acquireLock()
	if err != nil {
		return 0, err
	}
	defer unlock()

	entries, err := loadEntries()
	if err != nil {
		return 0, err
	}

	var kept []WorkspaceEntry
	removed := 0
	for _, e := range entries {
		prismDir := filepath.Join(e.Path, ".prism")
		if info, err := os.Stat(prismDir); err == nil && info.IsDir() {
			kept = append(kept, e)
		} else {
			removed++
		}
	}

	if removed > 0 {
		if err := saveEntries(kept); err != nil {
			return 0, err
		}
	}
	return removed, nil
}
