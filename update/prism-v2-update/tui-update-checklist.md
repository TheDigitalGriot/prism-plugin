# TUI Code Update Checklist
## cmd/ralph-tui → cmd/prism-tui Migration

---

## 📋 Pre-Migration Checklist

- [ ] **Backup current code**: `cp -r cmd/ralph-tui cmd/ralph-tui.backup`
- [ ] **Check current functionality**: Run `ralph-tui` to verify it works
- [ ] **Document current paths**: Note all files that reference ralph paths
- [ ] **Create feature branch**: `git checkout -b feat/prism-tui-migration`

---

## 🔄 Step 1: Rename Directory

```bash
# Rename the main directory
mv cmd/ralph-tui cmd/prism-tui

# Update git tracking
git mv cmd/ralph-tui cmd/prism-tui

# Verify
ls cmd/prism-tui
```

**Verification**:
- [ ] Directory renamed successfully
- [ ] Git tracking updated
- [ ] No broken symlinks

---

## 🛠️ Step 2: Update Path Constants

### File: `cmd/prism-tui/config/paths.go`

```go
package config

import (
    "os"
    "path/filepath"
)

// OLD - Remove these
/*
const (
    ThoughtsDir  = "thoughts"
    RalphDir     = "thoughts/shared/ralph"
    StoriesFile  = "thoughts/shared/ralph/stories.json"
    ProgressFile = "thoughts/shared/ralph/progress.md"
)
*/

// NEW - Add these
const (
    PrismDir      = ".prism"
    StoriesDir    = ".prism/stories"
    SpectrumDir   = ".prism/shared/spectrum"
    
    // Separated paths
    StoriesFile   = ".prism/stories/stories.json"
    ProgressFile  = ".prism/shared/spectrum/progress.md"
    
    // Additional paths
    SharedDir     = ".prism/shared"
    LocalDir      = ".prism/local"
)

// Helper function to check if Prism is initialized
func IsPrismInitialized() bool {
    _, err := os.Stat(PrismDir)
    return err == nil
}

// Helper to get absolute paths
func GetStoriesPath() (string, error) {
    return filepath.Abs(StoriesFile)
}

func GetProgressPath() (string, error) {
    return filepath.Abs(ProgressFile)
}
```

**Checklist**:
- [ ] Created/updated `config/paths.go`
- [ ] All constants use new `.prism/` structure
- [ ] Removed old `thoughts/` references
- [ ] Added helper functions
- [ ] Code compiles without errors

---

## 📂 Step 3: Update Data Models

### File: `cmd/prism-tui/models/stories.go`

```go
package models

import (
    "encoding/json"
    "os"
    "github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui/config"
)

// OLD - Update this function
/*
func LoadStories() (*Stories, error) {
    data, err := os.ReadFile("thoughts/shared/ralph/stories.json")
    // ...
}
*/

// NEW - Use config constants
func LoadStories() (*Stories, error) {
    // Use the centralized path constant
    data, err := os.ReadFile(config.StoriesFile)
    if err != nil {
        return nil, fmt.Errorf("failed to read stories from %s: %w", 
            config.StoriesFile, err)
    }
    
    var stories Stories
    if err := json.Unmarshal(data, &stories); err != nil {
        return nil, fmt.Errorf("failed to parse stories: %w", err)
    }
    
    return &stories, nil
}

// Add backward compatibility helper (optional, for transition period)
func LoadStoriesWithFallback() (*Stories, error) {
    // Try new path first
    stories, err := LoadStories()
    if err == nil {
        return stories, nil
    }
    
    // Fall back to old path if new doesn't exist
    legacyPath := "thoughts/shared/ralph/stories.json"
    if _, err := os.Stat(legacyPath); err == nil {
        log.Printf("WARNING: Using legacy path %s. Please run /prism-dir-update", legacyPath)
        data, err := os.ReadFile(legacyPath)
        if err != nil {
            return nil, err
        }
        var stories Stories
        json.Unmarshal(data, &stories)
        return &stories, nil
    }
    
    return nil, err
}
```

### File: `cmd/prism-tui/models/progress.go`

```go
package models

import (
    "os"
    "github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui/config"
)

// OLD - Update this
/*
func LoadProgress() (*Progress, error) {
    data, err := os.ReadFile("thoughts/shared/ralph/progress.md")
    // ...
}
*/

// NEW - Use config constants
func LoadProgress() (*Progress, error) {
    data, err := os.ReadFile(config.ProgressFile)
    if err != nil {
        // Progress file might not exist on first run, that's okay
        if os.IsNotExist(err) {
            return &Progress{Entries: []string{}}, nil
        }
        return nil, fmt.Errorf("failed to read progress from %s: %w", 
            config.ProgressFile, err)
    }
    
    return ParseProgress(string(data)), nil
}

func SaveProgress(progress *Progress) error {
    // Ensure directory exists
    dir := filepath.Dir(config.ProgressFile)
    if err := os.MkdirAll(dir, 0755); err != nil {
        return fmt.Errorf("failed to create directory %s: %w", dir, err)
    }
    
    return os.WriteFile(config.ProgressFile, []byte(progress.String()), 0644)
}
```

**Checklist**:
- [ ] Updated `models/stories.go`
- [ ] Updated `models/progress.go`
- [ ] All file operations use `config.*` constants
- [ ] Error messages include new paths
- [ ] Added directory creation for write operations
- [ ] Optional: Added backward compatibility
- [ ] Tests pass (if you have them)

---

## 👁️ Step 4: Update File Watchers

### File: `cmd/prism-tui/ui/file_watcher.go`

```go
package ui

import (
    "github.com/fsnotify/fsnotify"
    "github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui/config"
)

// OLD - Update these watch calls
/*
func (m *Model) watchFiles() error {
    watcher.Add("thoughts/shared/ralph/stories.json")
    watcher.Add("thoughts/shared/ralph/progress.md")
}
*/

// NEW - Use config constants
func (m *Model) watchFiles() error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    
    m.watcher = watcher
    
    // Watch stories file
    if err := watcher.Add(config.StoriesFile); err != nil {
        log.Printf("Warning: cannot watch %s: %v", config.StoriesFile, err)
    }
    
    // Watch progress file
    if err := watcher.Add(config.ProgressFile); err != nil {
        log.Printf("Warning: cannot watch %s: %v", config.ProgressFile, err)
    }
    
    // Watch directories for new files
    watcher.Add(config.StoriesDir)
    watcher.Add(config.SpectrumDir)
    
    go m.watchLoop()
    return nil
}

func (m *Model) watchLoop() {
    for {
        select {
        case event := <-m.watcher.Events:
            switch event.Name {
            case config.StoriesFile:
                m.onStoriesChange()
            case config.ProgressFile:
                m.onProgressChange()
            }
        case err := <-m.watcher.Errors:
            log.Printf("Watcher error: %v", err)
        }
    }
}
```

**Checklist**:
- [ ] Updated file watcher paths
- [ ] Watching both `.prism/stories/` and `.prism/shared/spectrum/`
- [ ] Event handlers updated
- [ ] Error handling for missing files
- [ ] Tests pass

---

## 🏗️ Step 5: Update Build Configuration

### File: `go.mod`

```go
// OLD
module github.com/TheDigitalGriot/prism-plugin/cmd/ralph-tui

// NEW
module github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui

go 1.21
```

### File: `Makefile` (if you have one)

```makefile
# OLD
build:
    go build -o bin/ralph-tui ./cmd/ralph-tui

# NEW
build:
    go build -o bin/prism-tui ./cmd/prism-tui

install:
    go install ./cmd/prism-tui

test:
    go test ./cmd/prism-tui/...
```

### File: `cmd/prism-tui/main.go`

```go
package main

import (
    "fmt"
    "os"
    
    tea "github.com/charmbracelet/bubbletea"
    "github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui/config"
    "github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui/ui"
)

func main() {
    // Check if Prism is initialized
    if !config.IsPrismInitialized() {
        fmt.Fprintf(os.Stderr, 
            "Error: .prism directory not found\n" +
            "Run 'python skills/prism/scripts/init_prism.py' first\n")
        os.Exit(1)
    }
    
    // Create and run the TUI
    m := ui.NewModel()
    p := tea.NewProgram(m, tea.WithAltScreen())
    
    if err := p.Start(); err != nil {
        fmt.Fprintf(os.Stderr, "Error running prism-tui: %v\n", err)
        os.Exit(1)
    }
}
```

**Checklist**:
- [ ] Updated `go.mod` module path
- [ ] Updated `Makefile` or build scripts
- [ ] Updated `main.go` to check for `.prism/`
- [ ] Binary name is now `prism-tui`
- [ ] Build succeeds: `make build` or `go build`
- [ ] Binary runs: `./bin/prism-tui`

---

## 🎨 Step 6: Update UI Display Text

### File: `cmd/prism-tui/ui/dashboard.go`

```go
// Update any UI text that references paths
func (m Model) View() string {
    var b strings.Builder
    
    // Header
    b.WriteString(lipgloss.NewStyle().
        Bold(true).
        Foreground(lipgloss.Color("#6366f1")).
        Render("🌈 Prism - Spectrum Workflow"))
    b.WriteString("\n\n")
    
    // Status
    if m.stories != nil {
        b.WriteString(fmt.Sprintf("Stories: %s\n", 
            lipgloss.NewStyle().Faint(true).Render(config.StoriesFile)))
        b.WriteString(fmt.Sprintf("Progress: %s\n", 
            lipgloss.NewStyle().Faint(true).Render(config.ProgressFile)))
    }
    
    // ... rest of UI
}
```

### File: `cmd/prism-tui/ui/help.go`

```go
func helpView() string {
    return `
Prism TUI - Spectrum Workflow Dashboard

Files:
  Stories:  .prism/stories/stories.json
  Progress: .prism/shared/spectrum/progress.md

Keys:
  ? - Toggle help
  q - Quit
  ↑/↓ - Navigate
  ...
`
}
```

**Checklist**:
- [ ] Updated all UI text referencing old paths
- [ ] Help text shows new paths
- [ ] Error messages use new paths
- [ ] About/info screens updated
- [ ] No mentions of "ralph" in UI

---

## 🧪 Step 7: Testing

### Manual Testing

```bash
# 1. Build
cd cmd/prism-tui
go build -o prism-tui

# 2. Test without .prism directory
cd /tmp/test-project
./prism-tui
# Should show error about missing .prism/

# 3. Initialize Prism
python /path/to/skills/prism/scripts/init_prism.py

# 4. Create test stories
cat > .prism/stories/stories.json << 'EOF'
{
  "stories": [
    {"id": 1, "title": "Test Story 1", "status": "pending"},
    {"id": 2, "title": "Test Story 2", "status": "complete"}
  ]
}
EOF

# 5. Create test progress
cat > .prism/shared/spectrum/progress.md << 'EOF'
# Progress

- Completed story 2
- Working on story 1
EOF

# 6. Run TUI
./prism-tui
# Should load and display stories and progress
```

### Automated Testing (if applicable)

```go
// cmd/prism-tui/config/paths_test.go
package config

import (
    "testing"
)

func TestPathConstants(t *testing.T) {
    tests := []struct {
        name     string
        path     string
        expected string
    }{
        {"Stories", StoriesFile, ".prism/stories/stories.json"},
        {"Progress", ProgressFile, ".prism/shared/spectrum/progress.md"},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.path != tt.expected {
                t.Errorf("got %s, want %s", tt.path, tt.expected)
            }
        })
    }
}
```

**Test Checklist**:
- [ ] TUI loads stories from new path
- [ ] TUI loads progress from new path
- [ ] TUI watches for file changes
- [ ] TUI handles missing files gracefully
- [ ] Error messages show correct paths
- [ ] Build produces `prism-tui` binary
- [ ] No hardcoded old paths remain

---

## 🔍 Step 8: Code Review

### Search for Remaining References

```bash
# Search for old paths in code
cd cmd/prism-tui
grep -r "thoughts/" . --exclude-dir=vendor
grep -r "ralph" . --exclude-dir=vendor --exclude-dir=.git
grep -ri "RALPH" . --exclude-dir=vendor

# Should return 0 results (or only in comments/docs)
```

### Update Comments and Documentation

```go
// OLD comment
// Load stories from thoughts/shared/ralph/stories.json

// NEW comment
// Load stories from .prism/stories/stories.json
```

**Review Checklist**:
- [ ] No hardcoded "thoughts/" paths
- [ ] No references to "ralph" (except in git history)
- [ ] Comments updated with new paths
- [ ] README updated
- [ ] CHANGELOG entry created
- [ ] All TODOs addressed

---

## 📝 Step 9: Documentation Updates

### Update README

```markdown
# Prism TUI

Terminal dashboard for monitoring Spectrum workflow execution.

## Installation

```bash
go install github.com/TheDigitalGriot/prism-plugin/cmd/prism-tui@latest
```

## Usage

```bash
# Launch dashboard
prism-tui

# Follow live execution
prism-tui --follow
```

## Requirements

- Prism must be initialized: `.prism/` directory exists
- Files monitored:
  - `.prism/stories/stories.json` - Task definitions
  - `.prism/shared/spectrum/progress.md` - Execution progress
```

**Documentation Checklist**:
- [ ] README updated with new paths
- [ ] Installation instructions updated
- [ ] Usage examples use new paths
- [ ] Screenshots updated (if any)
- [ ] CHANGELOG updated

---

## ✅ Final Verification

### Pre-Commit Checklist

- [ ] All tests pass: `go test ./...`
- [ ] Build succeeds: `go build`
- [ ] Binary name is `prism-tui`
- [ ] No references to `ralph` in code
- [ ] No hardcoded old paths
- [ ] Documentation updated
- [ ] CHANGELOG entry added

### Commit Messages

```bash
git add cmd/prism-tui
git commit -m "refactor(tui): rename ralph-tui to prism-tui

- Rename cmd/ralph-tui to cmd/prism-tui
- Update paths to use .prism/ structure
- Separate stories.json and progress.md paths
- Update module name and imports
- Update build configuration

BREAKING CHANGE: TUI now expects .prism/ directory structure"
```

---

## 🚀 Deployment

### Build for Release

```bash
# Build for current platform
go build -o bin/prism-tui ./cmd/prism-tui

# Cross-compile for multiple platforms
GOOS=darwin GOARCH=amd64 go build -o bin/prism-tui-darwin-amd64 ./cmd/prism-tui
GOOS=darwin GOARCH=arm64 go build -o bin/prism-tui-darwin-arm64 ./cmd/prism-tui
GOOS=linux GOARCH=amd64 go build -o bin/prism-tui-linux-amd64 ./cmd/prism-tui
GOOS=windows GOARCH=amd64 go build -o bin/prism-tui-windows-amd64.exe ./cmd/prism-tui
```

### Installation

```bash
# Install locally
go install ./cmd/prism-tui

# Verify
which prism-tui
prism-tui --version
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: TUI says "stories.json not found"
```bash
# Check if file exists at new location
ls -la .prism/stories/stories.json

# If not, run migration
/prism-dir-update
```

**Issue**: TUI not watching file changes
```bash
# Check file watcher permissions
# Ensure .prism/ directory is readable
chmod -R u+r .prism/
```

**Issue**: Build fails with "package not found"
```bash
# Update go.mod
cd cmd/prism-tui
go mod tidy

# Rebuild
go build
```

---

## 📊 Progress Tracking

| Step | Status | Notes |
|------|--------|-------|
| 1. Rename directory | ✅ | cmd/ralph-tui → cmd/prism-tui |
| 2. Update path constants | ✅ | Paths handled inline (no separate config/paths.go) |
| 3. Update data models | ✅ | .prism/ paths throughout |
| 4. Update file watchers | ✅ | Watching .prism/ structure |
| 5. Update build config | ✅ | go.mod, Makefile, GitHub workflow |
| 6. Update UI text | ✅ | All ralph/thoughts refs removed |
| 7. Testing | ✅ | Zero ralph/thoughts references in TUI code |
| 8. Code review | ✅ | Clean — verified no stale references |
| 9. Documentation | ✅ | README updated with spectrum branding |
| 10. Final verification | ✅ | TUI code is clean and migrated |

---

**Estimated Time**: 3-4 hours for experienced Go developer

**Priority**: HIGH - Required for Spectrum migration to work properly
