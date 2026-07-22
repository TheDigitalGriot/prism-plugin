---
name: prism-implement
description: Implementation phase for complex coding tasks. Use when executing an approved plan. Triggers on "implement the plan", "start building", "execute phase 1", or after plan approval. Works phase by phase with verification checkpoints.
model: sonnet
---

# Prism Implement

Execute the approved plan phase by phase with verification at each checkpoint.

## Prerequisites

- Approved plan in `.prism/shared/plans/`
- All plan questions resolved
- Success criteria defined

## Workflow

### 1. Load Stories (the work-definition) + Plan (the narrative)

The **work-definition is `.prism/stories/stories.json`** — that is what you execute. Read it first and
load its stories into TodoWrite. Read the plan `.md` (found via the plan's `epic` back-link, or the
story file's `epic`) for narrative and rationale — but the *tasks* come from stories, **not** from
re-parsing plan phases.

- Read `.prism/stories/stories.json` (flat) or `.prism/stories/<epic>/stories.json`. Schema:
  `.prism/shared/contracts/stories-contract.md`.
- Resume-aware: skip stories already `status: done` (respect `completedAt` / `commitHash`).
- Load pending stories into TodoWrite, ordered by `blockedBy` then `priority`.
- If no `stories.json` exists yet (a legacy plan), prompt to run the emit step (`decompose_plan`)
  rather than silently parsing the plan's phases.

### 2. Read the Story's Files

Before changes, read ALL files listed in the current story's `files`:
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

### 5. Update Status

Mark the story done in `.prism/stories/stories.json` (`status: done`, set `completedAt`) — this is the
authoritative status every executor reads. The plan's phase checkbox is narrative and can mirror it:
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

## Rationalization Prevention

| Rationalization | Reality |
|----------------|---------|
| "I'll just fix this small thing while I'm here" | One story. One plan phase. Nothing else. |
| "This related code should be updated too" | If it's not in the plan, it doesn't exist. |
| "I can skip verification, it's obviously correct" | Nothing is obviously correct. Run the commands. |
| "The user won't mind if I combine these phases" | Phases exist for a reason. Stop at checkpoints. |
| "This is basically the same as what was planned" | "Basically" hides deviations. Document the mismatch. |

## Session Handoff

If context high or session ending, add to plan:

```markdown
## Session Notes - [Date]
- Completed: Phase [N]
- In Progress: Phase [N+1], step [X]
- Next action: [specific step]
```

> See also: [cl-plugin-structure/references/hook-events.md](../cl-plugin-structure/references/hook-events.md) for hook-touching implementation work (PostToolUse, WorktreeCreate, SubagentStart/Stop event taxonomy).
