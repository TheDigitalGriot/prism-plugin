---
name: prism-spectrum
description: Spectrum-style single-story execution for iterative development. Executes one story per session with quality gates. Used by spectrum.sh orchestrator for autonomous feature implementation. Triggers on "spectrum", "execute story", "run spectrum", or when invoked by spectrum.sh loop.
model: sonnet
---

# Prism Spectrum

Execute a single story from the backlog with quality verification and atomic commits.

## Philosophy

1. **Fresh Start**: Each session starts clean - load all context from files
2. **One Story**: Execute exactly one story per invocation
3. **Quality Gates**: Must pass typecheck/lint/test before commit
4. **Atomic Commits**: One story = one commit
5. **Learn Forward**: Capture learnings for future iterations

## State Files

The stories path and progress path are provided in the prompt. Use the exact paths given.

| File | Purpose |
|------|---------|
| `<stories-path>` | Story definitions and status (from prompt: "Execute the next story from PATH") |
| `<progress-path>` | Accumulated learnings (from prompt: "Progress file: PATH") |
| `CLAUDE.md` | Project patterns and context (if exists) |

**Path structure:** Stories and progress support both flat and epic-scoped layouts:
- Flat: `.prism/stories/stories.json` + `.prism/shared/spectrum/progress.md`
- Epic: `.prism/stories/<epic>/stories.json` + `.prism/shared/spectrum/<epic>/progress.md`

## Workflow

### 1. Load State

Read ALL state files completely before doing anything:

```
1. Read the stories file at the path from the prompt
2. Read the progress file at the path from the prompt (create if it doesn't exist)
3. Read CLAUDE.md (if exists in project root)
```

Parse the stories and identify:
- Total stories
- Completed stories (status: "complete")
- Pending stories (status: "pending" or "in_progress")
- Blocked stories (has blockedBy that isn't complete)

### 1b. Load Epic + Story Context

After loading state files, extract contextual intelligence:

1. Read `epic.decisions`, `epic.risks`, `epic.outOfScope`, `epic.references`
   — these are the human-approved architectural decisions. Follow them.
2. Read current story's `context.why` — understand WHY this story exists
3. Read `context.risks` — be aware of known pitfalls
4. Read `context.patterns` — follow referenced implementation patterns
5. Read `context.edgeCases` — handle these explicitly

If epic or context fields are absent, proceed with current behavior (implement from steps only).

### 1c. Graph Verification (if codebase-memory-mcp available)

Before implementing:
1. Run `index_repository` to ensure graph reflects latest code state
2. For each function in `story.context.graphTargets`:
   - Run `trace_call_path(function_name, direction="inbound")`
   - Record current caller count
3. If any target has significantly MORE callers than expected
   → emit `<spectrum-blocked reason="Blast radius changed: [target] now has [N] callers">`

After implementing:
4. Run `index_repository` again to capture changes
5. Run `search_graph(max_degree=0, exclude_entry_points=true)` → dead code check
6. Log graph delta in progress.md entry (nodes added/removed, new dead code)

If codebase-memory-mcp is not available, skip all graph steps silently.

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
<spectrum-story>
ID: [STORY-XXX]
Title: [Story title]
Priority: [N]
Files: [list of files to modify]
</spectrum-story>
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

Execute ALL verification commands from `epic.qualityGates`:

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
5. Output: `<spectrum-retry reason="QUALITY_GATE_FAILED">[debug summary]</spectrum-retry>`
6. Exit (spectrum.sh will retry in fresh session with debug context)

### 6b. Browser Verification (if applicable)

If the story modified UI files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`):

1. Check if `playwright-cli` is available:
   ```bash
   which playwright-cli 2>/dev/null || npx @playwright/cli --version 2>/dev/null
   ```
2. If not available, skip with note in progress.md: "Browser verification skipped: playwright-cli not installed"
3. Detect dev server command from `package.json` scripts (`dev` > `start` > `serve`)
4. Start dev server in background, poll until responding (max 30s)
5. Run browser verification:
   ```bash
   playwright-cli screenshot --session story-{id} http://localhost:PORT --name verify-{id}
   playwright-cli console --session story-{id} http://localhost:PORT
   ```
6. Evaluate results:
   - No console errors → PASS
   - Screenshot captured → store in `.prism/local/verifications/`
   - On failure → treat as quality gate failure (same debug flow as Section 6)
7. Close session: `playwright-cli session-close story-{id}`
8. Kill dev server process

### 7. Commit Changes

If all quality gates pass:

```bash
git add [specific files from story]
git commit -m "[STORY-XXX] [Story title]

[Story description]

Implemented by Spectrum iteration"
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

**CRITICAL**: Re-read the stories file and explicitly count remaining stories before signaling.

```javascript
// Re-parse the stories file (use the same path from the prompt) to get accurate count
const stories = JSON.parse(readFile('<stories-path>')).stories;
const remaining = stories.filter(s => s.status !== 'complete').length;
const total = stories.length;
const completed = total - remaining;

// Log the count for verification
console.log(`Progress: ${completed}/${total} stories complete, ${remaining} remaining`);
```

**MUST verify count before outputting signal:**

**If remaining > 0** (more incomplete stories exist):
```
<spectrum-continue>STORY_COMPLETE: [STORY-XXX] - Progress: [completed]/[total], [remaining] remaining</spectrum-continue>
```

**If remaining === 0** (ALL stories now complete):
```
<promise>COMPLETE</promise>
```

**WARNING**: NEVER output `<promise>COMPLETE</promise>` unless you have verified that ZERO stories remain incomplete. Premature completion signals will stop the entire execution loop.

## Error Handling

| Scenario | Action |
|----------|--------|
| Story requirements unclear | Record question in progress.md, output `<spectrum-blocked reason="UNCLEAR">[question]</spectrum-blocked>` |
| Quality gate fails | Record failure details, output `<spectrum-retry reason="QUALITY_GATE_FAILED">[details]</spectrum-retry>` |
| Merge conflict | Record conflict, output `<spectrum-error reason="MERGE_CONFLICT">[details]</spectrum-error>` |
| File not found | Check if it should be created, adapt or record in learnings |
| Dependency not complete | Skip story, pick next available |

## Output Signals

| Signal | Meaning | Spectrum.sh Action |
|--------|---------|-----------------|
| `<promise>COMPLETE</promise>` | All stories done | Terminate loop |
| `<spectrum-continue>...</spectrum-continue>` | Story complete, more remain | Continue loop |
| `<spectrum-retry>...</spectrum-retry>` | Recoverable error | Retry (fresh session) |
| `<spectrum-blocked>...</spectrum-blocked>` | Story blocked | Skip, continue loop |
| `<spectrum-error>...</spectrum-error>` | Fatal error | Stop loop |

## Rules

1. **Load state fresh** - Never assume prior context, always read files
2. **One story only** - Execute exactly one story per session
3. **Quality gates mandatory** - No commit without all checks passing
4. **Atomic commits** - Each story = exactly one commit
5. **Record learnings** - Help future iterations succeed
6. **Clean output** - Use signal tags for orchestrator parsing
7. **Don't skip blocked stories** - Only work on unblocked stories
8. **Follow existing patterns** - Check progress.md before implementing
9. **VERIFY before COMPLETE** - Re-read stories.json and count remaining before outputting `<promise>COMPLETE</promise>`. If remaining > 0, use `<spectrum-continue>` instead

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

The `<spectrum-retry>` signal now includes debug context:

```xml
<spectrum-retry reason="QUALITY_GATE_FAILED">
  <error>npm test failed: 2 tests failing</error>
  <root_cause>Missing mock for AuthService in test setup</root_cause>
  <suggested_fix>Add AuthService mock to test/setup.ts beforeEach</suggested_fix>
  <files>
    - src/auth/auth.service.ts:45
    - test/auth.test.ts:12
  </files>
</spectrum-retry>
```

This context helps the next fresh iteration understand what went wrong and how to fix it.

## Example Session Flow

```
1. Load stories.json → 5 stories, 2 complete
2. Load progress.md → Previous learnings about auth patterns
3. Check: 3 incomplete stories remain (not 0, so continue)
4. Pick: STORY-003 (priority 3, not blocked)
5. Output: <spectrum-story>ID: STORY-003...</spectrum-story>
6. Read files: src/auth/login.ts, src/types/auth.ts
7. Implement: Add password validation
8. Run: npm run typecheck ✓, npm run lint ✓, npm test ✓
9. Commit: "[STORY-003] Add password validation"
10. Update: stories.json (status: complete), progress.md (learnings)
11. RE-READ stories.json → count remaining: filter status !== 'complete'
12. Verify: 3/5 complete, 2 remaining (remaining > 0, so use spectrum-continue)
13. Output: <spectrum-continue>STORY_COMPLETE: STORY-003 - Progress: 3/5, 2 remaining</spectrum-continue>
```

**IMPORTANT**: Step 11-12 must RE-READ the file and COUNT before choosing the signal. Never assume the count.
