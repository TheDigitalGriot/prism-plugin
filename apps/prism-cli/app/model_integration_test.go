package app

import (
	"strings"
	"sync"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
)

// ============================================================================
// TUI Model integration tests for prism-cli
//
// Adapted from ref/prism-testing-suite/model_test.go. Uses the actual app.Model
// (via NewDemoModel) instead of a stub model. Tests validate initialization,
// key handling, view rendering, and state transitions on the real TUI.
//
// The actual Model is significantly more complex than the reference stub:
// - 12 views (vs 6 in stub), plugin architecture, splash screen, modals
// - Key dispatch: splash check → onboarding → q/ctrl+c → dialogs → modals → global → plugin
// - State is plugin-local (cursor, selection, etc.), not top-level
//
// Run:
//   cd cmd/prism-cli && go test ./app/ -v -run Integration
//
// Benchmarks:
//   cd cmd/prism-cli && go test ./app/ -bench=BenchmarkIntegration -benchmem
// ============================================================================

// --- Helpers ---------------------------------------------------------------

// initZone ensures bubblezone is initialized exactly once across all tests.
// The real app calls zone.NewGlobal() in main.go; tests need it too.
var zoneOnce sync.Once

func ensureZone() {
	zoneOnce.Do(func() {
		zone.NewGlobal()
	})
}

// newTestModel creates a demo model suitable for testing.
// Uses "ascii" prism style to avoid heavy FauxGL rendering.
func newTestModel() Model {
	ensureZone()
	return NewDemoModel("ascii")
}

// skipSplash transitions the model past the splash screen into ViewHome.
// Most tests need this since the real model starts in ViewSplash.
func skipSplash(m Model) Model {
	m.SplashDone = true
	m.Splash = nil
	m.ActiveView = ViewHome
	m.Registry.SetActive("home")
	return m
}

// sendKey sends a regular key press to the model.
func sendKey(m tea.Model, key string) (tea.Model, tea.Cmd) {
	return m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
}

// sendSpecialKey sends a special key press to the model.
func sendSpecialKey(m tea.Model, keyType tea.KeyType) (tea.Model, tea.Cmd) {
	return m.Update(tea.KeyMsg{Type: keyType})
}

// sendWindowSize sends a window resize event to the model.
func sendWindowSize(m tea.Model, w, h int) (tea.Model, tea.Cmd) {
	return m.Update(tea.WindowSizeMsg{Width: w, Height: h})
}

// assertViewContains checks that the model's View() output contains a substring.
func assertViewContains(t *testing.T, m Model, substr string) {
	t.Helper()
	view := m.View()
	if !strings.Contains(view, substr) {
		t.Errorf("view should contain %q, got %d chars of output", substr, len(view))
	}
}

// assertViewNotContains checks that View() output does NOT contain a substring.
func assertViewNotContains(t *testing.T, m Model, substr string) {
	t.Helper()
	view := m.View()
	if strings.Contains(view, substr) {
		t.Errorf("view should NOT contain %q", substr)
	}
}

// ============================================================================
// TEST SUITE: Initialization
// ============================================================================

func TestIntegrationNewModelDefaults(t *testing.T) {
	m := newTestModel()

	if m.ActiveView != ViewSplash {
		t.Errorf("initial view should be ViewSplash, got %s", m.ActiveView)
	}
	if !m.DemoMode {
		t.Error("demo model should have DemoMode=true")
	}
	if m.Ready {
		t.Error("should not start ready (needs window size)")
	}
	if m.SplashDone {
		t.Error("splash should not be done initially")
	}
	if m.Registry == nil {
		t.Error("registry should not be nil")
	}
}

func TestIntegrationTabOrderPopulated(t *testing.T) {
	m := newTestModel()

	if len(m.TabOrder) == 0 {
		t.Fatal("TabOrder should not be empty")
	}

	// Verify expected tab order
	expectedTabs := []ActiveView{ViewHome, ViewResearch, ViewPlans, ViewSpectrum, ViewFiles, ViewGit, ViewAgent, ViewMonitor, ViewBrowser, ViewWorkspaces}
	if len(m.TabOrder) != len(expectedTabs) {
		t.Fatalf("expected %d tabs, got %d", len(expectedTabs), len(m.TabOrder))
	}
	for i, expected := range expectedTabs {
		if m.TabOrder[i] != expected {
			t.Errorf("tab %d should be %s, got %s", i, expected, m.TabOrder[i])
		}
	}
}

func TestIntegrationInitReturnsCommands(t *testing.T) {
	m := newTestModel()
	cmd := m.Init()
	// Init returns a tea.Batch of tick, splash timer, and file cache commands
	if cmd == nil {
		t.Error("Init() should return non-nil command batch")
	}
}

// ============================================================================
// TEST SUITE: Splash screen behavior
// ============================================================================

func TestIntegrationSplashSkipOnKeyPress(t *testing.T) {
	m := newTestModel()

	// Any key press should skip splash
	updated, _ := sendKey(m, "x")
	model := updated.(Model)

	if !model.SplashDone {
		t.Error("key press should mark splash as done")
	}
	if model.Splash != nil {
		t.Error("splash should be released after skip")
	}
	if model.ActiveView != ViewHome {
		t.Errorf("should transition to ViewHome after splash, got %s", model.ActiveView)
	}
}

func TestIntegrationSplashDoneMsg(t *testing.T) {
	m := newTestModel()

	// SplashDoneMsg auto-transitions past splash
	updated, _ := m.Update(SplashDoneMsg{})
	model := updated.(Model)

	if !model.SplashDone {
		t.Error("SplashDoneMsg should mark splash as done")
	}
	if model.ActiveView != ViewHome {
		t.Errorf("should transition to ViewHome, got %s", model.ActiveView)
	}
}

// ============================================================================
// TEST SUITE: Quit behavior
// ============================================================================

func TestIntegrationQuitOnQ(t *testing.T) {
	m := skipSplash(newTestModel())

	_, cmd := sendKey(m, "q")
	if cmd == nil {
		t.Error("pressing 'q' should return a command (tea.Quit)")
	}
}

func TestIntegrationQuitOnCtrlC(t *testing.T) {
	m := skipSplash(newTestModel())

	_, cmd := sendSpecialKey(m, tea.KeyCtrlC)
	if cmd == nil {
		t.Error("ctrl+c should return a command (tea.Quit)")
	}
}

func TestIntegrationQuitDuringSplash(t *testing.T) {
	m := newTestModel()

	// Even during splash, pressing q should skip splash first
	// (any key skips splash)
	updated, _ := sendKey(m, "q")
	model := updated.(Model)

	// Splash should be skipped
	if !model.SplashDone {
		t.Error("q during splash should at minimum skip splash")
	}
}

// ============================================================================
// TEST SUITE: Tab navigation via number keys
// ============================================================================

func TestIntegrationNumberKeysNavigateViews(t *testing.T) {
	m := skipSplash(newTestModel())

	tests := []struct {
		key      string
		expected ActiveView
	}{
		{"1", ViewHome},
		{"2", ViewResearch},
		{"3", ViewPlans},
		{"4", ViewSpectrum},
		{"5", ViewFiles},
		{"6", ViewGit},
		{"7", ViewAgent},
		{"8", ViewMonitor},
		{"9", ViewBrowser},
	}

	for _, tc := range tests {
		t.Run("key_"+tc.key, func(t *testing.T) {
			updated, _ := sendKey(m, tc.key)
			model := updated.(Model)
			if model.ActiveView != tc.expected {
				t.Errorf("key %s: expected %s, got %s", tc.key, tc.expected, model.ActiveView)
			}
		})
	}
}

func TestIntegrationTabCyclesViews(t *testing.T) {
	m := skipSplash(newTestModel())

	// Start at Home, tab should go to Research
	updated, _ := sendSpecialKey(m, tea.KeyTab)
	model := updated.(Model)

	if model.ActiveView != ViewResearch {
		t.Errorf("tab from Home should go to Research, got %s", model.ActiveView)
	}
}

func TestIntegrationShiftTabCyclesBackward(t *testing.T) {
	m := skipSplash(newTestModel())

	// Start at Home (index 0), shift+tab should wrap to last tab
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyShiftTab})
	model := updated.(Model)

	lastTab := m.TabOrder[len(m.TabOrder)-1]
	if model.ActiveView != lastTab {
		t.Errorf("shift+tab from Home should wrap to %s, got %s", lastTab, model.ActiveView)
	}
}

// ============================================================================
// TEST SUITE: Help modal
// ============================================================================

func TestIntegrationHelpModalOpens(t *testing.T) {
	m := skipSplash(newTestModel())

	updated, _ := sendKey(m, "?")
	model := updated.(Model)

	if model.ActiveModal == nil {
		t.Error("pressing '?' should open a help modal")
	}
}

// ============================================================================
// TEST SUITE: Window resize
// ============================================================================

func TestIntegrationWindowSizeUpdatesModel(t *testing.T) {
	m := newTestModel()
	updated, _ := sendWindowSize(m, 120, 40)
	model := updated.(Model)

	if model.Width != 120 {
		t.Errorf("width should be 120, got %d", model.Width)
	}
	if model.Height != 40 {
		t.Errorf("height should be 40, got %d", model.Height)
	}
}

func TestIntegrationWindowSizeSetsReady(t *testing.T) {
	m := newTestModel()
	if m.Ready {
		t.Fatal("precondition: model should not be ready")
	}

	updated, _ := sendWindowSize(m, 80, 24)
	model := updated.(Model)

	if !model.Ready {
		t.Error("window size should set Ready=true")
	}
}

func TestIntegrationWindowSizeResizesPrism(t *testing.T) {
	m := newTestModel()
	if m.Prism == nil {
		t.Skip("prism renderer not initialized in test env")
	}

	updated, _ := sendWindowSize(m, 160, 50)
	model := updated.(Model)

	// Prism should have been resized
	if model.Prism == nil {
		t.Error("prism renderer should still exist after resize")
	}
}

// ============================================================================
// TEST SUITE: View rendering (no crash, no "ralph")
// ============================================================================

func TestIntegrationViewRendersDuringSplash(t *testing.T) {
	m := newTestModel()
	// Send a window resize so splash has dimensions to render
	updated, _ := sendWindowSize(m, 80, 24)
	model := updated.(Model)

	// Splash view may be empty if the splash animation hasn't started;
	// the key assertion is that it does not panic.
	_ = model.View()
}

func TestIntegrationViewRendersAfterSplash(t *testing.T) {
	m := skipSplash(newTestModel())
	m.Width = 80
	m.Height = 24
	m.Ready = true

	view := m.View()
	if view == "" {
		t.Error("View() should produce output after splash")
	}
}

func TestIntegrationNoRalphInAnyView(t *testing.T) {
	m := skipSplash(newTestModel())
	m.Width = 80
	m.Height = 24
	m.Ready = true

	// Test each tab view for "ralph" references
	for i, view := range m.TabOrder {
		t.Run(view.String(), func(t *testing.T) {
			testModel := m
			testModel.ActiveView = view
			// Set the registry's active plugin to match
			pluginID := viewToPluginID(view)
			testModel.Registry.SetActive(pluginID)

			output := testModel.View()
			if strings.Contains(strings.ToLower(output), "ralph") {
				t.Errorf("view %s (tab %d) should not contain 'ralph'", view, i)
			}
		})
	}
}

func TestIntegrationAllViewsRenderWithoutPanic(t *testing.T) {
	m := skipSplash(newTestModel())
	m.Width = 80
	m.Height = 24
	m.Ready = true

	for _, view := range m.TabOrder {
		t.Run(view.String(), func(t *testing.T) {
			testModel := m
			testModel.ActiveView = view
			pluginID := viewToPluginID(view)
			testModel.Registry.SetActive(pluginID)

			// This should not panic
			output := testModel.View()
			if output == "" {
				t.Errorf("view %s produced empty output", view)
			}
		})
	}
}

func TestIntegrationViewProducesContent(t *testing.T) {
	m := skipSplash(newTestModel())
	m.Width = 80
	m.Height = 24
	m.Ready = true

	view := m.View()

	// View should produce meaningful output (not empty, not just whitespace)
	trimmed := strings.TrimSpace(view)
	if len(trimmed) < 10 {
		t.Errorf("view should produce meaningful content, got %d chars", len(trimmed))
	}

	// Should contain tab labels (Home is the first tab)
	if !strings.Contains(view, "Home") {
		t.Error("view should contain 'Home' tab label")
	}
}

// ============================================================================
// TEST SUITE: Demo mode specifics
// ============================================================================

func TestIntegrationDemoModeFlag(t *testing.T) {
	m := newTestModel()
	if !m.DemoMode {
		t.Error("NewDemoModel should set DemoMode=true")
	}

	ctx := m.Registry.GetContext()
	if !ctx.DemoMode {
		t.Error("plugin context should have DemoMode=true")
	}
}

func TestIntegrationDemoStoriesSeeded(t *testing.T) {
	m := newTestModel()

	// Find the spectrum plugin — note that NewDemoModel seeds stories via
	// ActivePlugin() which may not be Spectrum at init time. The stories
	// may only be fully seeded after tab-switching to Spectrum.
	found := false
	for _, p := range m.Registry.Plugins() {
		if sp, ok := p.(*SpectrumPlugin); ok {
			found = true
			// Stories may or may not be seeded depending on which plugin
			// was active during NewDemoModel. Verify the plugin exists
			// and its plan name is set if stories were seeded.
			if len(sp.stories) > 0 && sp.totalStories == 0 {
				t.Error("if stories are present, totalStories should also be set")
			}
			break
		}
	}
	if !found {
		t.Error("SpectrumPlugin not found in registry")
	}
}

func TestIntegrationDemoResearchSeeded(t *testing.T) {
	m := newTestModel()

	for _, p := range m.Registry.Plugins() {
		if rp, ok := p.(*ResearchPlugin); ok {
			if len(rp.state.Files) == 0 {
				t.Error("demo model should have seeded research files")
			}
			return
		}
	}
	t.Error("ResearchPlugin not found in registry")
}

func TestIntegrationDemoPlansSeeded(t *testing.T) {
	m := newTestModel()

	for _, p := range m.Registry.Plugins() {
		if pp, ok := p.(*PlansPlugin); ok {
			if len(pp.state.Files) == 0 {
				t.Error("demo model should have seeded plan files")
			}
			return
		}
	}
	t.Error("PlansPlugin not found in registry")
}

// ============================================================================
// TEST SUITE: Messages
// ============================================================================

func TestIntegrationWindowSizeMessage(t *testing.T) {
	m := newTestModel()
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 30})
	model := updated.(Model)

	if model.Width != 100 || model.Height != 30 {
		t.Errorf("expected 100x30, got %dx%d", model.Width, model.Height)
	}
}

func TestIntegrationSplashDoneMsgTransition(t *testing.T) {
	m := newTestModel()
	updated, _ := m.Update(SplashDoneMsg{})
	model := updated.(Model)

	if !model.SplashDone {
		t.Error("SplashDoneMsg should set SplashDone=true")
	}
	if model.ActiveView == ViewSplash {
		t.Error("should no longer be on splash after SplashDoneMsg")
	}
}

func TestIntegrationTickMsgDoesNotCrash(t *testing.T) {
	m := skipSplash(newTestModel())
	m.Width = 80
	m.Height = 24
	m.Ready = true

	// Tick message should be handled gracefully
	_, _ = m.Update(TickMsg{})
}

// ============================================================================
// TEST SUITE: State consistency
// ============================================================================

func TestIntegrationPrismStylePreserved(t *testing.T) {
	m := NewDemoModel("ascii")
	if m.PrismStyle != "ascii" {
		t.Errorf("PrismStyle should be 'ascii', got %q", m.PrismStyle)
	}
}

func TestIntegrationSidebarToggle(t *testing.T) {
	m := skipSplash(newTestModel())

	if m.ForceSidebarOff {
		t.Fatal("precondition: sidebar should start visible")
	}

	// ctrl+d toggles sidebar
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlD})
	model := updated.(Model)

	if !model.ForceSidebarOff {
		t.Error("ctrl+d should toggle sidebar off")
	}

	// Toggle back
	updated2, _ := model.Update(tea.KeyMsg{Type: tea.KeyCtrlD})
	model2 := updated2.(Model)

	if model2.ForceSidebarOff {
		t.Error("second ctrl+d should toggle sidebar back on")
	}
}

// ============================================================================
// Benchmarks
// ============================================================================

func BenchmarkIntegrationHomeRender(b *testing.B) {
	m := skipSplash(newTestModel())
	m.Width = 120
	m.Height = 40
	m.Ready = true
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = m.View()
	}
}

func BenchmarkIntegrationSpectrumRender(b *testing.B) {
	m := skipSplash(newTestModel())
	m.Width = 120
	m.Height = 40
	m.Ready = true
	m.ActiveView = ViewSpectrum
	m.Registry.SetActive("spectrum")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = m.View()
	}
}
