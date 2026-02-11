# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Prism is a Claude Code plugin that implements a structured 4-phase development workflow: **Research → Plan → Implement → Validate**. It provides skills, commands, and agents that guide AI through deliberate phases rather than jumping straight into code. For large features, Spectrum autonomous execution runs one story per fresh Claude session in a loop.

## Build & Test Commands (TUI only)

The plugin itself is markdown-based prompt engineering with no build step. The Go-based TUI dashboard lives in `cmd/prism-tui/`:

```bash
cd cmd/prism-tui
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
│   ├── research/         # YYYY-MM-DD-topic.md
│   ├── plans/            # YYYY-MM-DD-feature.md
│   ├── validation/       # YYYY-MM-DD-report.md
│   ├── handoffs/         # Session handoff documents
│   ├── prs/              # PR descriptions
│   ├── spectrum/         # progress.md (accumulated learnings)
│   ├── ref/              # Reference materials
│   └── docs/             # Project documentation
└── local/                # Gitignored, per-developer artifacts
```

Initialize with: `python skills/prism/scripts/init_prism.py`

## stories.json Schema

```json
{
  "plan": { "name": "...", "source": "path/to/plan.md", "qualityGates": ["npm test"] },
  "stories": [{
    "id": "STORY-001", "title": "...", "description": "...",
    "priority": 1, "status": "pending|in_progress|complete",
    "blockedBy": null, "files": [{"path": "...", "action": "create|modify|delete"}],
    "steps": [{"description": "...", "done": false}]
  }]
}
```

## Key Principles

- **"Documentarian, Not Critic"**: All research agents only describe what exists. They do NOT suggest improvements or critique implementation unless asked.
- **Interactive Planning**: Present understanding first, get user buy-in at each step, never write a full plan in one shot, resolve all unknowns before finalizing.
- **Two-Category Success Criteria**: Plans always separate "Automated Verification" (runnable commands) from "Manual Verification" (human testing).
- **Fresh Context Per Iteration**: Spectrum gives each story a new Claude session. Memory persists through files and git commits, not AI context.

## TUI Dashboard (cmd/prism-tui/)

Go 1.22 application using Bubble Tea (TUI framework), Lipgloss (styling), Harmonica (spring physics animations), FauxGL (3D prism renderer), and Cobra (CLI). Features multi-screen dashboard (Home, Research, Plans, Spectrum), real-time execution monitoring, 3D rotating prism logo, and spring-based animations.

Key packages:
- `app/` — Bubble Tea UI models and views
- `domain/` — Story parsing, progress tracking, signal detection
- `claude/` — Claude runner integration
- `prism/` — 3D prism renderer using FauxGL

## File Naming Conventions

- Research/plans/validation: `YYYY-MM-DD-topic.md` (or `YYYY-MM-DD-ENG-XXXX-description.md` with ticket)
- Skills: `prism-<phase>` (e.g., `prism-research`)
- Agents: `<domain>-<role>` (e.g., `codebase-locator`)
- Commands: `<action>_<noun>` (e.g., `create_plan`)
