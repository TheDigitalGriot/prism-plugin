package main

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-cli/app"
	"github.com/spf13/cobra"
)

var version = "2.1.3"

func main() {
	var (
		storiesFile    string
		maxIterations  int
		pause          int
		demoMode       bool
		onboardingMode bool
		prismStyle     string
	)

	rootCmd := &cobra.Command{
		Use:     "prism-cli [stories-file]",
		Short:   "Prism CLI - Autonomous iteration executor with visual interface",
		Long: `Prism CLI provides a visual terminal interface for running the Spectrum
iterative workflow. It spawns Claude Code sessions to execute stories
autonomously while providing real-time visibility into progress.

The CLI displays:
  - Story list with completion status
  - Overall progress bar
  - Current activity and Claude output
  - Scrollable log history

Keyboard controls:
  q, Ctrl+C  Quit (graceful shutdown)
  p          Pause/Resume execution
  /          Skip current story
  a/s        Story pagination (prev/next page)
  z/x        Log pagination (prev/next page)
  Enter      Start (when idle)
  ?          Toggle help`,
		Version: version,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Demo mode - run with simulated data
			if demoMode {
				return runDemoMode(version, prismStyle, onboardingMode)
			}

			cwd, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("failed to get working directory: %w", err)
			}

			// Determine stories file path
			if len(args) > 0 {
				storiesFile = args[0]
			}

			var prismDir, projectDir string

			if storiesFile != "" {
				// Explicit file mode: resolve paths from stories file
				absPath, err := filepath.Abs(storiesFile)
				if err != nil {
					return fmt.Errorf("failed to resolve path: %w", err)
				}
				storiesFile = absPath

				// Verify file exists
				if _, err := os.Stat(storiesFile); os.IsNotExist(err) {
					return fmt.Errorf("stories file not found: %s\n\nRun /decompose_plan first to generate stories.json", storiesFile)
				}

				// Derive directories from stories file
				prismDir = filepath.Dir(filepath.Dir(storiesFile))
				projectDir = filepath.Dir(prismDir)
				if projectDir == "" || projectDir == "." {
					projectDir = cwd
				}
			} else {
				// Home mode: look for .prism/ in current directory
				prismDir = filepath.Join(cwd, ".prism")
				projectDir = cwd

				// Check if .prism/ exists
				if _, err := os.Stat(prismDir); os.IsNotExist(err) {
					// Check for legacy thoughts/ directory before erroring
					legacyDir := filepath.Join(cwd, "thoughts")
					if _, legacyErr := os.Stat(legacyDir); os.IsNotExist(legacyErr) {
						// Neither .prism/ nor thoughts/ — original error
						return fmt.Errorf(".prism/ directory not found in %s\n\nRun init_prism.py first to initialize the project", cwd)
					}
					// Legacy project detected — TUI will handle migration via onboarding
				} else {
					// Check for legacy flat structure
					flatPath := filepath.Join(prismDir, "stories", "stories.json")
					if _, err := os.Stat(flatPath); err == nil {
						// Legacy flat structure exists - can use it if no epics found
						storiesFile = flatPath
					}
				}
				// Otherwise storiesFile stays empty -> launches at ViewHome
			}

			// Create and run TUI
			model := app.NewModel(prismDir, storiesFile, projectDir, maxIterations, pause, prismStyle)
			if onboardingMode {
				model.NeedsOnboarding = true
			}

			zone.NewGlobal()
		p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
			if _, err := p.Run(); err != nil {
				return fmt.Errorf("failed to run CLI: %w", err)
			}

			// Reset terminal state — splash's raw ANSI can leave the
			// G0 charset as DEC Special Graphics, which persists after
			// alt screen exit and corrupts the parent shell.
			fmt.Print("\x1b(B\x1b[0m")

			return nil
		},
	}

	rootCmd.Flags().StringVarP(&storiesFile, "file", "f", "", "Path to stories.json")
	rootCmd.Flags().IntVarP(&maxIterations, "max-iterations", "n", 50, "Maximum iterations before stopping")
	rootCmd.Flags().IntVarP(&pause, "pause", "p", 2, "Seconds to pause between iterations")
	rootCmd.Flags().BoolVar(&demoMode, "demo", false, "Run in demo mode with simulated stories to preview animations")
	rootCmd.Flags().BoolVar(&onboardingMode, "onboarding", false, "Force onboarding flow (for testing/refining the setup wizard)")
	rootCmd.Flags().StringVar(&prismStyle, "prism-style", "gradient", "Prism animation style: gradient|simple|braille|ascii")

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// runDemoMode creates a demo TUI with simulated stories
func runDemoMode(version string, prismStyle string, onboarding bool) error {
	// Create demo model with fake data
	model := app.NewDemoModel(prismStyle)
	if onboarding {
		model.NeedsOnboarding = true
		model.OnboardingDone = false
		// Reset onboarding plugin to pending state so wizard is interactive
		model.ResetOnboarding()
	}

	zone.NewGlobal()
	p := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("failed to run demo CLI: %w", err)
	}

	// Reset terminal state — splash's raw ANSI can leave the
	// G0 charset as DEC Special Graphics, which persists after
	// alt screen exit and corrupts the parent shell.
	fmt.Print("\x1b(B\x1b[0m")

	return nil
}
