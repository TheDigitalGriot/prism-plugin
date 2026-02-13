package app

import (
	"time"

	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/prism"
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

	// UI state
	Width      int
	Height     int
	ShowHelp   bool
	Ready      bool // True once initial setup is complete
	SplashDone bool // True once splash screen has completed

	// Prism framebuffer animation (shared across all views)
	Prism *prism.Renderer

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
	}

	// Create plugin registry
	registry := plugin.NewRegistry(ctx)

	// Register plugins in tab order
	homePlugin := NewHomePlugin()
	researchPlugin := NewResearchPlugin()
	plansPlugin := NewPlansPlugin()
	spectrumPlugin := NewSpectrumPlugin(prismRenderer)

	registry.Register(homePlugin)
	registry.Register(researchPlugin)
	registry.Register(plansPlugin)
	registry.Register(spectrumPlugin)

	// Start with splash screen on first launch
	initialView := ViewSplash

	return Model{
		Registry:      registry,
		ActiveView:    initialView,
		TabOrder:      []ActiveView{ViewHome, ViewResearch, ViewPlans, ViewSpectrum},
		PrismDir:      prismDir,
		StoriesPath:   storiesPath,
		ProjectDir:    projectDir,
		PrismStyle:    prismStyle,
		MaxIterations: maxIter,
		Pause:         pause,
		Prism:         prismRenderer,
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
	}

	return m
}

// Note: Helper methods like CompletedCount(), AddLog(), ElapsedTime() are now
// owned by individual plugins (e.g., SpectrumPlugin) since state is plugin-local.
