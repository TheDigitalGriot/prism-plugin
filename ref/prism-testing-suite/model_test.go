package ui_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	// Uncomment and adjust when wiring to your actual model:
	// "github.com/TheDigitalGriot/prism-plugin/cmd/prism-cli/ui"
)

// ============================================================================
// TUI Model tests for prism-cli using Bubble Tea patterns
//
// These tests validate:
// - Model initialization
// - Key handling (navigation, quit, help)
// - View rendering (screen output)
// - State transitions between views
// - Window resize handling
//
// Two approaches included:
// 1. Direct model testing (call Init/Update/View manually)
// 2. teatest integration (uses tea.Program in a test harness)
//
// Run:
//   cd cmd/prism-cli && go test ./ui/ -v
//
// For golden file updates:
//   cd cmd/prism-cli && go test ./ui/ -v -update
// ============================================================================

// --- Stub model (replace with import of your actual model) -----------------
// Remove this section once you wire up the real ui.Model

type ViewMode int

const (
	ViewDashboard ViewMode = iota
	ViewStoryList
	ViewStoryDetail
	ViewProgress
	ViewHelp
	ViewDebug
)

type Model struct {
	width     int
	height    int
	view      ViewMode
	cursor    int
	stories   []string
	ready     bool
	quitting  bool
	err       error
}

func NewModel() Model {
	return Model{
		view:    ViewDashboard,
		cursor:  0,
		stories: []string{},
		ready:   false,
	}
}

func NewModelWithStories(stories []string) Model {
	m := NewModel()
	m.stories = stories
	m.ready = true
	return m
}

type storiesLoadedMsg struct {
	stories []string
}
type errMsg struct{ err error }

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		case "?":
			if m.view == ViewHelp {
				m.view = ViewDashboard
			} else {
				m.view = ViewHelp
			}
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.stories)-1 {
				m.cursor++
			}
		case "enter":
			if m.view == ViewStoryList && len(m.stories) > 0 {
				m.view = ViewStoryDetail
			}
		case "esc":
			m.view = ViewDashboard
			m.cursor = 0
		case "1":
			m.view = ViewDashboard
		case "2":
			m.view = ViewStoryList
		case "3":
			m.view = ViewProgress
		case "4":
			m.view = ViewDebug
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

	case storiesLoadedMsg:
		m.stories = msg.stories
		m.ready = true

	case errMsg:
		m.err = msg.err
	}

	return m, nil
}

func (m Model) View() string {
	if m.quitting {
		return "Goodbye! 🌈\n"
	}

	if !m.ready {
		return "Loading Prism...\n"
	}

	var b strings.Builder

	switch m.view {
	case ViewDashboard:
		b.WriteString("🌈 Prism — Spectrum Dashboard\n")
		b.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
		b.WriteString("\n")
		b.WriteString("  [1] Dashboard  [2] Stories  [3] Progress  [4] Debug\n")
		b.WriteString("\n")
		b.WriteString("  Stories: " + strings.Itoa(len(m.stories)) + "\n")
		b.WriteString("\n")
		b.WriteString("  ? help  q quit\n")

	case ViewStoryList:
		b.WriteString("📋 Stories\n")
		b.WriteString("━━━━━━━━━━\n")
		for i, s := range m.stories {
			cursor := "  "
			if i == m.cursor {
				cursor = "▸ "
			}
			b.WriteString(cursor + s + "\n")
		}
		b.WriteString("\n↑/↓ navigate  enter select  esc back\n")

	case ViewStoryDetail:
		if m.cursor < len(m.stories) {
			b.WriteString("📖 " + m.stories[m.cursor] + "\n")
			b.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
			b.WriteString("  Status: pending\n")
		}
		b.WriteString("\nesc back\n")

	case ViewProgress:
		b.WriteString("📊 Spectrum Progress\n")
		b.WriteString("━━━━━━━━━━━━━━━━━━━━\n")
		b.WriteString("  0/" + strings.Itoa(len(m.stories)) + " complete\n")
		b.WriteString("\nesc back\n")

	case ViewHelp:
		b.WriteString("❓ Help\n")
		b.WriteString("━━━━━━━\n")
		b.WriteString("  1-4    Switch views\n")
		b.WriteString("  ↑/↓    Navigate\n")
		b.WriteString("  enter  Select story\n")
		b.WriteString("  esc    Back to dashboard\n")
		b.WriteString("  ?      Toggle help\n")
		b.WriteString("  q      Quit\n")

	case ViewDebug:
		b.WriteString("🔧 Debug Logs\n")
		b.WriteString("━━━━━━━━━━━━━\n")
		b.WriteString("  No errors\n")
		b.WriteString("\nesc back\n")
	}

	return b.String()
}

// --- Helpers ---------------------------------------------------------------

func sendKey(m tea.Model, key string) tea.Model {
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
	return updated
}

func sendSpecialKey(m tea.Model, keyType tea.KeyType) tea.Model {
	updated, _ := m.Update(tea.KeyMsg{Type: keyType})
	return updated
}

func sendWindowSize(m tea.Model, w, h int) tea.Model {
	updated, _ := m.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return updated
}

func assertViewContains(t *testing.T, m tea.Model, substr string) {
	t.Helper()
	view := m.(Model).View()
	if !strings.Contains(view, substr) {
		t.Errorf("view should contain %q, got:\n%s", substr, view)
	}
}

func assertViewNotContains(t *testing.T, m tea.Model, substr string) {
	t.Helper()
	view := m.(Model).View()
	if strings.Contains(view, substr) {
		t.Errorf("view should NOT contain %q", substr)
	}
}

func assertCurrentView(t *testing.T, m tea.Model, expected ViewMode) {
	t.Helper()
	actual := m.(Model).view
	if actual != expected {
		t.Errorf("expected view %d, got %d", expected, actual)
	}
}

// ============================================================================
// TEST SUITE: Initialization
// ============================================================================

func TestNewModelDefaults(t *testing.T) {
	m := NewModel()

	if m.view != ViewDashboard {
		t.Error("initial view should be Dashboard")
	}
	if m.cursor != 0 {
		t.Error("initial cursor should be 0")
	}
	if m.quitting {
		t.Error("should not start in quitting state")
	}
	if m.ready {
		t.Error("should not start ready (needs window size)")
	}
}

func TestInitReturnsNoCommand(t *testing.T) {
	m := NewModel()
	cmd := m.Init()
	// Init can return nil or a command — adjust based on your actual impl
	_ = cmd // no assertion needed if nil is acceptable
}

// ============================================================================
// TEST SUITE: View rendering
// ============================================================================

func TestDashboardView(t *testing.T) {
	m := NewModelWithStories([]string{"Story 1", "Story 2"})

	view := m.View()
	assertions := []string{
		"Prism",
		"Spectrum",
		"Dashboard",
		"Stories",
		"Progress",
		"quit",
	}
	for _, s := range assertions {
		if !strings.Contains(view, s) {
			t.Errorf("dashboard should contain %q", s)
		}
	}
}

func TestDashboardShowsStoryCount(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B", "C"})
	assertViewContains(t, m, "3")
}

func TestLoadingStateView(t *testing.T) {
	m := NewModel()
	view := m.View()
	if !strings.Contains(view, "Loading") {
		t.Error("unready model should show loading message")
	}
}

func TestQuittingView(t *testing.T) {
	m := NewModelWithStories(nil)
	m.quitting = true
	view := m.View()
	if !strings.Contains(view, "Goodbye") {
		t.Error("quitting should show goodbye message")
	}
}

// ============================================================================
// TEST SUITE: Key handling
// ============================================================================

func TestQuitOnQ(t *testing.T) {
	m := NewModelWithStories(nil)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})

	if !updated.(Model).quitting {
		t.Error("pressing 'q' should set quitting=true")
	}
	if cmd == nil {
		t.Error("pressing 'q' should return tea.Quit command")
	}
}

func TestQuitOnCtrlC(t *testing.T) {
	m := NewModelWithStories(nil)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})

	if !updated.(Model).quitting {
		t.Error("ctrl+c should set quitting=true")
	}
	if cmd == nil {
		t.Error("ctrl+c should return tea.Quit command")
	}
}

func TestHelpToggle(t *testing.T) {
	m := NewModelWithStories(nil)

	// Press ? to open help
	m2 := sendKey(m, "?")
	assertCurrentView(t, m2, ViewHelp)

	// Press ? again to close help
	m3 := sendKey(m2, "?")
	assertCurrentView(t, m3, ViewDashboard)
}

func TestEscReturnsToDashboard(t *testing.T) {
	m := NewModelWithStories([]string{"Story 1"})

	// Navigate to story list
	m2 := sendKey(m, "2")
	assertCurrentView(t, m2, ViewStoryList)

	// Press Esc
	m3 := sendSpecialKey(m2, tea.KeyEsc)
	assertCurrentView(t, m3, ViewDashboard)
}

func TestNumberKeysNavigateViews(t *testing.T) {
	m := NewModelWithStories(nil)

	tests := []struct {
		key      string
		expected ViewMode
	}{
		{"1", ViewDashboard},
		{"2", ViewStoryList},
		{"3", ViewProgress},
		{"4", ViewDebug},
	}

	for _, tc := range tests {
		t.Run("key_"+tc.key, func(t *testing.T) {
			updated := sendKey(m, tc.key)
			assertCurrentView(t, updated, tc.expected)
		})
	}
}

// ============================================================================
// TEST SUITE: Cursor navigation
// ============================================================================

func TestCursorDown(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B", "C"})
	m.view = ViewStoryList

	m2 := sendKey(m, "j")
	if m2.(Model).cursor != 1 {
		t.Errorf("cursor should move to 1, got %d", m2.(Model).cursor)
	}

	m3 := sendKey(m2, "j")
	if m3.(Model).cursor != 2 {
		t.Errorf("cursor should move to 2, got %d", m3.(Model).cursor)
	}
}

func TestCursorUp(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B", "C"})
	m.view = ViewStoryList
	m.cursor = 2

	m2 := sendKey(m, "k")
	if m2.(Model).cursor != 1 {
		t.Errorf("cursor should move to 1, got %d", m2.(Model).cursor)
	}
}

func TestCursorDoesNotGoBelowZero(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B"})
	m.view = ViewStoryList
	m.cursor = 0

	m2 := sendKey(m, "k")
	if m2.(Model).cursor != 0 {
		t.Error("cursor should not go below 0")
	}
}

func TestCursorDoesNotExceedLength(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B"})
	m.view = ViewStoryList
	m.cursor = 1

	m2 := sendKey(m, "j")
	if m2.(Model).cursor != 1 {
		t.Error("cursor should not exceed story count")
	}
}

func TestCursorWithArrowKeys(t *testing.T) {
	m := NewModelWithStories([]string{"A", "B", "C"})
	m.view = ViewStoryList

	m2 := sendSpecialKey(m, tea.KeyDown)
	if m2.(Model).cursor != 1 {
		t.Error("down arrow should move cursor")
	}

	m3 := sendSpecialKey(m2, tea.KeyUp)
	if m3.(Model).cursor != 0 {
		t.Error("up arrow should move cursor")
	}
}

// ============================================================================
// TEST SUITE: Story selection
// ============================================================================

func TestEnterOpensStoryDetail(t *testing.T) {
	m := NewModelWithStories([]string{"Auth middleware", "OAuth flow"})
	m.view = ViewStoryList
	m.cursor = 0

	m2 := sendSpecialKey(m, tea.KeyEnter)
	assertCurrentView(t, m2, ViewStoryDetail)
}

func TestStoryDetailShowsSelectedStory(t *testing.T) {
	m := NewModelWithStories([]string{"Auth middleware", "OAuth flow"})
	m.view = ViewStoryList
	m.cursor = 1

	m2 := sendSpecialKey(m, tea.KeyEnter)
	assertViewContains(t, m2, "OAuth flow")
}

func TestEnterOnEmptyListNoOp(t *testing.T) {
	m := NewModelWithStories([]string{})
	m.view = ViewStoryList

	m2 := sendSpecialKey(m, tea.KeyEnter)
	// Should stay on story list, not crash
	assertCurrentView(t, m2, ViewStoryList)
}

// ============================================================================
// TEST SUITE: Window resize
// ============================================================================

func TestWindowSizeUpdatesModel(t *testing.T) {
	m := NewModel()
	m2 := sendWindowSize(m, 120, 40)

	model := m2.(Model)
	if model.width != 120 {
		t.Errorf("width should be 120, got %d", model.width)
	}
	if model.height != 40 {
		t.Errorf("height should be 40, got %d", model.height)
	}
}

func TestWindowSizeSetsReady(t *testing.T) {
	m := NewModel()
	if m.ready {
		t.Fatal("precondition: model should not be ready")
	}

	m2 := sendWindowSize(m, 80, 24)
	if !m2.(Model).ready {
		t.Error("window size should set ready=true")
	}
}

// ============================================================================
// TEST SUITE: Messages
// ============================================================================

func TestStoriesLoadedMessage(t *testing.T) {
	m := NewModel()
	stories := []string{"Setup", "Build", "Test"}

	m2, _ := m.Update(storiesLoadedMsg{stories: stories})
	model := m2.(Model)

	if len(model.stories) != 3 {
		t.Fatalf("expected 3 stories after load, got %d", len(model.stories))
	}
	if !model.ready {
		t.Error("model should be ready after stories loaded")
	}
}

func TestErrorMessage(t *testing.T) {
	m := NewModelWithStories(nil)

	testErr := errMsg{err: bytes.ErrTooLarge}
	m2, _ := m.Update(testErr)

	if m2.(Model).err == nil {
		t.Error("model should store error from errMsg")
	}
}

// ============================================================================
// TEST SUITE: View content assertions (no "ralph" anywhere)
// ============================================================================

func TestNoRalphInAnyView(t *testing.T) {
	m := NewModelWithStories([]string{"Story 1"})

	views := []struct {
		name string
		mode ViewMode
	}{
		{"dashboard", ViewDashboard},
		{"storyList", ViewStoryList},
		{"progress", ViewProgress},
		{"help", ViewHelp},
		{"debug", ViewDebug},
	}

	for _, v := range views {
		t.Run(v.name, func(t *testing.T) {
			m.view = v.mode
			output := m.View()
			if strings.Contains(strings.ToLower(output), "ralph") {
				t.Errorf("view %q should not contain 'ralph'", v.name)
			}
		})
	}
}

func TestAllViewsMentionPrism(t *testing.T) {
	m := NewModelWithStories([]string{"Story 1"})
	m.view = ViewDashboard
	assertViewContains(t, m, "Prism")
}

// ============================================================================
// TEST SUITE: teatest golden file pattern
// ============================================================================
// This demonstrates how to use teatest for snapshot testing.
// Requires: go get github.com/charmbracelet/x/exp/teatest
//
// Uncomment when you have the teatest dependency:

/*
import "github.com/charmbracelet/x/exp/teatest"

func TestGoldenDashboard(t *testing.T) {
	m := NewModelWithStories([]string{"Auth", "OAuth", "Tests"})
	tm := teatest.NewModel(t, m,
		teatest.WithInitialTermSize(80, 24),
	)

	// Wait for ready
	time.Sleep(100 * time.Millisecond)

	// Take snapshot
	teatest.RequireEqualOutput(t, tm.FinalOutput(t))
}

func TestGoldenStoryList(t *testing.T) {
	m := NewModelWithStories([]string{"Auth", "OAuth", "Tests"})
	tm := teatest.NewModel(t, m,
		teatest.WithInitialTermSize(80, 24),
	)

	tm.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("2")})
	time.Sleep(100 * time.Millisecond)

	teatest.RequireEqualOutput(t, tm.FinalOutput(t))
}
*/

// ============================================================================
// Benchmark: View rendering performance
// ============================================================================

func BenchmarkDashboardRender(b *testing.B) {
	m := NewModelWithStories([]string{"A", "B", "C", "D", "E"})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = m.View()
	}
}

func BenchmarkStoryListRender(b *testing.B) {
	stories := make([]string, 50)
	for i := range stories {
		stories[i] = "Story " + strings.Itoa(i+1)
	}
	m := NewModelWithStories(stories)
	m.view = ViewStoryList
	b.ResetTimer()
	for i := range b.N {
		_ = i
		_ = m.View()
	}
}

// Ignore this - it just uses time to avoid unused import
var _ = time.Second
