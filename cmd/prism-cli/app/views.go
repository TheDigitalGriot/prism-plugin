package app

import (
	"time"

	"github.com/charmbracelet/bubbles/viewport"
)

// ActiveView represents which top-level screen is displayed
type ActiveView int

const (
	ViewSplash     ActiveView = iota
	ViewHome
	ViewResearch
	ViewPlans
	ViewSpectrum
	ViewFiles
	ViewGit
	ViewAgent
	ViewChat
	ViewMonitor
	ViewWorkspaces
	ViewOnboarding
)

func (v ActiveView) String() string {
	switch v {
	case ViewSplash:
		return "SPLASH"
	case ViewHome:
		return "HOME"
	case ViewResearch:
		return "RESEARCH"
	case ViewPlans:
		return "PLANS"
	case ViewSpectrum:
		return "SPECTRUM"
	case ViewFiles:
		return "FILES"
	case ViewGit:
		return "GIT"
	case ViewAgent:
		return "AGENT"
	case ViewChat:
		return "CHAT"
	case ViewMonitor:
		return "MONITOR"
	case ViewWorkspaces:
		return "WORKSPACES"
	case ViewOnboarding:
		return "ONBOARDING"
	default:
		return "UNKNOWN"
	}
}

// HomeState holds state for the home menu view
type HomeState struct {
	SelectedIndex int
	MenuItems     []string
}

// FileEntry represents a markdown file in a listing
type FileEntry struct {
	Name    string    // filename without extension
	Path    string    // full absolute path
	Preview string    // first 3 lines of content
	ModTime time.Time // file modification time
}

// ResearchState holds state for the research browser view
type ResearchState struct {
	Files       []FileEntry
	SelectedIdx int
	Viewing     bool           // true = reading a file, false = list mode
	Viewport    viewport.Model // scrollable content viewer
}

// PlansState holds state for the plans browser view
type PlansState struct {
	Files       []FileEntry
	SelectedIdx int
	Viewing     bool
	Viewport    viewport.Model
}

// EpicInfo represents a discovered epic directory
type EpicInfo struct {
	Name           string // directory name
	StoriesPath    string // full path to stories.json
	StoryCount     int
	CompletedCount int
}

// EpicState holds state for the epic selector in Spectrum view
type EpicState struct {
	Epics         []EpicInfo
	SelectedIndex int
	IsLegacy      bool // true if using flat .prism/stories/stories.json
}
