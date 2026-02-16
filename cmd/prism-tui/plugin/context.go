package plugin

// Context holds shared configuration and state that all plugins can access.
// It is passed to plugins during Init() and provides read-only access to
// application-level configuration.
type Context struct {
	// PrismDir is the absolute path to the .prism/ directory
	PrismDir string

	// ProjectDir is the absolute path to the project root directory
	ProjectDir string

	// StoriesPath is the path to the stories.json file for the current epic/project
	StoriesPath string

	// Width is the terminal width (updated on resize)
	Width int

	// Height is the terminal height (updated on resize)
	Height int

	// DemoMode indicates whether the app is running in demo/test mode
	DemoMode bool

	// PrismStyle specifies the prism rendering style ("gradient", "braille", "ascii")
	PrismStyle string

	// MaxIterations is the maximum number of Spectrum iterations allowed
	MaxIterations int

	// Pause is the delay in seconds between Spectrum iterations
	Pause int

	// HasNerdFont indicates whether the terminal font supports Nerd Font glyphs
	HasNerdFont bool

	// EventBus provides inter-plugin communication via pub/sub events
	EventBus *EventBus
}
