# Prism - Project Summary

## Overview

Prism is a structured 4-phase development workflow (Research -> Plan -> Implement -> Validate) for Claude Code. It transforms complex coding tasks into focused, quality work through specialized agents and systematic documentation.

**Status**: Complete - Ready for use

---

## Architecture

### Three-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│  SKILLS (Orchestrators)                                     │
│  Auto-discovered, multi-file, invoke commands & agents      │
│  prism, prism-research, prism-plan, prism-prd, etc.         │
├─────────────────────────────────────────────────────────────┤
│  COMMANDS (Operations)                                      │
│  User-invocable /command, single-file prompts               │
│  /commit, /generate_prd, /generate_tech_spec, etc.          │
├─────────────────────────────────────────────────────────────┤
│  AGENTS (Specialists)                                       │
│  Task(subagent_type="..."), pure execution                  │
│  codebase-locator, codebase-analyzer, thoughts-locator      │
└─────────────────────────────────────────────────────────────┘
```

### Invocation Methods

| Layer | How to Invoke | Example |
|-------|---------------|---------|
| Skills | Auto-trigger on context OR `/skill-name` | "Help me build auth" triggers prism |
| Commands | `/command-name` OR called by skills | `/commit`, `/generate_prd` |
| Agents | `Task(subagent_type="agent-name")` | `Task(subagent_type="codebase-locator")` |

---

## Components

### Skills (8)

#### Core Workflow Skills (6)

| Skill | Purpose | Model |
|-------|---------|-------|
| `prism` | Main orchestrator | sonnet |
| `prism-research` | Research phase - document codebase | sonnet |
| `prism-plan` | Planning phase - create implementation plans | opus |
| `prism-implement` | Implementation phase - execute plans | sonnet |
| `prism-validate` | Validation phase - verify against plan | sonnet |
| `prism-iterate` | Iteration phase - update plans based on feedback | opus |

#### Document Generation Skills (2)

| Skill | Purpose | Model | Invokes Commands |
|-------|---------|-------|------------------|
| `prism-prd` | Orchestrate PRD generation in workflow | opus | `/generate_prd` |
| `prism-visual-docs` | Orchestrate UX/visual documentation | opus | `/generate_user_flows`, `/generate_tech_spec` |

### Agents (6)

| Agent | Purpose | Model |
|-------|---------|-------|
| `codebase-locator` | Find WHERE code lives | haiku |
| `codebase-analyzer` | Understand HOW code works | opus |
| `codebase-pattern-finder` | Find patterns to model after | sonnet |
| `thoughts-locator` | Find existing docs in thoughts/ | haiku |
| `thoughts-analyzer` | Extract insights from docs | opus |
| `web-search-researcher` | Research external docs/APIs | sonnet |

### Commands (17)

#### Workflow Commands (8)

| Command | Purpose | Model |
|---------|---------|-------|
| `create_plan.md` | Create implementation plans | opus |
| `iterate_plan.md` | Update existing plans | opus |
| `implement_plan.md` | Execute approved plan | sonnet |
| `validate_plan.md` | Verify implementation | sonnet |
| `research_codebase.md` | Comprehensive codebase research | opus |
| `prism-debug.md` | Debug with parallel agents | sonnet |
| `create_handoff.md` | Session handoff documents | sonnet |
| `resume_handoff.md` | Resume from handoff | sonnet |

#### Document Generation Commands (4)

| Command | Purpose | Model |
|---------|---------|-------|
| `generate_prd.md` | Generate Product Requirements Document | opus |
| `generate_tech_spec.md` | Generate Technical Specification | opus |
| `generate_user_flows.md` | Generate User Flows & UX documentation | opus |
| `generate_pricing.md` | Generate MVP pricing proposal | opus |

#### Git & PR Commands (5)

| Command | Purpose | Model |
|---------|---------|-------|
| `commit.md` | Git commit workflow | haiku |
| `describe_pr.md` | PR description generation | sonnet |
| `retroactive.md` | Create ticket/PR after work done | sonnet |
| `worktree.md` | Git worktree setup | haiku |
| `review-setup.md` | PR review environment setup | haiku |

### Reference Templates

| Template | Location |
|----------|----------|
| Research template | `skills/prism-research/references/research-template.md` |
| Exploration patterns | `skills/prism-research/references/exploration-patterns.md` |
| Plan template | `skills/prism-plan/references/plan-template.md` |
| Validation template | `skills/prism-validate/references/validation-template.md` |
| Workflow patterns | `skills/prism/references/workflow-patterns.md` |

### Scripts

| Script | Purpose |
|--------|---------|
| `init_thoughts.py` | Initialize thoughts/ directory structure |

---

## Workflow Diagram

### Full Prism Workflow

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

```
Skills (Orchestrators)              Commands (Generators)
─────────────────────              ────────────────────
prism-prd          ──────────────▶ /generate_prd

prism-visual-docs  ──────────────▶ /generate_user_flows
                   ──────────────▶ /generate_tech_spec

(standalone)       ──────────────▶ /generate_pricing
```

---

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

---

## Thoughts Directory Structure

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

---

## File Locations

### Production Target

`~/.claude/` (agents/, commands/, skills/)

### This Repository

`c:\Users\digit\Developer\prism-plugin\`

---

## Usage

### Workflow Trigger

Say "help me build [feature]" or "implement [task]" to trigger the Prism workflow.

### Direct Skill Invocation

#### Core Workflow
- `/prism` - Main orchestrator (auto-routes to appropriate phase)
- `/prism-research` - Start research phase
- `/prism-plan` - Create implementation plan
- `/prism-implement` - Execute approved plan
- `/prism-validate` - Verify implementation
- `/prism-iterate` - Update plan based on feedback

#### Document Generation
- `/prism-prd` - Generate PRD with workflow integration
- `/prism-visual-docs` - Generate UX docs with workflow integration

### Standalone Commands

#### Document Generation
- `/generate_prd` - Generate Product Requirements Document
- `/generate_tech_spec` - Generate Technical Specification
- `/generate_user_flows` - Generate User Flows & wireframes
- `/generate_pricing` - Generate pricing proposal

#### Git & Session
- `/commit` - Create git commit
- `/describe_pr` - Generate PR description
- `/create_handoff` - Create session handoff
- `/resume_handoff` - Resume from handoff
- `/prism-debug` - Debug with parallel agents
- `/worktree` - Set up git worktree
- `/review-setup` - Set up PR review environment
