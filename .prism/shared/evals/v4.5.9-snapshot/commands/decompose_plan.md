---
description: Convert a Prism implementation plan into Spectrum-style executable stories for autonomous iteration
model: opus
---

# Decompose Plan to Stories

Convert an existing Prism implementation plan into Spectrum-compatible `stories.json` format for autonomous execution via `spectrum.sh`.

> **This is the canonical plan→stories engine.** `/prism-plan` and `/create_plan` both call this as
> their final "emit stories" step, and it can be run standalone against any existing plan — one parser,
> two entry points. The emitted `.prism/stories/stories.json` is the **single work-definition** every
> executor reads (`prism-implement`, `prism-subagent`, `prism-spectrum`). Schema + the plan→stories
> mapping rules are the contract at [`.prism/shared/contracts/stories-contract.md`](../.prism/shared/contracts/stories-contract.md):
> one behavioral requirement per story · zero requirements dropped · story `id`s stable across re-emits
> (hash the requirement text so an unchanged requirement keeps its id when a plan is iterated).

## Prerequisites

- Approved plan in `.prism/shared/plans/`
- Plan must have defined phases and steps
- Quality gates / verification commands defined

## Process

### 1. Load the Plan

Read the plan document completely. Extract:
- Plan title and description
- Phase definitions with their steps
- Files to modify/create per phase
- Verification commands (success criteria)

### 2. Analyze Phase Complexity

For each phase, determine if it should be:
- **Single story**: 1-3 small, related steps
- **Multiple stories**: 4+ steps or steps touching different areas

**Decomposition Rules**:

| Plan Element | Story Mapping |
|--------------|---------------|
| Phase with 1-3 small steps | Single story |
| Phase with 4+ steps | Split into multiple stories |
| Step that creates new file | Own story (if substantial) |
| Step that modifies existing file | Group with related modifications |
| Test writing | Include with implementation OR separate story |

### 3. Create Atomic Stories

Each story must be:
- **Atomic**: Completable in one commit
- **Testable**: Quality gates can verify it
- **Independent**: Minimal dependencies on other stories
- **Small**: 15-30 minutes of AI work

**Story Sizing Guide**:

| Right-Sized | Too Big (Split) |
|-------------|-----------------|
| Add a database column | Build entire dashboard |
| Create a UI component | Add authentication system |
| Implement one API endpoint | Refactor entire API |
| Add form validation | Add complete feature with UI/API/DB |

**Rule of thumb**: If you can't describe the implementation in 2-3 sentences, split it.

### 4. Establish Dependencies

Set `blockedBy` when:
- Story B modifies file created by Story A
- Story B imports type/function defined by Story A
- Story B tests functionality from Story A

**Dependency Ordering Pattern**:
```
Types/Interfaces → Implementation → Integration → Tests → Polish
      (1-10)           (11-20)         (21-30)    (31-40) (41-50)
```

### 5. Set Priorities

Priority numbering (lower = done first):

| Range | Category | Examples |
|-------|----------|----------|
| 1-10 | Foundation | Types, interfaces, schemas, base classes |
| 11-20 | Core Implementation | Main logic, services, utilities |
| 21-30 | Integration | Wiring, API routes, component composition |
| 31-40 | Tests & Validation | Unit tests, integration tests |
| 41-50 | Documentation & Polish | Docs, cleanup, optional improvements |

### 6. Extract Quality Gates

From plan's verification commands, create `qualityGates` array.

**Common Patterns**:
```json
// Node.js / TypeScript
["npm run typecheck", "npm run lint", "npm test"]

// Make-based
["make check", "make test"]

// Python
["mypy .", "ruff check .", "pytest"]

// Go
["go build ./...", "go test ./..."]
```

### 6b. Extract Browser Gates (if applicable)

If the plan includes UI verification, visual testing, or browser-based success criteria, create a `browserGates` array in the `plan` object:

```json
"browserGates": [
  {
    "name": "Homepage renders correctly",
    "url": "http://localhost:3000",
    "checks": ["screenshot", "no-console-errors"]
  }
]
```

Only include `browserGates` if the plan explicitly mentions UI verification or browser-based checks. Do not add them for backend-only plans.

### 6c. Extract Epic Context (Enrichment)

From the plan document, extract:
1. **decisions** — from "Design Decisions", "Resolved Decisions", "Approach" sections
2. **references** — from "Reference Implementations", "References" sections
3. **outOfScope** — from "Out of Scope", "What We're NOT Doing" sections
4. **risks** — from "Risks & Mitigations" section (brief summaries, not full table)

### 7. Generate Stories

Create each story with:

```json
{
  "id": "STORY-XXX",
  "title": "Brief, action-oriented title",
  "description": "What this story accomplishes",
  "priority": N,
  "status": "pending",
  "blockedBy": null or "STORY-XXX",
  "files": [
    { "path": "path/to/file.ts", "action": "create|modify|delete" }
  ],
  "steps": [
    { "description": "Specific implementation step", "done": false }
  ]
}
```

### 7b. Extract Story Context

For each story, derive:
1. **why** — the design decision driving this story's approach (1 sentence)
2. **risks** — plan risks that apply to this story's files
3. **edgeCases** — from the plan's edge case table, filtered to this story
4. **patterns** — reference implementations relevant to this story
5. **graphTargets** — qualified function/class names from step descriptions
   (if codebase-memory-mcp available, use search_graph to get qualified names)

### 7c. Graph-Informed Ordering (if codebase-memory-mcp available)

1. Run trace_call_path for each change target identified in the plan
2. Order stories so CALLEE changes come BEFORE CALLER changes
3. Populate graphTargets with qualified names from graph search results
4. Flag stories touching cross-service boundaries as higher risk

### 8. Present for Review

Show the decomposition before generating:

```markdown
## Story Decomposition: [Plan Name]

**Source Plan**: [path to plan]
**Total Stories**: N
**Estimated Iterations**: N

### Stories by Priority

#### Foundation (Priority 1-10)
- [ ] STORY-001: [title] - [brief description]
- [ ] STORY-002: [title] - [brief description]

#### Core Implementation (Priority 11-20)
- [ ] STORY-003: [title] - [brief description]

#### Integration (Priority 21-30)
- [ ] STORY-004: [title] - [brief description]

#### Tests (Priority 31-40)
- [ ] STORY-005: [title] - [brief description]

### Dependencies

```
STORY-001 ──┬──> STORY-003
            │
STORY-002 ──┴──> STORY-004 ──> STORY-005
```

### Quality Gates

- `npm run typecheck`
- `npm run lint`
- `npm test`

---

Generate stories.json? (yes/no)
```

### 9. Generate Files

Upon approval:

**Create `.prism/stories/stories.json`**:
```json
{
  "epic": {
    "name": "[Plan title]",
    "source": "[path to plan]",
    "createdAt": "[ISO timestamp]",
    "qualityGates": [...],
    "decisions": ["..."],
    "references": ["..."],
    "outOfScope": ["..."],
    "risks": ["..."]
  },
  "stories": [...]
}
```

Each story should include a `context` field when enrichment data is available:
```json
{
  "context": {
    "why": "...",
    "risks": ["..."],
    "edgeCases": ["..."],
    "patterns": ["..."],
    "graphTargets": ["qualified::name#Function"]
  }
}
```

### 9b. Generate Comparison Files (for A/B token measurement)

Generate TWO files:
1. `.prism/stories/stories-v1.json` — Current schema (epic key, no context fields)
2. `.prism/stories/stories-v2.json` — Enriched schema (epic + all context fields)

Copy the enriched version as the primary `.prism/stories/stories.json`.

### 9c. Generate Story Manifests

For each story, generate a companion manifest file at `.prism/stories/<story-id>-manifest.json` (or `.prism/stories/<epic>/<story-id>-manifest.json` for epic-scoped).

Map each story step to a requirement:
- `id`: `REQ-001`, `REQ-002`, etc. (sequential within the manifest)
- `description`: from the step's description
- `depends_on`: from step ordering (each step depends on the previous)
- `owns_files`: from the story's `files` list, filtered to what this step touches
- `gate`: from `epic.qualityGates` or phase-specific verification commands
- `contracts_to_read` / `contracts_to_write`: populated if the story has cross-domain dependencies (see Step 9d)
- `passes`: `false` (initial state)

See `skills/prism-spectrum/references/story-manifest-schema.md` for the full schema.

### 9d. Initialize Contracts (if applicable)

If any stories have cross-domain dependencies (multiple stories touching the same interfaces, types, or API boundaries), create `.prism/shared/contracts/interfaces.json` with the shared type shapes identified during decomposition.

Only create contracts when:
- Two or more stories write to / read from the same interface
- A story's output is consumed by a later story across a domain boundary
- The plan explicitly identifies shared contracts or interfaces

See `skills/prism-spectrum/references/contracts-convention.md` for the convention.

**Create `.prism/shared/spectrum/progress.md`**:
```markdown
---
epic: [Plan title]
startedAt: [ISO timestamp]
lastUpdated: [ISO timestamp]
---

# Spectrum Progress Log

## Codebase Patterns (Consolidated)

*Patterns will be added as iterations discover them*

---

*Run `./scripts/spectrum.sh` to begin autonomous execution*
```

### 10. Provide Next Steps

```markdown
## Ready for Spectrum Execution

**Files created**:
- `.prism/stories/stories.json` - [N] stories
- `.prism/stories/<story-id>-manifest.json` - Per-story requirement manifests
- `.prism/shared/spectrum/progress.md` - Progress log
- `.prism/shared/contracts/interfaces.json` - (if cross-domain dependencies detected)

**To start autonomous execution**:
```bash
./scripts/spectrum.sh
```

**To run with options**:
```bash
SPECTRUM_MAX_ITERATIONS=20 ./scripts/spectrum.sh      # Custom iteration limit
SPECTRUM_VERBOSE=true ./scripts/spectrum.sh           # Verbose output
```

**To monitor progress**:
- Watch `.prism/shared/spectrum/progress.md` for learnings
- Check `.prism/stories/stories.json` for status
- Use `git log --oneline` to see commits
```

## Rules

1. **Stories must be atomic** - One logical change per story
2. **Dependencies must be explicit** - No hidden ordering assumptions
3. **Quality gates come from plan** - Use plan's verification commands
4. **Review before generation** - User approves decomposition
5. **Preserve plan intent** - Stories should map back to phases
6. **Err on smaller** - Better to have more small stories than fewer large ones
