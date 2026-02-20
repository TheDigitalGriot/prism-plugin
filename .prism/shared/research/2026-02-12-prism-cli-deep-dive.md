# Prism CLI Deep Dive Research

**Date**: 2026-02-12
**Researcher**: Claude Opus 4.6
**Purpose**: Comprehensive documentation of prism-cli CLI application

---

## Executive Summary

The Prism CLI is a sophisticated Go-based terminal user interface application built with the Charmbracelet ecosystem (Bubble Tea, Lipgloss, Harmonica, FauxGL) that provides a real-time dashboard for autonomous development workflow execution via the Spectrum protocol. The application features:

- **4 main screens**: Home, Research, Plans, Spectrum execution dashboard
- **3D animated prism logo** rendered using FauxGL with half-block Unicode encoding
- **Real-time execution monitoring** with streaming Claude CLI output and tool activity tracking
- **Spring physics animations** using Harmonica for organic UI transitions
- **Signal-based workflow control** parsing XML-like tags from Claude output
- **Epic-based story organization** with dependency tracking and quality gate validation

---

## Research Question

How does the prism-cli CLI application work end-to-end? What are all the screens, components, navigation flows, state management patterns, animation systems, 3D rendering pipeline, Claude integration mechanisms, and domain models?

---

## Files Discovered

### Entry Point & Configuration
| File | Lines | Purpose |
|------|-------|---------|
| `cmd/prism-cli/main.go` | 153 | CLI entry point, Cobra command setup, TUI initialization |
| `cmd/prism-cli/Makefile` | ~50 | Build targets, cross-compilation, test/lint commands |
| `cmd/prism-cli/go.mod` | ~40 | Go 1.22 module with Charmbracelet dependencies |
| `cmd/prism-cli/build.sh` | ~20 | Single-platform build script |

### UI Framework (`app/`)
| File | Lines | Purpose |
|------|-------|---------|
| `app/model.go` | 419 | Main TUI state, AnimState structure, Model initialization |
| `app/update.go` | 701 | Bubble Tea Update handler, message routing, state transitions |
| `app/view.go` | 127 | View router, shared rendering utilities, progress bar |
| `app/commands.go` | ~274 | Async commands for loading stories/files/epics |
| `app/messages.go` | ~60 | Message type definitions for Bubble Tea event loop |
| `app/views.go` | ~80 | View state types, file entry structures |
| `app/view_home.go` | ~98 | Home screen menu with 3D prism + logo |
| `app/view_research.go` | ~97 | Research file browser with viewport |
| `app/view_plans.go` | ~104 | Plans file browser with decompose command |
| `app/view_spectrum.go` | ~487 | Spectrum execution dashboard with 5 sub-panels |

### Domain Logic (`domain/`)
| File | Lines | Purpose |
|------|-------|---------|
| `domain/story.go` | 176 | Story/Plan data structures, dependency resolution |
| `domain/signals.go` | ~190 | Signal parsing (Complete, Continue, Retry, Blocked, Error) |
| `domain/progress.go` | 216 | Progress.md file management and path derivation |
| `domain/progress_test.go` | ~50 | Tests for progress file logic |
| `domain/signals_test.go` | ~50 | Tests for signal detection |

### Claude Integration (`claude/`)
| File | Lines | Purpose |
|------|-------|---------|
| `claude/runner.go` | ~292 | Claude CLI process spawning and streaming output |
| `claude/parser.go` | ~208 | Real-time output parsing for phases/signals/quality gates |
| `claude/events.go` | ~192 | Stream-JSON event parsing and tool activity formatting |

### 3D Rendering (`prism/`)
| File | Lines | Purpose |
|------|-------|---------|
| `prism/prism.go` | 266 | FauxGL 3D renderer with half-block ANSI encoding |
| `prism/framebuffer/buffer.go` | 63 | RGBA pixel buffer with dirty tracking |
| `prism/prism-test.obj` | 1510 | Embedded 3D prism mesh (444 vertices, 360 faces) |
| `prism/prism-test.mtl` | ~20 | Material definition for 3D mesh |

### Styling & Theming (`styles/`)
| File | Lines | Purpose |
|------|-------|---------|
| `styles/theme.go` | ~365 | Color palette, component styles, 7 prism logo variants |
| `styles/gradient.go` | ~117 | Color interpolation, gradients, shimmer effects |

### Documentation
| File | Purpose |
|------|---------|
| `.prism/shared/docs/claude-cli-communication-tui.md` | Technical docs on Claude CLI communication and request/response flow |

---

## Component Analysis

### 1. Bubble Tea UI Architecture

**Pattern**: Elm Architecture (Model-Update-View)

**Model** (`app/model.go:39-192`):
```go
type Model struct {
    // State management
    AppState        AppState          // Idle, Running, Paused, Complete, Error
    ActiveView      ActiveView        // Home, Research, Plans, Spectrum
    Ready           bool              // Initialization complete flag

    // Screen states
    Home            HomeState         // Menu selection
    Research        ResearchState     // File browser state
    Plans           PlansState        // File browser state
    Epic            EpicState         // Epic selector state

    // Story execution
    Stories         []StoryView       // Display stories
    CurrentStoryIdx int               // Active story index
    Iteration       int               // Current iteration counter
    StartTime       time.Time         // Execution start time

    // Claude integration
    Claude          *claude.Runner    // CLI process manager
    CurrentTool     string            // Active tool name
    CurrentActivity string            // Human-readable activity
    RecentActivities []string         // Last 10 activities

    // UI components
    Spinner         spinner.Model     // Loading spinner
    Progress        progress.Model    // Progress bar (unused, custom render)
    StoryPaginator  paginator.Model   // Story list pagination
    LogPaginator    paginator.Model   // Log list pagination
    Prism           *prism.Renderer   // 3D prism renderer

    // Animation state
    Anim            AnimState         // All spring physics and animation data

    // Configuration
    StoriesPath     string            // Path to stories.json
    PrismDir        string            // Path to .prism/ directory
    MaxIterations   int               // Iteration limit
    Pause           int               // Seconds between iterations
    MaxConsecutiveErrs int            // Error limit before stopping

    // Dimensions
    Width, Height   int               // Terminal size
}
```

**Update Loop** (`app/update.go:54-676`):

The Update function is a 700-line message dispatcher handling:

1. **Initialization** (lines 55-62): Window resize and ready state
2. **Tick-driven animations** (lines 87-164): 100ms ticks update all spring physics
3. **User input** (lines 575-619): Global handler dispatches to view-specific handlers
4. **Story loading** (lines 166-183): Populate stories from JSON
5. **File content** (lines 532-545): Load markdown files into viewports
6. **Epic discovery** (lines 484-512): Multi-epic story organization
7. **Execution control** (lines 359-392): Start, pause, resume, skip
8. **Iteration loop** (lines 308-337): Start next iteration with checks
9. **Claude output** (lines 205-236): Real-time tool activity and raw output
10. **Claude completion** (lines 238-279): Parse signals, reload stories, handle errors
11. **Signal processing** (lines 622-676): Workflow control based on signal type

**View Routing** (`app/view.go:14-31`):

```go
func (m Model) View() string {
    if !m.Ready { return "\n  Initializing..." }
    switch m.ActiveView {
    case ViewHome:     return m.renderHomeView()
    case ViewResearch: return m.renderResearchView()
    case ViewPlans:    return m.renderPlansView()
    case ViewSpectrum: return m.renderSpectrumView()
    default:           return m.renderHomeView()
    }
}
```

### 2. Navigation Flow

```
                    +-----------+
                    |   Home    |  (if no stories file)
                    | [1,2,3]   |
                    +---+---+---+
                   /    |        \
              [1]/   [2]|      [3]\
                /       |          \
   +-----------+  +-----------+  +-------------+
   | Research  |  |   Plans   |  |  Spectrum   | (direct if stories exist)
   | (list)    |  |  (list)   |  |  (idle)     |
   +-----+-----+  +-----+-----+  +------+------+
         |              |                |
   [enter]|        [enter]|          [enter]|
         v              v                v
   +-----------+  +-----------+  +-------------+
   | Research  |  |   Plans   |  |  Spectrum   |
   | (viewer)  |  | (viewer)  |  |  (running)  |
   +-----------+  +-----------+  +------+------+
         |              |           |         |
     [esc]|          [esc]|      [p]|    [complete]
         v              v          v         |
   back to list   back to list  Paused    +--v--------+
                                          | Complete / |
                                          | Error /    |
                                          | MaxIter    |
                                          +-----+------+
                                                |
                                          [enter]|
                                                v
                                              Quit
```

**Global Navigation** (`app/update.go:575-619`):
- `q` / `ctrl+c`: Quit from any screen
- `?`: Toggle help display
- `esc` / `backspace`: Return to Home (unless running or in file viewer)

**View-Specific Controls**:

*Home* (`app/view_home.go:70-98`):
- `j` / `down`: Next menu item
- `k` / `up`: Previous menu item
- `enter` / `space`: Select menu item
- `1` / `2` / `3`: Direct jump to Research/Plans/Spectrum

*Research/Plans List* (`app/view_research.go:77-93`):
- `j` / `down`: Next file
- `k` / `up`: Previous file
- `enter`: Open file in viewport
- `d` (Plans only): Decompose plan to epic

*Research/Plans Viewer* (`app/view_research.go:63-73`):
- `esc` / `backspace`: Close viewer
- Other keys forwarded to viewport for scrolling

*Spectrum Dashboard* (`app/view_spectrum.go:412-487`):
- `a` / `s`: Stories page prev/next
- `z` / `x`: Logs page prev/next
- `tab` / `shift+tab`: Cycle through epics
- `enter` / `space`: Start execution (Idle), Resume (Paused), Quit (Complete/Error)
- `p`: Pause (Running), Resume (Paused)
- `/`: Skip current story (Running)

### 3. Spectrum Execution Dashboard

**Layout** (`app/view_spectrum.go:14-38`):

```
┌──────────────────────────────────────────────────────────────┐
│ Epic Selector: [ProjectA (3/5)] [ProjectB (0/2)] [ProjectC] │ (if multi-epic)
├──────────────────────────────────────────────────────────────┤
│ PRISM TUI              Iteration 3/50 • [?] Help • [q] Quit │ Header
├──────────────────────────────────────────────────────────────┤
│ [3D Prism]  [PRISM ASCII]  [████████░░░░░░░░░░] 60%         │ Progress Bar
├────────────────────────────┬─────────────────────────────────┤
│ STORIES                    │ ACTIVITY                        │
│ ─────────────────────      │ ─────────────────               │
│ ✓ STORY-001: Setup...      │ 🔄 Implementing STORY-003      │ Main Panels
│ ✓ STORY-002: Add tests...  │ [spinner] Running...            │ (40/60 split)
│ ▸ STORY-003: Fix bug...    │                                 │
│ ○ STORY-004: Refactor...   │ 🔧 Bash: npm test              │
│ ○ STORY-005: Deploy...     │                                 │
│                            │ Recent:                         │
│ [a/s pagination]           │ • Edit: src/components/...     │
│                            │ • Read: tests/unit/...         │
│                            │ • Bash: npm run typecheck      │
├────────────────────────────┴─────────────────────────────────┤
│ LOGS                                                          │
│ ────                                                          │
│ 14:32:15 [INFO] Starting iteration 3                         │ Log Panel
│ 14:32:20 [OK] Quality gates passed                           │
│ 14:32:25 [OK] STORY-003 completed                            │
│ [z/x pagination]                                              │
├──────────────────────────────────────────────────────────────┤
│ ● Running • 02:15 elapsed • [p]ause [/]skip                 │ Status Bar
└──────────────────────────────────────────────────────────────┘
```

**5 Sub-Panels**:

1. **Epic Selector** (`app/view_spectrum.go:396-410`): Tab-style epic navigation (multi-epic only)
2. **Header** (`app/view_spectrum.go:40-59`): Title, iteration counter, help hints
3. **Progress Bar** (`app/view_spectrum.go:61-107`): 3D prism + ASCII logo + gradient progress bar
4. **Story List** (`app/view_spectrum.go:124-165`): Paginated stories with animated icons
5. **Activity Panel** (`app/view_spectrum.go:206-291`): Current tool + recent activities
6. **Log Panel** (`app/view_spectrum.go:293-334`): Paginated log entries with slide-in animation
7. **Status Bar** (`app/view_spectrum.go:336-393`): State indicator + elapsed time + controls

**Story Icons** (`app/view_spectrum.go:167-191`):
- **Complete**: `✓` with pop animation (scale 0.3 → 1.0 with overshoot)
- **Active**: `▸` / `▶` pulsing (brightness oscillates via sine wave)
- **Blocked**: `⊘` italic yellow
- **Pending**: `○` dim gray
- **Error**: `✗` red

### 4. Domain Models

**stories.json Structure** (`domain/story.go:11-48`):

```json
{
  "plan": {
    "name": "Feature Implementation",
    "source": ".prism/shared/plans/2026-02-12-feature.md",
    "createdAt": "2026-02-12T14:00:00Z",
    "qualityGates": ["npm run typecheck", "npm run lint", "npm test"]
  },
  "stories": [
    {
      "id": "STORY-001",
      "title": "Setup database schema",
      "description": "Create initial migration files",
      "priority": 1,
      "status": "complete",
      "blockedBy": null,
      "files": [
        {"path": "db/migrations/001_initial.sql", "action": "create"}
      ],
      "steps": [
        {"description": "Design schema", "done": true},
        {"description": "Write migration", "done": true}
      ],
      "completedAt": "2026-02-12T14:30:00Z",
      "commitHash": "abc123def456"
    },
    {
      "id": "STORY-002",
      "title": "Implement API endpoints",
      "description": "Add REST handlers",
      "priority": 2,
      "status": "in_progress",
      "blockedBy": null,
      "files": [
        {"path": "api/handlers.go", "action": "create"}
      ],
      "steps": [
        {"description": "Define routes", "done": true},
        {"description": "Implement handlers", "done": false}
      ]
    },
    {
      "id": "STORY-003",
      "title": "Write integration tests",
      "description": "Test API flows",
      "priority": 3,
      "status": "pending",
      "blockedBy": "STORY-002"
    }
  ]
}
```

**Dependency Resolution** (`domain/story.go:80-120`):

```go
// IsBlocked checks if this story is blocked by dependencies
func (s *Story) IsBlocked(stories []Story) bool {
    if s.BlockedBy == nil { return false }
    for _, other := range stories {
        if other.ID == *s.BlockedBy {
            return other.Status != "complete"
        }
    }
    return false  // Blocker not found = assume not blocked
}

// GetNextStory returns highest-priority unblocked pending story
func (sf *StoriesFile) GetNextStory() *Story {
    var candidates []Story
    for _, s := range sf.Stories {
        if s.Status == "complete" { continue }
        if s.IsBlocked(sf.Stories) { continue }
        candidates = append(candidates, s)
    }
    if len(candidates) == 0 { return nil }

    sort.Slice(candidates, func(i, j int) bool {
        return candidates[i].Priority < candidates[j].Priority
    })
    return &candidates[0]
}
```

**Signal Protocol** (`domain/signals.go:8-35`):

```go
type SignalType int

const (
    SignalNone     SignalType = iota  // No signal detected
    SignalComplete                     // <promise>COMPLETE</promise>
    SignalContinue                     // <spectrum-continue>...</spectrum-continue>
    SignalRetry                        // <spectrum-retry reason="...">...</spectrum-retry>
    SignalBlocked                      // <spectrum-blocked reason="...">...</spectrum-blocked>
    SignalError                        // <spectrum-error reason="...">...</spectrum-error>
)
```

**Signal Priority** (`domain/signals.go:56-100`):
1. **Complete** (highest): Declares current story done, all work finished
2. **Error** (fatal): Unrecoverable failure, stops execution
3. **Retry** (recoverable): Temporary failure, retry with fresh context
4. **Blocked** (dependency): Current story blocked, skip to next
5. **Continue** (default): Success, continue to next story

**Progress File** (`domain/progress.go:11-41`):

Path derivation logic:
- **Epic-based**: `.prism/stories/<epic>/stories.json` → `.prism/shared/spectrum/<epic>/progress.md`
- **Legacy flat**: `.prism/stories/stories.json` → `.prism/shared/spectrum/progress.md`

Structure:
```markdown
---
plan: Feature Implementation
startedAt: 2026-02-12T14:00:00Z
lastUpdated: 2026-02-12T14:45:00Z
---

## Codebase Patterns (Consolidated)

- API handlers follow RESTful conventions
- Database migrations use numbered prefixes
- Tests use table-driven approach

---

### 2026-02-12T14:30:00Z - STORY-001

**Summary**: Created initial database schema

**Learnings**:
- PostgreSQL UUID extension required
- Foreign key constraints must be deferred

**Files Changed**:
- db/migrations/001_initial.sql

**Quality Gates**: All passed
- typecheck: ✓
- lint: ✓
- test: ✓

---
```

### 5. Claude CLI Integration

**Command Invocation** (`claude/runner.go:109-130`):

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  --output-format stream-json \
  --verbose \
  "Execute the next story from .prism/stories/stories.json using /prism-spectrum workflow. Progress file: .prism/shared/spectrum/progress.md"
```

**Streaming Output Pipeline** (`claude/runner.go:202-246`):

```
Claude CLI stdout
       ↓
  bufio.Scanner (1MB buffer)
       ↓
  Line-by-line iteration
       ↓
  ParseStreamEvent (JSON unmarshaling)
       ↓
  ExtractToolActivity (tool-specific formatting)
       ↓
  ToolActivityMsg → output channel → Bubble Tea Update
```

**Stream-JSON Event Structure** (`claude/events.go:8-24`):

```go
type StreamEvent struct {
    Type      string            `json:"type"`       // "assistant", "tool_result", "result"
    Subtype   string            `json:"subtype"`    // Optional refinement
    ToolUseID string            `json:"tool_use_id"`
    Tool      *ToolUse          `json:"tool"`       // Tool invocation data
    Message   *AssistantMessage `json:"message"`    // Full message with content
    Result    map[string]any    `json:"result"`     // Result data
    IsError   bool              `json:"is_error"`   // Error flag
    Duration  int               `json:"duration_ms"`// Execution time
}

type ToolUse struct {
    Name  string         `json:"name"`   // "Read", "Edit", "Bash", etc.
    Input map[string]any `json:"input"`  // Tool-specific parameters
}
```

**Tool Activity Formatting** (`claude/events.go:103-173`):

| Tool | Format |
|------|--------|
| Read | `Reading: .../path/to/file.ts` (shortened) |
| Edit | `Editing: .../path/to/file.ts` (shortened) |
| Write | `Writing: .../path/to/file.ts` (shortened) |
| Bash | Command or description (truncated to 50 chars) |
| Glob | `Finding: **/*.ts` (pattern) |
| Grep | `Searching: pattern` (truncated to 40 chars) |
| Task | Agent description (truncated to 50 chars) |
| WebFetch | `Fetching: https://...` |
| WebSearch | `Web search...` |
| TodoWrite | `Updating tasks...` |
| AskUserQuestion | `Asking question...` |

**Output Parsing for Events** (`claude/parser.go:46-104`):

The OutputParser maintains a buffer of all output and detects:

1. **Story announcements** (line 52): `<spectrum-story>ID: STORY-NNN...</spectrum-story>`
2. **Phase changes** (line 65): Heuristic keyword matching (research, planning, implementing)
3. **Quality gates** (line 75): "Running quality gates", "npm run typecheck/lint/test"
4. **Commits** (line 86): "commit", "git add"
5. **Signals** (line 94): Full buffer regex scan for `<promise>` or `<spectrum-*>` tags

**Execution Flow** (`app/update.go:308-392` + `app/update.go:622-676`):

```
1. User presses Enter in Idle state
   → StartExecutionMsg (line 359)
   → State = Running, Iteration = 0
   → Emit StartNextIterationMsg

2. StartNextIterationMsg handler (line 308)
   → Increment iteration
   → Check max iterations limit
   → Create output channel
   → RunClaudeStreamingCmd + ListenToOutput

3. Claude process spawns (claude/runner.go:143)
   → Pipes created for stdout/stderr
   → Goroutines stream output to channel
   → JSON events parsed in real-time

4. Real-time updates (app/update.go:205-236)
   → ToolActivityMsg: Update current tool/activity
   → ClaudeOutputMsg: Accumulate raw output (not displayed)

5. Process completes (app/update.go:238-279)
   → Close output channel
   → Parse signal from full output
   → ReloadStoriesCmd: Read stories.json from disk
   → SignalDetectedMsg: Process workflow control

6. Signal handling (app/update.go:622-676)
   → Complete: Check remaining stories, transition to Complete or continue
   → Continue: Schedule next iteration after pause
   → Retry: Increment error counter, retry or stop if limit reached
   → Blocked: Log warning, continue to next story
   → Error: Fatal, transition to Error state
   → None: Assume continue

7. Next iteration starts
   → Loop back to step 2
```

### 6. Animation System

**Spring Physics Configuration** (`app/model.go:247-262`):

```go
Anim: AnimState{
    // Progress bar: snappy with slight overshoot
    ProgressSpring: harmonica.NewSpring(harmonica.FPS(60), 6.0, 0.7),
    ProgressPos: 0.0,
    ProgressVel: 0.0,
    ProgressTarget: 0.0,

    // Story pop: bouncy
    StoryPopSpring: harmonica.NewSpring(harmonica.FPS(60), 8.0, 0.5),
    StoryPopScales: make(map[int]float64),
    StoryPopVels: make(map[int]float64),

    // Log slide: smooth
    LogSlideSpring: harmonica.NewSpring(harmonica.FPS(60), 5.0, 0.8),
    LogEntryOffsets: []float64{},
    LogEntryVels: []float64{},

    // Ray animation: bouncy for organic light
    RaySpring: harmonica.NewSpring(harmonica.FPS(60), 4.0, 0.3),
    RayLengths: [4]float64{6, 7, 5, 8},
    RayVels: [4]float64{},
    RayTargets: [4]float64{6, 7, 5, 8},

    // Continuous animations
    PulsePhase: 0,    // Sine wave for active story icon
    ShimmerPhase: 0,  // Sine wave for prism body shimmer
}
```

**Update Loop** (`app/update.go:87-164`):

Every 100ms tick:

1. **Spinner** (line 90): Advance frame
2. **3D Prism** (line 95): Tick frame counter for rotation
3. **Progress Bar Spring** (lines 99-103):
   ```go
   m.Anim.ProgressPos, m.Anim.ProgressVel = m.Anim.ProgressSpring.Update(
       m.Anim.ProgressPos,
       m.Anim.ProgressVel,
       m.Anim.ProgressTarget,
   )
   ```
4. **Story Pop Springs** (lines 106-120): Update each active pop, cleanup finished
5. **Pulse Phase** (lines 123-126): `phase += 0.15`, wrap at 2π
6. **Log Slide Springs** (lines 129-137): Update each log entry offset toward 0.0
7. **Prism Frame** (lines 140-144): Advance frame every 3 ticks (300ms)
8. **Ray Springs** (lines 147-158): Update lengths, re-target randomly when settled
9. **Shimmer Phase** (lines 161-164): `phase += 0.08`, wrap at 2π

**Animation Triggers**:

- **Progress bar**: Target updated when stories reload (`app/update.go:194`)
- **Story pop**: Scale set to 0.3 when story completes (`app/update.go:297-299`)
- **Log slide**: Offset set to 20.0 when log added (`app/model.go:389-396`)
- **Pulse/shimmer**: Continuous, no trigger

**Animation Characteristics**:

| Animation | Stiffness | Damping | Feel |
|-----------|-----------|---------|------|
| Progress bar | 6.0 | 0.7 | Snappy, slight overshoot |
| Story pop | 8.0 | 0.5 | Very bouncy |
| Log slide | 5.0 | 0.8 | Smooth, minimal overshoot |
| Ray length | 4.0 | 0.3 | Bouncy, organic |

### 7. 3D Prism Rendering

**Pipeline** (`prism/prism.go:168-213`):

```
1. Time calculation (line 173)
   t = frame / 30.0  (assumes 30 FPS)

2. FauxGL context setup (lines 177-179)
   - Create context at pixel resolution (cols × rows*2)
   - Clear color buffer to dark purple (0.05, 0.04, 0.08)
   - Clear depth buffer

3. Camera setup (lines 183-189)
   - Eye: (0, 0, 3)
   - Center: (0, 0, 0)
   - Up: (0, 1, 0)
   - FOV: 50 degrees
   - Aspect: w / h
   - Near/far: 0.1 / 100

4. Model transformation (lines 192-197)
   - Y-axis spin: angle = t * 0.6 rad/s
   - X-axis tilt wobble: 0.3 + 0.15*sin(angle*0.7)
   - Z-axis roll: 0.1*sin(angle*0.5)
   - Matrix: rz × ry × rx

5. MVP composition (line 199)
   mvp = projection × view × model

6. Lighting setup (lines 202-205)
   - Key light: direction (0.6, 0.5, 1), cool blue-white (0.9, 0.92, 1.0), intensity 0.85
   - Fill light: direction (-0.4, -0.3, 0.5), warm amber (1.0, 0.85, 0.7), intensity 0.3

7. Custom shader (prism/prism.go:131-166)
   - Vertex: Transform by MVP
   - Fragment: Lambertian diffuse = Σ (color * intensity * max(0, N·L))

8. Draw mesh (line 208)
   ctx.DrawMesh(r.mesh)

9. Extract pixels (lines 211-212)
   img = ctx.Image()
   copyToFramebuffer(img, w, h)

10. Half-block encoding (prism/prism.go:230-266)
    - Iterate by terminal rows
    - Each row combines 2 pixel rows
    - Top pixel → foreground color (ANSI 38;2;R;G;B)
    - Bottom pixel → background color (ANSI 48;2;R;G;B)
    - Emit half-block character: ▀ (U+2580)
    - Optimize: Only emit color codes when colors change
```

**Half-Block Encoding** (`prism/prism.go:235-264`):

```
Terminal Cell:
┌───┐
│███│ ← Top pixel (foreground color)
│   │ ← Bottom pixel (background color)
└───┘

ANSI output:
\x1b[38;2;R1;G1;B1m  (foreground = top)
\x1b[48;2;R2;G2;B2m  (background = bottom)
▀                     (upper half block)
```

This technique doubles vertical resolution: each terminal row displays 2 pixels using foreground/background color pairs.

**Embedded Model** (`prism/prism.go:26-30`):

```go
//go:embed prism-test.obj
var objData []byte

//go:embed prism-test.mtl
var mtlData []byte
```

OBJ file contains:
- 444 vertices (triangular prism geometry)
- 249 vertex normals (for lighting)
- 360 triangular faces

Model is normalized to unit cube via `mesh.BiUnitCube()` at `prism/prism.go:92`.

**Resize Handling** (`app/update.go:66-75`):

```go
prismCols := msg.Width / 4  // 25% of terminal width
if prismCols < 20 { prismCols = 20 }
if prismCols > 40 { prismCols = 40 }
m.Prism.Resize(prismCols, 5)  // Fixed 5 rows
```

**Fallback Text Prism** (`styles/theme.go:217-260`):

When 3D prism unavailable, the Spectrum view uses `RenderPrismGradientSpring()`:

```
 ◢═════════════◣
 ◢◆◆◆◆◆◆◆◆◆◆◆◆◣
 ◢━━━━━━━━━━━━◣
 ◢▬▬▬▬▬▬▬▬▬▬▬▬◣
╱████████████╲
```

With spring-animated rays in spectrum colors.

### 8. Styling System

**Color Palette** (`styles/theme.go:6-23`):

```go
// Core UI colors
Primary    = lipgloss.Color("#7C3AED")  // Purple
Success    = lipgloss.Color("#10B981")  // Green
Warning    = lipgloss.Color("#F59E0B")  // Amber
Error      = lipgloss.Color("#EF4444")  // Red
Info       = lipgloss.Color("#3B82F6")  // Blue
Dim        = lipgloss.Color("#6B7280")  // Gray
Background = lipgloss.Color("#1F2937")  // Dark gray
White      = lipgloss.Color("#FFFFFF")

// Prism spectrum gradient
PrismColors = []lipgloss.Color{
    "#3B82F6",  // Blue
    "#14B8A6",  // Teal
    "#22C55E",  // Green
    "#F59E0B",  // Amber
}
```

**Component Styles** (`styles/theme.go:34-94`):

```go
TitleStyle = lipgloss.NewStyle().
    Bold(true).
    Foreground(Primary).
    PaddingLeft(1).
    PaddingRight(1)

HeaderStyle = lipgloss.NewStyle().
    Bold(true).
    Foreground(White).
    Background(Primary).
    Align(lipgloss.Center).
    MarginBottom(1)

PanelStyle = lipgloss.NewStyle().
    Border(lipgloss.RoundedBorder()).
    BorderForeground(Dim).
    Padding(0, 1)

CompleteStyle = lipgloss.NewStyle().Foreground(Success)
CurrentStyle = lipgloss.NewStyle().Foreground(Primary).Bold(true)
PendingStyle = lipgloss.NewStyle().Foreground(Dim)
BlockedStyle = lipgloss.NewStyle().Foreground(Warning).Italic(true)
HighlightStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#06B6D4"))
```

**Gradient Rendering** (`styles/gradient.go:60-101`):

```go
func GradientString(text string, colors []string) string {
    if len(text) == 0 || len(colors) < 2 { return text }

    var result strings.Builder
    numChars := float64(len(text))
    numStops := float64(len(colors))

    for i, ch := range text {
        // Map character position to color stops
        pos := float64(i) / (numChars - 1)  // 0.0 to 1.0
        stopPos := pos * (numStops - 1)      // 0.0 to numStops-1

        // Find adjacent stops
        idx1 := int(stopPos)
        idx2 := idx1 + 1
        if idx2 >= len(colors) { idx2 = len(colors) - 1 }

        // Interpolate between stops
        t := stopPos - float64(idx1)
        color := LerpColor(colors[idx1], colors[idx2], t)

        // Apply color to character
        result.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(color)).Render(string(ch)))
    }
    return result.String()
}
```

Used for the ASCII "PRISM" logo (`app/view.go:36-49`):

```go
spectrumColors := []string{"#3B82F6", "#14B8A6", "#22C55E", "#F59E0B"}
for _, line := range logoLines {
    styledLines = append(styledLines, styles.GradientString(line, spectrumColors))
}
```

**Progress Bar Gradient** (`app/view.go:53-78`):

```go
func renderSpectrumProgressBar(percent float64, width int) string {
    filled := int(percent * float64(width))
    var bar strings.Builder

    for i := 0; i < width; i++ {
        if i < filled {
            // Gradient position within filled portion
            t := float64(i) / float64(width)
            color := styles.GradientColor(t, styles.PrismColors)
            bar.WriteString(lipgloss.NewStyle().Foreground(color).Render("█"))
        } else {
            bar.WriteString(styles.DimStyle.Render("░"))
        }
    }
    return bar.String()
}
```

### 9. Panel Layout System

**Spectrum Dashboard Layout** (`app/view_spectrum.go:14-38`):

```go
func (m Model) renderSpectrumView() string {
    var sections []string

    // 1. Epic selector (if multi-epic)
    if len(m.Epic.Epics) > 1 {
        sections = append(sections, m.renderEpicSelector())
    }

    // 2. Header
    sections = append(sections, m.renderHeader())

    // 3. Progress bar with prism
    sections = append(sections, m.renderProgressSection())

    // 4. Main panels (stories + activity side-by-side)
    sections = append(sections, m.renderMainPanels())

    // 5. Log panel
    sections = append(sections, m.renderLogPanel())

    // 6. Status bar
    sections = append(sections, m.renderStatusBar())

    return lipgloss.JoinVertical(lipgloss.Left, sections...)
}
```

**Two-Column Split** (`app/view_spectrum.go:109-122`):

```go
func (m Model) renderMainPanels() string {
    totalWidth := m.Width - 4  // Account for borders
    storyWidth := totalWidth * 40 / 100       // 40% for stories
    activityWidth := totalWidth - storyWidth - 3  // Remaining for activity

    storyPanel := m.renderStoryList(storyWidth)
    activityPanel := m.renderActivityPanel(activityWidth)

    return lipgloss.JoinHorizontal(lipgloss.Top, storyPanel, activityPanel)
}
```

**Panel Rendering Pattern** (`app/view_spectrum.go:124-164`):

```go
func (m Model) renderStoryList(width int) string {
    var lines []string

    // 1. Title
    title := styles.StoriesTitleStyle.Render("STORIES")
    lines = append(lines, title)

    // 2. Divider
    lines = append(lines, styles.HorizontalLine(width-4))

    // 3. Content
    start, end := m.StoryPaginator.GetSliceBounds(len(m.Stories))
    for i := start; i < end; i++ {
        story := m.Stories[i]
        icon := getStoryIcon(story, i, m)
        line := fmt.Sprintf("%s %s: %s", icon, story.ID, story.Title)
        if i == m.CurrentStoryIdx {
            line = styles.CurrentStyle.Render(line)
        }
        lines = append(lines, line)
    }

    // 4. Pagination indicator
    if m.StoryPaginator.TotalPages > 1 {
        pager := m.StoryPaginator.View()
        lines = append(lines, styles.DimStyle.Render(pager))
    }

    // 5. Wrap in panel
    content := lipgloss.JoinVertical(lipgloss.Left, lines...)
    return styles.PanelStyle.Width(width).Render(content)
}
```

---

## Patterns Found

### 1. Elm Architecture Pattern

**Model → Update → View** separation with immutable state transitions:

```go
// Model holds all state
type Model struct { ... }

// Update handles messages and returns new state + commands
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case TickMsg:
        // Update animations
        return m, tickCmd()
    case StartExecutionMsg:
        // Transition to Running state
        m.AppState = StateRunning
        return m, startNextIterationCmd()
    }
}

// View renders current state
func (m Model) View() string {
    return renderView(m.ActiveView, m)
}
```

### 2. Producer-Consumer Concurrency

**Claude output streaming** (`claude/runner.go:147-166`):

```go
// Producer goroutines
go streamOutput(ctx, stdout, outputChan, &buf, &wg)  // stdout
go streamOutput(ctx, stderr, outputChan, &buf, &wg)  // stderr

// Consumer in Bubble Tea
func listenToOutput(outputChan chan interface{}) tea.Msg {
    msg, ok := <-outputChan
    if !ok { return nil }  // Channel closed
    return msg
}
```

### 3. Signal-Based State Machine

**Workflow control** (`app/update.go:622-676`):

```
           ┌─────────┐
           │  Idle   │
           └────┬────┘
                │ [enter]
                ↓
           ┌─────────┐      [max iter]      ┌──────────────┐
    ┌─────→│ Running │─────────────────────→│ MaxIterations│
    │      └────┬────┘                       └──────────────┘
    │           │
    │      [ClaudeFinished]
    │           │
    │           ↓
    │    ┌──────────────┐
    │    │ Parse Signal │
    │    └──────┬───────┘
    │           │
    │     ┌─────┴──────┬──────────┬─────────┬────────┐
    │     │            │          │         │        │
    │     ↓            ↓          ↓         ↓        ↓
    │ [Complete]   [Continue]  [Retry]  [Blocked] [Error]
    │     │            │          │         │        │
    │     ↓            │          ↓         │        ↓
    │ Check      ←─────┴───→  Inc Error ←──┘    ┌───────┐
    │ Remaining       [pause]  Counter          │ Error │
    │     │                        │             └───────┘
    │     ↓                        ↓
    │ All Done?              > Max Errors?
    │  Yes │ No                Yes │ No
    │      │  │                    │  │
    │      ↓  └────────────────────┘  │
    │ ┌─────────┐                     │
    │ │Complete │                     │
    │ └─────────┘                     │
    │                                 │
    └─────────────────────────────────┘
```

### 4. Spring Physics Animation

**Harmonica integration** for organic motion:

```go
// Initialize spring with physics parameters
spring := harmonica.NewSpring(
    harmonica.FPS(60),  // Target frame rate
    6.0,                // Stiffness (higher = faster)
    0.7,                // Damping (higher = less overshoot)
)

// Update each frame
position, velocity = spring.Update(position, velocity, target)
```

Characteristics:
- **Snappy** (6.0 stiffness, 0.7 damping): Progress bar
- **Bouncy** (8.0 stiffness, 0.5 damping): Story pop
- **Smooth** (5.0 stiffness, 0.8 damping): Log slide

### 5. Half-Block Double Resolution

**Unicode U+2580 (▀)** for 2x vertical pixel density:

```
Each terminal character:
┌─────┐
│ ▀▀▀ │  Top half = foreground color
│     │  Bottom half = background color
└─────┘

ANSI encoding:
\x1b[38;2;R1;G1;B1m  (foreground)
\x1b[48;2;R2;G2;B2m  (background)
▀                     (character)
```

Used by:
- 3D prism renderer (`prism/prism.go:230-266`)
- Allows 24x10 pixel output in 24x5 character area

### 6. Directory Convention

**.prism/ structure** for persistence:

```
.prism/
├── stories/              # Epic organization
│   ├── stories.json      # Legacy flat layout
│   ├── epic-a/
│   │   └── stories.json  # Epic-scoped stories
│   └── epic-b/
│       └── stories.json
├── shared/               # Committed to repo
│   ├── research/
│   │   └── YYYY-MM-DD-topic.md
│   ├── plans/
│   │   └── YYYY-MM-DD-feature.md
│   ├── spectrum/
│   │   ├── progress.md           # Legacy flat
│   │   ├── epic-a/
│   │   │   └── progress.md       # Epic-scoped
│   │   └── epic-b/
│   │       └── progress.md
│   └── docs/
│       └── *.md
└── local/                # Gitignored
```

Path derivation (`domain/progress.go:21-41`):
- Inspects directory structure to determine layout
- Epic-based: `stories/<epic>/stories.json` → `spectrum/<epic>/progress.md`
- Legacy: `stories/stories.json` → `spectrum/progress.md`

### 7. Lipgloss Declarative Styling

**Pre-defined component styles** for consistency:

```go
PanelStyle = lipgloss.NewStyle().
    Border(lipgloss.RoundedBorder()).
    BorderForeground(Dim).
    Padding(0, 1)

CurrentStyle = lipgloss.NewStyle().
    Foreground(Primary).
    Bold(true)

// Usage
content := CurrentStyle.Render("Active Item")
panel := PanelStyle.Width(60).Render(content)
```

### 8. Functional Options Pattern

**Framebuffer initialization** (`prism/framebuffer/buffer.go:18-39`):

```go
type Option func(*Framebuffer)

func WithFixedSize(w, h int) Option {
    return func(fb *Framebuffer) {
        fb.Width = w
        fb.Height = h
    }
}

fb := framebuffer.New(
    framebuffer.WithFixedSize(cols, rows*2),
)
```

### 9. Regex Priority Cascade

**Signal detection** (`domain/signals.go:56-100`):

```go
// Check in order of severity
if completeRe.MatchString(output) {
    return Signal{Type: SignalComplete}
}
if errorRe.MatchString(output) {
    return Signal{Type: SignalError, Content: extract(output)}
}
if retryRe.MatchString(output) {
    return Signal{Type: SignalRetry, Content: extract(output)}
}
// ... etc
```

Priority: Complete > Error > Retry > Blocked > Continue

### 10. Event Sourcing via File Mutations

**State persistence** through stories.json updates:

```go
// 1. Load current state
sf, err := domain.LoadStoriesFile(path)

// 2. Mutate in memory
sf.MarkStoryComplete(storyID, commitHash)

// 3. Persist to disk
err = sf.SaveStoriesFile(path)

// 4. Fresh session reads latest state
// No in-memory state passed between iterations
```

---

## Open Questions

### Resolved

1. ✅ **How does the TUI handle terminal resize?**
   - Window size messages trigger recalculation of all panel widths
   - 3D prism renderer dynamically resizes between 20-40 columns
   - Viewports update their dimensions
   - Progress bar width adjusts to new terminal width

2. ✅ **What happens when a story is blocked mid-execution?**
   - `<spectrum-blocked>` signal is emitted by Claude
   - Signal handler logs warning and schedules next iteration
   - `GetNextStory()` skips blocked stories automatically
   - Blocked story remains in `in_progress` state until unblocked

3. ✅ **How are quality gates validated?**
   - Parser detects "Running quality gates" keyword in output
   - Scans for "typecheck", "lint", "test" keywords
   - Checks for "fail" or "error" in same line
   - Returns map of gate name → pass/fail boolean

4. ✅ **What is the fallback when 3D prism fails to load?**
   - `loadEmbeddedMesh()` returns nil on error
   - Spectrum view checks `if m.Prism != nil` before rendering
   - Falls back to `RenderPrismGradientSpring()` with spring-animated rays
   - Text-based prism uses Unicode geometric characters

5. ✅ **How does the TUI prevent duplicate tool activities?**
   - `RecentActivities` slice maintains last 10 activities
   - Before appending, checks if new activity equals last entry
   - If duplicate, skips append
   - Prevents flooding the UI with repeated tool invocations

### Remaining

1. **How does the TUI handle multi-epic concurrent execution?**
   - Current implementation appears to run one epic at a time
   - Epic selector allows switching between epics
   - Each epic has isolated stories.json and progress.md
   - No evidence of parallel epic execution in the codebase

2. **What happens if Claude CLI is not found in PATH?**
   - `exec.Command("claude", ...)` would fail with "executable file not found"
   - Error is caught in `ClaudeFinishedMsg` with error field
   - TUI transitions to Error state
   - No retry or PATH search fallback visible

3. **Can users edit stories.json while TUI is running?**
   - `ReloadStoriesCmd` reads from disk after each iteration
   - External edits would be loaded on next reload
   - Risk of race condition if TUI writes while user edits
   - No file locking detected in the code

4. **How are commit hashes populated in stories.json?**
   - `MarkStoryComplete()` accepts a `commitHash` parameter
   - Parameter comes from `ClaudeFinishedMsg` in `app/update.go`
   - No commit hash extraction logic found in Claude output parsing
   - Appears to be planned feature not yet implemented

5. **What is the maximum supported terminal size?**
   - No upper bounds detected beyond prism width clamp (40 cols)
   - Panel layouts dynamically calculate based on terminal width
   - Very wide terminals would produce very wide panels
   - No wraparound or max-width constraints found

---

## File References

### Core Architecture
- `cmd/prism-cli/main.go:1-153` - CLI entry point, flags, TUI initialization
- `cmd/prism-cli/app/model.go:39-192` - Model struct definition
- `cmd/prism-cli/app/update.go:54-676` - Update handler with state machine
- `cmd/prism-cli/app/view.go:14-31` - View router

### Screens
- `cmd/prism-cli/app/view_home.go:13-127` - Home menu
- `cmd/prism-cli/app/view_research.go:13-97` - Research file browser
- `cmd/prism-cli/app/view_plans.go:13-104` - Plans file browser
- `cmd/prism-cli/app/view_spectrum.go:14-487` - Spectrum execution dashboard

### Domain Logic
- `cmd/prism-cli/domain/story.go:11-176` - Story/Plan structs, dependency resolution
- `cmd/prism-cli/domain/signals.go:8-190` - Signal parsing and detection
- `cmd/prism-cli/domain/progress.go:11-216` - Progress file management

### Claude Integration
- `cmd/prism-cli/claude/runner.go:66-292` - Process spawning and streaming
- `cmd/prism-cli/claude/parser.go:10-208` - Output parsing for events
- `cmd/prism-cli/claude/events.go:8-192` - Stream-JSON deserialization

### 3D Rendering
- `cmd/prism-cli/prism/prism.go:33-266` - FauxGL renderer with half-block encoding
- `cmd/prism-cli/prism/framebuffer/buffer.go:8-64` - RGBA pixel buffer

### Styling
- `cmd/prism-cli/styles/theme.go:6-365` - Color palette, component styles, prism variants
- `cmd/prism-cli/styles/gradient.go:13-229` - Color math, gradients, shimmer

### Animation
- `cmd/prism-cli/app/model.go:66-99` - AnimState structure
- `cmd/prism-cli/app/update.go:87-164` - Animation update loop

---

## Next Steps for Documentation

To create the comprehensive MD file with UI diagrams:

1. **User Flow Diagrams**: ASCII/Unicode flowcharts showing navigation between screens
2. **UI Recreation**: Character-accurate representations of each screen with dimensions
3. **State Diagrams**: Visual state machine for execution lifecycle
4. **Sequence Diagrams**: Message flow through Bubble Tea event loop
5. **Component Hierarchy**: Tree structure of UI composition
6. **Animation Timeline**: Frame-by-frame breakdown of spring physics
7. **Data Flow**: End-to-end path from stories.json to rendered UI

The research is complete and ready for the planning phase.
