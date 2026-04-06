package watcher

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/prism-plugin/prism-cli/plugin"
)

func TestNewWatcher(t *testing.T) {
	dir := t.TempDir()
	bus := plugin.NewEventBus()

	w, err := New(dir, bus)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Stop()

	if w.debounce != 500*time.Millisecond {
		t.Errorf("default debounce = %v, want 500ms", w.debounce)
	}
	if w.projectDir != dir {
		t.Errorf("projectDir = %q, want %q", w.projectDir, dir)
	}
}

func TestWithDebounce(t *testing.T) {
	dir := t.TempDir()
	bus := plugin.NewEventBus()

	w, err := New(dir, bus, WithDebounce(100*time.Millisecond))
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	defer w.Stop()

	if w.debounce != 100*time.Millisecond {
		t.Errorf("debounce = %v, want 100ms", w.debounce)
	}
}

func TestDefaultIgnoreFunc(t *testing.T) {
	tests := []struct {
		path   string
		ignore bool
	}{
		{"/project/.git", true},
		{"/project/.env", true},
		{"/project/node_modules", true},
		{"/project/vendor", true},
		{"/project/.prism", false},
		{"/project/src", false},
		{"/project/main.go", false},
	}

	for _, tt := range tests {
		got := defaultIgnoreFunc(tt.path)
		if got != tt.ignore {
			t.Errorf("defaultIgnoreFunc(%q) = %v, want %v", tt.path, got, tt.ignore)
		}
	}
}

func TestClassifyAction(t *testing.T) {
	tests := []struct {
		name   string
		op     uint32 // fsnotify.Op is uint32
		expect string
	}{
		{"create", 1, "created"},   // fsnotify.Create = 1
		{"write", 2, "modified"},   // fsnotify.Write = 2
		{"remove", 4, "deleted"},   // fsnotify.Remove = 4
		{"rename", 8, "deleted"},   // fsnotify.Rename = 8
		{"chmod", 16, ""},          // fsnotify.Chmod = 16
	}

	// Use the actual fsnotify ops
	_ = tests // tests are illustrative; use the real API below

	if classifyAction(1) != "created" {
		t.Error("Create should map to 'created'")
	}
	if classifyAction(2) != "modified" {
		t.Error("Write should map to 'modified'")
	}
	if classifyAction(4) != "deleted" {
		t.Error("Remove should map to 'deleted'")
	}
	if classifyAction(8) != "deleted" {
		t.Error("Rename should map to 'deleted'")
	}
	if classifyAction(16) != "" {
		t.Error("Chmod should map to empty string")
	}
}

func TestWatcherStartStop(t *testing.T) {
	dir := t.TempDir()
	bus := plugin.NewEventBus()

	w, err := New(dir, bus, WithDebounce(50*time.Millisecond))
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	if err := w.Start(); err != nil {
		t.Fatalf("Start() error: %v", err)
	}

	// Stop should not panic or block
	w.Stop()

	// Double stop should be safe
	w.Stop()
}

func TestWatcherDetectsFileChange(t *testing.T) {
	dir := t.TempDir()
	bus := plugin.NewEventBus()

	received := make(chan plugin.FileChangedEvent, 10)
	bus.Subscribe("file.changed", func(e plugin.Event) {
		if fce, ok := e.(plugin.FileChangedEvent); ok {
			received <- fce
		}
	})

	w, err := New(dir, bus, WithDebounce(50*time.Millisecond))
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	if err := w.Start(); err != nil {
		t.Fatalf("Start() error: %v", err)
	}
	defer w.Stop()

	// Create a file
	testFile := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(testFile, []byte("hello"), 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	// Wait for debounced event
	select {
	case evt := <-received:
		if evt.FilePath != testFile {
			t.Errorf("FilePath = %q, want %q", evt.FilePath, testFile)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for FileChangedEvent")
	}
}
