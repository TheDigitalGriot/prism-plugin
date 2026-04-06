package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
	"github.com/prism-plugin/prism-cli/app"
	"github.com/prism-plugin/prism-cli/registry"
	"github.com/spf13/cobra"
)

var version = "3.0.0"

func main() {
	var (
		storiesFile    string
		maxIterations  int
		pause          int
		demoMode       bool
		onboardingMode bool
		prismStyle     string
		uninstallMode  bool
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
			// Uninstall mode
			if uninstallMode {
				return runUninstall()
			}

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
						// Neither .prism/ nor thoughts/ — launch onboarding to create it
						onboardingMode = true
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

			// Register project in global workspace registry (silent, best-effort)
			if projectDir != "" && !demoMode {
				registry.Register(projectDir, version)
			}

			return nil
		},
	}

	rootCmd.Flags().StringVarP(&storiesFile, "file", "f", "", "Path to stories.json")
	rootCmd.Flags().IntVarP(&maxIterations, "max-iterations", "n", 50, "Maximum iterations before stopping")
	rootCmd.Flags().IntVarP(&pause, "pause", "p", 2, "Seconds to pause between iterations")
	rootCmd.Flags().BoolVar(&demoMode, "demo", false, "Run in demo mode with simulated stories to preview animations")
	rootCmd.Flags().BoolVar(&onboardingMode, "onboarding", false, "Force onboarding flow (for testing/refining the setup wizard)")
	rootCmd.Flags().StringVar(&prismStyle, "prism-style", "gradient", "Prism animation style: gradient|simple|braille|ascii")
	rootCmd.Flags().BoolVar(&uninstallMode, "uninstall", false, "Remove prism-cli binary, PATH entries, and global ~/.prism/ directory")

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

// runUninstall removes prism-cli binary, PATH entries from shell profiles,
// and optionally the global ~/.prism/ directory.
func runUninstall() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}
	prismHome := filepath.Join(home, ".prism")

	fmt.Println("Prism CLI Uninstaller")
	fmt.Println()
	fmt.Printf("  Binary:     %s\n", filepath.Join(prismHome, "bin", "prism-cli"))
	fmt.Printf("  Global dir: %s\n", prismHome)
	fmt.Println()
	fmt.Print("Remove prism-cli completely? This will remove the binary, PATH entries,\nand the global ~/.prism/ directory (including workspaces.json).\n")
	fmt.Println()
	fmt.Print("Type 'yes' to confirm: ")

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Scan()
	answer := strings.TrimSpace(scanner.Text())
	if answer != "yes" {
		fmt.Println("Uninstall cancelled.")
		return nil
	}

	fmt.Println()

	// 1. Remove binary
	for _, name := range []string{"prism-cli", "prism-cli.exe"} {
		binPath := filepath.Join(prismHome, "bin", name)
		if err := os.Remove(binPath); err == nil {
			fmt.Printf("  Removed %s\n", binPath)
		}
	}

	// 2. Clean shell profiles
	cleanedProfiles := cleanShellProfiles(home)
	for _, p := range cleanedProfiles {
		fmt.Printf("  Cleaned %s\n", p)
	}

	// 3. Clean PowerShell profile (Windows only)
	if runtime.GOOS == "windows" {
		if cleaned := cleanPowerShellProfile(); cleaned != "" {
			fmt.Printf("  Cleaned %s\n", cleaned)
		}
	}

	// 4. Remove global ~/.prism/ directory
	if err := os.RemoveAll(prismHome); err != nil {
		fmt.Printf("  Warning: could not fully remove %s: %v\n", prismHome, err)
	} else {
		fmt.Printf("  Removed %s\n", prismHome)
	}

	fmt.Println()
	fmt.Println("Prism CLI uninstalled.")
	fmt.Println()
	fmt.Println("  Note: Per-project .prism/ directories were NOT touched.")
	fmt.Println("        Remove them manually if no longer needed.")
	fmt.Println()
	fmt.Println("  To reinstall: /prism:cli-install")

	return nil
}

// cleanShellProfiles removes Prism CLI PATH entries from bash/zsh profiles.
func cleanShellProfiles(home string) []string {
	var cleaned []string
	profiles := []string{
		filepath.Join(home, ".zshrc"),
		filepath.Join(home, ".bashrc"),
		filepath.Join(home, ".bash_profile"),
	}

	for _, profile := range profiles {
		if removeLinesFromFile(profile, ".prism/bin", "# Prism CLI") {
			cleaned = append(cleaned, profile)
		}
	}
	return cleaned
}

// cleanPowerShellProfile removes Prism CLI entries from the PowerShell profile.
func cleanPowerShellProfile() string {
	// Try pwsh first, fall back to powershell
	pwshCmd := "pwsh.exe"
	if _, err := exec.LookPath(pwshCmd); err != nil {
		pwshCmd = "powershell.exe"
		if _, err := exec.LookPath(pwshCmd); err != nil {
			return ""
		}
	}

	out, err := exec.Command(pwshCmd, "-NoProfile", "-Command", "echo $PROFILE").Output()
	if err != nil {
		return ""
	}
	profilePath := strings.TrimSpace(string(out))
	if profilePath == "" {
		return ""
	}

	if removeLinesFromFile(profilePath, ".prism", "# Prism CLI") {
		return profilePath
	}
	return ""
}

// removeLinesFromFile removes lines containing any of the given markers from a file.
// Returns true if the file was modified.
func removeLinesFromFile(filePath string, markers ...string) bool {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	lines := strings.Split(string(data), "\n")
	var kept []string
	removed := false

	for _, line := range lines {
		skip := false
		for _, marker := range markers {
			if strings.Contains(line, marker) {
				skip = true
				removed = true
				break
			}
		}
		if !skip {
			kept = append(kept, line)
		}
	}

	if !removed {
		return false
	}

	// Clean up consecutive blank lines
	var final []string
	prevBlank := false
	for _, line := range kept {
		isBlank := strings.TrimSpace(line) == ""
		if isBlank && prevBlank {
			continue
		}
		final = append(final, line)
		prevBlank = isBlank
	}

	os.WriteFile(filePath, []byte(strings.Join(final, "\n")), 0644)
	return true
}
