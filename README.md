# Prism

**A structured 4-phase development workflow for Claude Code**

> Research → Plan → Implement → Validate

Prism transforms complex coding tasks into focused, quality work through specialized agents and systematic documentation. Rather than jumping straight into code, Prism guides AI through deliberate phases—researching the codebase, creating approved plans, implementing with verification, and validating against success criteria.

**Key Features:**
- 🔬 **Parallel Research Agents** — Multiple specialized agents explore code simultaneously
- 📋 **Interactive Planning** — Plans are contracts, reviewed and approved before implementation
- ✅ **Quality Gates** — Automated verification at every stage
- 🔄 **Spectrum Autonomous Execution** — Multi-story feature development with fresh context per iteration

## Installation

### From GitHub Marketplace

```bash
# Add the marketplace
/plugin marketplace add TheDigitalGriot/prism-plugin

# Install the plugin
/plugin install prism@prism-marketplace
```

### Local Development

```bash
claude --plugin-dir /path/to/prism-plugin
```

## Usage

### Automatic Workflow

Say "help me build [feature]" or "implement [task]" to trigger the full Prism workflow.

### Core Workflow Skills

| Command | Purpose |
|---------|---------|
| `/prism:prism` | Main orchestrator - routes to appropriate phase |
| `/prism:prism-research` | Research phase - document codebase |
| `/prism:prism-plan` | Create implementation plan |
| `/prism:prism-implement` | Execute approved plan |
| `/prism:prism-validate` | Verify implementation against plan |
| `/prism:prism-iterate` | Update plan based on feedback |
| `/prism:prism-spectrum` | Autonomous story execution (used with spectrum.sh) |
| `/prism:prism-debug` | Debug investigation with parallel agents |

### Spectrum Autonomous Execution

For large features with 10+ changes, use Spectrum-style iterative execution:

```bash
# 1. Create and approve a plan
/prism:prism-plan

# 2. Decompose plan into atomic stories
/prism:decompose_plan

# 3. Run autonomous execution
./scripts/spectrum.sh
```

Spectrum spawns fresh Claude sessions in a loop, executing one story per iteration with quality gates. Memory persists through files, not AI context.

| Command | Purpose |
|---------|---------|
| `/prism:prism-spectrum` | Single-story execution (called by spectrum.sh) |
| `/prism:decompose_plan` | Convert plan into stories.json |

### Debug Skill

Investigate issues during implementation or when quality gates fail:

| Command | Purpose |
|---------|---------|
| `/prism:prism-debug` | Spawn parallel debug investigation agents |

Debug automatically integrates with Spectrum - when quality gates fail, investigation runs before retry.

### Document Generation Skills

These skills orchestrate document generation commands with workflow integration:

| Command | Purpose | Invokes |
|---------|---------|---------|
| `/prism:prism-prd` | Generate PRD with workflow context | `/generate_prd` |
| `/prism:prism-visual-docs` | Generate UX documentation | `/generate_user_flows`, `/generate_tech_spec` |

### Document Generation Commands

Standalone commands for generating project documentation:

| Command | Purpose |
|---------|---------|
| `/prism:generate_prd` | Generate Product Requirements Document |
| `/prism:generate_tech_spec` | Generate Technical Specification |
| `/prism:generate_user_flows` | Generate User Flows & wireframes |
| `/prism:generate_pricing` | Generate MVP pricing proposal |

### Git & Session Commands

| Command | Purpose |
|---------|---------|
| `/prism:commit` | Git commit workflow |
| `/prism:describe_pr` | Generate PR description |
| `/prism:create_handoff` | Create session handoff document |
| `/prism:resume_handoff` | Resume from handoff |
| `/prism:worktree` | Set up git worktree |
| `/prism:review-setup` | Set up PR review environment |
| `/prism:retroactive` | Create ticket/PR after work done |

## Architecture

### Three-Layer Model

```
User Request
     │
     ▼
┌──────────────────┐
│     SKILLS       │  Auto-discovered based on context
│  (Orchestrators) │  Invoke commands & agents
└────────┬─────────┘
         ▼
┌──────────────────┐
│    COMMANDS      │  User-invocable via /command
│  (Operations)    │  Single-file focused prompts
└────────┬─────────┘
         ▼
┌──────────────────┐
│     AGENTS       │  Specialized workers via Task()
│  (Specialists)   │  Research, analysis, pattern finding
└──────────────────┘
```

### Workflow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  prism-prd  │────▶│  research   │────▶│    plan     │────▶│  implement  │
│  (Optional) │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
       │                                                           │
       ▼                                                    ┌──────┴──────┐
┌─────────────┐                                             │             │
│ visual-docs │                                             ▼             ▼
│  (Optional) │                                      ┌───────────┐ ┌───────────┐
└─────────────┘                                      │  Manual   │ │ Spectrum  │
                                                     │  Path     │ │   Path    │
                                                     └─────┬─────┘ └─────┬─────┘
                                                           │             │
                                                           └──────┬──────┘
                                                                  ▼
                                                           ┌─────────────┐
                                                           │  validate   │
                                                           └──────┬──────┘
                                                                  │
                                                                  ▼
                                                           ┌─────────────┐
                                                           │   iterate   │
                                                           │ (if needed) │
                                                           └─────────────┘
```

### Spectrum Autonomous Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    spectrum.sh (Bash Loop)                    │
│                                                              │
│  for iteration in 1..MAX_ITERATIONS; do                      │
│      claude --skill prism-spectrum                           │
│      if output contains "<promise>COMPLETE</promise>"        │
│          break                                               │
│  done                                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Fresh Claude Session (per iteration)            │
│                                                              │
│  1. Load state from files (stories.json, progress.md)       │
│  2. Pick highest priority incomplete story                   │
│  3. Implement story                                          │
│  4. Run quality gates (typecheck, lint, test)                │
│  5. If fail → auto-debug → retry signal                      │
│  6. If pass → commit → update state → continue signal        │
└─────────────────────────────────────────────────────────────┘
```

### Document Generation Flow

Skills orchestrate commands for document generation:

```
Skills (Orchestrators)              Commands (Generators)
─────────────────────              ────────────────────
prism-prd          ──────────────▶ /generate_prd

prism-visual-docs  ──────────────▶ /generate_user_flows
                   ──────────────▶ /generate_tech_spec

(standalone)       ──────────────▶ /generate_pricing
```

### Agents

#### Research Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `codebase-locator` | Find WHERE code lives | haiku |
| `codebase-analyzer` | Understand HOW code works | opus |
| `codebase-pattern-finder` | Find patterns to model after | sonnet |
| `prism-locator` | Find existing docs in .prism/ | haiku |
| `prism-analyzer` | Extract insights from docs | opus |
| `web-search-researcher` | Research external docs/APIs | sonnet |

#### Debug Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `log-investigator` | Analyze logs for errors | haiku |
| `state-investigator` | Check app state and config | haiku |
| `git-investigator` | Analyze git history | haiku |

## Key Principles

### "Documentarian, Not Critic"

All research agents follow this philosophy:
- DO NOT suggest improvements unless explicitly asked
- DO NOT critique the implementation or identify problems
- ONLY describe what exists, where it exists, how it works

### Two-Category Success Criteria

Plans always separate:
- **Automated Verification**: Commands that can be run (`npm test`, `make check`)
- **Manual Verification**: Human testing required (UI, performance, edge cases)

### Interactive Planning

Plans are contracts:
- Present understanding first
- Get user buy-in at each step
- Never write full plan in one shot
- Resolve ALL unknowns before finalizing

## Prism Directory

Prism uses a `.prism/` directory for persistent documentation:

```
project/
└── .prism/
    ├── stories/           # Task definitions
    │   └── stories.json   # Story definitions and status
    ├── shared/            # Committed to repo
    │   ├── research/      # YYYY-MM-DD-topic.md
    │   ├── plans/         # YYYY-MM-DD-feature.md (PRDs, specs, flows)
    │   ├── validation/    # YYYY-MM-DD-report.md
    │   ├── handoffs/      # Session handoff docs
    │   ├── prs/           # PR descriptions
    │   ├── spectrum/      # Execution state
    │   │   └── progress.md    # Accumulated learnings
    │   ├── ref/           # Reference materials
    │   └── docs/          # Project documentation
    └── local/             # Gitignored, per-developer
```

Initialize with:
```bash
python skills/prism/scripts/init_prism.py
```

## Spectrum Execution

For autonomous multi-story execution:

### Quick Start

```bash
# 1. Create a plan
/prism:prism-plan "Add user authentication"

# 2. Decompose into stories
/prism:decompose_plan .prism/shared/plans/2026-02-04-auth.md

# 3. Run autonomous execution
./scripts/spectrum.sh
```

### Configuration

```bash
# Custom iteration limit (default: 50)
SPECTRUM_MAX_ITERATIONS=20 ./scripts/spectrum.sh

# Verbose output
SPECTRUM_VERBOSE=true ./scripts/spectrum.sh

# Custom stories file
./scripts/spectrum.sh path/to/stories.json
```

### How It Works

1. **Fresh Context**: Each iteration spawns a new Claude session (no context degradation)
2. **File-Based Memory**: State persists in `stories.json` and `progress.md`
3. **Quality Gates**: Must pass typecheck/lint/test before commit
4. **Auto-Debug**: On failure, spawns debug agents to diagnose issues
5. **Atomic Commits**: One story = one commit
6. **Learning Accumulation**: Insights persist for future iterations

## License

MIT
