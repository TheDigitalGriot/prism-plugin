---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Spectrum Autonomous Execution Workflow"
tags: [research, spectrum, autonomous-execution, stories, signals, prism-spectrum]
status: complete
---

# Research: Spectrum Autonomous Execution Workflow

## Research Question

Understand how the Spectrum autonomous execution workflow works in this project. Research the spectrum.sh script and prism-spectrum skill.

## Summary

Spectrum is an autonomous execution system that decomposes approved Prism plans into atomic stories and executes them one per fresh Claude CLI session in a loop. The system has three layers: a shell orchestrator (`scripts/spectrum.sh`) that manages the iteration loop, a plugin skill (`skills/prism-spectrum/SKILL.md`) that defines the per-session behavior, and shared TypeScript/Go libraries that handle signal parsing, story management, and progress tracking. State persists entirely through files (`stories.json` and `progress.md`) rather than AI context, enabling fresh context per iteration without degradation.

## Files Discovered

| File | Purpose |
|------|---------|
| `scripts/spectrum.sh` | Shell-based iteration loop orchestrator |
| `skills/prism-spectrum/SKILL.md` | Per-session story execution skill definition |
| `commands/decompose_plan.md` | Converts approved plans into stories.json |
| `packages/prism-core/src/core/controller/prism/spectrum.ts` | SpectrumEngine state machine (VSCode-native) |
| `packages/prism-core/src/core/controller/prism/spectrum-runner.ts` | Per-iteration CLI subprocess manager (VSCode) |
| `packages/prism-core/src/core/controller/prism/plugin-bridge.ts` | Maps commands to Prism skills, spawns Claude CLI |
| `packages/prism-core/src/prism/signals.ts` | Signal protocol parser (TypeScript port) |
| `packages/prism-core/src/prism/progress.ts` | Progress.md file management (TypeScript port) |
| `packages/prism-core/src/prism/stories.ts` | Story selection, blocking, and file I/O |
| `cmd/prism-cli/domain/signals.go` | Signal protocol parser (Go original) |
| `cmd/prism-cli/domain/progress.go` | Progress file management (Go original) |
| `agents/log-investigator.md` | Debug agent: log analysis on quality gate failure |
| `agents/state-investigator.md` | Debug agent: app state anomaly detection |
| `agents/git-investigator.md` | Debug agent: git history analysis |
| `prism-docs/docs/vscode/spectrum.md` | VSCode Spectrum execution documentation |
| `prism-docs/docs/cli/screens/spectrum.md` | CLI TUI Spectrum dashboard documentation |
| `.prism/shared/docs/update/prism-v2-update/spectrum-migration-summary.md` | Migration history from "Ralph" to "Spectrum" |

## Component Analysis

### 1. Shell Orchestrator: `spectrum.sh`

**Location**: `scripts/spectrum.sh`

**How it works**:

The shell script is the outer loop that spawns fresh Claude CLI sessions iteratively. It runs from the project directory where `.prism/` exists.

- **Prerequisites check** (`spectrum.sh:75-94`): Verifies `claude` CLI and `jq` are installed, and that the stories file exists.
- **Stories file path** (`spectrum.sh:36`): Defaults to `$PROJECT_DIR/.prism/stories/stories.json`, or accepts a custom path as the first argument.
- **Progress path derivation** (`spectrum.sh:41-61`): Derives progress.md location from stories path. Supports two layouts:
  - Flat: `.prism/stories/stories.json` maps to `.prism/shared/spectrum/progress.md`
  - Epic-scoped: `.prism/stories/<epic>/stories.json` maps to `.prism/shared/spectrum/<epic>/progress.md`
- **Progress initialization** (`spectrum.sh:112-137`): Creates progress.md with YAML frontmatter if it does not exist.
- **Story counting** (`spectrum.sh:97-104`): Uses `jq` to count remaining and total stories from stories.json.
- **Iteration loop** (`spectrum.sh:235-286`): Runs up to `MAX_ITERATIONS` (default 50). Each iteration:
  1. Checks if all stories are complete (remaining == 0)
  2. Calls `run_iteration()` which spawns `claude --dangerously-skip-permissions --print` with a prompt referencing the stories file and progress file paths
  3. Captures output and checks for signal tags via `check_signals()`
  4. Handles signal: 0=complete (break), 1=continue, 2=retry, 3=error
  5. Tracks consecutive errors (max 3 before stopping)
  6. Pauses `SPECTRUM_PAUSE` seconds (default 2) between iterations

**Configuration** (environment variables, `spectrum.sh:64-66`):
- `SPECTRUM_MAX_ITERATIONS`: default 50
- `SPECTRUM_VERBOSE`: default false (when true, tees output to stderr)
- `SPECTRUM_PAUSE`: default 2 seconds between iterations

**Data flow**:
```
spectrum.sh loop → claude CLI (fresh session) → prism-spectrum skill → stories.json + progress.md → spectrum.sh reads signals
```

### 2. Per-Session Skill: `prism-spectrum`

**Location**: `skills/prism-spectrum/SKILL.md`

**How it works**:

This skill defines the behavior of each individual Claude session spawned by spectrum.sh. Each session executes exactly one story.

**Workflow steps** (`SKILL.md:35-406`):
1. **Load State** (`SKILL.md:35-49`): Reads stories.json, progress.md, and CLAUDE.md completely before doing anything. Identifies total, completed, pending, and blocked stories.
2. **Load Epic + Story Context** (`SKILL.md:53-62`): Extracts `epic.decisions`, `epic.risks`, `epic.outOfScope`, `epic.references`, and per-story `context.why`, `context.risks`, `context.patterns`, `context.edgeCases`.
3. **Graph Verification** (`SKILL.md:64-79`): Optional step using codebase-memory-mcp. Runs `index_repository`, traces call paths for `graphTargets`, checks blast radius. After implementation, runs dead code check.
4. **Check Completion** (`SKILL.md:83-89`): If no incomplete stories remain, outputs `<promise>COMPLETE</promise>` and exits immediately.
5. **Pick Next Story** (`SKILL.md:93-104`): Selects highest priority incomplete story that is not blocked. Blocked stories (where `blockedBy` references an incomplete story) are skipped.
6. **Announce Story** (`SKILL.md:108-117`): Outputs `<spectrum-story>` tag with ID, title, priority, and files.
7. **Implement Story** (`SKILL.md:119-133`): Reads all files in the story's `files` array before making changes. Follows story steps. Marks each step `done` as completed.
8. **Run Quality Gates** (`SKILL.md:135-157`): Executes all commands from `epic.qualityGates`. On failure, spawns debug agents and outputs `<spectrum-retry>`.
9. **Browser Verification** (`SKILL.md:159-181`): Optional step for UI files. Uses playwright-cli for screenshots and console error checks.
10. **Commit Changes** (`SKILL.md:183-196`): Creates a git commit with format `[STORY-XXX] Story title`.
11. **Update State Files** (`SKILL.md:198-229`): Updates stories.json (status to "complete", adds commitHash, marks steps done) and appends entry to progress.md (learnings, files changed, quality gates status).
12. **Signal Continuation** (`SKILL.md:231-258`): Re-reads stories.json, counts remaining, and outputs either `<spectrum-continue>` or `<promise>COMPLETE</promise>`.

**Philosophy** (`SKILL.md:7-13`):
- Fresh Start: each session loads all context from files
- One Story: exactly one story per invocation
- Quality Gates: must pass before commit
- Atomic Commits: one story = one commit
- Learn Forward: capture learnings for future iterations

### 3. Signal Protocol

**Location**: `packages/prism-core/src/prism/signals.ts:1-169`, `cmd/prism-cli/domain/signals.go:1-191`

**How it works**:

The signal protocol uses XML-style tags embedded in Claude's output text. Both Go and TypeScript implementations use identical regex patterns and priority ordering.

**Signal types and priority** (highest to lowest, `signals.ts:58-104`, `signals.go:56-101`):

| Signal | Tag | Meaning | Orchestrator Action |
|--------|-----|---------|-------------------|
| Complete | `<promise>COMPLETE</promise>` | All stories done | Terminate loop |
| Error | `<spectrum-error reason="...">content</spectrum-error>` | Fatal error | Stop loop |
| Retry | `<spectrum-retry reason="...">content</spectrum-retry>` | Recoverable failure | Retry in fresh session |
| Blocked | `<spectrum-blocked reason="...">content</spectrum-blocked>` | Story blocked | Skip, continue loop |
| Continue | `<spectrum-continue>content</spectrum-continue>` | Story complete, more remain | Continue loop |

**Story announcement** (`signals.ts:127-169`, `signals.go:128-175`): Parses `<spectrum-story>` tags with ID, Title, Priority, and Files fields.

**Signal detection in spectrum.sh** (`spectrum.sh:176-209`): Uses `grep -q` to check for signal tags in output. Maps to return codes: 0=complete, 1=continue, 2=retry, 3=error.

### 4. Story Management

**Location**: `packages/prism-core/src/prism/stories.ts:1-114`

**How it works**:

- **Blocking resolution** (`stories.ts:15-26`): A story is blocked if its `blockedBy` field references another story whose status is not "complete". If the blocking story is not found, the story is treated as unblocked.
- **Next story selection** (`stories.ts:37-46`): Filters for non-complete, non-blocked stories, sorts by priority (ascending), returns the first.
- **Status tracking** (`stories.ts:64-89`): Stories have three statuses: `pending`, `in_progress`, `complete`. Functions exist to mark stories as in-progress or complete, with complete also setting `commitHash` and marking all steps `done: true`.
- **File I/O** (`stories.ts:101-113`): Reads/writes stories.json with `JSON.parse`/`JSON.stringify` (2-space indentation).

### 5. Progress File Management

**Location**: `packages/prism-core/src/prism/progress.ts:1-204`

**How it works**:

- **Path derivation** (`progress.ts:75-91`): Mirrors the shell script's `derive_progress_path()` logic. Supports flat and epic-scoped layouts.
- **Initialization** (`progress.ts:123-142`): Creates progress.md with YAML frontmatter containing epic name, timestamps, and a "Codebase Patterns (Consolidated)" section.
- **Entry appending** (`progress.ts:145-163`): Appends markdown entries with timestamp, story ID, summary, learnings, files changed, and quality gates status.
- **Pattern extraction** (`progress.ts:169-203`): Reads the "Codebase Patterns" section and extracts bullet-point patterns for use by future iterations.

### 6. SpectrumEngine (VSCode State Machine)

**Location**: `packages/prism-core/src/core/controller/prism/spectrum.ts:1-353`

**How it works**:

The SpectrumEngine is a VS Code-native state machine that mirrors the shell-based spectrum.sh loop. It provides the same execution flow but with a GUI-integrated experience.

**States** (`spectrum.ts:20-26`):
- `idle` - not running
- `running` - actively executing an iteration
- `paused` - loop suspended, waiting for resume
- `complete` - all stories finished
- `maxIterations` - hit the iteration cap
- `error` - too many consecutive errors

**State transitions** (`spectrum.ts:158-235`):
- `start()` - begins or resumes execution, starts elapsed timer
- `pause()` - suspends execution loop
- `resume()` - delegates to `start()` from paused state
- `stop()` - user-initiated stop, returns to idle
- `complete()` - all stories complete, progress = 100%
- `reachMaxIterations()` - hit iteration cap
- `error(message)` - fatal error state

**Iteration management** (`spectrum.ts:244-286`):
- `incrementIteration()` - increments counter, returns false if cap exceeded
- `setCurrentStory()` - sets current story and recalculates progress percentage
- `recordSignal()` - tracks signal type and manages consecutive error count (resets on complete/continue, increments on error)
- `hasTooManyErrors()` - checks against `maxConsecutiveErrors` threshold (default 3)

**Configuration defaults** (`spectrum.ts:95-100`): maxIterations=50, pauseMs=2000, verbose=false, maxConsecutiveErrors=3.

**Elapsed timer** (`spectrum.ts:328-339`): Runs a 1-second interval timer that updates `elapsedMs` and pushes state changes to the webview.

### 7. SpectrumRunner (VSCode Per-Iteration Executor)

**Location**: `packages/prism-core/src/core/controller/prism/spectrum-runner.ts:1-259`

**How it works**:

The SpectrumRunner handles single-iteration execution within the VSCode extension, analogous to `run_iteration()` in spectrum.sh.

**Execution flow** (`spectrum-runner.ts:95-209`):
1. Gets next pending story from `StoriesManager.getNextStory()`
2. Marks story as `in_progress`
3. Generates a UUID session ID for JSONL tracking
4. Spawns Claude CLI via `PluginBridge.executeSpectrum(storiesPath, sessionId)`
5. Parses signal from output using `parseSignal()` from the shared signals module
6. Handles signal by type:
   - `complete` / default: marks story complete, appends to progress.md
   - `blocked`: reloads stories.json fresh, emits blocked event
   - `retry`: reloads stories.json fresh, emits retry event
   - `error`: emits error event, keeps story as in_progress

**Event types** (`spectrum-runner.ts:25-34`): Emits typed events including `story_started`, `story_complete`, `story_blocked`, `story_retry`, `story_error`, `all_complete`, `no_next_story`, `tool_activity`, and `log`.

### 8. Debug Integration

**Location**: `skills/prism-spectrum/SKILL.md:292-386`, `agents/log-investigator.md`, `agents/state-investigator.md`, `agents/git-investigator.md`

**How it works**:

When quality gates fail, the prism-spectrum skill spawns three parallel debug investigation agents before retrying:

- **log-investigator** (`agents/log-investigator.md:1-107`): Haiku model. Searches log files for errors, warnings, stack traces, and patterns. Reports with timestamps and relevance assessment.
- **state-investigator** (`agents/state-investigator.md:1-122`): Haiku model. Examines databases, config files, environment variables, caches. Checks for missing config, corrupted state, prerequisite failures.
- **git-investigator** (`agents/git-investigator.md:1-141`): Haiku model. Analyzes current branch state, recent commits, uncommitted changes, and identifies potential regression points.

**Debug flow** (`SKILL.md:298-338`):
1. Capture full error output with file:line references and stack traces
2. Spawn all three investigators in parallel via Task tool
3. Synthesize findings into root cause hypothesis and fix approach
4. Record everything in progress.md (error output, investigation findings, root cause, suggested fix, files to examine)
5. Output enhanced `<spectrum-retry>` signal with XML-structured debug context

### 9. Plan Decomposition

**Location**: `commands/decompose_plan.md:1-306`

**How it works**:

The `/decompose_plan` command converts an approved Prism plan into Spectrum-compatible stories.json. Uses Opus model.

**Decomposition process** (`decompose_plan.md:18-55`):
- Phase with 1-3 small steps becomes a single story
- Phase with 4+ steps is split into multiple stories
- Each story must be atomic (one commit), testable, independent, and small (15-30 minutes of AI work)

**Priority ranges** (`decompose_plan.md:76-84`):
- 1-10: Foundation (types, interfaces, schemas)
- 11-20: Core implementation (main logic, services)
- 21-30: Integration (wiring, API routes)
- 31-40: Tests and validation
- 41-50: Documentation and polish

**Dependency ordering** (`decompose_plan.md:62-72`): Sets `blockedBy` when one story creates files that another modifies, or when imports/tests depend on earlier stories.

**Output** (`decompose_plan.md:216-253`): Generates `stories.json` with epic metadata (name, source, qualityGates, decisions, references, outOfScope, risks) and story array. Also creates initial `progress.md`.

### 10. Historical Context: Ralph to Spectrum Migration

**Location**: `.prism/shared/docs/update/prism-v2-update/spectrum-migration-summary.md:1-231`

The Spectrum system was originally named "Ralph." The migration renamed all files, directories, and references. The key architectural change during migration was separating `stories.json` (task definitions) from `progress.md` (execution state) into distinct directories:
- `.prism/stories/` for task definitions
- `.prism/shared/spectrum/` for execution state

The TUI dashboard was also renamed from `cmd/ralph-tui/` to `cmd/prism-cli/`.

## Patterns Found

### Signal Protocol Pattern

**Example at**: `packages/prism-core/src/prism/signals.ts:58-104`

The signal protocol uses XML-style tags with a strict priority ordering (Complete > Error > Retry > Blocked > Continue). This pattern is implemented identically in three places:
- `cmd/prism-cli/domain/signals.go:56-101` (Go original)
- `packages/prism-core/src/prism/signals.ts:58-104` (TypeScript port)
- `scripts/spectrum.sh:176-209` (Bash grep-based detection)

### Fresh Context Per Iteration Pattern

**Example at**: `scripts/spectrum.sh:163-168`

Each iteration spawns a completely fresh Claude CLI session via `claude --dangerously-skip-permissions --print`. Memory persists only through files on disk (stories.json and progress.md), not through AI context windows. This prevents context degradation over long execution runs.

### Atomic Story Execution Pattern

**Example at**: `skills/prism-spectrum/SKILL.md:119-196`

Each session reads all relevant files, implements exactly one story, runs quality gates, creates exactly one git commit, updates state files, and emits a signal. This ensures each iteration is self-contained and recoverable.

### Progress Path Derivation Pattern

**Example at**: `scripts/spectrum.sh:41-61`, `packages/prism-core/src/prism/progress.ts:75-91`

Both the shell script and TypeScript implementation use identical logic to derive the progress.md path from the stories.json path, supporting flat and epic-scoped layouts.

### Consecutive Error Circuit Breaker Pattern

**Example at**: `scripts/spectrum.sh:276-279`, `packages/prism-core/src/core/controller/prism/spectrum.ts:288-291`

Both the shell and TypeScript implementations track consecutive errors and stop execution after 3 consecutive failures (configurable). Successful iterations reset the counter.

## Architecture Notes

- **Three execution surfaces**: Spectrum runs through three interfaces: shell script (CLI), Go TUI dashboard (cmd/prism-cli), and VSCode extension (packages/prism-core). All share the same signal protocol and stories.json/progress.md file formats.
- **Code duplication by design**: Signal parsing, story management, and progress file management are implemented in both Go (for the CLI TUI) and TypeScript (for VSCode/Electron), with the TypeScript versions documented as ports of the Go originals.
- **Plugin bridge mapping**: The VSCode extension maps `prism.spectrum` command to the `prism-spectrum` skill via `plugin-bridge.ts:36-44`. The `prism-spectrum` skill is classified as a "workflow skill" alongside research, plan, implement, and validate.
- **stories.json schema**: Contains an `epic` object (name, source, qualityGates, decisions, references, outOfScope, risks) and a `stories` array. Each story has id, title, description, priority, status, blockedBy, files (path + action), steps (description + done), and optional context (why, risks, edgeCases, patterns, graphTargets).
- **Environment variable configuration**: `SPECTRUM_MAX_ITERATIONS` (default 50), `SPECTRUM_VERBOSE` (default false), `SPECTRUM_PAUSE` (default 2 seconds).

## Open Questions

- [ ] How does the Go CLI TUI (`cmd/prism-cli/`) interact with Spectrum at runtime? (No spectrum-specific Go screen files were found in the cmd/prism-cli directory.)
- [ ] What is the relationship between the `StoriesManager` class used in `spectrum-runner.ts` and the functional `stories.ts` module?
- [ ] How does the `PluginBridge.executeSpectrum()` method construct the Claude CLI invocation? (Only the first 60 lines of plugin-bridge.ts were read.)

## Code References

| Reference | Description |
|-----------|-------------|
| `scripts/spectrum.sh:155-173` | `run_iteration()` - spawns fresh Claude CLI session |
| `scripts/spectrum.sh:176-209` | `check_signals()` - bash signal detection via grep |
| `scripts/spectrum.sh:235-286` | Main iteration loop |
| `scripts/spectrum.sh:41-61` | `derive_progress_path()` - flat vs epic-scoped path derivation |
| `skills/prism-spectrum/SKILL.md:35-49` | Step 1: Load State workflow |
| `skills/prism-spectrum/SKILL.md:93-104` | Step 3: Pick Next Story (priority-based selection) |
| `skills/prism-spectrum/SKILL.md:135-157` | Step 6: Quality Gates with debug integration |
| `skills/prism-spectrum/SKILL.md:231-258` | Step 9: Signal Continuation with verification |
| `packages/prism-core/src/prism/signals.ts:58-104` | `parseSignal()` - TypeScript signal parser |
| `packages/prism-core/src/prism/signals.ts:127-169` | `parseStoryAnnouncement()` - story tag parser |
| `packages/prism-core/src/prism/stories.ts:37-46` | `getNextStory()` - priority-based story selection |
| `packages/prism-core/src/prism/stories.ts:15-26` | `isBlocked()` - dependency resolution |
| `packages/prism-core/src/prism/progress.ts:75-91` | `progressPathFromStories()` - path derivation |
| `packages/prism-core/src/prism/progress.ts:145-163` | `ProgressFile.appendEntry()` - progress log appending |
| `packages/prism-core/src/core/controller/prism/spectrum.ts:112-128` | `SpectrumEngine` constructor and config |
| `packages/prism-core/src/core/controller/prism/spectrum.ts:158-174` | `start()` - begin/resume execution |
| `packages/prism-core/src/core/controller/prism/spectrum.ts:245-255` | `incrementIteration()` - iteration management |
| `packages/prism-core/src/core/controller/prism/spectrum.ts:267-286` | `recordSignal()` - signal tracking with error counting |
| `packages/prism-core/src/core/controller/prism/spectrum-runner.ts:95-209` | `runIteration()` - single iteration execution |
| `cmd/prism-cli/domain/signals.go:56-101` | `ParseSignal()` - Go signal parser (original) |
| `cmd/prism-cli/domain/signals.go:128-175` | `ParseStoryAnnouncement()` - Go story tag parser |
| `commands/decompose_plan.md:129-148` | Story JSON schema definition |
| `commands/decompose_plan.md:76-84` | Priority range conventions |
| `agents/log-investigator.md:8-11` | Log investigation purpose (Haiku model) |
| `agents/state-investigator.md:8-11` | State investigation purpose (Haiku model) |
| `agents/git-investigator.md:8-11` | Git investigation purpose (Haiku model) |
