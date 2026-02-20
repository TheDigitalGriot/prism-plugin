# Claude CLI Communication & Request/Response Flow

How the Prism CLI (Go) and spectrum.sh (Bash) orchestrators communicate with the local `claude` CLI to iterate over stories autonomously.

---

## 1. Claude CLI Invocation

Both orchestrators spawn the `claude` binary as a child process. Neither uses the Anthropic HTTP API directly — all communication flows through the CLI's `--print` mode.

### Common Prompt

Both send the identical prompt each iteration:

```
Execute the next story from {storiesPath} using the /prism-spectrum workflow. Progress file: {progressPath}
```

The `{progressPath}` is derived from the stories file location:
- Legacy: `.prism/stories/stories.json` → `.prism/shared/spectrum/progress.md`
- Epic: `.prism/stories/<epic>/stories.json` → `.prism/shared/spectrum/<epic>/progress.md`

### TUI Invocation (Go)

```
claude --dangerously-skip-permissions --print --output-format stream-json --verbose "<prompt>"
```

Source: [`runner.go:122-128`](cmd/prism-cli/claude/runner.go#L122-L128)

| Flag | Purpose |
|------|---------|
| `--dangerously-skip-permissions` | Autonomous execution — no human approval prompts for tool use |
| `--print` | Non-interactive mode — Claude prints output and exits |
| `--output-format stream-json` | Emit structured NDJSON events on stdout (one JSON object per line) |
| `--verbose` | Include detailed tool use information in the event stream |

### Bash Invocation (spectrum.sh)

```
claude --dangerously-skip-permissions --print "<prompt>"
```

Source: [`spectrum.sh:164-167`](scripts/spectrum.sh#L164-L167)

Plain text mode. No structured streaming. Optional verbose mode pipes to stderr via `tee /dev/stderr`.

### Key Difference

The TUI gets **structured JSON events** in real-time, allowing it to display tool activity as it happens. The bash script gets **plain text** and only parses it after the process exits.

### Process Management

| Aspect | TUI (Go) | spectrum.sh (Bash) |
|--------|----------|-------------------|
| Timeout | 30 minutes (`context.WithTimeout`) | None |
| Kill (Windows) | `taskkill /F /T /PID <pid>` (tree kill) | N/A |
| Kill (Unix) | `cmd.Process.Kill()` | Normal process lifecycle |
| Cancel | `Runner.Cancel()` — context cancel + process kill | N/A |

Source: [`runner.go:277-291`](cmd/prism-cli/claude/runner.go#L277-L291)

### Who Picks the Next Story?

**Neither orchestrator selects stories.** Both delegate entirely to Claude:

1. The orchestrator sends the prompt with the `stories.json` path
2. Claude's `/prism-spectrum` skill reads `stories.json`
3. The skill selects the next unblocked story by priority
4. The skill marks it `in_progress`, implements it, marks it `complete`
5. The skill writes the updated `stories.json` back to disk
6. The skill emits a signal tag in its output

The orchestrators only read `stories.json` after each iteration to update their display state.

---

## 2. Streaming Protocol & Real-Time Activity (TUI)

### NDJSON Event Format

With `--output-format stream-json`, the Claude CLI emits newline-delimited JSON. Each line is one event:

```json
{"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Read", "input": {"file_path": "src/app.ts"}}]}}
{"type": "tool_result", "tool_use_id": "toolu_123"}
{"type": "assistant", "message": {"content": [{"type": "text", "text": "The file contains..."}]}}
{"type": "result", "result": "Story complete", "duration_ms": 45000}
```

Event types:

| `type` | Contains | Meaning |
|--------|----------|---------|
| `assistant` | `message.content[]` with `tool_use` or `text` blocks | Claude is thinking or invoking a tool |
| `tool_result` | `tool_use_id` | A tool finished executing |
| `result` | `result`, `is_error`, `duration_ms` | Session complete |

Source: [`events.go:9-24`](cmd/prism-cli/claude/events.go#L9-L24)

### Data Flow: CLI Process → TUI Display

```
claude process (child)
    │
    ├─ stdout pipe ──► goroutine 1 ──┐
    │                                │
    └─ stderr pipe ──► goroutine 2 ──┤
                                     │
                         bufio.Scanner (1MB buffer)
                         reads line by line
                                     │
                         ParseStreamEvent(line)
                         ExtractToolActivity(event)
                                     │
                                     ▼
                         chan tea.Msg (buffered, capacity 100)
                                     │
                         ListenToOutput() ◄──── recursive: each
                                     │          Update() re-invokes
                                     ▼          ListenToOutput()
                         Bubble Tea Update()
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                    ToolActivityMsg         ClaudeOutputMsg
                         │                   (raw JSON, unused)
                         ▼
                    m.CurrentTool = "Read"
                    m.CurrentActivity = "Reading: src/app.ts"
                    m.RecentActivities (last 10)
                         │
                         ▼
                    View() renders activity panel
```

Source: [`runner.go:109-246`](cmd/prism-cli/claude/runner.go#L109-L246)

### Channel Bridge Pattern

The core pattern connecting Go's `os/exec` pipes to Bubble Tea's event loop:

1. **Channel creation** — A buffered `chan tea.Msg` (capacity 100) is created at iteration start
   - Source: [`update.go:333`](cmd/prism-cli/app/update.go#L333)

2. **Two producer goroutines** — Read stdout and stderr pipes concurrently via `streamOutput()`
   - Source: [`runner.go:152-163`](cmd/prism-cli/claude/runner.go#L152-L163)

3. **Line parsing** — Each line is attempted as JSON via `ParseStreamEvent()`. Valid events get tool activity extracted; invalid lines become raw `ClaudeOutputMsg`
   - Source: [`runner.go:219-244`](cmd/prism-cli/claude/runner.go#L219-L244)

4. **Consumer bridge** — `ListenToOutput()` returns a `tea.Cmd` that blocks on the channel. When a message arrives, it's returned to Bubble Tea's `Update()`. The handler then calls `ListenToOutput()` again, creating a recursive drain:
   ```
   ListenToOutput() → blocks → returns msg → Update() → ListenToOutput() → ...
   ```
   - Source: [`runner.go:192-200`](cmd/prism-cli/claude/runner.go#L192-L200), [`update.go:223-235`](cmd/prism-cli/app/update.go#L223-L235)

5. **Channel close** — When both pipes close (process exits), the channel is closed and `RunClaudeStreamingCmd` returns `ClaudeFinishedMsg` with the full accumulated output
   - Source: [`runner.go:177-188`](cmd/prism-cli/claude/runner.go#L177-L188)

### Tool Activity Extraction

`formatToolUse()` maps Claude tool names to human-readable descriptions:

| Tool | Display Example |
|------|----------------|
| `Read` | `Reading: src/components/Button.tsx` |
| `Edit` | `Editing: src/services/user.ts` |
| `Write` | `Writing: src/utils/helpers.ts` |
| `Bash` | `Running: npm run typecheck` |
| `Glob` | `Finding: **/*.test.ts` |
| `Grep` | `Searching: handleSubmit` |
| `Task` | `Agent: Exploring test patterns` |
| `WebFetch` | `Fetching: https://docs.example.com` |
| `WebSearch` | `Web search...` |
| `TodoWrite` | `Updating tasks...` |

Source: [`events.go:104-173`](cmd/prism-cli/claude/events.go#L104-L173)

File paths are shortened for display (backslashes normalized, long paths truncated to last 2 components).

---

## 3. Signal Protocol & Iteration Loop

### Signal Tags

Claude's `/prism-spectrum` skill embeds XML-like tags in its output to communicate iteration outcomes. These are parsed by regex after the process completes.

| Signal | Tag | Priority | Orchestrator Action |
|--------|-----|----------|-------------------|
| Complete | `<promise>COMPLETE</promise>` | 1 (highest) | Stop execution (TUI verifies remaining count = 0) |
| Error | `<spectrum-error reason="...">content</spectrum-error>` | 2 | Fatal stop |
| Retry | `<spectrum-retry reason="...">content</spectrum-retry>` | 3 | Re-run iteration (up to 3 consecutive) |
| Blocked | `<spectrum-blocked reason="...">content</spectrum-blocked>` | 4 | Skip story, try next |
| Continue | `<spectrum-continue>content</spectrum-continue>` | 5 (lowest) | Move to next story |

Priority matters when multiple signals appear in the same output — the highest-priority signal wins.

Additionally, `<spectrum-story>` tags announce which story is being worked on:
```xml
<spectrum-story>
ID: STORY-003
Title: Add user authentication
Priority: 5
Files:
- src/auth/login.ts
- src/auth/middleware.ts
</spectrum-story>
```

Source: [`signals.go:44-53`](cmd/prism-cli/domain/signals.go#L44-L53)

### TUI Signal Handling

After `ClaudeFinishedMsg` arrives, the full accumulated output is parsed:

```go
signal := domain.ParseSignal(msg.Output)
```

Then `handleSignal()` routes the response:

| Signal | Handler Behavior |
|--------|-----------------|
| **Complete** | Verifies `RemainingCount() == 0`. If stories remain, logs a warning about a likely skill bug and continues anyway. Otherwise sets `StateComplete`. |
| **Continue** | Schedules `StartNextIterationMsg` after configurable pause (default 2s). |
| **Retry** | Increments `ConsecutiveErrs`. If >= 3, sets `StateError`. Otherwise schedules next iteration. |
| **Blocked** | Schedules next iteration (Claude will pick a different unblocked story). |
| **Error** | Sets `StateError`, stops execution. |
| **No signal** | Assumes continue — schedules next iteration. |

Source: [`update.go:622-676`](cmd/prism-cli/app/update.go#L622-L676)

### Bash Signal Handling

Uses `grep -q` for each tag and maps to return codes:

| Return Code | Signal | Action |
|-------------|--------|--------|
| 0 | Complete | Break loop |
| 1 | Continue/Blocked | Reset error count, continue |
| 2 | Retry | Increment error count |
| 3 | Error | Increment error count |

Source: [`spectrum.sh:176-209`](scripts/spectrum.sh#L176-L209)

### Iteration Loop State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
  ┌──────────┐  Enter   ┌──────────────┐  signal    ┌─────┴──────┐
  │  Idle    │────────►│   Running     │──────────►│  Evaluate   │
  └──────────┘         │              │            │  Signal     │
                       │  spawn claude│            └─────┬──────┘
                       │  stream JSON │                  │
                       │  display     │     ┌────────────┼────────────┐
                       │  activity    │     │            │            │
                       └──────┬───────┘     ▼            ▼            ▼
                              │        Continue/      Complete      Error
                              │        Blocked/                  (or 3x retry)
                        ┌─────┴─────┐  Retry                        │
                        │  Paused   │    │                           ▼
                        │  (p key)  │    │ pause              ┌──────────┐
                        └─────┬─────┘    │ (2s)               │  Error   │
                              │          │                    └──────────┘
                              └──────────┤
                                         │                ┌───────────────┐
                                         └───────────────►│  Max Iters    │
                                          (if limit hit)  └───────────────┘
```

### Iteration Lifecycle (TUI)

1. **`StartExecutionMsg`** — User presses Enter. Sets `StateRunning`, `Iteration = 0`, emits `StartNextIterationMsg`.
   - Source: [`update.go:359-392`](cmd/prism-cli/app/update.go#L359-L392)

2. **`StartNextIterationMsg`** — Checks pause state and max iterations. Increments iteration counter. Creates output channel. Batches `RunClaudeStreamingCmd` + `ListenToOutput`.
   - Source: [`update.go:308-337`](cmd/prism-cli/app/update.go#L308-L337)

3. **Streaming** — `ToolActivityMsg` and `ClaudeOutputMsg` arrive via channel. Each handler re-invokes `ListenToOutput()` to keep draining.
   - Source: [`update.go:205-236`](cmd/prism-cli/app/update.go#L205-L236)

4. **`ClaudeFinishedMsg`** — Nils the output channel. On error: increments `ConsecutiveErrs`, retries with backoff (`ConsecutiveErrs * 2s`). On success: parses signal, batches `ReloadStoriesCmd` + `SignalDetectedMsg`.
   - Source: [`update.go:238-279`](cmd/prism-cli/app/update.go#L238-L279)

5. **`SignalDetectedMsg`** — Routes through `handleSignal()`. Most paths schedule `StartNextIterationMsg` after a `tea.Tick` delay, looping back to step 2.
   - Source: [`update.go:281-282`](cmd/prism-cli/app/update.go#L281-L282)

6. **`StoriesReloadedMsg`** — Refreshes the story list and progress animation target from the reloaded `stories.json`.
   - Source: [`update.go:185-196`](cmd/prism-cli/app/update.go#L185-L196)

### Iteration Lifecycle (Bash)

```bash
while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$((iteration + 1))
    remaining=$(jq '[.stories[] | select(.status != "complete")] | length' stories.json)

    [[ $remaining -eq 0 ]] && break  # All done

    output=$(claude --dangerously-skip-permissions --print "$prompt" 2>&1)
    check_signals "$output"           # Returns 0-3

    case $signal in
        0) break ;;                   # COMPLETE
        1) consecutive_errors=0 ;;    # CONTINUE
        2) consecutive_errors++ ;;    # RETRY
        3) consecutive_errors++ ;;    # ERROR
    esac

    [[ $consecutive_errors -ge 3 ]] && exit 1
    sleep "$PAUSE"
done
```

Source: [`spectrum.sh:235-286`](scripts/spectrum.sh#L235-L286)

### File Mutation Flow

```
stories.json (on disk)
    │
    │  Read by Claude's /prism-spectrum skill at iteration start
    │  Skill calls GetNextStory() logic: filter complete/blocked, sort by priority
    │
    │  Skill marks story "in_progress", writes back to disk
    │  Skill implements the story (reads/edits/tests code)
    │  Skill marks story "complete" with commit hash, writes back to disk
    │
    │  Skill appends entry to progress.md (learnings, files changed, quality gates)
    │  Skill emits signal tag in output
    │
    ▼
stories.json (updated on disk)
    │
    │  Orchestrator reloads after ClaudeFinishedMsg:
    │    TUI: ReloadStoriesCmd → domain.LoadStoriesFile()
    │    Bash: jq query for remaining count
    │
    ▼
Display updated (TUI: story list, progress bar, animations)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Orchestrator (TUI or spectrum.sh)                                  │
│                                                                     │
│  ┌──────────────┐    spawn     ┌────────────────────────────────┐   │
│  │  Iteration   │────────────►│  claude CLI child process       │   │
│  │  Loop        │             │                                 │   │
│  │              │   stdout    │  Flags:                         │   │
│  │  - spawn     │◄───────────│  --dangerously-skip-permissions │   │
│  │  - stream    │  (NDJSON)  │  --print                        │   │
│  │  - parse     │             │  --output-format stream-json    │   │
│  │  - signal    │             │  --verbose                      │   │
│  │  - reload    │             │                                 │   │
│  │  - loop      │   signal   │  Executes /prism-spectrum skill: │   │
│  │              │◄───────────│  1. Read stories.json            │   │
│  │              │  (in text) │  2. Pick next story (priority)   │   │
│  │              │             │  3. Mark in_progress             │   │
│  └──────┬───────┘             │  4. Implement (read/edit/test)  │   │
│         │                     │  5. Mark complete + commit hash │   │
│         │ reload              │  6. Append to progress.md       │   │
│         │ after each          │  7. Emit signal tag             │   │
│         │ iteration           └───────────────┬─────────────────┘   │
│         │                                     │ write               │
│         ▼                                     ▼                     │
│    stories.json ◄──── mutated by ────── Claude skill                │
│    (status, commitHash)                                             │
│                                                                     │
│    progress.md  ◄──── appended by ───── Claude skill                │
│    (learnings, files, quality gates)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Comparison Table

| Aspect | TUI (Go) | spectrum.sh (Bash) |
|--------|----------|-------------------|
| Binary | `claude` | `claude` |
| Core flags | `--dangerously-skip-permissions --print` | `--dangerously-skip-permissions --print` |
| Streaming | `--output-format stream-json --verbose` | None (plain text) |
| Protocol | NDJSON (one JSON per line) | Plain text |
| Signal detection | Regex on accumulated buffer | `grep -q` on full output |
| Real-time display | Tool activity panel + animations | Optional verbose to stderr |
| Process kill (Win) | `taskkill /F /T /PID` | N/A |
| Process kill (Unix) | `cmd.Process.Kill()` | Normal lifecycle |
| Timeout | 30 minutes | None |
| Max iterations | `-n` flag (default 50) | `SPECTRUM_MAX_ITERATIONS` (default 50) |
| Pause | Configurable (default 2s) | `SPECTRUM_PAUSE` (default 2s) |
| Error tolerance | 3 consecutive | 3 consecutive |
| Pause/Resume | `p` key toggles | Not supported |
| Epic support | Tab selector UI | Path argument |
