# Agent Chat Evolution: OpenCode & Codebuff Analysis → Prism Agent Redesign

**Date**: 2026-03-04
**Type**: Research — Comparative Architecture Analysis
**Status**: Complete
**Predecessor**: `2026-03-02-agent-chat-lineage.md`

---

## Executive Summary

The prism-cli Agent screen descended from Sidecar's read-only Conversations plugin — a session browser with placeholder chat. This document analyzes two production-grade AI coding CLIs (OpenCode, Codebuff) to inform a fundamental redesign of the Prism Agent chat into an interactive, streaming, tool-aware conversation interface that can serve as the backbone for all three Prism platforms (CLI, VSCode, Electron).

**Key finding**: Both OpenCode and Codebuff have independently converged on a similar architecture — a **client/server split** with **event-bus streaming**, **pluggable provider abstraction**, and **permission-gated tool execution**. Prism should adopt this pattern rather than the current monolithic read-only approach.

---

## Part 1: Current State of Prism Agent Chat

### What Exists (1,052 lines across 5 files)

| File | Lines | Role | Status |
|------|-------|------|--------|
| `plugin_agent.go` | 1,052 | Main plugin — session browser, chat viewport, input, analytics | **Read-only browser + stub chat** |
| `adapter/adapter.go` | 35 | Adapter interface — `Session` struct, `Adapter` interface | Functional |
| `adapter/claude.go` | 335 | ClaudeAdapter — scans `~/.claude/projects/*/*.jsonl` | Functional |
| `chat/renderer.go` | 253 | Message rendering — user, assistant, tool indicators | Basic |
| `markdown/renderer.go` | 74 | Glamour-based markdown rendering | Functional |

### What Works
- Session discovery from `~/.claude/projects/` via ClaudeAdapter
- Date-grouped sidebar (Today / Yesterday / This Week / Older)
- JSONL parsing for user/assistant messages and basic tool indicators
- Glamour markdown rendering with blue `▎` accent bar
- Analytics view with model usage, token counts, cost estimates
- Wide/compact mode toggle

### What's Missing (Critical Gaps)
1. **No interactive chat** — `sendMessage()` returns a hardcoded placeholder string
2. **No Claude CLI integration** — The `claude/runner.go` exists but is wired only to Spectrum, not Agent
3. **No streaming** — No real-time response rendering
4. **No tool call visualization** — Only basic single-line `✓`/`✗` indicators from JSONL replay
5. **No conversation persistence** — New messages aren't saved
6. **No multi-turn context** — Each "send" is independent
7. **No permission system** — No tool approval/denial UI
8. **No file attachments** — Single-line `textinput` with 2000 char limit
9. **No search** — Can't search across sessions
10. **No resume** — Can't continue a previous session

### The Claude Runner Infrastructure (Already Built)

The `claude/` package has significant infrastructure already built for Spectrum:

```
claude/runner.go    — RunClaudeCmd(), RunClaudeStreamingCmd(), process management
claude/events.go    — StreamEvent parsing, ToolUse, ContentBlock, ExtractToolActivity()
claude/parser.go    — OutputParser with signal detection, phase tracking
```

**Key capability**: `RunClaudeStreamingCmd()` already streams Claude's `--output-format stream-json` output, parses tool_use events, and can extract tool activity descriptions for 12+ tool types (Read, Edit, Write, Bash, Glob, Grep, Task, WebFetch, etc.). This infrastructure is wired to Spectrum's execution dashboard but **not** to the Agent plugin.

---

## Part 2: OpenCode Architecture Analysis

### Overview
- **Stars**: 116k | **Language**: TypeScript (Bun) | **License**: Open Source
- **TUI**: @opentui/core + @opentui/solid (SolidJS-based terminal rendering)
- **Positioning**: "Open source alternative to Claude Code" — provider-agnostic, client/server design

### Architecture: Session Engine + Event Bus

```
┌─────────────────────────────────────────────────────────────┐
│                        TUI Client                           │
│  (SolidJS via @opentui/solid, renders in terminal)          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Chat UI  │  │ Editor/Input │  │ Tool Call Visualizer  │  │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘  │
│       │               │                      │              │
│       └───────────────┼──────────────────────┘              │
│                       │ SSE stream                          │
├───────────────────────┼─────────────────────────────────────┤
│                  HTTP/SSE Server                            │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ REST API   │  │ Session CRUD │  │  Bus (event pub)  │   │
│  └────┬───────┘  └──────┬───────┘  └───────┬───────────┘   │
│       │                 │                   │               │
│  ┌────┴─────────────────┴───────────────────┴────────────┐  │
│  │              SessionPrompt.loop()                     │  │
│  │  1. Load messages (filterCompacted)                   │  │
│  │  2. Resolve agent, model, tools                       │  │
│  │  3. Call LLM via Vercel AI SDK                        │  │
│  │  4. Stream parts → Bus.publish()                      │  │
│  │  5. Execute tool calls (permission-gated)             │  │
│  │  6. Loop until non-tool finish reason                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SQLite (Drizzle ORM)                               │    │
│  │  SessionTable │ MessageTable │ PartTable │ Project  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Client/Server split**: TUI is a thin client consuming an HTTP API + SSE stream. This enables:
   - Desktop app and mobile clients consuming the same API
   - Remote operation (run on server, use from phone)
   - Testing server logic independently of TUI

2. **SQLite persistence (Drizzle ORM)**: Sessions, messages, and message parts are all persisted in SQLite. The `PartTable` stores structured content (text, tool_use, tool_result, reasoning, snapshot, compaction) — not just serialized JSON blobs.

3. **Event Bus (Bus namespace)**: All LLM streaming events flow through `Bus.publish()`, which fans out to SSE clients. This decouples the agent loop from the UI — the loop doesn't know or care what's consuming its events.

4. **Message compaction**: When context grows too large, OpenCode creates a `CompactionPart` summary and re-invokes the agent loop with the compacted history. This enables indefinite conversations without hitting token limits.

5. **Multi-provider via Vercel AI SDK**: `BUNDLED_PROVIDERS` map covers 10+ providers (Anthropic, OpenAI, Azure, Google, Bedrock, Mistral, Groq, OpenRouter, GitLab, GitHub Copilot). Each provider has auto-detection logic for credentials.

6. **Permission-gated tool execution**: Tools call `PermissionNext.ask()` before execution. The TUI renders a permission dialog that the user can approve/deny.

7. **Built-in agents**: Three agent types:
   - **Build Agent** (full access, default)
   - **Plan Agent** (read-only, denies file edits)
   - **General Subagent** (complex searches, multistep)

8. **LSP integration**: Language Server Protocol support for diagnostics, hover info, go-to-definition. Experimental `LspTool` lets the LLM query LSP directly.

9. **Instance-scoped state**: `Instance.provide()` middleware provides per-request context. Subsystems use `Instance.state(async () => ...)` for lazy initialization tied to project scope.

### What Prism Can Learn from OpenCode

| Pattern | Value for Prism |
|---------|----------------|
| Client/server + SSE | Enables same chat backend for CLI, VSCode, Electron |
| SQLite sessions | Much richer than JSONL scanning; enables search, filtering, analytics |
| Event bus | Decouples LLM execution from UI rendering |
| Message compaction | Enables long conversations without context exhaustion |
| Permission dialogs | Critical for interactive agent use |
| Multi-agent types | Aligns with Prism's existing model assignment convention (Opus/Sonnet/Haiku) |
| Structured parts | Better than flat text for rendering tool calls, reasoning, etc. |

---

## Part 3: Codebuff Architecture Analysis

### Overview
- **Stars**: 3.6k | **Language**: TypeScript (Bun) | **License**: Apache-2.0
- **CLI**: OpenTUI + React 19 | **Web**: Next.js 15.5 + React 18.3
- **Positioning**: Multi-agent coding tool — 61% success on evals vs Claude Code's 53%

### Architecture: WebSocket Client-Server with Client-Side Tool Execution

```
┌──────────────────────────────────────────────────────────┐
│                      CLI Client                          │
│  (OpenTUI + React 19, TypeScript)                        │
│  ┌──────────────┐  ┌───────────────────────────────────┐ │
│  │ Chat UI      │  │ Tool Executor (client-side)       │ │
│  │              │  │ write_file, read_files,           │ │
│  │              │  │ run_terminal_command, code_search, │ │
│  │              │  │ str_replace, browser_logs         │ │
│  └──────┬───────┘  └───────────────┬───────────────────┘ │
│         │                          │                     │
│         └──────────┬───────────────┘                     │
│                    │ WebSocket                           │
├────────────────────┼─────────────────────────────────────┤
│              WebSocket Server                            │
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │ ClientAction     │  │ ServerAction                 │   │
│  │ discriminated    │  │ discriminated unions:        │   │
│  │ unions:          │  │ - response-chunk             │   │
│  │ - prompt         │  │ - tool-call-request          │   │
│  │ - tool-call-resp │  │ - prompt-response            │   │
│  └────────┬────────┘  └──────────────┬───────────────┘   │
│           │                          │                   │
│  ┌────────┴──────────────────────────┴───────────────┐   │
│  │            loopAgentSteps()                       │   │
│  │  ┌─────────────────┐  ┌────────────────────────┐  │   │
│  │  │ runAgentStep()  │  │ runProgrammaticStep()  │  │   │
│  │  │ (LLM-based)     │  │ (generator-based)      │  │   │
│  │  └────────┬────────┘  └────────────────────────┘  │   │
│  │           │                                       │   │
│  │  ┌────────┴────────────────────────────────────┐  │   │
│  │  │  Multi-Agent Orchestration                  │  │   │
│  │  │  File Picker → Planner → Editor → Reviewer  │  │   │
│  │  │  handleSpawnAgents() for recursive subagents │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │  PostgreSQL (Drizzle ORM)                       │     │
│  │  Users │ Sessions │ Messages │ Agent Runs       │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Client-side tool execution**: Tools that need filesystem access (write_file, read_files, run_terminal_command, code_search) execute on the client. The server sends `tool-call-request` events; the client executes and returns `tool-call-response`. This is the inverse of OpenCode (where tools run server-side).

2. **Discriminated union protocol**: All WebSocket messages use TypeScript discriminated unions (`ClientAction`, `ServerAction`) for type-safe message dispatch. Event types include: `response-chunk`, `tool_call`, `tool_result`, `subagent_start/finish`, `reasoning_delta`.

3. **Multi-agent orchestration**: Codebuff deploys coordinated specialist agents:
   - **File Picker Agent** — scans codebase structure
   - **Planner Agent** — determines modification sequence
   - **Editor Agent** — executes precise changes
   - **Reviewer Agent** — validates results
   - Agents can spawn subagents recursively via `handleSpawnAgents()`

4. **Code-map with tree-sitter**: The `@codebuff/code-map` package uses tree-sitter WASM to analyze codebase structure and generate token importance scores for context prioritization.

5. **TypeScript generators for custom workflows**: Users can mix AI generation with programmatic control through TypeScript generators, enabling conditional branching and agent composition.

6. **Streaming via PrintModeEvent**: All agent output streams as discriminated union events: `response-chunk`, `tool_call`, `tool_result`, `subagent_start/finish`, `reasoning_delta`.

7. **Ephemeral server-side sessions**: Unlike OpenCode's SQLite persistence, Codebuff's server sessions are ephemeral — not persisted between WebSocket reconnects. The SDK returns `RunState` for client-side serialization.

8. **ProjectFileContext**: Clients build rich context including file tree, git changes, file token scores, and knowledge files (knowledge.md, AGENTS.md) — sent to the server with each prompt.

### What Prism Can Learn from Codebuff

| Pattern | Value for Prism |
|---------|----------------|
| Client-side tool execution | Prism already has Claude CLI as the tool executor — same model |
| Discriminated union events | Clean event protocol for streaming to multiple UIs |
| Multi-agent orchestration | Aligns with Prism's existing agent architecture (10 agents) |
| Tree-sitter code mapping | Could enhance context building for agent prompts |
| Streaming event types | `response-chunk`, `tool_call`, `tool_result` exactly match Claude stream-json |
| ProjectFileContext | Enriched context for each prompt (git status, file tree, token scores) |

---

## Part 4: Comparative Architecture Matrix

| Dimension | Prism Agent (Current) | OpenCode | Codebuff |
|-----------|----------------------|----------|----------|
| **Language** | Go (Bubble Tea) | TypeScript (Bun) | TypeScript (Bun) |
| **TUI Framework** | Bubble Tea + Lipgloss | @opentui/solid (SolidJS) | OpenTUI + React 19 |
| **Chat Status** | Read-only browser + stub | Full interactive streaming | Full interactive streaming |
| **LLM Integration** | None (placeholder) | Vercel AI SDK, 10+ providers | Vercel AI SDK via OpenRouter |
| **Streaming** | None | SSE via event bus | WebSocket + discriminated unions |
| **Persistence** | JSONL file scanning (read-only) | SQLite (Drizzle ORM) | PostgreSQL (Drizzle ORM) |
| **Tool Execution** | N/A | Server-side, permission-gated | Client-side, server-orchestrated |
| **Tool Visualization** | Basic `✓`/`✗` single-line | Full tool name + status + collapsible | `tool_call`/`tool_result` events |
| **Permission System** | None | `PermissionNext.ask()` + TUI dialog | Server requests, client approves |
| **Session Management** | Scan-only, no CRUD | Full CRUD with titles, share URLs | Ephemeral server, SDK state return |
| **Context Management** | None | Message compaction (summarization) | ProjectFileContext + token scoring |
| **Multi-Agent** | Not in chat (used in plugin layer) | 3 agent types (Build/Plan/Subagent) | 4 specialists + recursive subagents |
| **Markdown Rendering** | Glamour + lite fallback | Structured part rendering | response-chunk streaming |
| **Search** | None | Full-text within conversations | Not documented |
| **Input** | Single-line textinput (2000 chars) | Multi-line editor | Full CLI input |
| **LSP** | None | Built-in, experimental tool | None |
| **Git Integration** | None in Agent | None documented | ProjectFileContext includes git changes |
| **Cost Tracking** | Analytics view (per-session scan) | Per-model token tracking | Per-turn credit tracking |

---

## Part 5: Strategic Analysis — What Prism Agent Should Become

### The Unique Prism Advantage

Prism has something neither OpenCode nor Codebuff has: **the Claude Code plugin ecosystem**. The 25 commands, 10 agents, and 11 skills that define the Prism workflow are invoked through Claude Code. The Agent chat should be the **interactive front-end to that entire system**.

This means the Prism Agent chat is not just "another Claude chat" — it's a **workflow-aware agent interface** that:
1. Can invoke `/prism-research`, `/prism-plan`, `/prism-implement`, `/prism-validate` through natural language
2. Can spawn and monitor the 10 specialized agents
3. Can trigger Spectrum autonomous execution and monitor progress
4. Can browse, search, and continue previous sessions
5. Renders tool activity with the same fidelity as the Spectrum execution dashboard

### The Bridge Already Exists

The `claude/` package is the critical connection point:

```
claude/runner.go     — RunClaudeStreamingCmd() with --output-format stream-json
claude/events.go     — StreamEvent parsing, tool activity extraction for 12+ tools
claude/parser.go     — Phase detection, signal parsing, quality gate results
```

This infrastructure already:
- Spawns Claude CLI as a subprocess
- Streams `stream-json` events line by line
- Parses tool_use, text, and result events
- Extracts human-readable tool activity descriptions
- Detects execution phases (Research → Planning → Implementation → Quality Gates → Committing)
- Parses Prism signals (`<spectrum-continue>`, `<spectrum-retry>`, `<spectrum-blocked>`)

The gap is simply that **this is wired to Spectrum, not to the Agent plugin**.

---

## Part 6: Recommended Architecture

### Option A: Direct Claude CLI Integration (Pragmatic, Phase 1)

Wire the existing `claude/` infrastructure directly into the Agent plugin. No new server, no new protocol — just connect what's already built.

```
┌─────────────────────────────────────────────────────────┐
│                Agent Plugin (Bubble Tea)                 │
│  ┌──────────────────┐  ┌────────────────────────────┐   │
│  │ Session Browser   │  │ Chat Viewport              │   │
│  │ (existing)        │  │ (existing + streaming)     │   │
│  └──────────────────┘  │                            │   │
│                        │  User message  ───────┐    │   │
│                        │  Assistant stream ◄───┐│   │   │
│                        │  Tool indicators  ◄──┐││   │   │
│                        │  Phase badges     ◄─┐│││   │   │
│                        └────────────────────┼┼┼┼────┘   │
│                                             ││││        │
│  ┌──────────────────────────────────────────┼┼┼┼─────┐  │
│  │  claude/ package (existing)              ││││     │  │
│  │  RunClaudeStreamingCmd() ────────────────┘│││     │  │
│  │  ParseStreamEvent() ──────────────────────┘││     │  │
│  │  ExtractToolActivity() ────────────────────┘│     │  │
│  │  OutputParser.ParseLine() ──────────────────┘     │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                    claude CLI                            │
│                  (subprocess)                            │
└─────────────────────────────────────────────────────────┘
```

**Effort**: Medium — mostly wiring, no new packages needed
**Risk**: Low — uses proven infrastructure
**Value**: Immediate interactive chat with tool visualization

#### What This Unlocks
1. User types message → `claude --print --output-format stream-json --verbose "<message>"`
2. Stream events render in real-time in the chat viewport
3. Tool calls show as expandable indicators with descriptions
4. Phase detection shows breadcrumb: `Research → Planning → Implementation`
5. Prism signals are detected and can trigger UI state changes
6. Session continues with `--resume` flag

### Option B: Event Bus Architecture (OpenCode-Inspired, Phase 2)

Add an internal event bus that decouples the Claude CLI execution from the UI. This enables the same events to flow to CLI, VSCode, and Electron.

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Service                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              AgentBus                           │    │
│  │  Publish(event AgentEvent)                      │    │
│  │  Subscribe(handler func(AgentEvent))            │    │
│  │                                                 │    │
│  │  Events:                                        │    │
│  │  - MessageStart(role, sessionID)                │    │
│  │  - TextDelta(text string)                       │    │
│  │  - ToolCallStart(name, input)                   │    │
│  │  - ToolCallComplete(name, output, status)       │    │
│  │  - PhaseChanged(phase string)                   │    │
│  │  - SignalDetected(signal Signal)                │    │
│  │  - SessionCreated/Updated/Loaded                │    │
│  │  - ErrorOccurred(error)                         │    │
│  └─────────────────┬───────────────────────────────┘    │
│                    │                                    │
│         ┌──────────┼──────────┐                         │
│         │          │          │                         │
│    ┌────▼────┐ ┌───▼───┐ ┌───▼──────────┐              │
│    │TUI Chat │ │VSCode │ │Electron Chat │              │
│    │Plugin   │ │Panel  │ │Component     │              │
│    └─────────┘ └───────┘ └──────────────┘              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Session Store (SQLite or file-based)           │    │
│  │  - CreateSession() → Session                    │    │
│  │  - AddMessage(sessionID, Message)               │    │
│  │  - GetMessages(sessionID) → []Message           │    │
│  │  - SearchSessions(query) → []Session            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Effort**: High — new package, session store, event types
**Risk**: Medium — more abstraction, but proven pattern
**Value**: Cross-platform event sharing, session persistence, search

### Option C: Hybrid Approach (Recommended)

**Phase 1** (Option A): Wire Claude CLI to Agent plugin. Get interactive chat working immediately. This is the highest-value, lowest-risk step.

**Phase 2** (Option B): Extract the event bus pattern. Factor the streaming logic into a reusable `agentbus/` package that VSCode and Electron can also consume.

**Phase 3**: Add session persistence (SQLite via modernc.org/sqlite for pure Go, or file-based JSONL with index). Enable search, resume, export.

**Phase 4**: Add permission dialogs for tool calls (Bubble Tea overlay component).

---

## Part 7: Feature Priority Matrix

### Must Have (Phase 1 — Interactive Chat)

| Feature | Source | Implementation |
|---------|--------|----------------|
| Send messages to Claude CLI | OpenCode/Codebuff model | `claude --print --output-format stream-json --verbose "<prompt>"` |
| Stream responses in real-time | Event bus pattern | Reuse `RunClaudeStreamingCmd()` + channel-to-Bubble Tea adapter |
| Render streaming text with markdown | Existing `markdown/renderer.go` | Glamour dark theme, incremental append |
| Tool call visualization | Existing `claude/events.go` | Expand `ExtractToolActivity()` → chat.Message stream |
| Phase detection badges | Existing `claude/parser.go` | Show current phase in breadcrumb or status bar |
| Resume previous sessions | Claude CLI `--resume` flag | Pass session ID when continuing a conversation |
| Multi-line input | Replace `textinput` with `textarea` | Bubble Tea `textarea` component |
| Conversation persistence | Write messages to JSONL | Append to same format Claude uses |

### Should Have (Phase 2 — Cross-Platform)

| Feature | Source | Implementation |
|---------|--------|----------------|
| Event bus abstraction | OpenCode's `Bus` pattern | New `agentbus/` package |
| Session search | OpenCode | Full-text search across JSONL files |
| Permission dialogs | OpenCode's `PermissionNext.ask()` | Bubble Tea modal overlay |
| File/image attachments | Both | `--file` flag to Claude CLI |
| Agent type selection | OpenCode's Build/Plan agents | Map to Prism's Opus/Sonnet/Haiku convention |
| Session export | OpenCode | Export as markdown or JSONL |

### Nice to Have (Phase 3 — Advanced)

| Feature | Source | Implementation |
|---------|--------|----------------|
| SQLite session store | OpenCode | `modernc.org/sqlite` (pure Go) |
| Context compaction | OpenCode | Summarize when context grows large |
| Tree-sitter code mapping | Codebuff | Token scoring for context prioritization |
| Multi-agent visualization | Codebuff | Subagent spawn/finish events |
| LSP integration | OpenCode | Diagnostics in Agent chat |
| Git context injection | Codebuff | Include git status/diffs in prompts |

---

## Part 8: Implementation Notes

### Connecting Claude CLI to Agent Plugin

The minimal change to make `sendMessage()` functional:

```go
// sendMessage sends the current input via Claude CLI
func (p *AgentPlugin) sendMessage() tea.Cmd {
    content := strings.TrimSpace(p.state.Input.Value())
    if content == "" {
        return nil
    }

    userMsg := chat.Message{
        Type:    chat.MessageTypeUser,
        Content: content,
    }
    p.state.Messages = append(p.state.Messages, userMsg)
    p.state.Input.Reset()

    // Create output channel for streaming
    outputChan := make(chan tea.Msg, 100)

    // Launch Claude CLI with streaming
    return tea.Batch(
        claude.RunClaudeStreamingCmd(p.projectDir, "", 0, outputChan),
        claude.ListenToOutput(outputChan),
    )
}
```

However, `RunClaudeStreamingCmd()` currently hardcodes a Spectrum prompt. It needs to be generalized to accept an arbitrary prompt string.

### Key Refactoring Needed

1. **Generalize `RunClaudeStreamingCmd()`** — Accept `prompt string` instead of deriving from `storiesPath`
2. **Add `--resume` support** — Pass session ID for multi-turn conversations
3. **Replace `textinput` with `textarea`** — Multi-line input is essential for agent chat
4. **Add streaming message accumulation** — `ClaudeOutputMsg` → incremental text append to current assistant message
5. **Wire `ExtractToolActivity()` to chat rendering** — Show tool indicators in real-time
6. **Add `OutputParser` integration** — Phase detection and signal handling in Agent context

### Claude CLI Flags for Agent Chat

```bash
# New conversation
claude --print --output-format stream-json --verbose "<prompt>"

# Resume existing conversation
claude --print --output-format stream-json --verbose --resume "<session-id>" "<prompt>"

# With file context
claude --print --output-format stream-json --verbose --file "path/to/file" "<prompt>"

# Conversation mode (keeps session alive)
claude --output-format stream-json --verbose
```

### Cross-Platform Event Sharing

For Phase 2, the `agentbus/` package would define:

```go
package agentbus

type EventType int
const (
    EventTextDelta EventType = iota
    EventToolCallStart
    EventToolCallComplete
    EventPhaseChanged
    EventSignalDetected
    EventMessageComplete
    EventError
)

type AgentEvent struct {
    Type      EventType
    SessionID string
    Text      string
    ToolName  string
    ToolInput string
    Phase     string
    Signal    domain.Signal
    Error     error
    Timestamp time.Time
}

type Bus struct {
    subscribers []func(AgentEvent)
    mu          sync.RWMutex
}

func (b *Bus) Publish(event AgentEvent) { ... }
func (b *Bus) Subscribe(handler func(AgentEvent)) { ... }
```

VSCode and Electron would consume these events via the existing gRPC-over-postMessage IPC bridge.

---

## Part 9: Risk Assessment

| Risk | Mitigation |
|------|------------|
| Claude CLI subprocess management on Windows | `TerminateProcess()` already handles Windows via `taskkill /F /T` |
| Stream buffering causes laggy rendering | Use `tea.Batch()` with channel listener, render on each `ClaudeOutputMsg` |
| Glamour re-rendering on each delta is slow | Buffer deltas, re-render on debounced interval (100ms) |
| Session resume may not preserve full context | Test `--resume` flag behavior, fall back to context injection |
| Permission dialogs block agent loop | Non-blocking: queue tool calls, show dialog, resume on approval |
| JSONL files grow large | Implement lazy loading with pagination (existing pattern in adapter) |

---

## Part 10: Comparison to Sidecar Lineage

| Aspect | Sidecar (Original) | Prism Agent (Current) | Prism Agent (Proposed) |
|--------|--------------------|-----------------------|------------------------|
| Purpose | Read-only session browser | Read-only session browser + stub | Interactive streaming agent chat |
| Chat | None | Placeholder response | Real Claude CLI integration |
| Streaming | N/A | N/A | stream-json → event bus → viewport |
| Tool viz | N/A | Basic `✓`/`✗` indicators | Real-time tool activity with descriptions |
| Persistence | File system scan | File system scan | Scan + write-back + optional SQLite |
| Multi-adapter | 10 adapters | 1 adapter (Claude) | 1 adapter + extensible |
| Search | Full-text | None | Full-text across sessions |
| Analytics | N/A | Token usage & cost | Enhanced with streaming cost tracking |
| Cross-platform | N/A | TUI only | TUI + VSCode + Electron via event bus |

---

## Referenced Documents

| Document | Relevance |
|----------|-----------|
| `2026-03-02-agent-chat-lineage.md` | Direct predecessor — Sidecar lineage analysis |
| `PRISM-DOCUMENTATION-2.3.5.md` | Agent Screen documentation (Section 9) |
| `cmd/prism-cli/app/plugin_agent.go` | Current implementation (1,052 lines) |
| `cmd/prism-cli/claude/runner.go` | Claude CLI subprocess management |
| `cmd/prism-cli/claude/events.go` | Stream-json event parsing |
| `cmd/prism-cli/claude/parser.go` | Output parsing, phase detection, signal parsing |

## External Sources

| Source | Key Takeaway |
|--------|-------------|
| [OpenCode GitHub](https://github.com/anomalyco/opencode) (116k stars) | Client/server + SSE, SQLite sessions, event bus, Vercel AI SDK |
| [OpenCode DeepWiki](https://deepwiki.com/anomalyco/opencode) | SessionPrompt.loop(), Bus.publish(), message compaction, LSP tools |
| [Codebuff GitHub](https://github.com/CodebuffAI/codebuff) (3.6k stars) | WebSocket protocol, client-side tools, multi-agent orchestration |
| [Codebuff DeepWiki](https://deepwiki.com/CodebuffAI/codebuff) | Discriminated unions, loopAgentSteps(), tree-sitter code mapping |
