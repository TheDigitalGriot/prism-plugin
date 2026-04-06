package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/prism-plugin/prism-cli/agentbus"
)

// ConversationConfig holds parameters for starting a conversation session.
type ConversationConfig struct {
	ProjectDir   string        // Working directory for the Claude CLI process
	SessionID    string        // For --resume; empty starts a new conversation
	Model        string        // Optional model override (e.g., "claude-opus-4-6")
	SystemPrompt string        // Optional system prompt
	AllowedTools []string      // Tool allowlist (nil = all tools)
	MaxTurns     int           // 0 = unlimited
	Timeout      time.Duration // Per-turn timeout (0 = no timeout)
}

// ConversationHandle lets the caller interact with a running conversation.
type ConversationHandle struct {
	Stdin  io.WriteCloser // Write messages here
	Cancel context.CancelFunc
	Cmd    *exec.Cmd
}

// ConvStartedMsg is sent to the Bubble Tea runtime when the process is up.
// Exported so the app package can receive it.
type ConvStartedMsg struct {
	Handle    *ConversationHandle
	SessionID string
}

// RunConversationCmd starts a persistent Claude CLI subprocess that streams
// events through the agentbus. It returns a tea.Cmd that resolves to a
// convStartedMsg (for the plugin to capture the stdin pipe) once the process
// is started, and continues emitting bus events asynchronously.
//
// RunConversationCmd is additive — it does NOT touch RunClaudeCmd or
// RunClaudeStreamingCmd used by Spectrum.
func RunConversationCmd(config ConversationConfig, bus *agentbus.Bus) tea.Cmd {
	return func() tea.Msg {
		args := []string{
			"--output-format", "stream-json",
			"--verbose",
			"--input-format", "stream-json",
		}
		if config.SessionID != "" {
			args = append(args, "--resume", config.SessionID)
		}
		if config.Model != "" {
			args = append(args, "--model", config.Model)
		}
		for _, tool := range config.AllowedTools {
			args = append(args, "--allowedTools", tool)
		}

		var ctx context.Context
		var cancel context.CancelFunc
		if config.Timeout > 0 {
			ctx, cancel = context.WithTimeout(context.Background(), config.Timeout)
		} else {
			ctx, cancel = context.WithCancel(context.Background())
		}

		cmd := exec.CommandContext(ctx, "claude", args...)
		if config.ProjectDir != "" {
			cmd.Dir = config.ProjectDir
		}

		stdin, err := cmd.StdinPipe()
		if err != nil {
			cancel()
			return ConvStartedMsg{Handle: nil}
		}

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			cancel()
			return ConvStartedMsg{Handle: nil}
		}

		stderr, err := cmd.StderrPipe()
		if err != nil {
			cancel()
			return ConvStartedMsg{Handle: nil}
		}

		if err := cmd.Start(); err != nil {
			cancel()
			bus.Publish(agentbus.Event{
				Type:      agentbus.EventStreamError,
				Timestamp: time.Now(),
				Error:     fmt.Errorf("claude CLI failed to start: %w", err),
			})
			return ConvStartedMsg{Handle: nil}
		}

		handle := &ConversationHandle{
			Stdin:  stdin,
			Cancel: cancel,
			Cmd:    cmd,
		}

		bus.Publish(agentbus.Event{
			Type:      agentbus.EventProcessStarted,
			Timestamp: time.Now(),
			SessionID: config.SessionID,
		})

		// Subscribe to permission responses and route them back to Claude CLI stdin.
		unsub := bus.Subscribe(func(e agentbus.Event) {
			if e.Type == agentbus.EventPermissionResponse && e.PermResp != nil {
				_ = SendPermissionResponse(stdin, e.PermResp.RequestID, e.PermResp.Action)
			}
		})
		// Unsubscribe when the process exits (cleaned up in monitor goroutine below).
		_ = unsub // captured by the monitor goroutine closure

		// Stream stdout and stderr concurrently, bridging to bus.
		var wg sync.WaitGroup

		wg.Add(1)
		go func() {
			defer wg.Done()
			streamConversationOutput(stdout, false, config.SessionID, bus)
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			streamConversationOutput(stderr, true, config.SessionID, bus)
		}()

		// Monitor process exit in a separate goroutine.
		go func() {
			wg.Wait()
			unsub() // stop routing permission responses after process exits
			startTime := time.Now()
			err := cmd.Wait()
			exitCode := 0
			if cmd.ProcessState != nil {
				exitCode = cmd.ProcessState.ExitCode()
			}
			bus.Publish(agentbus.Event{
				Type:      agentbus.EventProcessExited,
				Timestamp: time.Now(),
				SessionID: config.SessionID,
				ExitCode:  exitCode,
				Duration:  time.Since(startTime),
				Error:     err,
			})
			cancel()
		}()

		return ConvStartedMsg{
			Handle:    handle,
			SessionID: config.SessionID,
		}
	}
}

// SendMessage writes a user message to the Claude CLI subprocess's stdin.
// With --input-format stream-json, the CLI expects newline-delimited JSON
// following the Agent SDK protocol.
func SendMessage(stdin io.WriteCloser, message string) error {
	envelope := map[string]any{
		"type":               "user",
		"session_id":         "",
		"message":            map[string]any{"role": "user", "content": message},
		"parent_tool_use_id": nil,
	}
	data, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal user message: %w", err)
	}
	_, err = io.WriteString(stdin, string(data)+"\n")
	return err
}

// SendPermissionResponse writes a permission decision to the Claude CLI subprocess.
func SendPermissionResponse(stdin io.WriteCloser, requestID, action string) error {
	response := map[string]any{
		"type": "control_response",
		"response": map[string]any{
			"subtype":    "success",
			"request_id": requestID,
			"response": map[string]any{
				"behavior": action,
			},
		},
	}
	data, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("marshal permission response: %w", err)
	}
	_, err = io.WriteString(stdin, string(data)+"\n")
	return err
}

// BridgeStreamToBus converts a parsed StreamEvent into one or more agentbus
// Events and publishes them. Called from streamConversationOutput.
func BridgeStreamToBus(event *StreamEvent, bus *agentbus.Bus, sessionID string) {
	if event == nil {
		return
	}
	now := time.Now()

	switch event.Type {
	case "assistant":
		if event.Message == nil {
			return
		}
		for _, block := range event.Message.Content {
			switch block.Type {
			case "text":
				if block.Text != "" {
					bus.Publish(agentbus.Event{
						Type:      agentbus.EventTextDelta,
						Timestamp: now,
						SessionID: sessionID,
						Text:      block.Text,
					})
				}
			case "thinking":
				if block.Thinking != "" {
					bus.Publish(agentbus.Event{
						Type:      agentbus.EventThinkingDelta,
						Timestamp: now,
						SessionID: sessionID,
						Text:      block.Thinking,
					})
				}
			case "tool_use":
				inputJSON, _ := json.Marshal(block.Input)
				// Detect Task tool spawning subagents.
				if block.Name == "Task" {
					var taskInput struct {
						Description string `json:"description"`
						SubagentType string `json:"subagent_type"`
					}
					_ = json.Unmarshal(block.Input, &taskInput)
					bus.Publish(agentbus.Event{
						Type:      agentbus.EventAgentSpawnStart,
						Timestamp: now,
						SessionID: sessionID,
						ToolID:    block.ToolUseID,
						AgentDesc: taskInput.Description,
						AgentType: taskInput.SubagentType,
					})
				} else {
					bus.Publish(agentbus.Event{
						Type:       agentbus.EventToolCallStart,
						Timestamp:  now,
						SessionID:  sessionID,
						ToolName:   block.Name,
						ToolInput:  inputJSON,
						ToolID:     block.ToolUseID,
						ToolStatus: "running",
					})
				}
			}
		}

	case "tool_result":
		toolStatus := "complete"
		if event.IsError {
			toolStatus = "error"
		}
		bus.Publish(agentbus.Event{
			Type:       agentbus.EventToolCallComplete,
			Timestamp:  now,
			SessionID:  sessionID,
			ToolID:     event.ToolUseID,
			ToolStatus: toolStatus,
		})

	case "result":
		bus.Publish(agentbus.Event{
			Type:      agentbus.EventMessageComplete,
			Timestamp: now,
			SessionID: sessionID,
			Text:      event.Result,
		})

	case "permission_request":
		if event.PermissionRequest != nil {
			pr := event.PermissionRequest
			bus.Publish(agentbus.Event{
				Type:      agentbus.EventPermissionRequired,
				Timestamp: now,
				SessionID: sessionID,
				Permission: &agentbus.PermissionRequest{
					ID:          pr.ID,
					ToolName:    pr.ToolName,
					Description: pr.Description,
					Preview:     pr.Preview,
					SessionID:   sessionID,
				},
			})
		}

	case "usage":
		if event.Usage != nil {
			bus.Publish(agentbus.Event{
				Type:         agentbus.EventCostUpdate,
				Timestamp:    now,
				SessionID:    sessionID,
				InputTokens:  event.Usage.InputTokens,
				OutputTokens: event.Usage.OutputTokens,
				Model:        event.Usage.Model,
			})
		}

	case "system":
		// system init event — ignore
	}
}

// streamConversationOutput reads from a conversation pipe (stdout or stderr),
// parses stream-json events, and bridges them to the bus.
func streamConversationOutput(pipe io.ReadCloser, isStderr bool, sessionID string, bus *agentbus.Bus) {
	defer pipe.Close()

	scanner := bufio.NewScanner(pipe)
	const maxScanTokenSize = 1024 * 1024 // 1MB
	scanBuf := make([]byte, maxScanTokenSize)
	scanner.Buffer(scanBuf, maxScanTokenSize)

	parser := NewOutputParser()

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// Try to parse as stream-json event.
		event, err := ParseStreamEvent(line)
		if err != nil {
			// Raw line — publish as text delta if not stderr noise.
			if !isStderr {
				bus.Publish(agentbus.Event{
					Type:      agentbus.EventTextDelta,
					Timestamp: time.Now(),
					SessionID: sessionID,
					Text:      line,
				})
			}
			continue
		}

		// Bridge structured events to the bus.
		BridgeStreamToBus(event, bus, sessionID)

		// Also run through the OutputParser for phase/signal detection.
		for _, pe := range parser.ParseLine(line) {
			switch pe.Type {
			case EventPhaseChanged:
				bus.Publish(agentbus.Event{
					Type:      agentbus.EventPhaseChanged,
					Timestamp: time.Now(),
					SessionID: sessionID,
					Phase:     pe.Phase,
				})
			case EventSignalDetected:
				bus.Publish(agentbus.Event{
					Type:      agentbus.EventSignalDetected,
					Timestamp: time.Now(),
					SessionID: sessionID,
					Signal:    pe.Signal,
				})
			}
		}
	}
}
