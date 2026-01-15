---
name: prism-plan
description: Planning phase for complex coding tasks. Use when creating implementation plans after research. Triggers on "create a plan", "plan the implementation", "design how to build", or after research completes. Interactive planning - present understanding, get feedback, iterate before finalizing.
model: opus
---

# Prism Plan

Create actionable implementation plans through iteration with the user.

## Philosophy

- **Plans are contracts** - No implementation without buy-in
- **Be Skeptical** - Question vague requirements; identify issues early; don't assume, verify with code
- **Be Interactive** - Don't write full plan in one shot; get buy-in at each step
- **Be Thorough** - Read all context files COMPLETELY; include specific file:line references
- **Be Practical** - Focus on incremental, testable changes; consider migration and rollback

## Prerequisites

- Research exists in `thoughts/shared/research/` OR
- Sufficient codebase understanding from current session

## Available Agents

| Agent | Purpose |
|-------|---------|
| `codebase-analyzer` | Deep-dive on specific files |
| `codebase-pattern-finder` | Find patterns to model after |
| `thoughts-analyzer` | Extract insights from research |

## Workflow

### 1. Load Context

If research document exists:
```
Task(subagent_type="thoughts-analyzer")
"Analyze [research doc]. Extract decisions, constraints, patterns."
```

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

Save to `thoughts/shared/plans/YYYY-MM-DD-feature.md`

Use TodoWrite to track phases.

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
