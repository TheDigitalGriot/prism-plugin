---
description: Convert a Prism implementation plan into Ralph-style executable stories for autonomous iteration
model: opus
---

# Decompose Plan to Stories

Convert an existing Prism implementation plan into Ralph-compatible `stories.json` format for autonomous execution via `ralph.sh`.

## Prerequisites

- Approved plan in `thoughts/shared/plans/`
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

**Create `thoughts/shared/ralph/stories.json`**:
```json
{
  "plan": {
    "name": "[Plan title]",
    "source": "[path to plan]",
    "createdAt": "[ISO timestamp]",
    "qualityGates": [...]
  },
  "stories": [...]
}
```

**Create `thoughts/shared/ralph/progress.md`**:
```markdown
---
plan: [Plan title]
startedAt: [ISO timestamp]
lastUpdated: [ISO timestamp]
---

# Ralph Progress Log

## Codebase Patterns (Consolidated)

*Patterns will be added as iterations discover them*

---

*Run `./scripts/ralph.sh` to begin autonomous execution*
```

### 10. Provide Next Steps

```markdown
## Ready for Ralph Execution

**Files created**:
- `thoughts/shared/ralph/stories.json` - [N] stories
- `thoughts/shared/ralph/progress.md` - Progress log

**To start autonomous execution**:
```bash
./scripts/ralph.sh
```

**To run with options**:
```bash
RALPH_MAX_ITERATIONS=20 ./scripts/ralph.sh      # Custom iteration limit
RALPH_VERBOSE=true ./scripts/ralph.sh           # Verbose output
```

**To monitor progress**:
- Watch `thoughts/shared/ralph/progress.md` for learnings
- Check `thoughts/shared/ralph/stories.json` for status
- Use `git log --oneline` to see commits
```

## Rules

1. **Stories must be atomic** - One logical change per story
2. **Dependencies must be explicit** - No hidden ordering assumptions
3. **Quality gates come from plan** - Use plan's verification commands
4. **Review before generation** - User approves decomposition
5. **Preserve plan intent** - Stories should map back to phases
6. **Err on smaller** - Better to have more small stories than fewer large ones
