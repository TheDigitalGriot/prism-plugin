---
name: prism-implement
description: Implementation phase for complex coding tasks. Use when executing an approved plan. Triggers on "implement the plan", "start building", "execute phase 1", or after plan approval. Works phase by phase with verification checkpoints.
model: sonnet
---

# Prism Implement

Execute the approved plan phase by phase with verification at each checkpoint.

## Prerequisites

- Approved plan in `thoughts/shared/plans/`
- All plan questions resolved
- Success criteria defined

## Workflow

### 1. Load Plan

Read plan completely. Check for:
- Existing checkmarks (resume if partial)
- Current phase status
- Session notes from previous work

Load phases into TodoWrite.

### 2. Read All Phase Files

Before changes, read ALL files in current phase:
- Files to modify
- Files to create (if updating existing)

### 3. Implement Current Phase

Follow steps exactly as written.

For each step:
1. Make the change
2. Mark checkbox: `- [x]`
3. Update TodoWrite

### 4. Run Verification

Execute ALL verification commands:
```bash
# Whatever plan specifies
npm run typecheck
npm test -- --grep "feature"
```

### 5. Update Checkpoint

Mark phase complete in plan:
```markdown
**Checkpoint**: [x] Phase N complete
```

### 6. STOP and Confirm

After each phase:

```markdown
## Phase [N] Complete

**Changes**: [summary]
**Verification**: [x] passed

**Next**: Phase [N+1] - [name]

Ready to proceed?
```

Wait for approval before continuing.

## Handling Mismatches

When reality differs from plan:

```markdown
## Mismatch in Phase [N]

**Plan said**: [expected]
**Found**: [actual]
**Impact**: [effect]

**Options**:
A) Adapt to [approach]
B) Update plan to [change]
C) Stop and discuss

How to proceed?
```

Never silently deviate.

## Commands

After completing phases:
- `/commit` - Create atomic commits
- `/validate` - Verify implementation
- `/describe_pr` - Generate PR description

## Rules

1. **Follow the plan** - Adapt but preserve intent
2. **One phase at a time** - Unless told otherwise
3. **Never skip verification**
4. **Don't check manual tests** - Only user verifies
5. **Update plan document** - Keep checkboxes current
6. **Stop at checkpoints** - Get approval first

## Session Handoff

If context high or session ending, add to plan:

```markdown
## Session Notes - [Date]
- Completed: Phase [N]
- In Progress: Phase [N+1], step [X]
- Next action: [specific step]
```
