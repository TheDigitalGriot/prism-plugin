package state

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Store manages per-project persisted UI state.
// State files are stored at ~/.config/prism-cli/state/<project-hash>.json.
type Store struct {
	configDir string
	mu        sync.RWMutex
}

// ProjectState holds persisted UI state for a single project.
type ProjectState struct {
	ActivePlugin string                  `json:"activePlugin,omitempty"`
	Files        FilesPersistedState     `json:"files,omitempty"`
	Git          GitPersistedState       `json:"git,omitempty"`
	Workspaces   WorkspacesPersistedState `json:"workspaces,omitempty"`
}

// FilesPersistedState holds file browser state to restore across sessions.
type FilesPersistedState struct {
	OpenTabs     []string `json:"openTabs,omitempty"`
	ExpandedDirs []string `json:"expandedDirs,omitempty"`
	SidebarWidth int      `json:"sidebarWidth,omitempty"`
}

// GitPersistedState holds git plugin state to restore across sessions.
type GitPersistedState struct {
	SidebarWidth int    `json:"sidebarWidth,omitempty"`
	DiffViewMode string `json:"diffViewMode,omitempty"`
}

// WorkspacesPersistedState holds workspace plugin state.
type WorkspacesPersistedState struct {
	LinkedTasks map[string]string `json:"linkedTasks,omitempty"` // worktree path → story ID
}

// NewStore creates a new state store rooted at the given config directory.
// If configDir is empty, state operations become no-ops.
func NewStore(configDir string) *Store {
	return &Store{configDir: configDir}
}

// stateDir returns the path to the state directory, creating it if needed.
func (s *Store) stateDir() (string, error) {
	if s.configDir == "" {
		return "", fmt.Errorf("no config directory configured")
	}
	dir := filepath.Join(s.configDir, "state")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

// projectHash returns a short hash of the project path for use as a filename.
func projectHash(projectDir string) string {
	h := sha256.Sum256([]byte(projectDir))
	return fmt.Sprintf("%x", h[:6]) // 12 hex chars
}

// Load reads persisted state for the given project directory.
// Returns a zero-value ProjectState if no state file exists.
func (s *Store) Load(projectDir string) (*ProjectState, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dir, err := s.stateDir()
	if err != nil {
		return &ProjectState{}, nil
	}

	path := filepath.Join(dir, projectHash(projectDir)+".json")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &ProjectState{}, nil
	}
	if err != nil {
		return nil, err
	}

	var state ProjectState
	if err := json.Unmarshal(data, &state); err != nil {
		return &ProjectState{}, nil // Corrupt file, return defaults
	}
	return &state, nil
}

// Save writes persisted state for the given project directory.
func (s *Store) Save(projectDir string, state *ProjectState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir, err := s.stateDir()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	path := filepath.Join(dir, projectHash(projectDir)+".json")
	return os.WriteFile(path, data, 0644)
}
