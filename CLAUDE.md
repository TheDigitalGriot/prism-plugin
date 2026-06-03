# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## File Naming Conventions

- Research/plans/validation: `YYYY-MM-DD-topic.md` (or `YYYY-MM-DD-ENG-XXXX-description.md` with ticket)
- Skills: `prism-<phase>` (e.g., `prism-research`)
- Agents: `<domain>-<role>` (e.g., `codebase-locator`)
- Commands: `<action>_<noun>` (e.g., `create_plan`)
