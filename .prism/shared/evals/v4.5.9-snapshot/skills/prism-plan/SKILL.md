---
name: prism-plan
description: Planning phase for complex coding tasks. Use when creating implementation plans after research. Triggers on "create a plan", "plan the implementation", "design how to build", or after research completes. Interactive planning - present understanding, get feedback, iterate before finalizing.
model: opus
effort: xhigh
---

# Prism Plan

Create actionable implementation plans through iteration with the user.

## Philosophy

- **Plans are contracts** - No implementation without buy-in
- **Be Skeptical** - Question vague requirements; identify issues early; don't assume, verify with code
- **Be Interactive** - Don't write full plan in one shot; get buy-in at each step
- **Be Thorough** - Read all context files COMPLETELY; include specific file:line references
- **Be Practical** - Focus on incremental, testable changes; consider migration and rollback

<HARD-GATE>
Do NOT invoke any implementation skill, write any production code, scaffold any project, or take any implementation action until you have presented a plan and the user has approved it. Planning and implementation are separate phases — never collapse them.
</HARD-GATE>

## Prerequisites

- Research exists in `.prism/shared/research/` OR
- Sufficient codebase understanding from current session

## Available Agents

| Agent | Purpose |
|-------|---------|
| `codebase-analyzer` | Deep-dive on specific files |
| `codebase-pattern-finder` | Find patterns to model after |
| `prism-analyzer` | Extract insights from research |
| `graph-navigator` | Blast radius + structural impact analysis (Step 1.5) |

## Workflow

### 1. Load Context

If research document exists:
```
Task(subagent_type="prism-analyzer")
"Analyze [research doc]. Extract decisions, constraints, patterns."
```

### 1.5 Structural Analysis (if codebase-memory-mcp available)

Before presenting understanding, run a quick blast-radius scan. If `list_projects()` returns this project as indexed (or run `index_repository` if not):

1. `get_graph_schema()` — quick orientation, understand what's indexed
2. `search_graph(label="Function", name_pattern="<target functions this plan touches>")` — identify the specific symbols being changed
3. For each change target: `trace_call_path(function_name="<target>", direction="inbound", depth=3)` — blast radius
4. `search_graph(max_degree=0, exclude_entry_points=true)` — any dead code that can be safely removed alongside this change

Use results to:
- **Risk-order plan phases**: high blast radius = implement and verify early
- **Populate the "Structural Impact" section** of the plan output (template below)

If codebase-memory-mcp is not available, skip silently and note "Structural analysis skipped: graph not indexed" in the plan.

### 2. Present Understanding

Before writing plan, confirm understanding:

```markdown
## My Understanding

**Goal**: [What we're building]
**Key Files**: [paths and why relevant]
**Patterns to Follow**: [from codebase]
**Constraints**: [discovered limitations]

**Questions** (only if code can't answer):
1. [Focused question]
```

Wait for user confirmation.

### 3. Design Options (if multiple approaches)

```markdown
## Approach Options

### Option A: [Name]
- Pros: [benefits]
- Cons: [drawbacks]

### Option B: [Name]
- Pros: [benefits]
- Cons: [drawbacks]

Which approach?
```

### 4. Get Structure Approval

```markdown
## Proposed Phases

1. **[Phase 1]**: [one-line goal]
2. **[Phase 2]**: [one-line goal]

Does this make sense?
```

### 5. Write Full Plan

Save to `.prism/shared/plans/YYYY-MM-DD-feature.md`

Use TodoWrite to track phases.

### 6. Emit Stories (the executable work-definition)

A plan is not finished until it has emitted its **stories** — the single work-definition every
executor (`prism-implement`, `prism-subagent`, `prism-spectrum`) reads. Do NOT leave this as a
separate step the user must remember; the plan doc and the stories are produced together, from
the same plan.

1. Add an `epic:` id to the plan's front-matter (kebab-slug of the plan filename). This is the
   stable back-link between `plan.md` (human narrative) and `stories.json` (executable truth) —
   either can be found from the other.
2. Invoke the shared plan→stories engine — the [`decompose_plan`](../../commands/decompose_plan.md)
   command — to parse the plan's phases/steps into `.prism/stories/stories.json`. Schema + mapping
   rules live in [`.prism/shared/contracts/stories-contract.md`](../../.prism/shared/contracts/stories-contract.md):
   one behavioral requirement per story, zero requirements dropped, story `id`s stable across re-emits.
3. If the plan exceeds a single epic (~200K tokens of requirements), delegate to
   [`prism-decompose`](../prism-decompose/SKILL.md) for multi-epic splitting instead.

**A plan without a `stories.json` is incomplete.** `plan.md` is the contract for humans; the
stories are the contract for the executors.

## Output

See [references/plan-template.md](references/plan-template.md) for full template.

Key sections:
- Success Criteria (automated AND manual)
- Phases with specific files and steps
- Verification commands per phase
- Risks and mitigations
- Edge cases

## Rules

1. **Interactive** - Never write full plan in one shot
2. **No open questions** - Resolve ALL unknowns first
3. **Testable criteria** - Every criterion verifiable
4. **Specific file paths** - Know exactly what changes
5. **Phase checkpoints** - Gates between phases
6. **Explicit scope** - Always include "What We're NOT Doing" section
7. **Two-category criteria** - Separate automated vs manual verification

## Structural Impact Template

Include this section in the plan when Step 1.5 graph analysis was run. Omit if graph was unavailable.

```markdown
## Structural Impact (graph-informed)

### Change Targets
- `qualified::path#Function` — N direct callers, M transitive (risk: LOW/MEDIUM/HIGH/CRITICAL)

### Blast Radius: [LOW | MEDIUM | HIGH | CRITICAL]
- N direct files affected
- M transitive files potentially affected

### Dead Code Candidates (safe to remove)
- `qualified::path#Function` — 0 callers, not an entry point
- *(none if clean)*
```

Phases are risk-ordered: higher blast radius = earlier in the plan with earlier verification checkpoint.

## No Placeholders Gate

Before a plan exits the planning phase, verify zero instances of any of these patterns exist in any task description, step, or success criterion:

| Pattern | Example | Why it fails |
|---------|---------|--------------|
| `TBD` / `TODO` anywhere in task text | "Handle edge case TBD" | Deferred intent is a non-plan |
| "Similar to Task N" / "see above" | "Same as Task 3 but for auth" | Cross-reference without a self-contained spec |
| Empty success criteria | Task with no acceptance criteria | Untestable by definition |
| Undefined cross-references | "Use the pattern from research" without citing `file:line` | Implementer can't follow what they can't find |
| "fill in" / "tbd later" / "to be determined" | Any variant | Acknowledged incompleteness |
| Vague quantifiers without baseline | "Make it faster" / "Improve quality" | Not falsifiable |

```
IRON LAW:
NO PLAN EXITS THIS PHASE WITH A TBD ANYWHERE IN TASK DESCRIPTIONS OR SUCCESS CRITERIA.
```

If any of the above are found: pause, resolve, re-check before presenting to the user for approval.

## Success Criteria Format

Always separate into two categories:

```markdown
#### Automated Verification:
- [ ] Tests pass: `npm test`
- [ ] Types check: `npm run typecheck`

#### Manual Verification:
- [ ] Feature works in UI
- [ ] Performance acceptable
```

> See also: [cl-plugin-structure/references/component-patterns.md](../cl-plugin-structure/references/component-patterns.md) for multi-skill harness planning and component composition patterns.
