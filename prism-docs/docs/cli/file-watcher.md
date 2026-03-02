---
title: File Watcher, Persisted State & Registry
description: Real-time file change detection, per-project UI state persistence, and global workspace registry.
outline: [2, 3]
---

# File Watcher, Persisted State & Registry

## File Watcher

The `watcher/` package provides real-time file change detection using `fsnotify`, enabling auto-refresh across plugins.

### Architecture

```
Project Directory
    │
    ▼
┌──────────────────┐
│  fsnotify.Watcher │  Recursive directory watching
│  (all subdirs)    │  Auto-adds newly created directories
└────────┬─────────┘
         │
    fs event
         │
         ▼
┌──────────────────┐
│  Ignore Filter    │  Skips: .git, node_modules, vendor,
│                   │  dist, build, __pycache__, .cache,
│                   │  hidden dirs (except .prism)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Debounce         │  Per-path timer (default 500ms)
│  (time.Timer map) │  Resets on repeated events
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  EventBus.Publish │  FileChangedEvent{FilePath, Action}
│                   │  Action: "created", "modified", "deleted"
└──────────────────┘
```

### Configuration

- **Default debounce**: 500ms
- **Functional options**: `WithDebounce(duration)`, `WithIgnoreFunc(fn)`
- **Thread-safe**: Uses `sync.Mutex` for timer map access
- **Lifecycle**: `Start()` walks directory tree, `Stop()` cancels all timers and closes watcher

Subscribers: Git plugin (auto-refresh status), Files plugin (tree refresh), Browser plugin (artifact scanning).

---

## Persisted UI State

The `state/` package provides per-project UI state persistence across sessions.

### Storage

State files are stored at `~/.config/prism-cli/state/<project-hash>.json`. The hash is SHA-256 of the project directory path (first 12 hex characters).

### Schema

```go
type ProjectState struct {
    ActivePlugin string                    // Last active tab
    Files        FilesPersistedState       // Open tabs, expanded directories, sidebar width
    Git          GitPersistedState         // Sidebar width, diff view mode
    Workspaces   WorkspacesPersistedState  // Linked tasks (worktree path → story ID)
}
```

### Operations

| Method | Description |
|--------|-------------|
| `NewStore(configDir)` | Creates store rooted at config directory; empty `configDir` makes all operations no-ops |
| `Load(projectDir)` | Reads state for project; returns zero-value on missing/corrupt file |
| `Save(projectDir, state)` | Writes state atomically as indented JSON |

Thread-safe via `sync.RWMutex`.

---

## Global Workspace Registry

The `registry/` package manages `~/.prism/workspaces.json` for cross-directory project discovery.

### Schema

```json
{
  "projects": [
    {
      "path": "/Users/demo/project",
      "name": "project",
      "lastAccessed": "2026-03-02T14:00:00Z",
      "version": "2.3.0"
    }
  ]
}
```

### Operations

| Function | Description |
|----------|-------------|
| `Register(projectDir, version)` | Add/update project entry (called on TUI exit from `main.go`) |
| `LoadAll()` | Read all registered projects |
| `Prune()` | Remove entries where `.prism/` no longer exists on disk |

### Cross-Process Safety

Uses an exclusive lockfile at `~/.prism/workspaces.json.lock`:
- Retries up to 10 times with 50ms delay
- Removes stale lock and retries once on failure
- Windows paths are lowercased via `normalizePath()` for case-insensitive deduplication

The Workspaces plugin reads from this registry to discover projects across different directories (not just siblings).
