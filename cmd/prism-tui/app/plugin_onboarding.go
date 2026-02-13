package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-tui/plugin"
	"github.com/prism-plugin/prism-tui/styles"
)

// OnboardingStep represents a single step in the onboarding process
type OnboardingStep struct {
	ID          int
	Title       string
	Description string
	Status      string // "pending", "in_progress", "complete", "error"
	ActionLabel string // Label for the action button
	ErrorMsg    string // Error message if status is "error"
}

// OnboardingState holds state for the onboarding wizard
type OnboardingState struct {
	Steps           []OnboardingStep
	CurrentStep     int
	ProjectDir      string
	PrismDir        string
	ClaudeAvailable bool
	StoriesPath     string
	Completed       bool
}

// OnboardingPlugin implements the first-run setup wizard
type OnboardingPlugin struct {
	ctx     *plugin.Context
	state   OnboardingState
	focused bool
}

// NewOnboardingPlugin creates a new Onboarding plugin instance
func NewOnboardingPlugin() *OnboardingPlugin {
	return &OnboardingPlugin{
		state: OnboardingState{
			Steps: []OnboardingStep{
				{
					ID:          1,
					Title:       "Project Directory",
					Description: "Detect or select project directory",
					Status:      "pending",
					ActionLabel: "Detect",
				},
				{
					ID:          2,
					Title:       ".prism/ Directory",
					Description: "Check for .prism/ directory structure",
					Status:      "pending",
					ActionLabel: "Create",
				},
				{
					ID:          3,
					Title:       "Claude CLI",
					Description: "Verify claude CLI is installed",
					Status:      "pending",
					ActionLabel: "Check",
				},
				{
					ID:          4,
					Title:       "Stories File",
					Description: "Verify stories.json exists",
					Status:      "pending",
					ActionLabel: "Create",
				},
			},
			CurrentStep: 0,
			Completed:   false,
		},
	}
}

// ID returns the plugin identifier
func (p *OnboardingPlugin) ID() string {
	return "onboarding"
}

// Name returns the display name
func (p *OnboardingPlugin) Name() string {
	return "Onboarding"
}

// Icon returns the tab icon
func (p *OnboardingPlugin) Icon() string {
	return "🚀"
}

// Init initializes the plugin with context
func (p *OnboardingPlugin) Init(ctx *plugin.Context) error {
	p.ctx = ctx

	// Auto-detect project directory from context
	if ctx.ProjectDir != "" {
		p.state.ProjectDir = ctx.ProjectDir
		p.state.PrismDir = ctx.PrismDir
	}

	// Start onboarding automatically
	p.checkCurrentStep()

	return nil
}

// Start is called when the plugin is first activated
func (p *OnboardingPlugin) Start() tea.Cmd {
	return nil
}

// Stop is called when deactivated
func (p *OnboardingPlugin) Stop() {
	// No cleanup needed
}

// Update handles messages
func (p *OnboardingPlugin) Update(msg tea.Msg) (plugin.Plugin, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		return p.handleKeyPress(msg)

	case OnboardingStepCompleteMsg:
		// Step completed, move to next
		if p.state.CurrentStep < len(p.state.Steps) {
			p.state.Steps[p.state.CurrentStep].Status = "complete"
			p.state.CurrentStep++

			// Check if all steps are done
			if p.state.CurrentStep >= len(p.state.Steps) {
				p.state.Completed = true
				// Navigate to Home and signal completion
				return p, func() tea.Msg {
					return OnboardingCompleteMsg{}
				}
			}

			// Auto-check next step
			return p, p.checkNextStep()
		}
		return p, nil

	case OnboardingStepErrorMsg:
		// Step failed, show error
		if p.state.CurrentStep < len(p.state.Steps) {
			p.state.Steps[p.state.CurrentStep].Status = "error"
			p.state.Steps[p.state.CurrentStep].ErrorMsg = msg.Error
		}
		return p, nil
	}

	return p, nil
}

// View renders the onboarding wizard
func (p *OnboardingPlugin) View(width, height int) string {
	var sections []string

	// Header with gradient PRISM logo
	logo := renderPrismLogoStatic()
	logoPanel := styles.PanelStyle.Width(width-2).Render(logo)
	sections = append(sections, logoPanel)
	sections = append(sections, "")

	// Welcome message
	if !p.state.Completed {
		welcome := styles.TitleStyle.Render("Welcome to Prism TUI!")
		subtitle := styles.DimStyle.Render("Let's get you set up in a few quick steps")
		sections = append(sections, "  "+welcome)
		sections = append(sections, "  "+subtitle)
		sections = append(sections, "")
	} else {
		complete := styles.SuccessStyle.Render("✓ Setup Complete!")
		subtitle := styles.DimStyle.Render("Navigating to Home...")
		sections = append(sections, "  "+complete)
		sections = append(sections, "  "+subtitle)
		sections = append(sections, "")
	}

	// Render steps
	for i, step := range p.state.Steps {
		stepView := p.renderStep(step, i == p.state.CurrentStep, width-8)
		sections = append(sections, stepView)
		sections = append(sections, "")
	}

	// Progress indicator
	completedCount := 0
	for _, step := range p.state.Steps {
		if step.Status == "complete" {
			completedCount++
		}
	}
	progress := fmt.Sprintf("Progress: %d/%d steps complete", completedCount, len(p.state.Steps))
	sections = append(sections, "")
	sections = append(sections, "  "+styles.DimStyle.Render(progress))

	// Hints
	if !p.state.Completed {
		hints := "enter: run action   q: quit"
		sections = append(sections, "")
		sections = append(sections, "  "+styles.DimStyle.Render(hints))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// IsFocused returns whether the plugin is active
func (p *OnboardingPlugin) IsFocused() bool {
	return p.focused
}

// SetFocused sets the focus state
func (p *OnboardingPlugin) SetFocused(focused bool) {
	p.focused = focused
}

// KeyHints returns footer key hints
func (p *OnboardingPlugin) KeyHints() []plugin.KeyHint {
	return []plugin.KeyHint{
		{Key: "enter", Description: "run action"},
		{Key: "j/k", Description: "navigate"},
	}
}

// handleKeyPress handles keyboard input
func (p *OnboardingPlugin) handleKeyPress(msg tea.KeyMsg) (plugin.Plugin, tea.Cmd) {
	if p.state.Completed {
		return p, nil
	}

	key := msg.String()

	switch key {
	case "enter", " ":
		// Execute current step action
		return p, p.executeStepAction()

	case "j", "down":
		// Navigate to next step (for manual review)
		if p.state.CurrentStep < len(p.state.Steps)-1 {
			p.state.CurrentStep++
		}
		return p, nil

	case "k", "up":
		// Navigate to previous step
		if p.state.CurrentStep > 0 {
			p.state.CurrentStep--
		}
		return p, nil
	}

	return p, nil
}

// renderStep renders a single onboarding step
func (p *OnboardingPlugin) renderStep(step OnboardingStep, isCurrent bool, width int) string {
	var parts []string

	// Status icon
	var icon string
	var iconStyle lipgloss.Style
	switch step.Status {
	case "complete":
		icon = "✓"
		iconStyle = styles.SuccessStyle
	case "in_progress":
		icon = "▸"
		iconStyle = styles.InfoStyle
	case "error":
		icon = "✗"
		iconStyle = styles.ErrorStyle
	default:
		icon = "○"
		iconStyle = styles.DimStyle
	}

	// Step title
	stepLine := fmt.Sprintf("%s Step %d: %s",
		iconStyle.Render(icon),
		step.ID,
		step.Title,
	)

	if isCurrent {
		stepLine = styles.CurrentStyle.Bold(true).Render(stepLine)
	} else {
		stepLine = styles.DimStyle.Render(stepLine)
	}

	parts = append(parts, "  "+stepLine)

	// Description
	desc := "      " + step.Description
	if isCurrent {
		parts = append(parts, styles.InfoStyle.Render(desc))
	} else {
		parts = append(parts, styles.DimStyle.Render(desc))
	}

	// Error message if present
	if step.Status == "error" && step.ErrorMsg != "" {
		errMsg := "      Error: " + step.ErrorMsg
		parts = append(parts, styles.ErrorStyle.Render(errMsg))
	}

	// Action button (only for current step)
	if isCurrent && step.Status != "complete" {
		action := fmt.Sprintf("      [%s]", step.ActionLabel)
		parts = append(parts, styles.InfoStyle.Bold(true).Render(action))
	}

	return strings.Join(parts, "\n")
}

// checkCurrentStep validates the current step automatically
func (p *OnboardingPlugin) checkCurrentStep() {
	if p.state.CurrentStep >= len(p.state.Steps) {
		return
	}

	step := &p.state.Steps[p.state.CurrentStep]

	switch step.ID {
	case 1:
		// Step 1: Detect project directory
		if p.state.ProjectDir != "" {
			// Already detected from context
			step.Status = "complete"
			p.state.CurrentStep++
			p.checkCurrentStep() // Check next step
		} else {
			step.Status = "in_progress"
		}

	case 2:
		// Step 2: Check .prism/ directory
		if p.state.PrismDir != "" {
			if _, err := os.Stat(p.state.PrismDir); err == nil {
				// .prism/ exists
				step.Status = "complete"
				p.state.CurrentStep++
				p.checkCurrentStep()
			} else {
				step.Status = "in_progress"
			}
		} else {
			step.Status = "in_progress"
		}

	case 3:
		// Step 3: Check claude CLI
		if _, err := exec.LookPath("claude"); err == nil {
			p.state.ClaudeAvailable = true
			step.Status = "complete"
			p.state.CurrentStep++
			p.checkCurrentStep()
		} else {
			step.Status = "in_progress"
		}

	case 4:
		// Step 4: Check stories.json
		storiesPath := filepath.Join(p.state.PrismDir, "stories", "stories.json")
		if _, err := os.Stat(storiesPath); err == nil {
			p.state.StoriesPath = storiesPath
			step.Status = "complete"
			p.state.CurrentStep++
			// All steps complete!
		} else {
			step.Status = "in_progress"
		}
	}
}

// checkNextStep returns a command to check the next step
func (p *OnboardingPlugin) checkNextStep() tea.Cmd {
	return func() tea.Msg {
		p.checkCurrentStep()
		return nil
	}
}

// executeStepAction executes the action for the current step
func (p *OnboardingPlugin) executeStepAction() tea.Cmd {
	if p.state.CurrentStep >= len(p.state.Steps) {
		return nil
	}

	step := &p.state.Steps[p.state.CurrentStep]
	step.Status = "in_progress"

	return func() tea.Msg {
		switch step.ID {
		case 1:
			// Step 1: Detect project directory
			if p.state.ProjectDir == "" {
				// Try to detect from current working directory
				cwd, err := os.Getwd()
				if err != nil {
					return OnboardingStepErrorMsg{Error: "Could not detect current directory"}
				}
				p.state.ProjectDir = cwd
			}
			p.state.PrismDir = filepath.Join(p.state.ProjectDir, ".prism")
			return OnboardingStepCompleteMsg{}

		case 2:
			// Step 2: Create .prism/ directory structure
			if err := p.createPrismStructure(); err != nil {
				return OnboardingStepErrorMsg{Error: err.Error()}
			}
			return OnboardingStepCompleteMsg{}

		case 3:
			// Step 3: Check claude CLI
			if _, err := exec.LookPath("claude"); err != nil {
				return OnboardingStepErrorMsg{
					Error: "claude CLI not found. Install from: https://claude.com/claude-code",
				}
			}
			p.state.ClaudeAvailable = true
			return OnboardingStepCompleteMsg{}

		case 4:
			// Step 4: Create or verify stories.json
			storiesPath := filepath.Join(p.state.PrismDir, "stories", "stories.json")
			if _, err := os.Stat(storiesPath); err != nil {
				// Create minimal stories.json
				if err := p.createStoriesFile(storiesPath); err != nil {
					return OnboardingStepErrorMsg{Error: err.Error()}
				}
			}
			p.state.StoriesPath = storiesPath
			return OnboardingStepCompleteMsg{}

		default:
			return OnboardingStepCompleteMsg{}
		}
	}
}

// createPrismStructure creates the .prism/ directory structure
func (p *OnboardingPlugin) createPrismStructure() error {
	dirs := []string{
		p.state.PrismDir,
		filepath.Join(p.state.PrismDir, "stories"),
		filepath.Join(p.state.PrismDir, "shared"),
		filepath.Join(p.state.PrismDir, "shared", "research"),
		filepath.Join(p.state.PrismDir, "shared", "plans"),
		filepath.Join(p.state.PrismDir, "shared", "validation"),
		filepath.Join(p.state.PrismDir, "shared", "handoffs"),
		filepath.Join(p.state.PrismDir, "shared", "prs"),
		filepath.Join(p.state.PrismDir, "shared", "spectrum"),
		filepath.Join(p.state.PrismDir, "shared", "ref"),
		filepath.Join(p.state.PrismDir, "shared", "docs"),
		filepath.Join(p.state.PrismDir, "local"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create %s: %w", dir, err)
		}
	}

	return nil
}

// createStoriesFile creates a minimal stories.json file
func (p *OnboardingPlugin) createStoriesFile(path string) error {
	content := `{
  "plan": {
    "name": "New Project",
    "source": "",
    "qualityGates": []
  },
  "stories": []
}
`
	return os.WriteFile(path, []byte(content), 0644)
}

// OnboardingStepCompleteMsg signals that a step completed successfully
type OnboardingStepCompleteMsg struct{}

// OnboardingStepErrorMsg signals that a step encountered an error
type OnboardingStepErrorMsg struct {
	Error string
}

// OnboardingCompleteMsg signals that onboarding is fully complete
type OnboardingCompleteMsg struct{}
