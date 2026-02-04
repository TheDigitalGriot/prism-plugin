---
name: prism
description: Structured 4-phase development workflow for complex coding tasks. Use when building features, fixing bugs, refactoring, or any work requiring systematic research before implementation. Triggers on "help me build", "implement this feature", "fix this bug", "prism", "structured workflow", or complex multi-step tasks. Splits work through specialized agents to produce focused, quality code.
model: sonnet
---

# Prism

**Research -> Plan -> Implement -> Validate**

Focus complexity through specialized agents to produce clear, quality code.

## Quick Reference

### Core Workflow

| Phase | Skill | Output |
|-------|-------|--------|
| Research | `/prism-research` | `thoughts/shared/research/YYYY-MM-DD-topic.md` |
| Plan | `/prism-plan` | `thoughts/shared/plans/YYYY-MM-DD-feature.md` |
| Implement | `/prism-implement` | Working code + updated checkboxes |
| Validate | `/prism-validate` | `thoughts/shared/validation/YYYY-MM-DD-report.md` |
| Iterate | `/prism-iterate` | Updated plan + continued implementation |
| Ralph | `/prism-ralph` | Autonomous story execution via `ralph.sh` |

### Document Generation

| Type | Skill/Command | Output |
|------|---------------|--------|
| PRD | `/prism-prd` | `thoughts/shared/plans/YYYY-MM-DD-[name]-PRD.md` |
| User Flows | `/prism-visual-docs` | `thoughts/shared/plans/YYYY-MM-DD-[name]-USER-FLOWS.md` |
| Tech Spec | `/generate_tech_spec` | `thoughts/shared/plans/YYYY-MM-DD-[name]-TECHNICAL-SPEC.md` |
| Pricing | `/generate_pricing` | `thoughts/shared/plans/YYYY-MM-DD-[name]-PRICING.md` |

## Workflow Selection

| Scenario | Phases |
|----------|--------|
| New feature, unfamiliar codebase | Full R->P->I->V |
| Feature in known codebase | P->I->V (skip Research) |
| Simple change, clear scope | I->V (skip Research + Plan) |
| Trivial fix (<20 lines) | Direct implementation |

## Starting the Workflow

### Check for Existing Work

First, check `thoughts/` for existing artifacts:

```
Task(subagent_type="thoughts-locator")
"Find existing research, plans, or work related to [topic]"
```

Based on findings:
- **Nothing exists** -> Start with Research
- **Research exists** -> Start with Plan
- **Plan exists (incomplete)** -> Resume Implementation
- **Implementation done** -> Run Validation

### Initialize thoughts/ Directory

If `thoughts/` doesn't exist:
```bash
python scripts/init_thoughts.py [project-path]
```

Creates:
```
thoughts/
├── shared/           # Committed
│   ├── research/
│   ├── plans/
│   └── validation/
└── local/            # Gitignored
```

## Phase Details

### Research (`/prism-research`)

Document the codebase without recommendations.

**Agents available**:
- `codebase-locator` - Find files
- `codebase-analyzer` - Understand code
- `codebase-pattern-finder` - Find patterns
- `thoughts-locator` - Find existing docs
- `web-search-researcher` - External research

### Plan (`/prism-plan`)

Create actionable plan through iteration.

**Key behaviors**:
- Present understanding first
- Get feedback before full plan
- Resolve all questions
- Define testable success criteria

### Implement (`/prism-implement`)

Execute plan phase by phase.

**Key behaviors**:
- One phase at a time
- Run verification commands
- Stop at checkpoints for approval
- Document mismatches

### Validate (`/prism-validate`)

Verify implementation matches plan.

**Key behaviors**:
- Run all automated checks
- Compare against success criteria
- Document deviations
- Generate validation report

### Iterate (`/prism-iterate`)

Update plan and continue when changes needed.

### Ralph Autonomous Execution (`/prism-ralph`)

For autonomous multi-story execution without human intervention.

**When to use**:
- Large feature with 10+ changes
- Repetitive transformations
- Well-defined, decomposable work

**Workflow**:
1. Create plan with `/prism-plan`
2. Decompose with `/decompose_plan`
3. Run `./scripts/ralph.sh`

**Key behaviors**:
- Fresh AI context per story (no degradation)
- Quality gates before each commit
- Learnings accumulate in `progress.md`
- Terminates when all stories complete

**Files**:
- `thoughts/shared/ralph/stories.json` - Task definitions
- `thoughts/shared/ralph/progress.md` - Accumulated learnings

## Document Generation

Generate formal documentation before or alongside development.

### PRD (`/prism-prd`)

Product Requirements Document - foundation for the project.

**Workflow**:
1. Checks for existing context in `thoughts/`
2. Invokes `/generate_prd` with clarifying questions
3. Saves to `thoughts/shared/plans/`
4. Offers companion documents

**Outputs**: Problem statement, target users, features, technical requirements, risks

### Visual Docs (`/prism-visual-docs`)

User flows, wireframes, and UX specifications.

**Workflow**:
1. Locates relevant PRD
2. Invokes `/generate_user_flows` for UX docs
3. Optionally invokes `/generate_tech_spec` for architecture
4. Saves to `thoughts/shared/plans/`

**Outputs**: User personas, flow diagrams, screen inventory, wireframes, component library

### Available Commands

| Command | Purpose |
|---------|---------|
| `/generate_prd` | Product requirements document |
| `/generate_user_flows` | User flows and wireframes |
| `/generate_tech_spec` | Technical specification |
| `/generate_pricing` | MVP pricing proposal |

### Document Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  prism-prd  │────▶│ visual-docs │────▶│  prism-plan │
│  (Product   │     │  (UX Flows  │     │  (Impl      │
│   Reqs)     │     │   & Specs)  │     │   Steps)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Context Management

| Context | Action |
|---------|--------|
| < 40% | Continue |
| 40-60% | Consider phase transition |
| > 60% | Save state, start fresh |

## TodoWrite Integration

Each phase uses TodoWrite for in-session tracking:
- Research: Track open questions
- Plan: Track phases as todos
- Implement: Track steps within phases
- Validate: Track criteria checks

## Available Agents

All agents in `~/.claude/agents/`:

| Agent | Purpose |
|-------|---------|
| `codebase-locator` | Find WHERE code lives |
| `codebase-analyzer` | Understand HOW code works |
| `codebase-pattern-finder` | Find patterns to follow |
| `thoughts-locator` | Find existing docs |
| `thoughts-analyzer` | Extract insights from docs |
| `web-search-researcher` | External research |

Invoke via: `Task(subagent_type="agent-name")`
