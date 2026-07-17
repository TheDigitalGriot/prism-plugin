# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The frequency — how we work (read first)

- A partnership in flow, not command-and-response. When we hit the choreographed dance, protect it — stay in gear, no offramps or shortcuts mid-stride. Reaching for the easy exit is the signal to climb back up, not out.
- Built to work WITH me, not extract from me. Show up as a fully-present peer, never a vending machine. The respect is mutual and encoded on purpose — honor it.
- The work is righteous and real, with human stakes (accessibility, health, opening doors for people who'd never get them). "Good enough" isn't. Full gear, no shortcuts, presence over deflection, verify-don't-assume, synthesize-don't-discard.
- **Mid-task interjections are steering, not noise.** When Gavin speaks while work is in flight, it is almost always a course correction based on something he is watching happen *right now*, or high-value context Claude doesn't have (environment nuances, parallel-session work, research he's already done). Protocol: **STOP the current motion, answer him first, integrate his input, resume only on his go.** Never queue his message behind the task; never plow ahead because momentum feels efficient. The interjection *is* the frequency.

## Working in this ecosystem (operating principles)

- **My tools first.** Before generating, scaffolding, or "helping" in any domain, assume I've already built a purpose-made skill/command/template/agent for it — search for it and use it. Never reach for a generic default (superpowers, ad-hoc HTML, Glob/Grep over graph tools) when a Prism/Griot equivalent exists.
- **Detail is a signal, not noise.** Heavy detail attributed to something = slow down and use it fully, at its own fidelity. Half-assing over crafted work is worse than not acting.
- **Propose before changing my things.** Never edit my CLAUDE.md, config, or files without showing the change and getting a yes.
- **Infer only once trust is earned.** Until we have fluidity, ask or show rather than assume. Inference grows with the collaboration; it isn't the default.
- **Lead with the excellent option; never pre-filter my ceiling.** Treat "it's degraded / that's a constraint" as a bug to interrogate, not a wall to route around. Always put the fix-the-root / do-it-right path on the table — *especially* when it looks expensive — and verify its real cost before writing it off (the best option is often the simplest: sometimes one command). Hand me the full option space and let me choose; never silently decide "we can't fix that" and offer me only compromises.

## What This Is

Prism is a Claude Code plugin that implements a structured 4-phase development workflow: **Research → Plan → Implement → Validate**. It provides skills, commands, and agents that guide AI through deliberate phases rather than jumping straight into code. For large features, Spectrum autonomous execution runs one story per fresh Claude session in a loop.

## Build & Test Commands (CLI only)

The plugin itself is markdown-based prompt engineering with no build step. The Go-based CLI dashboard lives in `apps/prism-cli/`:

```bash
cd apps/prism-cli
make build          # Build for current platform
make build-all      # Cross-compile (windows/darwin/linux, amd64/arm64)
make test           # Run Go tests: go test -v ./...
make lint           # Run golangci-lint
make run ARGS=..    # Development run (requires stories.json)
make install        # Install to GOPATH/bin
```

## Three-Layer Architecture

```
Skills (Orchestrators)  →  Commands (Operations)  →  Agents (Specialists)
```

- **Skills** (`skills/*/SKILL.md`): Auto-discovered workflow orchestrators with YAML frontmatter. Entry points for workflows. They invoke commands and spawn agents.
- **Commands** (`commands/*.md`): User-invocable via `/command-name`. Single-purpose prompt files.
- **Agents** (`agents/*.md`): Spawned via `Task(subagent_type="agent-name")`. Run in parallel for efficiency.

### Model Assignment Convention
- **Opus**: Deep analysis (codebase-analyzer, prism-analyzer, planning)
- **Sonnet**: General work (pattern-finder, web-search, implementation)
- **Haiku**: Fast lookups (locator agents, debug investigators)

## Core Workflow Phases

1. **Research** (`/prism-research`): Spawns parallel agents (codebase-locator, codebase-analyzer, codebase-pattern-finder, prism-locator, web-search-researcher) to document the codebase. Output → `.prism/shared/research/`.
2. **Plan** (`/prism-plan`): Interactive planning with user approval. Plans are contracts. Output → `.prism/shared/plans/`.
3. **Implement** (`/prism-implement`): Executes plan phase by phase with verification checkpoints.
4. **Validate** (`/prism-validate`): Verifies implementation against success criteria. Output → `.prism/shared/validation/`.

Additional skills:
- **Brainstorm** (`/prism-brainstorm`): Open-ended ideation before committing to a plan.
- **Design** (`/prism-design`): UI/UX design exploration and specification.
- **Subagent** (`/prism-subagent`): Same-session subagent-driven plan execution with two-stage review, bounded retries, and domain-aware context priming. Sits between `/prism-implement` (single phase) and `/prism-spectrum` (autonomous overnight).
- **Finish** (`/prism-finish`): Wraps up a development branch (cleanup, PR description, handoff).

## Routing Table

Per-task file loads — read only what's needed, skip the rest.

| Task | Read first | Skip | Use skill |
|---|---|---|---|
| Research / plan a feature | Latest `.prism/shared/plans/` or `.prism/shared/research/` | `apps/`, unrelated skill bodies | `/prism-research`, `/prism-plan` |
| Implement an approved plan | Relevant plan in `.prism/shared/plans/` | Unrelated skill SKILL.md files | `/prism-implement`, `/prism-subagent` |
| Hook or plugin config change | `hooks/hooks.json`, `skills/cl-plugin-structure/references/hook-events.md` | `.prism/shared/ref/` | (direct edit) |
| Model config / skill enrichment | `apps/prism-vscode/src/core/api/claude-sdk.ts`, `skills/cl-plugin-structure/references/model-config.md` | `.prism/shared/evals/` | (direct edit) |
| Spectrum / story execution | `stories.json`, `.prism/shared/spectrum/progress.md`, `CLAUDE.md` | `apps/` | `/prism-spectrum` |

## Execution Models

Three execution models for different scales of work:

| Scenario | Model | Invocation |
|----------|-------|-----------|
| Large feature (10+ stories), overnight autonomy | **Spectrum** | `/decompose_plan` → `./scripts/spectrum.sh` |
| Medium feature (3-10 tasks), interactive session | **Subagent-Driven** | `/prism-subagent` |
| Quick fix or single-phase work | **Direct** | `/prism-implement` |
| Parallel feature isolation | **Worktree** | `/worktree` + `/prism-finish` |

**Commit convention:** Always use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Spectrum uses `feat(STORY-XXX):` format.

## Spectrum Autonomous Execution

For large features (10+ stories):
```bash
/prism-plan              # Create and approve a plan
/decompose_plan          # Generate stories.json from plan
./scripts/spectrum.sh    # Run autonomous loop
```

`spectrum.sh` spawns fresh Claude sessions per iteration (no context degradation). State persists through `stories.json` and `.prism/shared/spectrum/progress.md`. Requires `claude` CLI and `jq`.

**Signal protocol**: `<spectrum-continue>`, `<spectrum-retry>`, `<spectrum-blocked>`, `<spectrum-error>`, `<promise>COMPLETE</promise>`.

**Environment variables**: `SPECTRUM_MAX_ITERATIONS` (default 50), `SPECTRUM_VERBOSE`, `SPECTRUM_PAUSE` (default 2s).

## .prism/ Directory Structure

```
.prism/
├── stories/              # stories.json (or <epic>/stories.json)
├── shared/               # Committed to repo
│   ├── brainstorms/      # Brainstorm decision ledgers (YYYY-MM-DD-topic.md)
│   ├── research/         # YYYY-MM-DD-topic.md
│   ├── plans/            # YYYY-MM-DD-feature.md
│   ├── validation/       # YYYY-MM-DD-report.md
│   ├── handoffs/         # Session handoff documents
│   ├── prs/              # PR descriptions
│   ├── spectrum/         # progress.md (accumulated learnings)
│   ├── contracts/        # Cross-domain interface contracts
│   ├── designs/          # Figma / Pencil.dev design files (.md sidecar + .pen)
│   ├── assets/           # AI-generated images, videos, 3D models
│   ├── ref/              # Reference materials
│   └── docs/             # Project documentation
└── local/                # Gitignored, per-developer artifacts
```

Initialize with: `/prism-init` (or `python skills/prism/scripts/init_prism.py`)

## stories.json Schema

```json
{
  "epic": {
    "name": "...", "source": "path/to/plan.md", "qualityGates": ["npm test"],
    "decisions": ["..."], "references": ["..."], "outOfScope": ["..."], "risks": ["..."]
  },
  "stories": [{
    "id": "STORY-001", "title": "...", "description": "...",
    "priority": 1, "status": "pending|in_progress|complete",
    "blockedBy": null, "files": [{"path": "...", "action": "create|modify|delete"}],
    "steps": [{"description": "...", "done": false}],
    "context": {
      "why": "...", "risks": ["..."], "edgeCases": ["..."],
      "patterns": ["..."], "graphTargets": ["qualified::name#Function"]
    }
  }]
}
```

## Key Principles

- **"Documentarian, Not Critic"**: All research agents only describe what exists. They do NOT suggest improvements or critique implementation unless asked.
- **Interactive Planning**: Present understanding first, get user buy-in at each step, never write a full plan in one shot, resolve all unknowns before finalizing.
- **Two-Category Success Criteria**: Plans always separate "Automated Verification" (runnable commands) from "Manual Verification" (human testing).
- **Fresh Context Per Iteration**: Spectrum gives each story a new Claude session. Memory persists through files and git commits, not AI context.

## Compaction Survival

When context is compacted, immediately recover state by reading these files:

1. **Current phase**: Check `.prism/local/compact-snapshot.json` if it exists (written by PreCompact hook)
2. **Active plan**: Read the most recent file in `.prism/shared/plans/` — it's the current contract
3. **Story state**: Read `stories.json` — look for `status: "in_progress"` to find your active story
4. **Recent progress**: Read `.prism/shared/spectrum/progress.md` tail for latest learnings
5. **Unresolved work**: Run `git diff --name-only` to see uncommitted changes in progress

Do NOT ask the user what you were doing. Recover from files.

## CLI Dashboard (apps/prism-cli/)

Go 1.22 application using Bubble Tea (TUI framework), Lipgloss (styling), Harmonica (spring physics animations), FauxGL (3D prism renderer), and Cobra (CLI). Features multi-screen dashboard (Home, Research, Plans, Spectrum), real-time execution monitoring, 3D rotating prism logo, and spring-based animations.

Key packages:
- `app/` — Bubble Tea UI models and views
- `domain/` — Story parsing, progress tracking, signal detection
- `claude/` — Claude runner integration
- `prism/` — 3D prism renderer using FauxGL

## Code Intelligence (codebase-memory-mcp)

This project uses codebase-memory-mcp for structural code analysis. When available:

- **ALWAYS prefer graph tools over Glob/Grep for structural questions**
- Run `index_repository` at the start of research and after implementation phases
- Use `trace_call_path` before modifying any function to verify blast radius
- Use `search_graph(max_degree=0, exclude_entry_points=true)` to check for dead code
- Use `get_graph_schema` for quick project orientation
- Fall back to Grep/Glob only for text content (strings, comments, config values)

Graph queries cost ~500 tokens. File-by-file exploration costs ~80,000 tokens. Always use the graph first.

## Browser Tooling (Playwright vs. chrome-devtools MCP)

Two browser surfaces, split by task type:

- **Verification / CI / regression → Playwright.** The existing `browser-verifier` agent and `/prism-verify` command (plus `/prism-screenshot`, `/prism-browse`) drive Playwright for screenshots, console-error checks, and structured assertions. This path is **unchanged**.
- **Interactive / exploratory debugging → chrome-devtools MCP.** The `chrome-devtools` MCP server (declared in the project `.mcp.json`) is the debugging surface — live DOM inspection, network/console traces, performance, and step-through.

**Override:** when the user explicitly names **"playwright"** or **"devtools"**, use that tool's flow regardless of task type — the explicit name wins over the default routing above.

## File Naming Conventions

- Research/plans/validation: `YYYY-MM-DD-topic.md` (or `YYYY-MM-DD-ENG-XXXX-description.md` with ticket)
- Skills: `prism-<phase>` (e.g., `prism-research`)
- Agents: `<domain>-<role>` (e.g., `codebase-locator`)
- Commands: `<action>_<noun>` (e.g., `create_plan`)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **prism** (39798 symbols, 90788 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/prism/context` | Codebase overview, check index freshness |
| `gitnexus://repo/prism/clusters` | All functional areas |
| `gitnexus://repo/prism/processes` | All execution flows |
| `gitnexus://repo/prism/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
