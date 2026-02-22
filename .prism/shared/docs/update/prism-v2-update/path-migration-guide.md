# Prism Path Migration Visual Guide

## 🗂️ Directory Structure Changes

### Before: Ralph Structure
```
project/
├── thoughts/
│   └── shared/
│       └── ralph/
│           ├── stories.json    ← Task definitions
│           └── progress.md     ← Execution state
├── cmd/
│   └── ralph-tui/              ← TUI code
└── scripts/
    └── ralph.sh                ← Execution script
```

### After: Spectrum Structure
```
project/
├── .prism/
│   ├── stories/                ← 🆕 SEPARATED DIRECTORY
│   │   └── stories.json        ← Task definitions (source of truth)
│   └── shared/
│       └── spectrum/           ← 🆕 RENAMED FROM ralph/
│           └── progress.md     ← Execution state only
├── cmd/
│   └── prism-cli/              ← 🔄 RENAMED FROM ralph-tui/
└── scripts/
    └── spectrum.sh             ← 🔄 RENAMED FROM ralph.sh
```

---

## 📍 Path Migration Map

### Stories File Path
```
OLD: thoughts/shared/ralph/stories.json
     ↓
     ↓ Move + Separate
     ↓
NEW: .prism/stories/stories.json
```

### Progress File Path
```
OLD: thoughts/shared/ralph/progress.md
     ↓
     ↓ Move + Rename directory
     ↓
NEW: .prism/shared/spectrum/progress.md
```

### TUI Binary & Code
```
OLD: cmd/ralph-tui/
     ↓
     ↓ Rename + Update paths
     ↓
NEW: cmd/prism-cli/
```

### Execution Script
```
OLD: scripts/ralph.sh
     ↓
     ↓ Rename
     ↓
NEW: scripts/spectrum.sh
```

---

## 🔧 Code Changes Required

### 1. Path Constants (Go)
```go
// cmd/prism-cli/config/paths.go

// BEFORE
const (
    StoriesFile  = "thoughts/shared/ralph/stories.json"
    ProgressFile = "thoughts/shared/ralph/progress.md"
)

// AFTER
const (
    StoriesFile  = ".prism/stories/stories.json"      // ← Different dir
    ProgressFile = ".prism/shared/spectrum/progress.md" // ← Different dir
)
```

### 2. File Watchers (Go)
```go
// cmd/prism-cli/ui/file_watcher.go

// BEFORE
watchFile("thoughts/shared/ralph/stories.json", handler)
watchFile("thoughts/shared/ralph/progress.md", handler)

// AFTER
watchFile(".prism/stories/stories.json", handler)           // ← New path
watchFile(".prism/shared/spectrum/progress.md", handler)    // ← New path
```

### 3. Data Loaders (Go)
```go
// cmd/prism-cli/models/stories.go

// BEFORE
func LoadStories() (*Stories, error) {
    return loadJSONFile("thoughts/shared/ralph/stories.json")
}

// AFTER
func LoadStories() (*Stories, error) {
    return loadJSONFile(".prism/stories/stories.json")      // ← New path
}
```

### 4. Scripts (Bash)
```bash
# scripts/spectrum.sh

# BEFORE
STORIES_FILE="thoughts/shared/ralph/stories.json"
PROGRESS_FILE="thoughts/shared/ralph/progress.md"

# AFTER
STORIES_FILE=".prism/stories/stories.json"                  # ← New path
PROGRESS_FILE=".prism/shared/spectrum/progress.md"          # ← New path
```

---

## ✅ Migration Checklist

### File Operations
- [ ] Move `thoughts/shared/ralph/stories.json` → `.prism/stories/stories.json`
- [ ] Move `thoughts/shared/ralph/progress.md` → `.prism/shared/spectrum/progress.md`
- [ ] Rename `cmd/ralph-tui/` → `cmd/prism-cli/`
- [ ] Rename `scripts/ralph.sh` → `scripts/spectrum.sh`

### Code Updates
- [ ] Update path constants in `cmd/prism-cli/config/paths.go`
- [ ] Update file loaders in `cmd/prism-cli/models/`
- [ ] Update file watchers in `cmd/prism-cli/ui/`
- [ ] Update script paths in `scripts/spectrum.sh`
- [ ] Update import statements referencing old package names
- [ ] Update build scripts (Makefile, go.mod, etc.)

### Testing
- [ ] TUI can load `.prism/stories/stories.json`
- [ ] TUI can load `.prism/shared/spectrum/progress.md`
- [ ] TUI watches both files for changes
- [ ] `spectrum.sh` script finds both files
- [ ] Error messages show correct new paths
- [ ] Build produces `prism-cli` binary (not `ralph-tui`)

### Documentation
- [ ] Update README with new paths
- [ ] Update comments in code
- [ ] Update example commands
- [ ] Add migration guide for existing users

---

## 💡 Why Separate stories.json?

### Conceptual Separation
```
stories.json     = WHAT to do    (plan, tasks, requirements)
progress.md      = WHAT happened (learnings, decisions, outcomes)
```

### Benefits
1. **Multiple runs share stories**: Same story definitions, different progress files
2. **Clearer ownership**: Stories = product/planning, Progress = execution
3. **Better version control**: Changes to tasks don't mix with execution logs
4. **Easier resets**: Delete progress.md to retry without losing task definitions

### Example Use Case
```bash
# Run 1: First attempt
.prism/stories/stories.json          # 10 tasks defined
.prism/shared/spectrum/run-1/progress.md  # Failed at task 5

# Run 2: Retry with improvements
.prism/stories/stories.json          # Same 10 tasks (unchanged)
.prism/shared/spectrum/run-2/progress.md  # New attempt, learned from run-1
```

---

## 🚨 Common Pitfalls

### ❌ Don't do this:
```go
// Using old hardcoded paths
const storiesPath = "thoughts/shared/ralph/stories.json"
```

### ✅ Do this instead:
```go
// Use centralized constants
const storiesPath = config.StoriesFile

// Or support both during transition
func findStoriesFile() string {
    if exists(".prism/stories/stories.json") {
        return ".prism/stories/stories.json"
    }
    if exists("thoughts/shared/ralph/stories.json") {
        log.Warn("Using legacy path. Run /prism-dir-update")
        return "thoughts/shared/ralph/stories.json"
    }
    return ".prism/stories/stories.json" // Default
}
```

---

## 📚 Quick Reference Card

| Component | Old Path | New Path |
|-----------|----------|----------|
| Stories | `thoughts/shared/ralph/stories.json` | `.prism/stories/stories.json` |
| Progress | `thoughts/shared/ralph/progress.md` | `.prism/shared/spectrum/progress.md` |
| TUI Code | `cmd/ralph-tui/` | `cmd/prism-cli/` |
| Script | `scripts/ralph.sh` | `scripts/spectrum.sh` |
| Command | `/prism:prism-ralph` | `/prism:prism-spectrum` |

**Remember**: Stories and Progress are now in DIFFERENT directories!
