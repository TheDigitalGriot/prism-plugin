---
name: prism-iterate
description: Iteration phase combining plan updates and re-implementation. Use when plan needs adjustment after partial implementation or validation feedback. Triggers on "iterate on plan", "update and continue", "adjust the approach", or when validation reveals issues requiring plan changes.
model: opus
---

# Prism Iterate

Update the plan based on feedback and continue implementation.

## Philosophy

1. **Be Skeptical** - Don't blindly accept changes; question vague feedback; verify feasibility
2. **Be Surgical** - Precise edits, not wholesale rewrites; preserve good content
3. **Be Thorough** - Read entire plan first; research if needed; maintain quality
4. **Be Interactive** - Confirm understanding before changes; allow course corrections
5. **No Open Questions** - If change raises questions, ASK immediately; don't leave unresolved

## When to Use

- Validation found issues requiring plan changes
- User feedback requires adjustments
- Implementation revealed new constraints
- Scope changed mid-implementation

## Workflow

### 1. Assess Current State

Check what exists:
- Plan status in `thoughts/shared/plans/`
- Completed phases (checkboxes)
- Validation report (if exists)
- User feedback

### 2. Identify Changes Needed

```markdown
## Iteration Needed

**Trigger**: [What prompted iteration]

**Current State**:
- Phase [N] complete
- Phase [N+1] blocked/needs changes

**Changes Required**:
1. [Plan adjustment 1]
2. [Plan adjustment 2]

**Impact**:
- Phases affected: [list]
- Success criteria changes: [if any]
```

### 3. Update Plan Document

Modify the plan in `thoughts/shared/plans/`:
- Add iteration note with timestamp
- Update affected phases
- Adjust success criteria if needed
- Keep history visible (don't delete, strike through or note changes)

```markdown
## Iteration Log

### [Date] - Iteration 1
**Reason**: [Why iterating]
**Changes**:
- Phase 3: Changed from [X] to [Y]
- Added Phase 3.5 for [Z]
**Approved by**: User
```

### 4. Resume Implementation

Follow `/prism-implement` workflow from the updated phase.

### 5. Re-validate if Needed

If significant changes, run `/prism-validate` again.

## Rules

1. **Document why** - Always record iteration reason
2. **Preserve history** - Don't erase, annotate changes
3. **Get approval** - User confirms plan changes
4. **Update TodoWrite** - Reflect new/changed tasks
5. **Don't restart** - Resume from appropriate point
6. **Complete changes** - Never leave unresolved questions in the plan
7. **Maintain structure** - Keep automated vs manual success criteria separation

## Research When Needed

Only spawn research tasks if changes require new technical understanding:

```
Task(subagent_type="codebase-locator")    # Find relevant files
Task(subagent_type="codebase-analyzer")   # Understand implementation
Task(subagent_type="codebase-pattern-finder")  # Find similar patterns
```

Be EXTREMELY specific about directories in prompts.
