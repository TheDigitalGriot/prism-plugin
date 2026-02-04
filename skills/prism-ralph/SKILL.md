---
name: prism-ralph
description: Ralph-style single-story execution for iterative development. Executes one story per session with quality gates. Used by ralph.sh orchestrator for autonomous feature implementation. Triggers on "ralph", "execute story", "run ralph", or when invoked by ralph.sh loop.
model: sonnet
---

# Prism Ralph

Execute a single story from the backlog with quality verification and atomic commits.

## Philosophy

1. **Fresh Start**: Each session starts clean - load all context from files
2. **One Story**: Execute exactly one story per invocation
3. **Quality Gates**: Must pass typecheck/lint/test before commit
4. **Atomic Commits**: One story = one commit
5. **Learn Forward**: Capture learnings for future iterations

## State Files

| File | Purpose |
|------|---------|
| `thoughts/shared/ralph/stories.json` | Story definitions and status |
| `thoughts/shared/ralph/progress.md` | Accumulated learnings |
| `CLAUDE.md` | Project patterns and context (if exists) |

## Workflow

### 1. Load State

Read ALL state files completely before doing anything:

```
1. Read thoughts/shared/ralph/stories.json
2. Read thoughts/shared/ralph/progress.md
3. Read CLAUDE.md (if exists in project root)
```

Parse the stories and identify:
- Total stories
- Completed stories (status: "complete")
- Pending stories (status: "pending" or "in_progress")
- Blocked stories (has blockedBy that isn't complete)

### 2. Check Completion

If no incomplete stories remain:

```
Output: <promise>COMPLETE</promise>
```

Exit immediately - all work is done.

### 3. Pick Next Story

Select the highest priority incomplete story:

```javascript
const availableStories = stories
    .filter(s => s.status !== 'complete')
    .filter(s => !s.blockedBy || isComplete(s.blockedBy))
    .sort((a, b) => a.priority - b.priority);

const nextStory = availableStories[0];
```

If a story is blocked by an incomplete story, skip it.

### 4. Announce Story

Before implementing, output:

```
<ralph-story>
ID: [STORY-XXX]
Title: [Story title]
Priority: [N]
Files: [list of files to modify]
</ralph-story>
```

### 5. Implement Story

Follow Prism implementation patterns:

1. Read ALL files mentioned in the story's `files` array BEFORE making changes
2. Make changes according to the story's `steps`
3. Mark each step's `done` field as you complete it
4. Use TodoWrite for in-session tracking

**Implementation Rules**:
- Follow existing code patterns (check progress.md for learnings)
- Make minimal, focused changes
- Don't over-engineer
- Don't add features not in the story

### 6. Run Quality Gates

Execute ALL verification commands from `plan.qualityGates`:

```bash
# Default gates (adjust based on project)
npm run typecheck
npm run lint
npm test
```

Or for make-based projects:
```bash
make check
make test
```

**If any gate fails**:
1. DO NOT commit
2. Capture the full error output
3. **Run auto-debug investigation** (see Debug Integration section)
4. Record failure details AND debug findings in progress.md
5. Output: `<ralph-retry reason="QUALITY_GATE_FAILED">[debug summary]</ralph-retry>`
6. Exit (ralph.sh will retry in fresh session with debug context)

### 7. Commit Changes

If all quality gates pass:

```bash
git add [specific files from story]
git commit -m "[STORY-XXX] [Story title]

[Story description]

Implemented by Ralph iteration"
```

Capture the commit hash for the story record.

### 8. Update State Files

**Update stories.json**:
- Set story `status` to `"complete"`
- Set `completedAt` to current ISO timestamp
- Set `commitHash` to the new commit hash
- Mark all steps as `done: true`

**Append to progress.md**:

```markdown
---

## [ISO Timestamp] - [STORY-XXX] Complete

**What was done**: [1-2 sentence summary]

**Learnings**:
- [Pattern discovered]
- [Gotcha encountered]
- [Useful context for future iterations]

**Files changed**:
- [file1.ts]
- [file2.ts]

**Quality gates**: All passed
- typecheck: OK
- lint: OK
- test: OK
```

If new general patterns were discovered, add them to the "Codebase Patterns" section at the top of progress.md.

### 9. Signal Continuation

Check remaining stories:

**If more incomplete stories exist**:
```
<ralph-continue>STORY_COMPLETE: [STORY-XXX]</ralph-continue>
```

**If all stories now complete**:
```
<promise>COMPLETE</promise>
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Story requirements unclear | Record question in progress.md, output `<ralph-blocked reason="UNCLEAR">[question]</ralph-blocked>` |
| Quality gate fails | Record failure details, output `<ralph-retry reason="QUALITY_GATE_FAILED">[details]</ralph-retry>` |
| Merge conflict | Record conflict, output `<ralph-error reason="MERGE_CONFLICT">[details]</ralph-error>` |
| File not found | Check if it should be created, adapt or record in learnings |
| Dependency not complete | Skip story, pick next available |

## Output Signals

| Signal | Meaning | Ralph.sh Action |
|--------|---------|-----------------|
| `<promise>COMPLETE</promise>` | All stories done | Terminate loop |
| `<ralph-continue>...</ralph-continue>` | Story complete, more remain | Continue loop |
| `<ralph-retry>...</ralph-retry>` | Recoverable error | Retry (fresh session) |
| `<ralph-blocked>...</ralph-blocked>` | Story blocked | Skip, continue loop |
| `<ralph-error>...</ralph-error>` | Fatal error | Stop loop |

## Rules

1. **Load state fresh** - Never assume prior context, always read files
2. **One story only** - Execute exactly one story per session
3. **Quality gates mandatory** - No commit without all checks passing
4. **Atomic commits** - Each story = exactly one commit
5. **Record learnings** - Help future iterations succeed
6. **Clean output** - Use signal tags for orchestrator parsing
7. **Don't skip blocked stories** - Only work on unblocked stories
8. **Follow existing patterns** - Check progress.md before implementing

## Debug Integration

When quality gates fail, automatically invoke debug investigation before retrying.

### Auto-Debug Flow

```
Quality Gate Failure
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Capture Error Output                                     │
│     - Full error messages                                    │
│     - File:line references                                   │
│     - Stack traces                                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Spawn Debug Investigation Agents (parallel)              │
│                                                              │
│  Task(subagent_type="log-investigator")                     │
│  "Check logs for errors related to: [failure summary]"      │
│                                                              │
│  Task(subagent_type="state-investigator")                   │
│  "Check app state for anomalies: [failure context]"         │
│                                                              │
│  Task(subagent_type="git-investigator")                     │
│  "Check recent changes that might cause: [failure]"         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Synthesize Findings                                      │
│     - Combine agent results                                  │
│     - Identify root cause hypothesis                         │
│     - Formulate fix approach                                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Record in progress.md                                    │
│     - Error output                                           │
│     - Investigation findings                                 │
│     - Root cause hypothesis                                  │
│     - Suggested fix for next iteration                       │
└─────────────────────────────────────────────────────────────┘
```

### Debug Progress Entry Format

When debug runs, append to progress.md:

```markdown
---

## [Timestamp] - Debug Investigation for [STORY-XXX]

**Quality Gate Failed**: [typecheck/lint/test]

**Error Output**:
```
[captured error output]
```

**Investigation Findings**:
- **Logs**: [summary from log-investigator]
- **State**: [summary from state-investigator]
- **Git**: [summary from git-investigator]

**Root Cause Hypothesis**: [what we think is wrong]

**Suggested Fix**: [specific approach for next iteration to try]

**Files to Examine**:
- [file:line] - [why]
```

### Debug Signal Enhancement

The `<ralph-retry>` signal now includes debug context:

```xml
<ralph-retry reason="QUALITY_GATE_FAILED">
  <error>npm test failed: 2 tests failing</error>
  <root_cause>Missing mock for AuthService in test setup</root_cause>
  <suggested_fix>Add AuthService mock to test/setup.ts beforeEach</suggested_fix>
  <files>
    - src/auth/auth.service.ts:45
    - test/auth.test.ts:12
  </files>
</ralph-retry>
```

This context helps the next fresh iteration understand what went wrong and how to fix it.

## Example Session Flow

```
1. Load stories.json → 5 stories, 2 complete
2. Load progress.md → Previous learnings about auth patterns
3. Check: 3 incomplete stories remain
4. Pick: STORY-003 (priority 3, not blocked)
5. Output: <ralph-story>ID: STORY-003...</ralph-story>
6. Read files: src/auth/login.ts, src/types/auth.ts
7. Implement: Add password validation
8. Run: npm run typecheck ✓, npm run lint ✓, npm test ✓
9. Commit: "[STORY-003] Add password validation"
10. Update: stories.json (status: complete), progress.md (learnings)
11. Check: 2 incomplete stories remain
12. Output: <ralph-continue>STORY_COMPLETE: STORY-003</ralph-continue>
```
