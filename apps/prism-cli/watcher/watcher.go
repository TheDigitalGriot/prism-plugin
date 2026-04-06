package watcher

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/prism-plugin/prism-cli/plugin"
)

// Watcher provides real-time file change detection for auto-refresh across plugins.
// It wraps fsnotify with debouncing, gitignore-aware filtering, and EventBus integration.
type Watcher struct {
	fsWatcher  *fsnotify.Watcher
	debounce   time.Duration
	eventBus   *plugin.EventBus
	ignoreFunc func(string) bool
	projectDir string

	mu      sync.Mutex
	timers  map[string]*time.Timer // debounce timers per path
	started bool
	stopped bool
	done    chan struct{}
}

// Option configures the watcher.
type Option func(*Watcher)

// WithDebounce sets the debounce duration (default 500ms).
func WithDebounce(d time.Duration) Option {
	return func(w *Watcher) {
		w.debounce = d
	}
}

// WithIgnoreFunc sets a custom ignore function for filtering events.
func WithIgnoreFunc(fn func(string) bool) Option {
	return func(w *Watcher) {
		w.ignoreFunc = fn
	}
}

// New creates a new Watcher for the given project directory.
func New(projectDir string, eventBus *plugin.EventBus, opts ...Option) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	w := &Watcher{
		fsWatcher:  fsw,
		debounce:   500 * time.Millisecond,
		eventBus:   eventBus,
		projectDir: projectDir,
		timers:     make(map[string]*time.Timer),
		done:       make(chan struct{}),
		ignoreFunc: defaultIgnoreFunc,
	}

	for _, opt := range opts {
		opt(w)
	}

	return w, nil
}

// Start begins watching the project directory recursively and dispatching events.
func (w *Watcher) Start() error {
	// Walk project directory and add all subdirectories
	err := filepath.WalkDir(w.projectDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable dirs
		}
		if !d.IsDir() {
			return nil
		}
		if w.ignoreFunc(path) {
			return filepath.SkipDir
		}
		return w.fsWatcher.Add(path)
	})
	if err != nil {
		return err
	}

	w.mu.Lock()
	w.started = true
	w.mu.Unlock()

	go w.loop()
	return nil
}

// Stop stops watching and cleans up resources.
func (w *Watcher) Stop() {
	w.mu.Lock()
	if w.stopped {
		w.mu.Unlock()
		return
	}
	w.stopped = true
	started := w.started
	w.mu.Unlock()

	w.fsWatcher.Close()
	if started {
		<-w.done
	}

	// Cancel any pending debounce timers
	w.mu.Lock()
	for _, t := range w.timers {
		t.Stop()
	}
	w.timers = nil
	w.mu.Unlock()
}

// AddPath adds an additional path to watch (e.g., conversation directories).
func (w *Watcher) AddPath(path string) error {
	return w.fsWatcher.Add(path)
}

// loop processes fsnotify events until the watcher is stopped.
func (w *Watcher) loop() {
	defer close(w.done)

	for {
		select {
		case event, ok := <-w.fsWatcher.Events:
			if !ok {
				return
			}
			w.handleEvent(event)

		case _, ok := <-w.fsWatcher.Errors:
			if !ok {
				return
			}
			// Silently ignore watcher errors (permissions, etc.)
		}
	}
}

// handleEvent processes a single fsnotify event with debouncing.
func (w *Watcher) handleEvent(event fsnotify.Event) {
	path := event.Name

	// Skip ignored paths
	if w.ignoreFunc(path) {
		return
	}

	// If a new directory was created, start watching it too
	if event.Has(fsnotify.Create) {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			if !w.ignoreFunc(path) {
				w.fsWatcher.Add(path)
			}
		}
	}

	// Determine action
	action := classifyAction(event.Op)
	if action == "" {
		return
	}

	// Debounce: reset timer for this path
	w.mu.Lock()
	if w.stopped {
		w.mu.Unlock()
		return
	}
	if t, ok := w.timers[path]; ok {
		t.Stop()
	}
	w.timers[path] = time.AfterFunc(w.debounce, func() {
		w.publishEvent(path, action)
		w.mu.Lock()
		delete(w.timers, path)
		w.mu.Unlock()
	})
	w.mu.Unlock()
}

// publishEvent publishes a FileChangedEvent and, if applicable, a ConversationChangedEvent.
func (w *Watcher) publishEvent(path, action string) {
	if w.eventBus == nil {
		return
	}

	w.eventBus.Publish(plugin.FileChangedEvent{
		FilePath: path,
		Action:   action,
	})
}

// classifyAction maps fsnotify operations to action strings.
func classifyAction(op fsnotify.Op) string {
	switch {
	case op.Has(fsnotify.Create):
		return "created"
	case op.Has(fsnotify.Write):
		return "modified"
	case op.Has(fsnotify.Remove):
		return "deleted"
	case op.Has(fsnotify.Rename):
		return "deleted" // renamed away is effectively a delete
	default:
		return ""
	}
}

// defaultIgnoreFunc filters out paths that should not trigger events.
func defaultIgnoreFunc(path string) bool {
	base := filepath.Base(path)

	// Skip hidden directories (except .prism)
	if strings.HasPrefix(base, ".") && base != ".prism" {
		return true
	}

	// Skip common large/noisy directories
	switch base {
	case "node_modules", "vendor", "dist", "build", "__pycache__", ".cache":
		return true
	}

	return false
}
