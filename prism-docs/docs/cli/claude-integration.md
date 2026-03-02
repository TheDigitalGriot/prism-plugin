---
title: Claude CLI Integration
description: Command invocation, streaming pipeline, tool activity formatting, output parser event detection, and error handling.
outline: [2, 3]
---

# Claude CLI Integration

## Command Invocation

**Streaming mode** (used during execution):

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  --output-format stream-json \
  --verbose \
  "Execute the next story from {storiesPath} using the /prism-spectrum workflow. \
   Progress file: {progressPath}"
```

**Non-streaming mode** (fallback):

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  "Execute the next story from {storiesPath} using the /prism-spectrum workflow. \
   Progress file: {progressPath}"
```

## Streaming Pipeline

```
claude CLI (child process)
    │
    ├── stdout ──▶ goroutine 1 ──▶ streamOutput()
    │                                  │
    └── stderr ──▶ goroutine 2 ──▶ streamOutput()
                                       │
                              ┌────────┴────────┐
                              │  bufio.Scanner   │  1MB buffer
                              │  (line by line)  │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │ ParseStreamEvent │  JSON → StreamEvent
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │ ExtractTool      │  Tool-specific formatting
                              │ Activity()       │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │  output channel  │  buffered (100)
                              │  (tea.Msg)       │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │  Bubble Tea      │  ToolActivityMsg →
                              │  Update()        │  update UI in real-time
                              └─────────────────┘
```

## Tool Activity Formatting

| Tool | Display Format | Example |
|------|---------------|---------|
| Read | `Reading: .../shortened/path.ts` | `Reading: .../services/auth.ts` |
| Edit | `Editing: .../shortened/path.ts` | `Editing: .../components/Form.tsx` |
| Write | `Writing: .../shortened/path.ts` | `Writing: .../config/db.ts` |
| Bash | `Running: command` (50 char max) | `Running: npm run typecheck` |
| Glob | `Finding: pattern` | `Finding: **/*.test.ts` |
| Grep | `Searching: pattern` (40 char max) | `Searching: handleSubmit` |
| Task | `Agent: description` (50 char max) | `Agent: Analyzing codebase...` |
| WebFetch | `Fetching: URL` (50 char max) | `Fetching: https://docs.example.com` |
| WebSearch | `Web search...` | `Web search...` |
| TodoWrite | `Updating tasks...` | `Updating tasks...` |
| AskUserQuestion | `Asking question...` | `Asking question...` |

## Output Parser Event Detection

The `OutputParser` maintains a buffer of all output and fires events on:

| Event | Detection | Source |
|-------|-----------|--------|
| Story Announced | `<spectrum-story>ID: STORY-NNN` tag | `parser.go:52` |
| Phase Changed | Keywords: "research", "implementing", "quality gate", etc. | `parser.go:65` |
| Quality Gate Started | "Running quality gates", "npm run typecheck/lint/test" | `parser.go:75` |
| Commit Created | "git commit", "[STORY-" keywords | `parser.go:86` |
| Signal Detected | Full buffer regex scan for `<promise>` or `<spectrum-*>` | `parser.go:94` |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude process error | Increment `ConsecutiveErrs`, backoff = `errs × 2s`, retry |
| 3+ consecutive errors | Transition to `StateError`, stop execution |
| Signal: error | Immediate `StateError` |
| Signal: retry | Increment errors, retry if under limit (3) |
| Signal: complete (but stories remain) | Override signal, log warning, continue |
| Max iterations reached | Transition to `StateMaxIterations` |
| Claude timeout | 30 minutes per session |

## Process Termination

- **Windows**: `taskkill /F /T /PID <pid>` (tree kill)
- **Unix**: `cmd.Process.Kill()` (direct kill)
