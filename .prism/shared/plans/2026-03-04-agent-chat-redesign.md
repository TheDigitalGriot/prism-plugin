# Agent Chat Redesign — Bulletproof Interactive Streaming Chat

**Date**: 2026-03-04
**Type**: Implementation Plan
**Status**: Draft — Awaiting Approval
**Predecessor**: `research/2026-03-04-agent-chat-opencode-codebuff-analysis.md`
**Target**: `cmd/prism-cli/` (with cross-platform preparation for VSCode + Electron)

---

## Overview

Transform the prism-cli Agent screen from a read-only session browser with placeholder chat into a **hardened, interactive, streaming conversation interface** backed by the Claude CLI subprocess. This is the primary interface to the entire Prism plugin ecosystem.

### Design Decisions (User-Confirmed)
- **Conversation mode**: Persistent Claude CLI subprocess (not one-shot `--print`)
- **Multi-adapter**: Claude Code, Codex, and Cursor adapters
- **Hybrid persistence**: Session store + native Claude JSONL for Claude Code sessions
- **Cross-platform**: Event bus architecture preparing for VSCode + Electron

### Reference Implementations Studied
- **OpenCode** (116k stars): Event bus, SQLite sessions, Dialog stack, Permission/Question prompts, Part-based messages, InlineTool/BlockTool rendering, SessionProcessor while-loop, progressive timeline staging
- **Codebuff** (3.6k stars): StreamController, AskUserBridge pub/sub, MultipleChoiceForm accordion, GridLayout multi-column parallel agents, BatchedMessageUpdater, discriminated union event protocol

---

## Phase 1: Event Bus & Message Types (Foundation)

**Goal**: Create the `agentbus/` package that decouples agent execution from UI rendering, enabling all three platforms to consume the same events.

### Files to Create

#### `cmd/prism-cli/agentbus/bus.go`
Event bus with publish/subscribe, thread-safe:
```go
package agentbus

type Bus struct {
    subscribers []func(Event)
    mu          sync.RWMutex
}

func New() *Bus
func (b *Bus) Publish(event Event)
func (b *Bus) Subscribe(handler func(Event)) (unsubscribe func())
```

#### `cmd/prism-cli/agentbus/events.go`
Discriminated event types (inspired by Codebuff's PrintModeEvent + OpenCode's Bus events):
```go
type EventType int
const (
    EventTextDelta          EventType = iota // Streaming text from assistant
    EventTextComplete                        // Full text block complete
    EventToolCallStart                       // Tool invocation begins
    EventToolCallComplete                    // Tool invocation ends (success/error)
    EventToolCallProgress                    // Intermediate tool status update
    EventAgentSpawnStart                     // Subagent started (Task tool)
    EventAgentSpawnFinish                    // Subagent completed
    EventPhaseChanged                        // Execution phase changed
    EventSignalDetected                      // Prism signal detected
    EventPermissionRequired                  // Tool needs user approval
    EventQuestionAsked                       // Claude asks user a question (AskUserQuestion)
    EventSessionCreated                      // New session started
    EventSessionResumed                      // Existing session continued
    EventMessageComplete                     // Full assistant turn complete
    EventStreamError                         // Error during streaming
    EventProcessStarted                      // Claude CLI subprocess started
    EventProcessExited                       // Claude CLI subprocess exited
    EventCostUpdate                          // Token/cost information
)

type Event struct {
    Type      EventType
    Timestamp time.Time
    SessionID string

    // Text events
    Text string

    // Tool events
    ToolName   string
    ToolInput  json.RawMessage
    ToolOutput string
    ToolStatus string // "running", "complete", "error"
    ToolID     string

    // Agent events
    AgentID       string
    AgentType     string
    AgentDesc     string
    ParentAgentID string

    // Phase/signal events
    Phase  string
    Signal domain.Signal

    // Permission events
    Permission *PermissionRequest

    // Question events
    Question *QuestionRequest

    // Process events
    ExitCode int
    Duration time.Duration
    Error    error

    // Cost events
    InputTokens  int
    OutputTokens int
    Model        string
}
```

#### `cmd/prism-cli/agentbus/permission.go`
Permission request/response types:
```go
type PermissionRequest struct {
    ID          string
    ToolName    string
    Description string
    Preview     string // Command text or file diff
    SessionID   string
}

type PermissionResponse struct {
    RequestID string
    Action    string // "allow", "allow_session", "deny"
}
```

#### `cmd/prism-cli/agentbus/question.go`
User question types (matching Claude's AskUserQuestion tool schema):
```go
type QuestionRequest struct {
    ID        string
    SessionID string
    Questions []Question
}

type Question struct {
    Text        string
    Header      string
    Options     []QuestionOption
    MultiSelect bool
}

type QuestionOption struct {
    Label       string
    Description string
}

type QuestionResponse struct {
    RequestID string
    Answers   map[string]string // question text → selected answer
    Skipped   bool
}
```

### Verification
- [ ] `go build ./agentbus/...` compiles
- [ ] Unit test: Bus.Publish() → subscriber receives event
- [ ] Unit test: Unsubscribe removes handler
- [ ] Unit test: Concurrent publish/subscribe is safe

---

## Phase 2: Session Store (Hybrid Persistence)

**Goal**: Create a session store that manages active sessions and integrates with Claude's native JSONL for historical sessions. Supports future Codex and Cursor adapters.

### Files to Create

#### `cmd/prism-cli/agentbus/session.go`
Session management types and store:
```go
type SessionState int
const (
    SessionIdle    SessionState = iota // Historical session (from adapter scan)
    SessionActive                      // Currently running conversation
    SessionPaused                      // Subprocess paused/disconnected
)

type ManagedSession struct {
    Session   adapter.Session
    State     SessionState
    Messages  []chat.Message  // In-memory message buffer
    ProcessID int             // Claude CLI PID (0 if not running)
    ClaudeSessionID string   // Claude's internal session ID for --resume
}
```

#### `cmd/prism-cli/agentbus/store.go`
Session store with CRUD:
```go
type Store struct {
    mu             sync.RWMutex
    activeSessions map[string]*ManagedSession // sessionID → session
    bus            *Bus
}

func NewStore(bus *Bus) *Store
func (s *Store) Create(projectDir string) *ManagedSession
func (s *Store) Get(sessionID string) *ManagedSession
func (s *Store) AddMessage(sessionID string, msg chat.Message)
func (s *Store) UpdateState(sessionID string, state SessionState)
func (s *Store) List() []*ManagedSession
```

### Files to Modify

#### `cmd/prism-cli/app/adapter/adapter.go`
Add `SupportsWrite() bool` to the Adapter interface for adapters that can persist messages (not just read):
```go
type Adapter interface {
    ID() string
    Name() string
    Available() bool
    ScanSessions() ([]Session, error)
    LoadMessages(sessionPath string) ([]chat.Message, error)
    SupportsWrite() bool // NEW
}
```

#### `cmd/prism-cli/app/adapter/claude.go`
Implement `SupportsWrite() bool { return true }` — Claude adapter can write back to JSONL.

### Verification
- [ ] Unit test: Store.Create() generates unique session IDs
- [ ] Unit test: Store.AddMessage() appends correctly
- [ ] Unit test: Store.List() returns all active sessions
- [ ] `go build ./...` compiles

---

## Phase 3: Generalized Claude Runner (Conversation Mode)

**Goal**: Refactor `claude/runner.go` from Spectrum-specific to general-purpose conversation mode. Support persistent subprocess with stdin/stdout streaming.

### Files to Modify

#### `cmd/prism-cli/claude/runner.go`

**3a. Add `RunConversationCmd()` — persistent subprocess**

New function that keeps Claude CLI alive as a persistent subprocess, accepting input via stdin and streaming output via stdout. This is the conversation mode (not one-shot `--print`):

```go
// ConversationConfig holds parameters for starting a conversation
type ConversationConfig struct {
    ProjectDir      string
    SessionID       string // For --resume, empty for new conversation
    Model           string // Optional model override
    SystemPrompt    string // Optional system prompt
    AllowedTools    []string // Tool allowlist (empty = all)
    MaxTurns        int    // 0 = unlimited
    Timeout         time.Duration // Per-turn timeout
}

// RunConversationCmd starts a persistent Claude CLI subprocess
// that streams output via the event bus
func RunConversationCmd(config ConversationConfig, bus *agentbus.Bus) tea.Cmd
```

Implementation details:
- Spawn `claude --output-format stream-json --verbose` (NO `--print` flag = conversation mode)
- If `config.SessionID != ""`, add `--resume <sessionID>`
- Connect stdin pipe for sending follow-up messages
- Stream stdout through existing `streamOutput()` → parse events → `bus.Publish()`
- Handle process lifecycle: start → running → exit
- Graceful shutdown via context cancellation + `TerminateProcess()`

**3b. Add `SendMessage()` — write to stdin pipe**

```go
// SendMessage writes a message to the running Claude CLI subprocess stdin
func SendMessage(stdin io.WriteCloser, message string) error
```

**3c. Keep existing `RunClaudeStreamingCmd()` and `RunClaudeCmd()` for Spectrum**

Don't break Spectrum. The new functions are additive.

**3d. Add event bridge — stream events to bus**

New function that bridges the existing `streamOutput()` parsing to `agentbus.Event` types:

```go
// BridgeStreamToBus converts parsed StreamEvents to agentbus.Events
func BridgeStreamToBus(event *StreamEvent, bus *agentbus.Bus, sessionID string)
```

Maps:
- `StreamEvent{Type: "assistant"}` with text → `EventTextDelta`
- `StreamEvent{Type: "assistant"}` with tool_use → `EventToolCallStart`
- `StreamEvent{Type: "tool_result"}` → `EventToolCallComplete`
- `StreamEvent{Type: "result"}` → `EventMessageComplete`
- Phase detection via `OutputParser.ParseLine()` → `EventPhaseChanged`
- Signal detection → `EventSignalDetected`

### Files to Create

#### `cmd/prism-cli/claude/conversation.go`
Dedicated file for conversation mode logic, keeping `runner.go` focused on one-shot/Spectrum execution.

### Verification
- [ ] `go build ./claude/...` compiles
- [ ] Existing `RunClaudeStreamingCmd` tests still pass (no regression)
- [ ] Unit test: `BridgeStreamToBus` correctly maps all event types
- [ ] Integration test: spawn Claude CLI in conversation mode, send a simple prompt, receive streaming response

---

## Phase 4: Enhanced Message Model

**Goal**: Upgrade the chat.Message type from flat text to a structured part-based model (inspired by OpenCode's Part system) that supports text, tool calls, tool results, thinking, and agent spawns.

### Files to Modify

#### `cmd/prism-cli/app/chat/renderer.go`

**4a. Expand message model with structured parts**

```go
// ContentPart represents a structured part of a message
type ContentPart struct {
    Type       PartType
    Text       string          // For TextPart
    ToolName   string          // For ToolPart
    ToolInput  string          // For ToolPart (human-readable summary)
    ToolOutput string          // For ToolResultPart
    ToolStatus string          // "running", "complete", "error"
    ToolID     string          // Links tool_use to tool_result
    AgentID    string          // For AgentPart
    AgentName  string          // For AgentPart
    AgentParts []ContentPart   // Nested parts for subagent output
}

type PartType int
const (
    PartText       PartType = iota
    PartToolCall
    PartToolResult
    PartThinking
    PartAgent
)
```

**4b. Add Parts field to Message**

```go
type Message struct {
    Type    string
    Content string          // Legacy flat text (still used for user messages)
    Parts   []ContentPart   // Structured parts for assistant messages
    ToolID  string
    Status  string
}
```

**4c. Upgrade renderers for part-based messages**

- `renderAssistantMessage()` — iterate Parts: render text parts with markdown, render tool parts as indicators, render agent parts as collapsible blocks
- Keep backward compatibility: if `Parts` is empty, fall back to rendering `Content` as flat text (for historical sessions loaded from JSONL)
- Tool parts: two tiers (inspired by OpenCode's InlineTool/BlockTool)
  - **Inline**: Single-line status indicator for simple tools (Read, Glob, Grep) — current `✓`/`✗`/`▸` style
  - **Block**: Multi-line expandable block for complex tools (Bash, Edit, Write) — show preview of input/output

**4d. Add agent part rendering**

For Task tool calls (subagents), render as collapsible sections with:
- Agent name + type + status indicator
- Collapsed: single-line summary with bullet prefix (like Codebuff's `• agent-name`)
- Expanded: full nested content with indentation

### Verification
- [ ] Existing message rendering works unchanged (backward compatible)
- [ ] Part-based messages render correctly with mixed text + tool + agent parts
- [ ] Tool parts show inline/block modes correctly
- [ ] Agent parts collapse/expand correctly

---

## Phase 5: Multi-line Input (textarea Replacement)

**Goal**: Replace the single-line `textinput` with `textarea` for multi-line input. Add keyboard shortcuts for send, cancel, and newlines.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**5a. Replace textinput with textarea in AgentState**

```go
import "github.com/charmbracelet/bubbles/textarea"

type AgentState struct {
    // ...
    Input        textarea.Model  // CHANGED from textinput.Model
    // ...
}
```

**5b. Configure textarea**

```go
ta := textarea.New()
ta.Placeholder = "Type a message… (Enter to send, Shift+Enter for newline)"
ta.CharLimit = 10000 // Generous limit
ta.SetWidth(50)
ta.SetHeight(3) // Start with 3 lines, grow dynamically
ta.ShowLineNumbers = false
ta.FocusedStyle.CursorLine = lipgloss.NewStyle() // No cursor line highlight
ta.KeyMap.InsertNewline.SetKeys("shift+enter") // Shift+Enter for newline
```

**5c. Dynamic height**

The textarea should grow from 1 line to a max of 8 lines based on content, then scroll internally. Calculate line count from content and adjust `SetHeight()` in the Update loop.

**5d. Send on Enter, newline on Shift+Enter**

In the Update handler, intercept `enter` (without shift) to trigger `sendMessage()` instead of inserting a newline. `shift+enter` inserts the newline.

**5e. Escape to cancel/blur**

Pressing Escape while textarea is focused should:
1. If text is present: clear the text and stay focused
2. If text is empty: blur the textarea (return focus to message viewport)

### Verification
- [ ] Enter sends message (does not insert newline)
- [ ] Shift+Enter inserts newline
- [ ] Textarea grows dynamically with content (1-8 lines)
- [ ] Escape clears text or blurs
- [ ] Paste multi-line content works correctly

---

## Phase 6: Wire Agent Plugin to Event Bus + Claude Conversation

**Goal**: Connect the Agent plugin to the event bus and Claude conversation mode. Replace the placeholder `sendMessage()` with real Claude CLI integration.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**6a. Add event bus and conversation state to AgentPlugin**

```go
type AgentPlugin struct {
    // ... existing fields ...
    bus           *agentbus.Bus
    store         *agentbus.Store
    conversation  *agentbus.ManagedSession // Active conversation
    stdinPipe     io.WriteCloser           // Claude CLI stdin
    streaming     bool                     // Currently receiving response
    streamingText strings.Builder          // Accumulator for current text delta
    pendingPerm   *agentbus.PermissionRequest  // Current permission dialog
    pendingQ      *agentbus.QuestionRequest    // Current question dialog
}
```

**6b. Replace sendMessage() with real Claude CLI invocation**

```go
func (p *AgentPlugin) sendMessage() tea.Cmd {
    content := strings.TrimSpace(p.state.Input.Value())
    if content == "" || p.streaming {
        return nil
    }

    userMsg := chat.Message{Type: chat.MessageTypeUser, Content: content}
    p.state.Messages = append(p.state.Messages, userMsg)
    p.state.Input.Reset()

    if p.stdinPipe != nil {
        // Send to existing conversation
        return func() tea.Msg {
            err := claude.SendMessage(p.stdinPipe, content)
            if err != nil {
                return StreamErrorMsg{Error: err}
            }
            return nil
        }
    }

    // Start new conversation
    config := claude.ConversationConfig{
        ProjectDir: p.getProjectDir(),
    }
    return claude.RunConversationCmd(config, p.bus)
}
```

**6c. Subscribe to bus events and convert to Bubble Tea messages**

The bus subscriber converts agentbus.Events to Bubble Tea messages (tea.Msg) and sends them through a channel. A listener command picks them from the channel:

```go
// New message types for the Agent plugin
type StreamTextMsg struct{ Text string }
type StreamToolStartMsg struct{ Name, Input, ID string }
type StreamToolCompleteMsg struct{ ID, Output, Status string }
type StreamAgentStartMsg struct{ ID, Name, Type string }
type StreamAgentFinishMsg struct{ ID string }
type StreamPhaseMsg struct{ Phase string }
type StreamCompleteMsg struct{ Duration time.Duration }
type StreamErrorMsg struct{ Error error }
type PermissionRequestMsg struct{ Request *agentbus.PermissionRequest }
type QuestionRequestMsg struct{ Request *agentbus.QuestionRequest }
```

**6d. Handle streaming messages in Update()**

- `StreamTextMsg` → append text to current assistant message's text part, debounce Glamour re-render (every 100ms)
- `StreamToolStartMsg` → add new ToolCall part to current message
- `StreamToolCompleteMsg` → update existing ToolCall part status
- `StreamAgentStartMsg` → add Agent part, collapsible
- `StreamPhaseMsg` → update phase breadcrumb
- `StreamCompleteMsg` → finalize message, enable input
- `PermissionRequestMsg` → open PermissionDialog via overlay
- `QuestionRequestMsg` → open QuestionDialog via overlay

**6e. Auto-scroll during streaming**

When streaming is active and the user hasn't manually scrolled away from the bottom, auto-scroll the viewport to show new content. Track whether the user has scrolled manually (like OpenCode's boundary gesture detection).

### Verification
- [ ] Typing a message and pressing Enter spawns Claude CLI subprocess
- [ ] Streaming text appears in real-time in the chat viewport
- [ ] Tool call indicators appear as tools are invoked
- [ ] Multiple messages in a conversation maintain context (persistent subprocess)
- [ ] Auto-scroll follows new content
- [ ] Can scroll up to read history without auto-scroll fighting

---

## Phase 7: Permission Dialog Integration

**Goal**: When Claude CLI requests permission for a tool (detected from stream-json events), display the existing PermissionDialog overlay and send the user's decision back.

### How Claude CLI Permissions Work

Claude CLI with `--output-format stream-json` emits permission request events when a tool needs approval. The event contains the tool name, description, and a way to respond. In conversation mode, the response is sent back via stdin.

### Files to Modify

#### `cmd/prism-cli/claude/conversation.go`

**7a. Detect permission requests from stream events**

Parse stream-json events for permission prompts. When detected, emit `EventPermissionRequired` on the bus with the tool details.

**7b. Send permission response via stdin**

When the user responds to the permission dialog, write the response back to the Claude CLI subprocess stdin.

#### `cmd/prism-cli/app/plugin_agent.go`

**7c. Wire PermissionDialog to permission events**

```go
case PermissionRequestMsg:
    p.pendingPerm = msg.Request
    p.overlay.Open(dialog.NewPermission(
        msg.Request.ID,
        msg.Request.ToolName,
        msg.Request.Description,
        msg.Request.Preview,
    ))
    return p, nil
```

**7d. Handle dialog result**

When the dialog returns an action (Allow/AllowSession/Deny), send the response through the bus which routes it to the Claude CLI stdin pipe:

```go
case dialog.ActionAllow:
    p.bus.Publish(agentbus.Event{
        Type: agentbus.EventPermissionResponse,
        Permission: &agentbus.PermissionResponse{
            RequestID: p.pendingPerm.ID,
            Action:    "allow",
        },
    })
    p.pendingPerm = nil
    p.overlay.CloseFront()
```

### Verification
- [ ] Permission dialog appears when Claude requests tool approval
- [ ] "Allow" sends approval and Claude continues execution
- [ ] "Deny" sends denial and Claude handles gracefully
- [ ] "Allow Session" persists for the session duration
- [ ] Keyboard shortcuts (a/s/d) work within the dialog
- [ ] Input is blocked while permission dialog is showing

---

## Phase 8: Question Dialog (AskUserQuestion)

**Goal**: When Claude invokes the AskUserQuestion tool, render an interactive question form in the TUI (inspired by Codebuff's MultipleChoiceForm accordion).

### Files to Create

#### `cmd/prism-cli/dialog/question.go`

Full question dialog implementing the `dialog.Dialog` interface:

```go
type QuestionDialog struct {
    id            string
    questions     []agentbus.Question
    answers       [][]int      // Selected option indices per question
    customTexts   []string     // Custom text input per question
    customActive  []bool       // Whether custom input is active per question
    activeQuestion int         // Which question is expanded (accordion)
    focusedOption  int         // Which option has focus within active question
    focusedBtn    int          // 0=submit, 1=skip (when on submit row)
    mode          questionMode // options, custom, submit
}
```

Features (matching Codebuff's behavior):
- **Accordion layout**: One question expanded at a time, others show answered summary
- **Single-select**: Arrow keys navigate options, Enter selects and advances
- **Multi-select**: Space toggles options, Enter advances to next question
- **Custom text**: Last option is always "Other..." which opens a textarea
- **Submit/Skip**: Tab moves to submit button, Escape skips all questions
- **Progress indicator**: "Question 1 of 3" header with segment dots

Keyboard map:
- `↑`/`↓` — navigate options
- `Enter` — select option (single) or advance (multi)
- `Space` — toggle option (multi-select)
- `Tab` — move to submit button
- `Escape` — skip question(s)
- `←`/`→` — navigate between questions (accordion)

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

Wire QuestionDialog to `QuestionRequestMsg`:
```go
case QuestionRequestMsg:
    p.pendingQ = msg.Request
    p.overlay.Open(dialog.NewQuestion(
        msg.Request.ID,
        msg.Request.Questions,
    ))
```

Handle dialog submission → send response back to Claude CLI via stdin/bus.

### Verification
- [ ] Single-select question works with arrow keys and Enter
- [ ] Multi-select question works with Space toggle
- [ ] Custom text input activates when "Other..." is selected
- [ ] Accordion expands/collapses correctly
- [ ] Submit sends answers back to Claude CLI
- [ ] Skip sends skip response, Claude continues
- [ ] Input is blocked while question dialog is showing

---

## Phase 9: Parallel Agent Visualization

**Goal**: When Claude spawns subagents via the Task tool, render them as collapsible parallel blocks with streaming content (inspired by Codebuff's GridLayout and OpenCode's InlineTool/BlockTool).

### How It Works in Practice

Claude's `--output-format stream-json` emits events when the Task tool is invoked. Each subagent appears as a tool_use with `name: "Task"` and input containing `description` and `subagent_type`. We can track agent lifecycle through:
1. `tool_use` with `name: "Task"` → agent started
2. Streaming text/tool events with that tool_use_id → agent working
3. `tool_result` for that tool_use_id → agent completed

### Files to Modify

#### `cmd/prism-cli/app/chat/renderer.go`

**9a. Add agent block rendering**

```go
func renderAgentBlock(part ContentPart, width int, collapsed bool) string
```

Rendering rules:
- **Running + Collapsed**: `• agent-name ▸` with first line of content as italic preview
- **Running + Expanded**: Full content with indented nested parts
- **Complete + Collapsed**: `• agent-name ✓` with last line as muted summary
- **Complete + Expanded**: Full content
- **Multi-column**: When 2+ agents run in parallel at the same nesting level, consider side-by-side rendering (terminal width permitting, like Codebuff's GridLayout):
  - Width < 100: 1 column (stacked)
  - Width 100-149: 2 columns
  - Width 150+: 3 columns

**9b. Track active agents in AgentState**

```go
type AgentState struct {
    // ... existing ...
    ActiveAgents    map[string]*AgentTracker // toolID → tracker
    AgentCollapsed  map[string]bool          // agentID → collapsed
}

type AgentTracker struct {
    ID          string
    Name        string
    Type        string
    ParentID    string
    Status      string // "running", "complete", "error"
    ContentBuf  strings.Builder
    NestedParts []ContentPart
    StartTime   time.Time
}
```

**9c. Handle agent events in Update()**

- `StreamAgentStartMsg` → create AgentTracker, add PartAgent to current message
- `StreamToolStartMsg` with parent agent → add tool part to agent's nested parts
- `StreamAgentFinishMsg` → mark agent complete, finalize nested parts
- Toggle collapse with Enter/Space when agent block is focused

### Verification
- [ ] Agent blocks appear when Claude spawns subagents
- [ ] Streaming content updates within agent blocks in real-time
- [ ] Collapse/expand toggles correctly
- [ ] Completed agents show ✓ with summary
- [ ] Running agents show ▸ with live preview
- [ ] Multi-column layout activates at appropriate widths

---

## Phase 10: Streaming Markdown Rendering (Performance)

**Goal**: Optimize markdown rendering for streaming content to avoid janky re-renders on every text delta. Inspired by Codebuff's BatchedMessageUpdater.

### Strategy

1. **Buffer text deltas**: Accumulate incoming `StreamTextMsg` in a `strings.Builder`
2. **Debounced re-render**: Use a tick-based approach — re-render markdown every 100ms (not on every delta)
3. **Progressive rendering**: During streaming, render the last line as raw text (no markdown). Only apply full Glamour rendering to complete paragraphs/blocks.
4. **Viewport optimization**: Only re-render visible content. Messages above the viewport fold can be cached.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**10a. Add render debounce**

```go
type AgentState struct {
    // ... existing ...
    streamBuffer    strings.Builder // Accumulates text deltas
    lastRenderTime  time.Time       // When we last re-rendered
    renderDirty     bool            // Whether buffer has unrendered content
    renderedCache   map[int]string  // messageIndex → rendered HTML cache
}
```

**10b. Debounce tick**

During streaming, start a 100ms tick that triggers re-render if `renderDirty` is true:

```go
type RenderTickMsg struct{}

func renderTick() tea.Cmd {
    return tea.Tick(100*time.Millisecond, func(time.Time) tea.Msg {
        return RenderTickMsg{}
    })
}
```

On `RenderTickMsg`: flush `streamBuffer` → re-render current message → update viewport.

**10c. Cached message rendering**

Once a message is complete (not streaming), cache its rendered output in `renderedCache`. On viewport resize, invalidate cache.

#### `cmd/prism-cli/markdown/renderer.go`

**10d. Add incremental rendering option**

```go
// RenderStreaming renders markdown optimized for streaming:
// complete blocks are rendered with Glamour, the trailing incomplete
// block is rendered as plain text with basic formatting.
func RenderStreaming(content string, width int) string
```

Split content at the last `\n\n` boundary. Everything before → full Glamour render (cached). The trailing partial paragraph → basic inline formatting only.

### Verification
- [ ] Streaming text appears smooth (no visible jank)
- [ ] Complete code blocks render with syntax highlighting
- [ ] Partial text renders immediately without waiting for Glamour
- [ ] Resize correctly invalidates render cache
- [ ] CPU usage stays reasonable during fast streaming

---

## Phase 11: Session Resume & Management

**Goal**: Enable resuming previous Claude Code sessions and managing active conversations.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**11a. Resume from sidebar**

When the user selects a historical session in the sidebar and presses Enter (or sends a message), start a new Claude CLI subprocess with `--resume <sessionID>`:

```go
func (p *AgentPlugin) resumeSession(session adapter.Session) tea.Cmd {
    config := claude.ConversationConfig{
        ProjectDir: session.ProjectPath,
        SessionID:  session.ID,
    }
    return claude.RunConversationCmd(config, p.bus)
}
```

**11b. New session action**

Add `Ctrl+N` shortcut to start a fresh conversation (no --resume):
- Clear messages
- Create new ManagedSession in store
- Highlight "New Session" entry at top of sidebar

**11c. Session title generation**

After the first assistant response in a new session, generate a title from the first user message (truncated to 80 chars). Update the sidebar entry.

**11d. Active session indicator**

In the sidebar, the currently active session shows a `▸` prefix and is highlighted with the primary color. Running sessions show a pulsing dot indicator.

### Verification
- [x] Selecting a historical session loads its messages
- [x] Sending a message in a historical session resumes it via --resume
- [x] Ctrl+N starts a fresh conversation
- [x] Active session is visually distinct in sidebar
- [x] Session title updates after first exchange

---

## Phase 12: Codex Adapter

**Goal**: Add a Codex CLI adapter for reading Codex conversation sessions.

### Files to Create

#### `cmd/prism-cli/app/adapter/codex.go`

```go
type CodexAdapter struct {
    baseDir string // ~/.codex/
}

func NewCodexAdapter(baseDir string) *CodexAdapter
func (a *CodexAdapter) ID() string   { return "codex" }
func (a *CodexAdapter) Name() string { return "Codex" }
func (a *CodexAdapter) Available() bool
func (a *CodexAdapter) ScanSessions() ([]Session, error)
func (a *CodexAdapter) LoadMessages(sessionPath string) ([]chat.Message, error)
func (a *CodexAdapter) SupportsWrite() bool { return false }
```

Implementation:
- Locate Codex session directory (typically `~/.codex/` or `~/.openai/codex/`)
- Parse session files (JSONL or JSON format depending on Codex version)
- Map Codex message format to `chat.Message`
- Extract tool calls if present in Codex format

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

Register Codex adapter:
```go
p.adapters = []adapter.Adapter{
    adapter.NewClaudeAdapter(""),
    adapter.NewCodexAdapter(""),
}
```

### Verification
- [x] Codex adapter correctly detects availability
- [x] Sessions from Codex appear in sidebar with "Codex" badge
- [x] Messages load correctly from Codex format
- [x] Graceful handling when Codex is not installed

---

## Phase 13: Cursor Adapter

**Goal**: Add a Cursor editor adapter for reading Cursor conversation sessions.

### Files to Create

#### `cmd/prism-cli/app/adapter/cursor.go`

```go
type CursorAdapter struct {
    baseDir string
}

func NewCursorAdapter(baseDir string) *CursorAdapter
func (a *CursorAdapter) ID() string   { return "cursor" }
func (a *CursorAdapter) Name() string { return "Cursor" }
func (a *CursorAdapter) Available() bool
func (a *CursorAdapter) ScanSessions() ([]Session, error)
func (a *CursorAdapter) LoadMessages(sessionPath string) ([]chat.Message, error)
func (a *CursorAdapter) SupportsWrite() bool { return false }
```

Implementation:
- Locate Cursor workspace storage (typically `~/.cursor/` or within workspace `.cursor/`)
- Parse Cursor's conversation storage format
- Map to `chat.Message`

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

Register Cursor adapter alongside Claude and Codex.

### Verification
- [x] Cursor adapter correctly detects availability
- [x] Sessions appear in sidebar with "Cursor" badge
- [x] Messages load correctly
- [x] Graceful handling when Cursor is not installed

---

## Phase 14: Adapter Badges & Sidebar Polish

**Goal**: Visually distinguish sessions from different adapters in the sidebar.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**14a. Adapter badge rendering**

Each session in the sidebar shows a small colored badge:
- Claude: `[C]` in primary blue
- Codex: `[X]` in green
- Cursor: `[R]` in purple
- Active: pulsing `●` dot

**14b. Group by adapter option**

Add `Ctrl+G` to toggle between date-grouped and adapter-grouped sidebar views.

**14c. Session count per group**

Each group header shows the count: `Today (3)` or `Claude Code (12)`.

### Verification
- [x] Adapter badges render correctly with distinct colors
- [x] Ctrl+G toggles grouping mode
- [x] Session counts are accurate

---

## Phase 15: Session Search

**Goal**: Full-text search across all sessions from all adapters.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**15a. Search input**

`/` activates search mode — a search input appears at the top of the sidebar. `Escape` cancels search.

**15b. Search implementation**

Search across session titles and optionally message content:
```go
func (p *AgentPlugin) searchSessions(query string) []adapter.Session {
    query = strings.ToLower(query)
    var results []adapter.Session
    for _, s := range p.state.Sessions {
        if strings.Contains(strings.ToLower(s.Title), query) ||
           strings.Contains(strings.ToLower(s.ProjectPath), query) {
            results = append(results, s)
        }
    }
    return results
}
```

**15c. Highlighted matches**

Search results highlight the matching portion of the title.

### Verification
- [x] `/` activates search mode
- [x] Results filter in real-time as user types
- [x] Escape clears search and restores full list
- [x] Match highlighting works correctly

---

## Phase 16: Cost & Token Tracking

**Goal**: Real-time cost tracking during conversations and enhanced analytics.

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

**16a. Streaming cost accumulator**

Track tokens and cost from stream-json events during active conversations:
```go
type CostTracker struct {
    InputTokens  int
    OutputTokens int
    CacheReads   int
    CacheWrites  int
    TotalCost    float64
    Model        string
}
```

**16b. Status bar cost display**

During streaming, show a compact cost indicator in the input area:
`⬤ streaming... | 1.2k in / 450 out | $0.03`

**16c. Per-session cost summary**

In analytics mode, show cost breakdown per session including model, tokens, and estimated cost.

### Verification
- [x] Token counts update in real-time during streaming
- [x] Cost estimate is visible in input area
- [x] Analytics view shows per-session cost breakdown

---

## Phase 17: Keyboard Shortcut System

**Goal**: Comprehensive keyboard shortcuts for power users.

### Shortcut Map

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Input focused | Send message |
| `Shift+Enter` | Input focused | Insert newline |
| `Escape` | Input focused (text) | Clear text |
| `Escape` | Input focused (empty) | Blur input |
| `Escape` | Dialog open | Close/deny dialog |
| `Ctrl+N` | Anywhere | New conversation |
| `Ctrl+C` | Streaming | Cancel/abort current response |
| `Ctrl+L` | Anywhere | Clear chat viewport |
| `/` | Sidebar focused | Activate search |
| `Ctrl+G` | Anywhere | Toggle sidebar grouping |
| `Tab` | Anywhere | Toggle sidebar/chat focus |
| `a`/`s`/`d` | Permission dialog | Allow/AllowSession/Deny |
| `↑`/`↓` | Sidebar | Navigate sessions |
| `↑`/`↓` | Question dialog | Navigate options |
| `Space` | Question dialog (multi) | Toggle option |

### Files to Modify

#### `cmd/prism-cli/app/plugin_agent.go`

Ensure all shortcuts are implemented in the `Update()` method with proper focus gating (shortcuts only active in appropriate context).

### Verification
- [x] All shortcuts work in their designated context
- [x] No shortcut conflicts between contexts
- [x] Ctrl+C during streaming gracefully aborts

---

## Phase 18: Error Handling & Resilience

**Goal**: Bullet-proof error handling for all failure modes.

### Failure Modes to Handle

1. **Claude CLI not installed**: Show clear error message with install instructions
2. **Claude CLI crashes mid-conversation**: Detect exit, show error, offer retry
3. **Network timeout**: Handle --timeout flag, show timeout message
4. **Malformed stream-json**: Log and skip unparseable lines (already handled in `streamOutput()`)
5. **Session file locked**: Handle concurrent access to JSONL files
6. **Process zombie**: Ensure `TerminateProcess()` is called on all exit paths (including Ctrl+C of prism-cli itself)
7. **Permission timeout**: If user doesn't respond to permission dialog within 5 minutes, auto-deny
8. **Stdin pipe broken**: Detect write errors, offer to restart conversation
9. **Very large output**: Cap message buffer at 1MB, truncate with "[output truncated]" indicator
10. **Rapid message sending**: Debounce to prevent sending while streaming

### Files to Modify

#### `cmd/prism-cli/claude/conversation.go`

**18a. Process monitoring goroutine**

```go
// monitorProcess watches the Claude CLI subprocess and publishes events on state changes
func monitorProcess(cmd *exec.Cmd, bus *agentbus.Bus, sessionID string)
```

**18b. Graceful shutdown hook**

Register a cleanup function that terminates all active Claude CLI subprocesses when prism-cli exits:

```go
// CleanupConversations terminates all active Claude CLI processes
func CleanupConversations(store *agentbus.Store)
```

#### `cmd/prism-cli/app/plugin_agent.go`

**18c. Error state rendering**

```go
func renderErrorBanner(err error, width int) string
```

Shows a red-bordered error banner with the error message and suggested actions (Retry / New Conversation / Report Bug).

**18d. Retry mechanism**

On process crash, offer to retry the last message:
```go
type RetryLastMsg struct{}
```

### Verification
- [x] Missing Claude CLI shows install instructions
- [x] Process crash shows error banner with retry option
- [x] Ctrl+C of prism-cli terminates Claude subprocess
- [x] Large output is truncated gracefully
- [x] Cannot send messages while already streaming
- [x] Permission dialog times out after 5 minutes

---

## Phase 19: Cross-Platform Event Bridge Preparation

**Goal**: Ensure the `agentbus/` package can be consumed by VSCode and Electron via gRPC/IPC.

### Architecture

```
┌────────────────────────────────────────────────┐
│              agentbus/ (Go package)             │
│                                                 │
│  Bus ──┬── TUI subscriber (Bubble Tea msgs)    │
│        ├── gRPC subscriber (future VSCode)     │
│        └── WebSocket subscriber (future Electron)│
│                                                 │
│  Store ── Session management                   │
│  Events ── Typed event protocol                │
└────────────────────────────────────────────────┘
```

### Files to Create

#### `cmd/prism-cli/agentbus/serializer.go`

JSON serialization for events (needed for gRPC/WebSocket transport):
```go
// ToJSON serializes an Event to JSON for cross-platform transport
func (e *Event) ToJSON() ([]byte, error)

// FromJSON deserializes a JSON event
func FromJSON(data []byte) (*Event, error)
```

#### `cmd/prism-cli/agentbus/adapter.go`

Interface for platform-specific event consumers:
```go
// EventConsumer defines how a platform receives events
type EventConsumer interface {
    OnEvent(event Event)
    Close()
}

// BubbleTeaConsumer adapts events to tea.Msg for the TUI
type BubbleTeaConsumer struct {
    ch chan tea.Msg
}

func (c *BubbleTeaConsumer) OnEvent(event Event) {
    // Convert event to appropriate tea.Msg type
    // and send to channel
}
```

### Verification
- [x] Events serialize/deserialize to JSON correctly
- [x] BubbleTeaConsumer correctly converts all event types
- [x] Event protocol is documented with examples

---

## Phase 20: Integration Testing & Hardening

**Goal**: Comprehensive test suite covering all critical paths.

### Test Categories

#### Unit Tests (`*_test.go` alongside each file)

1. **agentbus/bus_test.go**: Concurrent pub/sub, unsubscribe, multiple subscribers
2. **agentbus/store_test.go**: Session CRUD, concurrent access
3. **agentbus/events_test.go**: Event serialization/deserialization
4. **claude/conversation_test.go**: Config validation, stdin message formatting
5. **claude/events_test.go**: All stream-json event type parsing (expand existing)
6. **dialog/question_test.go**: Question dialog state transitions
7. **chat/renderer_test.go**: Part-based message rendering, edge cases
8. **adapter/codex_test.go**: Codex session parsing
9. **adapter/cursor_test.go**: Cursor session parsing

#### Integration Tests

1. **Conversation flow**: Start conversation → send message → receive streaming response → send follow-up → end conversation
2. **Session resume**: Create session → exit → resume with --resume → verify context preserved
3. **Permission flow**: Send message → tool triggers permission → approve → execution continues
4. **Question flow**: Claude asks question → user answers → Claude continues with answer
5. **Error recovery**: Kill Claude subprocess → verify error handling → retry works
6. **Multi-adapter scan**: Claude + Codex sessions appear correctly grouped

### Quality Gates

```bash
make test      # All unit tests pass
make lint      # golangci-lint clean
go vet ./...   # No vet issues
```

### Verification
- [x] All unit tests pass
- [x] Integration tests pass on Windows, macOS, Linux
- [x] `make lint` clean
- [x] No race conditions detected with `go test -race`

---

## Dependency Summary

### New Go Dependencies
None required — all functionality built on existing imports:
- `encoding/json` — event serialization
- `sync` — thread-safe bus/store
- `os/exec` — Claude CLI subprocess (already used)
- `bufio` — stdin/stdout streaming (already used)
- `github.com/charmbracelet/bubbles/textarea` — already imported in modal/input.go

### Phase Dependencies

```
Phase 1 (Event Bus) ─────────────────┐
                                      │
Phase 2 (Session Store) ──────────────┤
                                      │
Phase 3 (Claude Runner) ──────────────┤
                                      ├── Phase 6 (Wire Everything)
Phase 4 (Message Model) ──────────────┤        │
                                      │        ├── Phase 7 (Permissions)
Phase 5 (Multi-line Input) ───────────┘        │
                                               ├── Phase 8 (Questions)
                                               │
                                               ├── Phase 9 (Parallel Agents)
                                               │
                                               ├── Phase 10 (Streaming Perf)
                                               │
                                               ├── Phase 11 (Session Resume)
                                               │
Phase 12 (Codex Adapter) ─── independent       ├── Phase 16 (Cost Tracking)
                                               │
Phase 13 (Cursor Adapter) ── independent       ├── Phase 17 (Shortcuts)
                                               │
Phase 14 (Sidebar Polish) ── after 12,13       ├── Phase 18 (Error Handling)
                                               │
Phase 15 (Search) ────────── after 14          └── Phase 19 (Cross-Platform)
                                                        │
Phase 20 (Testing) ────────────────────────────── after all
```

### Parallelizable Phases

These phases can be worked on concurrently:
- Phases 1-5 (foundation) are independent of each other
- Phase 12 and 13 (adapters) are independent of 7-11
- Phase 14-16 are independent of each other

---

## File Impact Summary

### New Files (14)
| File | Phase | Purpose |
|------|-------|---------|
| `agentbus/bus.go` | 1 | Event bus |
| `agentbus/events.go` | 1 | Event types |
| `agentbus/permission.go` | 1 | Permission types |
| `agentbus/question.go` | 1 | Question types |
| `agentbus/session.go` | 2 | Session types |
| `agentbus/store.go` | 2 | Session store |
| `agentbus/serializer.go` | 19 | JSON serialization |
| `agentbus/adapter.go` | 19 | Platform consumers |
| `claude/conversation.go` | 3 | Conversation mode |
| `dialog/question.go` | 8 | Question dialog |
| `adapter/codex.go` | 12 | Codex adapter |
| `adapter/cursor.go` | 13 | Cursor adapter |
| `agentbus/bus_test.go` | 20 | Bus tests |
| `agentbus/store_test.go` | 20 | Store tests |

### Modified Files (6)
| File | Phases | Changes |
|------|--------|---------|
| `app/plugin_agent.go` | 5,6,7,8,9,10,11,14,15,16,17,18 | Major — core chat integration |
| `app/chat/renderer.go` | 4,9 | Part-based rendering, agent blocks |
| `app/adapter/adapter.go` | 2 | Add SupportsWrite() |
| `app/adapter/claude.go` | 2 | Implement SupportsWrite() |
| `claude/runner.go` | 3 | Keep existing, add conversation support |
| `markdown/renderer.go` | 10 | Add streaming render mode |

### Untouched Files
- `claude/events.go` — Already well-designed, reused as-is
- `claude/parser.go` — Already well-designed, reused via bus bridge
- `dialog/dialog.go` — Already has perfect overlay/dialog system
- `dialog/permissions.go` — Already has complete permission dialog
- `dialog/confirm.go` — Reused for confirmation dialogs

---

## Success Criteria

### Automated Verification
- [ ] `make build` succeeds
- [ ] `make test` passes all tests
- [ ] `make lint` is clean
- [ ] `go test -race ./...` passes
- [ ] No increase in binary size > 2MB

### Manual Verification
- [ ] Can start a new conversation and get streaming responses
- [ ] Can resume a previous session with full context
- [ ] Tool calls render with real-time status indicators
- [ ] Permission dialogs appear and work correctly
- [ ] Question dialogs render with full interaction
- [ ] Subagent blocks appear and show streaming content
- [ ] Multi-line input works with Enter/Shift+Enter
- [ ] Search finds sessions across all adapters
- [ ] Error states show helpful messages with recovery options
- [x] Ctrl+C during streaming gracefully aborts
- [ ] Prism-cli exit terminates all Claude subprocesses
- [ ] Performance is smooth even with fast streaming output
