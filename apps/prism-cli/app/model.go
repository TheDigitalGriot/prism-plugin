package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/prism-plugin/prism-cli/app/chat"
	"github.com/prism-plugin/prism-cli/dialog"
	"github.com/prism-plugin/prism-cli/modal"
	"github.com/prism-plugin/prism-cli/plugin"
	"github.com/prism-plugin/prism-cli/prism"
	"github.com/prism-plugin/prism-cli/splash"
	"github.com/prism-plugin/prism-cli/styles"
	"github.com/prism-plugin/prism-cli/terminal"
	"github.com/prism-plugin/prism-cli/watcher"
)

// AppState represents the running state of the TUI
type AppState int

const (
	StateIdle AppState = iota
	StateRunning
	StatePaused
	StateComplete
	StateMaxIterations // Reached iteration limit (not an error)
	StateError
)

func (s AppState) String() string {
	switch s {
	case StateIdle:
		return "IDLE"
	case StateRunning:
		return "RUNNING"
	case StatePaused:
		return "PAUSED"
	case StateComplete:
		return "COMPLETE"
	case StateMaxIterations:
		return "PAUSED"
	case StateError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// LogLevel represents the severity of a log entry
type LogLevel int

const (
	LogInfo LogLevel = iota
	LogSuccess
	LogWarning
	LogError
	LogClaudeOutput
)

// LogEntry represents a single log line with metadata
type LogEntry struct {
	Time    time.Time
	Level   LogLevel
	Message string
	StoryID string
}

// AnimState holds global animation state for the app shell (prism in header).
// Plugin-specific animations (like Spectrum's progress bar, story pops, log slides)
// are now owned by the respective plugins.
type AnimState struct {
	// Prism animation (rotating shimmer for ASCII prism in tab screens)
	PrismFrame int // Current animation frame (0-3)
	PrismTick  int // Sub-tick counter for slower animation

	// Spring-based ray animation for gradient prism (used in fallback rendering)
	RayLengths [4]float64 // Current animated length per ray
	RayVels    [4]float64 // Velocity per ray
	RayTargets [4]float64 // Target lengths (oscillates between 4-8)

	// Shimmer phase for gradient brightness
	ShimmerPhase float64
}

// Model is the main application state (slimmed down with plugin architecture)
type Model struct {
	// Plugin system
	Registry *plugin.Registry

	// View system
	ActiveView ActiveView
	TabOrder   []ActiveView // Ordered list of tabs to display

	// Configuration
	PrismDir     string
	StoriesPath  string
	ProgressPath string
	ProjectDir   string
	PrismStyle   string // "gradient", "braille", or "ascii"
	MaxIterations int
	Pause         int // seconds between iterations

	// Terminal capabilities
	HasNerdFont bool // true if terminal font contains "Nerd"

	// UI state
	Width              int
	Height             int
	ShowHelp           bool
	ForceSidebarOff    bool // User toggled sidebar off (ctrl+d)
	ActiveModal        *modal.Modal    // Currently active modal dialog (nil if none)
	CommandPalette     *CommandPalette // Command palette state (nil if closed)
	FileFinder         *FileFinder     // File finder overlay state (nil if closed) (F-4)
	ContentSearch      *ContentSearch  // Content search overlay state (nil if closed) (F-5)
	FileCache          []string        // Project-wide file path cache (relative paths)
	FileCacheLoaded    bool            // True once file cache has been built
	Dialogs            *dialog.Overlay // Stack of permission/confirmation dialogs
	Ready              bool            // True once initial setup is complete
	SplashDone         bool            // True once splash screen has completed
	NeedsOnboarding    bool            // True if onboarding flow should run after splash
	OnboardingDone     bool            // True once onboarding has completed

	// Prism framebuffer animation (shared across all views)
	Prism *prism.Renderer

	// File watcher for auto-refresh (G-6)
	Watcher *watcher.Watcher

	// Full-screen splash animation
	Splash *splash.Model

	// Global animation state (for prism in header)
	Anim AnimState

	// Demo mode
	DemoMode bool
}

// StoryView is a simplified story representation for display
type StoryView struct {
	ID        string
	Title     string
	Status    string // pending, in_progress, complete
	IsBlocked bool
	Priority  int
}

// NewModel creates initial model state
func NewModel(prismDir, storiesPath, projectDir string, maxIter, pause int, prismStyle string) Model {
	// Default prism style
	if prismStyle == "" {
		prismStyle = "gradient"
	}

	// Create 3D prism renderer (shared across all views)
	prismRenderer := prism.New(24, 5)

	// Resolve WorkDir, GitRoot, and ConfigDir for context upgrades (SI-2)
	workDir, _ := os.Getwd()
	gitRoot := resolveGitRoot(projectDir)
	configDir := resolveConfigDir()

	// Detect if onboarding is needed (before context creation so plugins see it)
	needsOnboarding := false
	hasLegacyDir := false
	legacyDir := ""

	// Check if .prism/ directory exists
	if prismDir != "" && prismDir != "demo" {
		if _, err := os.Stat(prismDir); os.IsNotExist(err) {
			needsOnboarding = true
			// Check for legacy thoughts/ directory
			candidate := filepath.Join(projectDir, "thoughts")
			if _, legacyErr := os.Stat(candidate); legacyErr == nil {
				hasLegacyDir = true
				legacyDir = candidate
			}
		}
	}

	// Check if stories.json exists
	if storiesPath != "" && !needsOnboarding {
		if _, err := os.Stat(storiesPath); os.IsNotExist(err) {
			needsOnboarding = true
		}
	}

	// Check if claude CLI is available
	if !needsOnboarding {
		if _, err := exec.LookPath("claude"); err != nil {
			// Note: we don't force onboarding just for missing CLI,
			// but it will be checked during onboarding if triggered
		}
	}

	// Create plugin context
	ctx := &plugin.Context{
		PrismDir:      prismDir,
		ProjectDir:    projectDir,
		StoriesPath:   storiesPath,
		Width:         80, // Will be updated on first WindowSizeMsg
		Height:        24,
		DemoMode:      false,
		PrismStyle:    prismStyle,
		MaxIterations: maxIter,
		Pause:         pause,
		WorkDir:       workDir,
		GitRoot:       gitRoot,
		ConfigDir:     configDir,
		HasLegacyDir:  hasLegacyDir,
		LegacyDir:     legacyDir,
	}

	// Create plugin registry
	registry := plugin.NewRegistry(ctx)

	// Register plugins in tab order
	homePlugin := NewHomePlugin()
	researchPlugin := NewResearchPlugin()
	plansPlugin := NewPlansPlugin()
	spectrumPlugin := NewSpectrumPlugin(prismRenderer)
	filesPlugin := NewFilesPlugin()
	gitPlugin := NewGitPlugin()
	agentPlugin := NewAgentPlugin()
	monitorPlugin := NewMonitorPlugin()
	browserPlugin := NewBrowserPlugin()
	workspacesPlugin := NewWorkspacesPlugin()
	onboardingPlugin := NewOnboardingPlugin()

	registry.Register(homePlugin)
	registry.Register(researchPlugin)
	registry.Register(plansPlugin)
	registry.Register(spectrumPlugin)
	registry.Register(filesPlugin)
	registry.Register(gitPlugin)
	registry.Register(agentPlugin)
	registry.Register(monitorPlugin)
	registry.Register(browserPlugin)
	registry.Register(workspacesPlugin)
	registry.Register(onboardingPlugin)

	// Create splash screen animation
	termInfo := terminal.Detect()
	themeColors := terminal.DetectThemeColors(termInfo)
	ctx.HasNerdFont = termInfo.HasNerdFont

	// Apply theme accent to global styles (tabs, headers, titles)
	if themeColors.AccentSource != "default" {
		styles.ApplyTheme(fmt.Sprintf("#%02x%02x%02x", themeColors.AccentR, themeColors.AccentG, themeColors.AccentB))
	}

	// Apply editor.background as secondary color (inactive tabs, etc.)
	if themeColors.EditorBgSource != "default" {
		styles.ApplySecondary(fmt.Sprintf("#%02x%02x%02x", themeColors.EditorBgR, themeColors.EditorBgG, themeColors.EditorBgB))
	}

	// Compute atmosphere color from detected terminal background
	if termInfo.BgR+termInfo.BgG+termInfo.BgB > 0 {
		styles.ComputeAtmosphere(termInfo.BgR, termInfo.BgG, termInfo.BgB)
	}

	splashModel := splash.New()
	envLines := termInfo.EnvLines()
	// Append accent and editor bg sources to the runtime context line
	if len(envLines) >= 3 && themeColors.AccentSource != "" {
		envLines[2] += " | accent via " + themeColors.AccentSource
	}
	if len(envLines) >= 3 && themeColors.EditorBgSource != "" {
		envLines[2] += " | editorBg via " + themeColors.EditorBgSource
	}
	// Debug: show atmosphere values so we can verify what splash receives
	envLines = append(envLines, fmt.Sprintf("bg(%d,%d,%d) atmo(%d,%d,%d)",
		termInfo.BgR, termInfo.BgG, termInfo.BgB,
		styles.AtmosphereR, styles.AtmosphereG, styles.AtmosphereB))
	splashModel.EnvLines = envLines
	splashModel.BoostColors = termInfo.IsIDETerminal()
	splashModel.BgR = termInfo.BgR
	splashModel.BgG = termInfo.BgG
	splashModel.BgB = termInfo.BgB
	splashModel.AccentR = themeColors.AccentR
	splashModel.AccentG = themeColors.AccentG
	splashModel.AccentB = themeColors.AccentB
	splashModel.AtmoR = styles.AtmosphereR
	splashModel.AtmoG = styles.AtmosphereG
	splashModel.AtmoB = styles.AtmosphereB

	// Start file watcher for auto-refresh (G-6)
	var fileWatcher *watcher.Watcher
	if projectDir != "" && projectDir != "demo" {
		if w, err := watcher.New(projectDir, ctx.EventBus); err == nil {
			w.Start()
			fileWatcher = w
		}
	}

	// Always start with splash. Onboarding is a full-screen interstitial
	// between splash and Home — never a tab in the tab bar.
	return Model{
		Registry:        registry,
		ActiveView:      ViewSplash,
		TabOrder:        []ActiveView{ViewHome, ViewResearch, ViewPlans, ViewSpectrum, ViewFiles, ViewGit, ViewAgent, ViewMonitor, ViewBrowser, ViewWorkspaces},
		NeedsOnboarding: needsOnboarding,
		HasNerdFont:     termInfo.HasNerdFont,
		PrismDir:        prismDir,
		StoriesPath:     storiesPath,
		ProjectDir:      projectDir,
		PrismStyle:      prismStyle,
		MaxIterations:   maxIter,
		Pause:           pause,
		Prism:           prismRenderer,
		Splash:          splashModel,
		Watcher:         fileWatcher,
		Dialogs:         dialog.NewOverlay(),
		Anim: AnimState{
			RayLengths: [4]float64{6, 5, 4, 3},
			RayTargets: [4]float64{6, 7, 5, 8},
		},
	}
}

// NewDemoModel creates a model with fake stories for demo/testing
func NewDemoModel(prismStyle string) Model {
	m := NewModel("demo", "", "", 50, 2, prismStyle)
	m.ActiveView = ViewSplash
	m.DemoMode = true

	// Update context to reflect demo mode
	ctx := m.Registry.GetContext()
	ctx.DemoMode = true
	m.Registry.UpdateContext(ctx)

	// Re-init all plugins so they receive the updated context.
	// GetContext returns a copy, so UpdateContext alone doesn't propagate
	// DemoMode=true to plugins that cached the old context pointer during Init.
	m.Registry.Reinit()

	// Seed demo stories data directly into SpectrumPlugin
	spectrumPlugin := m.Registry.ActivePlugin()
	if sp, ok := spectrumPlugin.(*SpectrumPlugin); ok {
		sp.planName = "Prism Animation Demo"
		sp.stories = []StoryView{
			// Page 1 (completed stories)
			{ID: "DEMO-001", Title: "Initialize spring physics engine", Status: "complete"},
			{ID: "DEMO-002", Title: "Implement progress bar animations", Status: "complete"},
			{ID: "DEMO-003", Title: "Add story completion pop effect", Status: "complete"},
			{ID: "DEMO-004", Title: "Create active story pulse animation", Status: "complete"},
			{ID: "DEMO-005", Title: "Implement log entry slide-in", Status: "complete"},
			{ID: "DEMO-006", Title: "Add prism logo with rainbow shimmer", Status: "complete"},
			{ID: "DEMO-007", Title: "Optimize animation frame rate", Status: "complete"},
			{ID: "DEMO-008", Title: "Test all animations together", Status: "complete"},
			{ID: "DEMO-009", Title: "Create TipTap RichTextEditor component", Status: "complete"},
			{ID: "DEMO-010", Title: "Build FormatToolbar with bubble menu", Status: "complete"},
			{ID: "DEMO-011", Title: "Implement markdown shortcuts", Status: "complete"},
			{ID: "DEMO-012", Title: "Create NoteCard component shell", Status: "complete"},
			// Page 2 (in progress / pending)
			{ID: "DEMO-013", Title: "Implement auto-expanding height for notes", Status: "pending"},
			{ID: "DEMO-014", Title: "Add note persistence layer", Status: "pending"},
			{ID: "DEMO-015", Title: "Create ImageCard component", Status: "pending"},
			{ID: "DEMO-016", Title: "Implement image upload functionality", Status: "pending"},
			{ID: "DEMO-017", Title: "Create image thumbnail generator", Status: "pending"},
			{ID: "DEMO-018", Title: "Build LinkCard component", Status: "pending"},
			{ID: "DEMO-019", Title: "Implement link metadata fetching", Status: "pending"},
			{ID: "DEMO-020", Title: "Create TaskListCard component", Status: "pending"},
			{ID: "DEMO-021", Title: "Implement task functionality", Status: "pending"},
			{ID: "DEMO-022", Title: "Integrate new card types with canvas", Status: "pending"},
			{ID: "DEMO-023", Title: "Add drag-and-drop card reordering", Status: "pending"},
			{ID: "DEMO-024", Title: "Implement card selection system", Status: "pending"},
			// Page 3 (more pending)
			{ID: "DEMO-025", Title: "Create multi-select for cards", Status: "pending"},
			{ID: "DEMO-026", Title: "Add keyboard navigation", Status: "pending"},
			{ID: "DEMO-027", Title: "Implement undo/redo system", Status: "pending"},
			{ID: "DEMO-028", Title: "Create canvas zoom controls", Status: "pending"},
			{ID: "DEMO-029", Title: "Add minimap navigation", Status: "pending"},
			{ID: "DEMO-030", Title: "Implement canvas panning", Status: "pending"},
			{ID: "DEMO-031", Title: "Create board sharing system", Status: "pending"},
			{ID: "DEMO-032", Title: "Add collaborative editing", Status: "pending"},
			{ID: "DEMO-033", Title: "Implement real-time sync", Status: "pending"},
			{ID: "DEMO-034", Title: "Create export functionality", Status: "pending"},
			{ID: "DEMO-035", Title: "Add import from other tools", Status: "pending"},
			{ID: "DEMO-036", Title: "Final integration testing", Status: "pending"},
		}
		sp.totalStories = len(sp.stories)
		sp.storyPaginator.TotalPages = (len(sp.stories) + sp.storiesPerPage - 1) / sp.storiesPerPage
		sp.storyPaginator.Page = 0
		sp.anim.ProgressPos = sp.progressPercent()
		sp.anim.ProgressTarget = sp.progressPercent()

		// Seed epic data
		sp.epic.Epics = []EpicInfo{
			{Name: "user-auth", StoriesPath: "demo/stories/user-auth/stories.json", StoryCount: 12, CompletedCount: 8},
			{Name: "dashboard", StoriesPath: "demo/stories/dashboard/stories.json", StoryCount: 36, CompletedCount: 12},
			{Name: "notifications", StoriesPath: "demo/stories/notifications/stories.json", StoryCount: 9, CompletedCount: 0},
		}
	}

	// Seed demo data for Research and Plans plugins
	// Find and cast plugins
	for _, p := range m.Registry.Plugins() {
		if rp, ok := p.(*ResearchPlugin); ok {
			rp.state.Files = []FileEntry{
				{Name: "tech-stack-evaluation", Path: "demo/research/tech-stack-evaluation.md", Preview: "Evaluated React vs Svelte vs Solid for frontend framework.\nRecommendation: React with Next.js for SSR support."},
				{Name: "auth-patterns", Path: "demo/research/auth-patterns.md", Preview: "JWT vs session-based authentication analysis.\nOAuth2 flow diagrams and token refresh strategy."},
				{Name: "database-schema-design", Path: "demo/research/database-schema-design.md", Preview: "PostgreSQL schema for multi-tenant SaaS.\nPartitioning strategy and index recommendations."},
				{Name: "api-rate-limiting", Path: "demo/research/api-rate-limiting.md", Preview: "Token bucket vs sliding window algorithms.\nRedis-based distributed rate limiter design."},
			}
		}
		if pp, ok := p.(*PlansPlugin); ok {
			pp.state.Files = []FileEntry{
				{Name: "user-authentication", Path: "demo/plans/user-authentication.md", Preview: "Implement OAuth2 + JWT auth with refresh tokens.\n12 stories across 3 phases."},
				{Name: "dashboard-redesign", Path: "demo/plans/dashboard-redesign.md", Preview: "Multi-view dashboard with real-time data.\nIncludes drag-and-drop widget layout."},
				{Name: "notification-system", Path: "demo/plans/notification-system.md", Preview: "Push notifications via WebSocket + FCM.\nIn-app notification center with read tracking."},
			}
		}
		if fp, ok := p.(*FilesPlugin); ok {
			// Demo file tree
			fp.state.Root = &FileNode{
				Name:     "prism-plugin",
				Path:     "/demo/prism-plugin",
				IsDir:    true,
				Expanded: true,
				Depth:    0,
				Children: []*FileNode{
					{Name: ".prism", Path: "/demo/.prism", IsDir: true, Expanded: false, Depth: 1, Children: []*FileNode{
						{Name: "shared", Path: "/demo/.prism/shared", IsDir: true, Depth: 2},
						{Name: "stories", Path: "/demo/.prism/stories", IsDir: true, Depth: 2},
					}},
					{Name: "cmd", Path: "/demo/cmd", IsDir: true, Expanded: true, Depth: 1, Children: []*FileNode{
						{Name: "prism-cli", Path: "/demo/cmd/prism-cli", IsDir: true, Expanded: false, Depth: 2, Children: []*FileNode{
							{Name: "app", Path: "/demo/cmd/prism-cli/app", IsDir: true, Depth: 3},
							{Name: "main.go", Path: "/demo/cmd/prism-cli/main.go", IsDir: false, Depth: 3},
						}},
					}},
					{Name: "README.md", Path: "/demo/README.md", IsDir: false, Depth: 1},
					{Name: "go.mod", Path: "/demo/go.mod", IsDir: false, Depth: 1},
				},
			}
			fp.rebuildFlatList()
		}
		if gp, ok := p.(*GitPlugin); ok {
			// Demo git status
			gp.state.BranchName = "feat/spectrum-migration"
			gp.state.Ahead = 3
			gp.state.Behind = 1
			gp.state.StagedFiles = []GitFileStatus{
				{Path: "cmd/prism-cli/app/plugin_files.go", Status: "staged"},
				{Path: "cmd/prism-cli/app/plugin_git.go", Status: "staged"},
			}
			gp.state.ModifiedFiles = []GitFileStatus{
				{Path: "cmd/prism-cli/app/model.go", Status: "modified"},
				{Path: "cmd/prism-cli/app/update.go", Status: "modified"},
			}
			gp.state.UntrackedFiles = []GitFileStatus{
				{Path: "cmd/prism-cli/app/plugin_monitor.go", Status: "untracked"},
			}
		}
		if ap, ok := p.(*AgentPlugin); ok {
			// Demo chat messages
			ap.state.Messages = []chat.Message{
				{
					Type:    chat.MessageTypeUser,
					Content: "Help me implement Phase 7 of the Sidecar + Crush integration into Prism CLI",
				},
				{
					Type:    chat.MessageTypeAssistant,
					Content: "I'll help you implement Phase 7. Let me start by **researching** the existing architecture and understanding the plugin interface.\n\nFirst, I'll need to:\n- Read the Plugin interface definition\n- Examine existing plugin implementations\n- Understand the message rendering requirements",
				},
				{
					Type:    chat.MessageTypeTool,
					ToolID:  "Read",
					Content: "Reading: cmd/prism-cli/plugin/plugin.go",
					Status:  "complete",
				},
				{
					Type:    chat.MessageTypeTool,
					ToolID:  "Read",
					Content: "Reading: cmd/prism-cli/app/plugin_home.go",
					Status:  "complete",
				},
				{
					Type:    chat.MessageTypeAssistant,
					Content: "Great! I've reviewed the architecture. Now I'll create:\n\n1. `chat/renderer.go` for message rendering\n2. `plugin_agent.go` implementing the Plugin interface\n3. Register the plugin in NewModel()\n\nLet me start with the message renderer.",
				},
				{
					Type:    chat.MessageTypeTool,
					ToolID:  "Write",
					Content: "Creating: cmd/prism-cli/app/chat/renderer.go",
					Status:  "running",
				},
			}
			// Mark first tool message as collapsed
			ap.state.ToolsCollapsed[2] = true
		}
		if mp, ok := p.(*MonitorPlugin); ok {
			// Demo execution history
			now := time.Now()
			mp.state.History = []ExecutionRecord{
				{
					StoryID:   "DEMO-001",
					StoryName: "Initialize spring physics engine",
					Duration:  2 * time.Minute + 34 * time.Second,
					Result:    "success",
					Timestamp: now.Add(-25 * time.Minute),
				},
				{
					StoryID:   "DEMO-002",
					StoryName: "Implement progress bar animations",
					Duration:  3 * time.Minute + 12 * time.Second,
					Result:    "success",
					Timestamp: now.Add(-22 * time.Minute),
				},
				{
					StoryID:   "DEMO-003",
					StoryName: "Add story completion pop effect",
					Duration:  1 * time.Minute + 45 * time.Second,
					Result:    "success",
					Timestamp: now.Add(-18 * time.Minute),
				},
				{
					StoryID:   "DEMO-004",
					StoryName: "Create active story pulse animation",
					Duration:  2 * time.Minute + 8 * time.Second,
					Result:    "error",
					Timestamp: now.Add(-15 * time.Minute),
				},
				{
					StoryID:   "DEMO-005",
					StoryName: "Implement log entry slide-in",
					Duration:  2 * time.Minute + 56 * time.Second,
					Result:    "success",
					Timestamp: now.Add(-10 * time.Minute),
				},
			}
			// Demo quality gates status
			mp.UpdateQualityGate("Lint", "pass", "golangci-lint run --timeout 5m\n✓ All checks passed")
			mp.UpdateQualityGate("Tests", "pass", "go test ./...\nok  \tprism-cli/app\t2.341s")
			mp.UpdateQualityGate("Build", "pass", "go build ./...\nBuild complete")
		}
		if wp, ok := p.(*WorkspacesPlugin); ok {
			// Demo discovered projects
			wp.state.Projects = []ProjectInfo{
				{
					Name:            "prism-plugin",
					Path:            "/Users/demo/Developer/prism-plugin",
					Branch:          "feat/spectrum-migration",
					StoriesTotal:    36,
					StoriesComplete: 12,
					Epics: []EpicInfo{
						{Name: "user-auth", StoriesPath: "/Users/demo/Developer/prism-plugin/.prism/stories/user-auth/stories.json", StoryCount: 12, CompletedCount: 8},
						{Name: "dashboard", StoriesPath: "/Users/demo/Developer/prism-plugin/.prism/stories/dashboard/stories.json", StoryCount: 24, CompletedCount: 4},
					},
				},
				{
					Name:            "sidecar",
					Path:            "/Users/demo/Developer/sidecar",
					Branch:          "main",
					StoriesTotal:    18,
					StoriesComplete: 18,
					Epics:           []EpicInfo{},
				},
				{
					Name:            "crush",
					Path:            "/Users/demo/Developer/crush",
					Branch:          "develop",
					StoriesTotal:    42,
					StoriesComplete: 28,
					Epics: []EpicInfo{
						{Name: "chat-ui", StoriesPath: "/Users/demo/Developer/crush/.prism/stories/chat-ui/stories.json", StoryCount: 20, CompletedCount: 15},
						{Name: "lsp-integration", StoriesPath: "/Users/demo/Developer/crush/.prism/stories/lsp-integration/stories.json", StoryCount: 22, CompletedCount: 13},
					},
				},
			}
		}
		if op, ok := p.(*OnboardingPlugin); ok {
			// Demo onboarding with all steps complete
			op.state.ProjectDir = "/Users/demo/Developer/prism-plugin"
			op.state.PrismDir = "/Users/demo/Developer/prism-plugin/.prism"
			op.state.ClaudeAvailable = true
			op.state.StoriesPath = "/Users/demo/Developer/prism-plugin/.prism/stories/stories.json"
			op.state.CurrentStep = 4 // All steps complete
			op.state.Completed = true
			// Mark all steps as complete
			for i := range op.state.Steps {
				op.state.Steps[i].Status = "complete"
			}
		}
	}

	return m
}

// ResetOnboarding resets the onboarding plugin to pending state so the wizard
// can be walked through interactively. Used by --onboarding flag.
func (m *Model) ResetOnboarding() {
	for _, p := range m.Registry.Plugins() {
		if op, ok := p.(*OnboardingPlugin); ok {
			op.state.CurrentStep = 0
			op.state.Completed = false
			for i := range op.state.Steps {
				op.state.Steps[i].Status = "pending"
				op.state.Steps[i].ErrorMsg = ""
			}
		}
	}
}

// Note: Helper methods like CompletedCount(), AddLog(), ElapsedTime() are now
// owned by individual plugins (e.g., SpectrumPlugin) since state is plugin-local.

// resolveGitRoot returns the git repository root for the given directory,
// or empty string if not inside a git repo.
func resolveGitRoot(dir string) string {
	if dir == "" || dir == "demo" {
		return ""
	}
	out, err := exec.Command("git", "-C", dir, "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// resolveConfigDir returns the global configuration directory for prism-cli.
// Uses XDG_CONFIG_HOME if set, otherwise ~/.config/prism-cli/.
func resolveConfigDir() string {
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "prism-cli")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".config", "prism-cli")
}
