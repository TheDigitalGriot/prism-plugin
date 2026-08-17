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
| Research | `/prism-research` | `.prism/shared/research/YYYY-MM-DD-topic.md` |
| Plan | `/prism-plan` | `.prism/shared/plans/YYYY-MM-DD-feature.md` |
| Implement | `/prism-implement` | Working code + updated checkboxes |
| Verify UI | `/prism-verify` | `.prism/local/verifications/{date}-{context}/` |
| Validate | `/prism-validate` | `.prism/shared/validation/YYYY-MM-DD-report.md` |
| Iterate | `/prism-iterate` | Updated plan + continued implementation |
| Spectrum | `/prism-spectrum` | Autonomous story execution via `spectrum.sh` |
| Debug | `/prism-debug` | Debug investigation report |
| Brainstorm | `/prism-brainstorm` | `.prism/shared/brainstorms/YYYY-MM-DD-<topic>.md` (decision ledger) |
| Design | `/prism-design` | `.prism/shared/designs/YYYY-MM-DD-<topic>-design.md` + `.pen` (dual output) |
| Finish | `/prism-finish` | Merge, PR, keep, or discard branch |

### Document Generation

| Type | Skill/Command | Output |
|------|---------------|--------|
| PRD | `/prism-prd` | `.prism/shared/plans/YYYY-MM-DD-[name]-PRD.md` |
| User Flows | `/prism-visual-docs` | `.prism/shared/plans/YYYY-MM-DD-[name]-USER-FLOWS.md` |
| Tech Spec | `/generate_tech_spec` | `.prism/shared/plans/YYYY-MM-DD-[name]-TECHNICAL-SPEC.md` |
| Pricing | `/generate_pricing` | `.prism/shared/plans/YYYY-MM-DD-[name]-PRICING.md` |

## Workflow Selection

| Scenario | Phases |
|----------|--------|
| New feature, unfamiliar codebase | Full R->P->I->V |
| Feature in known codebase | P->I->V (skip Research) |
| Simple change, clear scope | I->V (skip Research + Plan) |
| Trivial fix (<20 lines) | Direct implementation |
| Design decisions needed | Brainstorm->Design->P->I->V |

## Starting the Workflow

### Check for Existing Work

First, check `.prism/` for existing artifacts:

```
Task(subagent_type="prism-locator")
"Find existing research, plans, or work related to [topic]"
```

Based on findings:
- **Nothing exists** -> Start with Research
- **Design decisions needed** -> Start with Brainstorm
- **Work is complete** -> Finish with prism-finish
- **Research exists** -> Start with Plan
- **Plan exists (incomplete)** -> Resume Implementation
- **Implementation done** -> Run Validation

### Initialize .prism/ Directory

If `.prism/` doesn't exist:
```bash
python scripts/init_prism.py [project-path]
```

Creates:
```
.prism/
├── stories/          # Task definitions
├── shared/           # Committed
│   ├── research/
│   ├── plans/
│   ├── validation/
│   ├── spectrum/     # Execution state
│   ├── ref/
│   └── docs/
└── local/            # Gitignored
```

## Phase Details

### Research (`/prism-research`)

Document the codebase without recommendations.

**Agents available**:
- `codebase-locator` - Find files
- `codebase-analyzer` - Understand code
- `codebase-pattern-finder` - Find patterns
- `prism-locator` - Find existing docs
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

### Verify UI (`/prism-verify`)

Browser verification — confirm the UI renders correctly after implementation.

**Key behaviors**:
- Checks playwright-cli is installed (graceful skip if not)
- Detects dev server from package.json
- Spawns `browser-verifier` agent for headless checks
- Stores screenshots and results in `.prism/local/verifications/` (gitignored)
- Optional phase: runs between Implement and Validate

### Validate (`/prism-validate`)

Verify implementation matches plan.

**Key behaviors**:
- Run all automated checks
- Compare against success criteria
- Document deviations
- Generate validation report

### Iterate (`/prism-iterate`)

Update plan and continue when changes needed.

### Spectrum Autonomous Execution (`/prism-spectrum`)

For autonomous multi-story execution without human intervention.

**When to use**:
- Large feature with 10+ changes
- Repetitive transformations
- Well-defined, decomposable work

**Workflow**:
1. Create plan with `/prism-plan`
2. Decompose with `/decompose_plan`
3. Run `./scripts/spectrum.sh`

**Key behaviors**:
- Fresh AI context per story (no degradation)
- Quality gates before each commit
- Learnings accumulate in `progress.md`
- Terminates when all stories complete

**Files**:
- `.prism/stories/stories.json` - Task definitions
- `.prism/shared/spectrum/progress.md` - Accumulated learnings

### Debug (`/prism-debug`)

Investigate issues during implementation or when quality gates fail.

**When to use**:
- Quality gate failures (typecheck, lint, test)
- Unexpected runtime errors
- "It was working before" scenarios

**Key behaviors**:
- Spawns parallel investigation agents
- Checks logs, app state, and git history
- Produces structured debug report
- Integrates with Spectrum auto-retry flow

**Agents available**:
- `log-investigator` - Analyze log files for errors
- `state-investigator` - Check app state and config
- `git-investigator` - Analyze recent changes

**Spectrum Integration**:
When Spectrum encounters quality gate failures, `/prism-debug` runs automatically to capture diagnostic context for the next retry iteration.

### Brainstorm (`/prism-brainstorm`)

Interactive design exploration with optional browser-based visual companion.

**When to use**:
- Design decisions before planning (A/B choices)
- Visual UI decisions (layouts, components)
- Exploring multiple approaches

**Key behaviors**:
- HARD-GATE: No code until design approved
- Optional visual companion (HTML mockups in browser)
- One question at a time
- Saves design document to `.prism/shared/plans/`

### Design (`/prism-design`)

Bridge between research and planning — produces architectural decisions.

**When to use**:
- Research identified multiple viable approaches
- Cross-cutting concerns need decisions
- Feature involves user-facing design

**Key behaviors**:
- Invokes `/prism-brainstorm` for each decision
- Optionally generates user flows
- Saves design document to `.prism/shared/plans/`

### Finish (`/prism-finish`)

Complete development work with structured options.

**When to use**:
- Implementation and validation are complete
- Ready to merge, create PR, or clean up

**Key behaviors**:
- Verifies tests pass first
- 4 options: merge locally, push+PR, keep as-is, discard
- Cleans up worktrees after merge/PR/discard
- Integrates with `/describe_pr`

## Document Generation

Generate formal documentation before or alongside development.

### PRD (`/prism-prd`)

Product Requirements Document - foundation for the project.

**Workflow**:
1. Checks for existing context in `.prism/`
2. Invokes `/generate_prd` with clarifying questions
3. Saves to `.prism/shared/plans/`
4. Offers companion documents

**Outputs**: Problem statement, target users, features, technical requirements, risks

### Visual Docs (`/prism-visual-docs`)

User flows, wireframes, and UX specifications.

**Workflow**:
1. Locates relevant PRD
2. Invokes `/generate_user_flows` for UX docs
3. Optionally invokes `/generate_tech_spec` for architecture
4. Saves to `.prism/shared/plans/`

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
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  prism-prd  │────▶│ brainstorm/ │────▶│  prism-plan │────▶│  prism-     │
│  (Product   │     │  design     │     │  (Impl      │     │  finish     │
│   Reqs)     │     │  (Decisions)│     │   Steps)    │     │  (Ship)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
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

All agents in `agents/`:

### Research Agents

| Agent | Purpose |
|-------|---------|
| `graph-navigator` | Structural analysis via knowledge graph |
| `codebase-locator` | Find WHERE code lives |
| `codebase-analyzer` | Understand HOW code works |
| `codebase-pattern-finder` | Find patterns to follow |
| `prism-locator` | Find existing docs |
| `prism-analyzer` | Extract insights from docs |
| `web-search-researcher` | External research |

### Debug Agents

| Agent | Purpose |
|-------|---------|
| `log-investigator` | Analyze logs for errors |
| `state-investigator` | Check app state and config |
| `git-investigator` | Analyze git history |

Invoke via: `Task(subagent_type="agent-name")`
