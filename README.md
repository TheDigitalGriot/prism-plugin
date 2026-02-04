# Prism

A structured 4-phase development workflow for Claude Code: **Research → Plan → Implement → Validate**

Prism transforms complex coding tasks into focused, quality work through specialized agents and systematic documentation.

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
| `/prism:prism-debug` | Debug with parallel agents |
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
       ▼                                                           ▼
┌─────────────┐                                            ┌─────────────┐
│ visual-docs │                                            │  validate   │
│  (Optional) │                                            │             │
└─────────────┘                                            └──────┬──────┘
                                                                  │
                                                                  ▼
                                                           ┌─────────────┐
                                                           │   iterate   │
                                                           │ (if needed) │
                                                           └─────────────┘
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

| Agent | Purpose | Model |
|-------|---------|-------|
| `codebase-locator` | Find WHERE code lives | haiku |
| `codebase-analyzer` | Understand HOW code works | opus |
| `codebase-pattern-finder` | Find patterns to model after | sonnet |
| `thoughts-locator` | Find existing docs in thoughts/ | haiku |
| `thoughts-analyzer` | Extract insights from docs | opus |
| `web-search-researcher` | Research external docs/APIs | sonnet |

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

## Thoughts Directory

Prism uses a `thoughts/` directory for persistent documentation:

```
project/
└── thoughts/
    ├── shared/            # Committed to repo
    │   ├── research/      # YYYY-MM-DD-topic.md
    │   ├── plans/         # YYYY-MM-DD-feature.md (PRDs, specs, flows)
    │   ├── validation/    # YYYY-MM-DD-report.md
    │   ├── handoffs/      # Session handoff docs
    │   └── prs/           # PR descriptions
    └── local/             # Gitignored, per-developer
```

Initialize with:
```bash
python skills/prism/scripts/init_thoughts.py
```

## License

MIT
