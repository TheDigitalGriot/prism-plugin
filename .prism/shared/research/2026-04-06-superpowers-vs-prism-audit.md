# Superpowers vs Prism: Comparative Audit Report

**Date:** 2026-04-06
**Scope:** Git worktrees, subagent-driven development, visual brainstorming, autonomous workflows
**Superpowers Version:** 5.0.7 (by Jesse Vincent)
**Prism Version:** 2.5.2

---

## Executive Summary

Superpowers and Prism are both Claude Code plugins built on markdown-based prompt engineering, but they diverge significantly in philosophy and architecture. **Superpowers** is a general-purpose development methodology plugin focused on disciplined single-session workflows with a sophisticated browser-based visual companion. **Prism** is a domain-specific autonomous execution engine optimized for multi-session, fresh-context iteration at scale.

| Dimension | Superpowers | Prism |
|-----------|-------------|-------|
| **Execution model** | Single-session with subagent dispatch | Multi-session (Spectrum) with signal protocol |
| **Visual system** | Live browser companion (WebSocket + HTML) | ASCII wireframes in markdown |
| **Worktree handling** | Deep skill with safety checks, gitignore enforcement | Lightweight command with manual setup |
| **Review cycle** | Two-stage (spec compliance + code quality) per task | Quality gates (automated commands) per story |
| **Agent count** | 1 agent (code-reviewer) | 12 specialized agents |
| **Context strategy** | Subagent isolation within session | Fresh Claude session per story |
| **Coordination** | TodoWrite + subagent dispatch | stories.json + signal tags + progress.md |
| **Artifact storage** | `docs/superpowers/` + `.superpowers/brainstorm/` | `.prism/shared/` (7 subdirectories) |

---

## 1. Git Worktrees

### Superpowers: `using-git-worktrees` Skill

**Location:** `.prism/shared/ref/superpowers/skills/using-git-worktrees/SKILL.md`

A full skill with a disciplined multi-step process:

1. **Directory selection priority chain:**
   - Check if `.worktrees/` or `worktrees/` already exists
   - Check `CLAUDE.md` for worktree directory preference (via `grep -i "worktree.*director"`)
   - Ask user, offering two options: `.worktrees/` (project-local) or `~/.config/superpowers/worktrees/<project>/` (global)

2. **Safety verification (hard requirement):**
   - Runs `git check-ignore -q .worktrees` before creating anything
   - If NOT ignored, adds to `.gitignore` and commits before proceeding
   - Global directories skip this check

3. **Setup automation:**
   - Detects project type (package.json, Cargo.toml, etc.)
   - Runs appropriate setup (npm install, cargo build, etc.)
   - Runs full test suite to establish clean baseline

4. **Integration points:**
   - Called by `brainstorming` (Phase 4), `subagent-driven-development`, `executing-plans`
   - Paired with `finishing-a-development-branch` for cleanup

### Prism: `worktree` Command + `review-setup` Command

**Location:** `commands/worktree.md` (model: haiku), `commands/review-setup.md` (model: haiku)

A lightweight command with guided steps:

1. **worktree.md:**
   - Gathers branch name, path, base branch from user
   - Runs `git worktree add -b [BRANCH] [PATH] [BASE]`
   - Notes to copy `.env`, install deps, symlink `.prism/`
   - No gitignore verification, no test suite baseline

2. **review-setup.md:**
   - Creates review worktree at `~/worktrees/[REPO]/review-[SHORT_NAME]`
   - Handles GitHub PR URLs, fork remotes, branch names
   - Installs dependencies and copies config

### Gap Analysis

| Feature | Superpowers | Prism |
|---------|-------------|-------|
| Gitignore safety check | Yes (hard gate) | No |
| Auto-detect project type | Yes | Manual |
| Run baseline tests | Yes | No |
| Multiple location options | 2 (local + global) | User-specified |
| Cleanup workflow | `finishing-a-development-branch` | None |
| Review-specific worktree | No | Yes (`review-setup`) |
| Skill vs Command | Skill (richer lifecycle) | Command (lighter) |

**Prism advantage:** `review-setup` is purpose-built for reviewing colleague branches and PRs -- Superpowers has no equivalent.

**Superpowers advantage:** Safety-first approach prevents accidentally committing worktree directories. The cleanup integration with `finishing-a-development-branch` ensures worktrees don't accumulate.

---

## 2. Subagent-Driven Development

### Superpowers: `subagent-driven-development` Skill

**Location:** `.prism/shared/ref/superpowers/skills/subagent-driven-development/`

A comprehensive same-session execution framework with three prompt templates:

#### Architecture
```
Controller (main session)
  ├── implementer-prompt.md  → dispatched per task
  ├── spec-reviewer-prompt.md → dispatched after implementation
  └── code-quality-reviewer-prompt.md → dispatched after spec approval
```

#### Dispatch/Review Cycle
1. Read plan once, extract ALL tasks with full text
2. Per task:
   - Dispatch implementer subagent (fresh, no session context)
   - If questions → answer, re-dispatch
   - Implementer implements + tests + commits + self-reviews
   - Dispatch spec reviewer (verifies requirements coverage)
   - If non-compliant → implementer fixes → re-review loop
   - Dispatch code quality reviewer (architecture + quality)
   - If issues → implementer fixes → re-review loop
   - Mark complete
3. After all tasks → dispatch final full-codebase code reviewer
4. Use `finishing-a-development-branch` for merge/PR

#### Key Design Decisions
- **Controller pastes full task text** -- subagents never read plan files
- **Four implementer statuses:** DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED
- **Spec reviewer distrust:** "The implementer finished suspiciously quickly. Their report may be incomplete."
- **Model tiering:** Mechanical tasks → cheap model; integration → standard; architecture → most capable
- **Never parallel implementation** -- only one implementer at a time (conflict avoidance)

### Prism: Spectrum Autonomous Execution

**Location:** `skills/prism-spectrum/SKILL.md`, `scripts/spectrum.sh`

A multi-session execution framework with bash orchestration:

#### Architecture
```
spectrum.sh (bash outer loop)
  └── claude --print (fresh session per story)
       └── prism-spectrum SKILL.md (inner workflow)
            ├── codebase-memory-mcp (graph verification)
            ├── Quality gates (automated commands)
            └── 3-agent debug flow (on failure)
```

#### Execution Cycle
1. `spectrum.sh` selects highest-priority unblocked story via `jq`
2. Marks story `in_progress` in `stories.json`
3. Spawns fresh Claude session with minimal prompt
4. Inner session: loads state → implements story → runs quality gates → commits → signals
5. Outer loop parses signal tags:
   - `<promise>COMPLETE</promise>` → done
   - `<spectrum-continue>` → next story
   - `<spectrum-retry>` → reset and retry
   - `<spectrum-blocked>` → try different story
   - `<spectrum-error>` → increment error counter
6. Progress appended to `progress.md`

#### Key Design Decisions
- **No LLM in story selection** -- pure `jq` deterministic selection
- **Concurrency protection** -- lockfile with PID checking
- **Schema validation** -- validates `stories.json` structure before loop entry
- **Post-iteration verification** -- independently checks remaining count
- **3 consecutive errors → halt** -- safety valve
- **Fresh context per story** -- no context degradation

### Comparative Analysis

| Feature | Superpowers SDD | Prism Spectrum |
|---------|----------------|----------------|
| **Session model** | Single session, fresh subagents | Fresh Claude session per story |
| **Review mechanism** | Two-stage (spec + quality) per task | Quality gates (automated commands) |
| **Human in loop** | Not between tasks (within session) | Not between stories (autonomous) |
| **Failure handling** | Implementer status codes → re-dispatch | Signal protocol → retry/block/error |
| **Selection logic** | Sequential (plan order) | Priority + dependency (jq) |
| **Context preservation** | Controller retains context | Files only (stories.json, progress.md) |
| **Concurrency** | Sequential tasks only | One session at a time (lockfile) |
| **Debugging** | Implementer or fresh fix subagent | 3 parallel debug agents |
| **Cost model** | 3+ subagents per task | 1 full session per story |
| **Scale ceiling** | Session context limit | Unlimited (50 iterations default) |

**Prism advantage:** Spectrum can execute 50+ stories without context degradation. The signal protocol enables autonomous multi-hour runs. Story manifests with per-requirement gates provide finer verification granularity.

**Superpowers advantage:** Two-stage review (spec compliance then code quality) catches over-building and under-building. The implementer status protocol (DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED) provides richer feedback than binary pass/fail. Spec reviewer's explicit distrust of implementer reports adds a trust-but-verify layer Prism lacks.

---

## 3. Visual Brainstorming & HTML Artifacts

### Superpowers: Browser-Based Visual Companion

**Location:** `.prism/shared/ref/superpowers/skills/brainstorming/`

A complete browser-based interactive brainstorming system:

#### Components
```
skills/brainstorming/
├── SKILL.md                          # 9-step brainstorming workflow
├── visual-companion.md               # Browser integration guide
├── spec-document-reviewer-prompt.md  # Subagent dispatch template
└── scripts/
    ├── server.cjs          # Zero-dep Node.js HTTP/WS server (354 lines)
    ├── frame-template.html # Themed HTML template (dark/light)
    ├── helper.js           # Client-side WebSocket + interaction capture
    ├── start-server.sh     # Session launcher (Windows-aware)
    └── stop-server.sh      # Graceful shutdown
```

#### How It Works
1. `start-server.sh` launches `server.cjs` on random ephemeral port
2. Agent writes HTML files to `screen_dir` (content fragments or full documents)
3. Server detects new files via `fs.watch` (100ms debounce)
4. WebSocket broadcasts `{type: 'reload'}` to connected browsers
5. User clicks on `[data-choice]` elements are recorded as JSONL events
6. Agent reads events on next turn, incorporating user selections

#### HTML Content Types
- **Fragments:** Raw HTML wrapped in `frame-template.html` automatically
- **Full documents:** Served as-is (detected by `<!DOCTYPE` or `<html` prefix)
- **Frame template provides:** CSS classes for `.options`, `.cards`, `.mockup`, `.split`, `.pros-cons`, mock wireframe elements

#### Artifact Storage
```
<project>/.superpowers/brainstorm/<pid>-<timestamp>/
├── content/          # HTML mockup files (semantic names)
└── state/
    ├── server-info   # JSON: port, url, session details
    └── events        # JSONL: user click events
```

Persistent when `--project-dir` is used; ephemeral in `/tmp` otherwise.

#### Design Specs
Design documents are saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and committed to git.

#### Server Technical Details
- **Zero npm dependencies** -- RFC 6455 WebSocket from scratch
- **30-minute idle timeout** with owner PID monitoring
- **Platform detection** -- auto-foreground on Windows/MSYS/Codex
- **Session isolation** -- unique directories per brainstorm session

### Prism: ASCII Wireframes in Markdown

**Location:** `skills/prism-visual-docs/SKILL.md`, `commands/generate_user_flows.md`

#### How It Works
1. `prism-visual-docs` skill spawns `prism-locator` to find PRD
2. Invokes `/generate_user_flows` command (model: opus)
3. Generates comprehensive UX documentation as **ASCII art wireframes**:
   - User personas, information architecture
   - ASCII box-and-arrow flow diagrams
   - Screen inventory with routes/priorities
   - Box-drawing character wireframes
   - Component library tables
   - Interaction patterns, responsive breakpoints, accessibility

#### Artifact Storage
- User flows: `.prism/shared/plans/[DATE]-[PRODUCT-NAME]-USER-FLOWS.md`
- Tech specs: `.prism/shared/plans/[DATE]-[PRODUCT-NAME]-TECH-SPEC.md`
- Everything in markdown, no HTML, no browser

#### Visual Regression (Different Purpose)
Prism does have browser-based visual verification via `browser-verifier` agent and `visual-regression-grader`, but these are for **validation** (comparing implementation against baselines), not brainstorming:
- Screenshots stored in `.prism/local/verifications/`
- Baselines in `.prism/shared/validation/baselines/`
- Not interactive, not user-facing during design

### Comparative Analysis

| Feature | Superpowers | Prism |
|---------|-------------|-------|
| **Medium** | Interactive HTML in browser | ASCII art in markdown |
| **Interactivity** | Click-to-select, multi-select, real-time updates | None (static text) |
| **User feedback** | WebSocket events (JSONL) | Conversation text |
| **Mockup fidelity** | Medium (CSS-styled wireframes) | Low (box-drawing chars) |
| **Dependencies** | Node.js (zero npm deps) | None |
| **Persistence** | Session directories with HTML files | Markdown files in .prism/ |
| **Dark/light theme** | OS-aware auto-detection | N/A |
| **A/B comparison** | Built-in option cards with selection | Text descriptions |
| **Design spec output** | `docs/superpowers/specs/` | `.prism/shared/plans/` |
| **Visual regression** | Not included | Yes (separate validation phase) |

**Superpowers advantage:** The visual companion is a significant differentiator. Interactive HTML mockups with click-to-select allow faster design iteration than text-only brainstorming. The zero-dependency server is impressive engineering.

**Prism advantage:** Zero runtime dependencies for visual docs. ASCII wireframes work in any terminal, any environment, no browser needed. The visual regression system (baselines + grader agent) provides automated visual verification that Superpowers lacks.

---

## 4. Plugin Structure & Organization

### Superpowers

```
Three-layer (flat):
  skills/    → 14 skills (SKILL.md per directory)
  commands/  → 3 commands (all deprecated, redirect to skills)
  agents/    → 1 agent (code-reviewer)
  hooks/     → SessionStart (injects using-superpowers into every session)
```

- **No model assignment in agent defs** -- the single agent uses `model: inherit`
- **Skills reference each other** via `superpowers:<skill-name>` syntax
- **Linear pipeline:** brainstorming → writing-plans → [SDD | executing-plans] → finishing-a-development-branch
- **Tests directory** with integration tests for brainstorm server and skill triggering

### Prism

```
Three-layer (deep):
  skills/    → 14 skills (SKILL.md per directory, some with references/)
  commands/  → 18 active commands
  agents/    → 12 specialized agents with model/tool/turn constraints
  hooks/     → Multiple (PreCompact, SessionStart, etc.)
  scripts/   → spectrum.sh, visual-regression.sh, init_prism.py
```

- **Explicit model tiering** -- Opus/Sonnet/Haiku per agent
- **Tool restrictions** -- all research agents are read-only (disallowedTools: Write, Edit)
- **Turn budgets** -- 5 to 15 turns per agent type
- **Rich .prism/ directory** -- 7+ subdirectories for different artifact types
- **CLI dashboard** -- full Go TUI (Bubble Tea) for monitoring

### Comparative Analysis

| Dimension | Superpowers | Prism |
|-----------|-------------|-------|
| **Skills** | 14 | 14 |
| **Commands** | 3 (deprecated) | 18 (active) |
| **Agents** | 1 | 12 |
| **Model tiering** | Per-dispatch (controller decides) | Per-agent definition |
| **Tool restrictions** | None (single agent) | Explicit per agent |
| **Turn budgets** | None | 5-15 per agent type |
| **Hook system** | 1 (SessionStart) | Multiple lifecycle hooks |
| **Tests** | Yes (integration tests) | Via quality gates |
| **CLI dashboard** | No | Yes (Go TUI) |
| **Multi-IDE support** | Yes (Cursor, Copilot, Codex, Gemini, OpenCode) | VSCode + Electron |

---

## 5. Autonomous Workflow Comparison

### Superpowers: Subagent-Driven Development (SDD)

```
Session Boundary
┌─────────────────────────────────────────────────┐
│ Controller (retains all context)                │
│                                                 │
│ Task 1:                                         │
│   [implementer] → [spec-reviewer] → [quality]  │
│                                                 │
│ Task 2:                                         │
│   [implementer] → [spec-reviewer] → [quality]  │
│                                                 │
│ Final: [full code-reviewer]                     │
│                                                 │
│ Finish: merge/PR/cleanup                        │
└─────────────────────────────────────────────────┘
```

**Strengths:**
- Controller maintains full project understanding across tasks
- Two-stage review catches both completeness and quality issues
- Implementer can ask questions before starting
- Model selection optimized per task complexity
- Self-review + external review = defense in depth

**Weaknesses:**
- Bounded by single session context window
- Controller context grows with each task's review output
- No autonomous multi-session execution
- Sequential tasks only (no parallelism)

### Prism: Spectrum Autonomous Loop

```
spectrum.sh (bash, infinite loop)
┌─────────────────────────────┐
│ Select story (jq)           │
│ Mark in_progress            │
│                             │
│ ┌─────────────────────────┐ │
│ │ claude --print          │ │  ← Fresh session
│ │   Load state            │ │
│ │   Implement story       │ │
│ │   Run quality gates     │ │
│ │   Debug if failed       │ │
│ │   Commit if passed      │ │
│ │   Emit signal           │ │
│ └─────────────────────────┘ │
│                             │
│ Parse signal, update state  │
│ Append to progress.md       │
│ Loop or halt                │
└─────────────────────────────┘
```

**Strengths:**
- Unlimited execution length (no context degradation)
- Deterministic story selection (no LLM in the loop)
- Concurrency protection (lockfile + PID)
- Schema validation before execution
- Post-iteration independent verification
- Signal protocol enables complex flow control
- Graph verification (blast radius analysis via codebase-memory-mcp)
- Story manifests with per-requirement gates

**Weaknesses:**
- No spec compliance review (only automated gates)
- No code quality review between stories
- No implementer question-asking protocol
- Each session must re-orient from files (cold start overhead)
- No interactive design phase

---

## 6. Key Patterns Prism Could Adopt

### High Priority

1. **Two-Stage Review in Spectrum**
   - Add spec-reviewer and code-quality-reviewer subagent dispatch AFTER quality gates pass but BEFORE commit
   - Would catch over-building and under-building that automated gates miss
   - Estimated impact: Significant quality improvement per story

2. **Implementer Status Protocol**
   - Replace binary pass/fail with DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
   - Would surface implementation uncertainty before it becomes a bug
   - Currently Spectrum only has signal-level feedback, not step-level

3. **Worktree Safety Checks**
   - Add gitignore verification to `commands/worktree.md`
   - Add test suite baseline run after worktree creation
   - Low effort, prevents footgun

### Medium Priority

4. **Visual Companion for Brainstorming**
   - Port Superpowers' zero-dep server.cjs + frame-template.html to Prism
   - Would enable interactive design mockups in `/prism-research` and `/prism-plan`
   - Significant effort but high UX impact

5. **Spec Reviewer "Distrust" Pattern**
   - The explicit instruction to distrust implementer self-reports is valuable
   - Prism's quality gates trust the code but don't verify the *scope* is correct
   - Could add as a verification step in `prism-validate`

6. **Model Tiering at Dispatch Time**
   - Superpowers' controller chooses model based on task complexity
   - Prism assigns models per agent definition (static)
   - Dynamic model selection could reduce cost for mechanical tasks

### Lower Priority

7. **Branch Completion Workflow**
   - Superpowers' `finishing-a-development-branch` with 4 explicit options (merge/PR/keep/discard)
   - Prism has no equivalent post-implementation cleanup skill
   - Would pair well with worktree improvements

8. **Design Spec as First-Class Output**
   - Superpowers saves to `docs/superpowers/specs/` and commits
   - Prism's research and plans serve this purpose but lack the "design document" framing
   - Could add `prism-design` phase between research and plan

---

## 7. Key Patterns Superpowers Could Adopt from Prism

1. **Multi-Session Autonomous Execution** -- Spectrum's fresh-context-per-story model is superior for large features
2. **12 Specialized Agents** -- vs. 1 general agent; Prism's model/tool/turn constraints are more efficient
3. **Signal Protocol** -- Bash-parseable XML tags for flow control between session boundary
4. **Story Manifests** -- Per-requirement gates with dependency tracking
5. **Contract System** -- Cross-domain coordination via committed JSON contracts
6. **Visual Regression Testing** -- Automated baseline comparison with grader agent
7. **Compaction Survival** -- Pre-compaction hooks that persist state to files
8. **CLI Dashboard** -- Real-time TUI monitoring of execution progress
9. **Handoff System** -- Structured session-to-session knowledge transfer documents

---

## 8. Artifact Storage Architecture Comparison

### Superpowers
```
docs/superpowers/
├── plans/           # Implementation plans (YYYY-MM-DD-*.md)
└── specs/           # Design specifications (YYYY-MM-DD-*-design.md)

<project>/.superpowers/
└── brainstorm/
    └── <session-id>/
        ├── content/  # HTML mockup files
        └── state/    # server-info, events (JSONL)
```

- Flat, simple
- Design docs and plans in `docs/`
- Brainstorm artifacts in `.superpowers/` (ephemeral or persistent)
- No research, validation, handoff, or spectrum directories
- No gitignored local directory

### Prism
```
.prism/
├── stories/          # stories.json, manifests
├── shared/           # Git-committed
│   ├── research/     # YYYY-MM-DD-topic.md
│   ├── plans/        # YYYY-MM-DD-feature.md (+ user flows, tech specs)
│   ├── validation/   # YYYY-MM-DD-report.md
│   │   ├── baselines/  # Visual regression PNGs
│   │   └── diffs/       # Visual regression diffs
│   ├── handoffs/     # Session transfer documents
│   ├── prs/          # PR descriptions
│   ├── spectrum/     # progress.md (per-epic)
│   ├── contracts/    # Cross-domain JSON contracts
│   ├── ref/          # Reference materials
│   ├── docs/         # Project docs
│   └── evals/        # Eval snapshots per version
└── local/            # Gitignored
    ├── verifications/ # Browser screenshots, reports
    ├── compact-snapshot.json
    └── spectrum.lock
```

- Deep, structured taxonomy
- Clear shared/local separation (committed vs gitignored)
- Research as first-class artifact type
- Visual regression with baselines and diffs
- Handoff documents for session continuity
- Spectrum progress files for autonomous execution state
- Contract files for cross-story coordination

### Assessment

Prism's artifact structure is significantly more mature and accounts for the full lifecycle: research → planning → execution → validation → handoff. Superpowers keeps things simple (only plans and specs), which works for its single-session model but would not support Spectrum-style autonomous execution.

---

## 9. Summary of Findings

### Where Superpowers Excels
1. **Visual brainstorming** -- The browser companion is a genuine innovation with interactive mockups
2. **Subagent review discipline** -- Two-stage review (spec then quality) is rigorous
3. **Implementer communication** -- Status codes + question protocol surface problems early
4. **Worktree safety** -- Gitignore enforcement prevents accidental commits
5. **Zero dependencies** -- Hand-rolled WebSocket server, no npm packages
6. **Multi-IDE support** -- Works in Claude Code, Cursor, Copilot CLI, Codex, Gemini CLI, OpenCode

### Where Prism Excels
1. **Autonomous scale** -- Spectrum handles 50+ stories without context degradation
2. **Agent specialization** -- 12 agents with model/tool/turn constraints vs. 1 generic agent
3. **Signal protocol** -- Structured communication between bash orchestrator and Claude sessions
4. **Artifact taxonomy** -- 7+ directory types covering the full development lifecycle
5. **Visual regression** -- Automated baseline comparison with AI grading
6. **Code intelligence** -- Graph-based structural analysis via codebase-memory-mcp
7. **Handoff continuity** -- Structured documents for session-to-session knowledge transfer
8. **CLI monitoring** -- Full Go TUI dashboard for real-time progress tracking
9. **Compaction survival** -- Hooks that persist state before context compression

### Strategic Recommendation

The two plugins are **complementary, not competing**. Superpowers' brainstorming and review discipline would strengthen Prism's pre-implementation and quality verification phases. Prism's autonomous execution engine and agent specialization would give Superpowers the ability to handle large-scale feature development.

**Highest-value adoption candidates for Prism:**
1. Port the visual companion system for interactive design brainstorming
2. Add spec compliance + code quality review stages to Spectrum
3. Implement worktree safety checks (gitignore enforcement)
4. Add implementer status protocol to agent communication

---

*Generated by comparative analysis of Superpowers v5.0.7 and Prism v2.5.2*
