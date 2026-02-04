package claude

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// Runner manages Claude CLI execution
type Runner struct {
	projectDir   string
	storiesPath  string
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	outputBuffer strings.Builder
	mu           sync.Mutex
	running      bool
}

// NewRunner creates a new Claude runner
func NewRunner(projectDir, storiesPath string) *Runner {
	return &Runner{
		projectDir:  projectDir,
		storiesPath: storiesPath,
	}
}

// ClaudeStartedMsg indicates Claude process has started
type ClaudeStartedMsg struct {
	StoryID   string
	Iteration int
}

// ClaudeOutputMsg carries streaming output from Claude
type ClaudeOutputMsg struct {
	Text     string
	IsStderr bool
}

// ClaudeFinishedMsg indicates Claude process completed
type ClaudeFinishedMsg struct {
	ExitCode int
	Output   string
	Duration time.Duration
	Error    error
}

// RunClaudeCmd returns a tea.Cmd that runs Claude and returns when complete
func RunClaudeCmd(projectDir, storiesPath string, iteration int) tea.Cmd {
	return func() tea.Msg {
		startTime := time.Now()

		// Build the prompt
		prompt := fmt.Sprintf(
			"Execute the next story from %s using the /prism-ralph workflow.",
			storiesPath,
		)

		// Create command with context for cancellation
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx,
			"claude",
			"--dangerously-skip-permissions",
			"--print",
			prompt,
		)
		cmd.Dir = projectDir

		// Capture combined output
		output, err := cmd.CombinedOutput()
		duration := time.Since(startTime)

		exitCode := 0
		if cmd.ProcessState != nil {
			exitCode = cmd.ProcessState.ExitCode()
		}

		return ClaudeFinishedMsg{
			ExitCode: exitCode,
			Output:   string(output),
			Duration: duration,
			Error:    err,
		}
	}
}

// RunClaudeStreamingCmd runs Claude with streaming output via channel
// Returns a tea.Cmd that sends ClaudeOutputMsg for each line and ClaudeFinishedMsg at the end
func RunClaudeStreamingCmd(projectDir, storiesPath string, iteration int, outputChan chan<- tea.Msg) tea.Cmd {
	return func() tea.Msg {
		startTime := time.Now()

		prompt := fmt.Sprintf(
			"Execute the next story from %s using the /prism-ralph workflow.",
			storiesPath,
		)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx,
			"claude",
			"--dangerously-skip-permissions",
			"--print",
			prompt,
		)
		cmd.Dir = projectDir

		// Get pipes for streaming
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return ClaudeFinishedMsg{Error: err}
		}
		stderr, err := cmd.StderrPipe()
		if err != nil {
			return ClaudeFinishedMsg{Error: err}
		}

		// Start the process
		if err := cmd.Start(); err != nil {
			return ClaudeFinishedMsg{Error: err}
		}

		// Collect output while streaming
		var outputBuf strings.Builder
		var wg sync.WaitGroup

		// Stream stdout
		wg.Add(1)
		go func() {
			defer wg.Done()
			streamOutput(stdout, &outputBuf, false, outputChan)
		}()

		// Stream stderr
		wg.Add(1)
		go func() {
			defer wg.Done()
			streamOutput(stderr, &outputBuf, true, outputChan)
		}()

		// Wait for streams to finish
		wg.Wait()

		// Wait for process to complete
		err = cmd.Wait()
		duration := time.Since(startTime)

		exitCode := 0
		if cmd.ProcessState != nil {
			exitCode = cmd.ProcessState.ExitCode()
		}

		return ClaudeFinishedMsg{
			ExitCode: exitCode,
			Output:   outputBuf.String(),
			Duration: duration,
			Error:    err,
		}
	}
}

// streamOutput reads from a pipe and sends output messages
func streamOutput(pipe io.ReadCloser, buf *strings.Builder, isStderr bool, outputChan chan<- tea.Msg) {
	scanner := bufio.NewScanner(pipe)
	// Increase buffer size for long lines
	const maxScanTokenSize = 1024 * 1024 // 1MB
	scanBuf := make([]byte, maxScanTokenSize)
	scanner.Buffer(scanBuf, maxScanTokenSize)

	for scanner.Scan() {
		line := scanner.Text()
		buf.WriteString(line + "\n")

		if outputChan != nil {
			outputChan <- ClaudeOutputMsg{
				Text:     line,
				IsStderr: isStderr,
			}
		}
	}
}

// TerminateProcess kills the Claude process and its children
func TerminateProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	if runtime.GOOS == "windows" {
		// On Windows, use taskkill for tree kill
		kill := exec.Command("taskkill", "/F", "/T", "/PID",
			strconv.Itoa(cmd.Process.Pid))
		return kill.Run()
	}

	// On Unix, kill the process directly
	// Note: For proper process group kill, would need to set Setpgid
	return cmd.Process.Kill()
}

// IsRunning returns true if a Claude process is currently running
func (r *Runner) IsRunning() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.running
}

// GetOutput returns the captured output so far
func (r *Runner) GetOutput() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.outputBuffer.String()
}

// Cancel stops the current Claude process if running
func (r *Runner) Cancel() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cancel != nil {
		r.cancel()
	}
	if r.cmd != nil {
		TerminateProcess(r.cmd)
	}
	r.running = false
}
