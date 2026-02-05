package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/prism-plugin/ralph-tui/app"
	"github.com/spf13/cobra"
)

var version = "v1.8.0"

func main() {
	var (
		storiesFile   string
		maxIterations int
		pause         int
		demoMode      bool
		prismStyle    string
	)

	rootCmd := &cobra.Command{
		Use:     "ralph-tui [stories-file]",
		Short:   "Ralph TUI - Autonomous iteration executor with visual interface",
		Long: `Ralph TUI provides a visual terminal interface for running the Ralph
iterative workflow. It spawns Claude Code sessions to execute stories
autonomously while providing real-time visibility into progress.

The TUI displays:
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
				return runDemoMode(version, prismStyle)
			}

			// Determine stories file path
			if len(args) > 0 {
				storiesFile = args[0]
			} else if storiesFile == "" {
				// Default: look in current directory
				cwd, err := os.Getwd()
				if err != nil {
					return fmt.Errorf("failed to get working directory: %w", err)
				}
				storiesFile = filepath.Join(cwd, "thoughts", "shared", "ralph", "stories.json")
			}

			// Get absolute path
			absPath, err := filepath.Abs(storiesFile)
			if err != nil {
				return fmt.Errorf("failed to resolve path: %w", err)
			}
			storiesFile = absPath

			// Verify file exists
			if _, err := os.Stat(storiesFile); os.IsNotExist(err) {
				return fmt.Errorf("stories file not found: %s\n\nRun /decompose_plan first to generate stories.json", storiesFile)
			}

			// Determine project directory (parent of thoughts/)
			projectDir := filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(storiesFile))))
			if projectDir == "" || projectDir == "." {
				projectDir, _ = os.Getwd()
			}

			// Create and run TUI
			model := app.NewModel(storiesFile, projectDir, maxIterations, pause, prismStyle)

			// Add initial log entry
			model.AddLog(app.LogInfo, "Ralph TUI v"+version)
			model.AddLog(app.LogInfo, "Stories: "+storiesFile)
			model.AddLog(app.LogInfo, "Project: "+projectDir)

			p := tea.NewProgram(model, tea.WithAltScreen())
			if _, err := p.Run(); err != nil {
				return fmt.Errorf("failed to run TUI: %w", err)
			}

			return nil
		},
	}

	rootCmd.Flags().StringVarP(&storiesFile, "file", "f", "", "Path to stories.json")
	rootCmd.Flags().IntVarP(&maxIterations, "max-iterations", "n", 50, "Maximum iterations before stopping")
	rootCmd.Flags().IntVarP(&pause, "pause", "p", 2, "Seconds to pause between iterations")
	rootCmd.Flags().BoolVar(&demoMode, "demo", false, "Run in demo mode with simulated stories to preview animations")
	rootCmd.Flags().StringVar(&prismStyle, "prism-style", "gradient", "Prism animation style: gradient|simple|braille|ascii")

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// runDemoMode creates a demo TUI with simulated stories
func runDemoMode(version string, prismStyle string) error {
	// Create demo model with fake data
	model := app.NewDemoModel(prismStyle)

	// Add initial log entries
	model.AddLog(app.LogInfo, "Ralph TUI "+version+" - DEMO MODE")
	model.AddLog(app.LogInfo, "Press Enter to start demo simulation")
	model.AddLog(app.LogWarning, "Stories will auto-complete every 2-3 seconds")

	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("failed to run demo TUI: %w", err)
	}

	return nil
}

// DemoTickMsg for demo auto-progression
type DemoTickMsg time.Time
