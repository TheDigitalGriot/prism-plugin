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

### 2. Identify Your Story

The story to execute is provided in your prompt by `spectrum.sh` (e.g., "Execute story STORY-003 from ..."). Story selection is deterministic — do not pick a different story. If no story ID is in the prompt, fall back to picking the highest-priority incomplete unblocked story.

### 3. Announce Story

Before implementing, output:

```
<spectrum-story>
ID: [STORY-XXX]
Title: [Story title]
Priority: [N]
Files: [list of files to modify]
</spectrum-story>
```

### 4. Implement Story

Follow Prism implementation patterns:

1. Read ALL files mentioned in the story's `files` array BEFORE making changes
2. Check for a manifest file at `.prism/stories/<story-id>-manifest.json`. If it exists, implement one requirement at a time (respecting `depends_on` ordering), skip requirements where `passes: true`, and run each requirement's `gate` command after completing it. Update `passes: true` on success. Read any `contracts_to_read` files before implementing.
3. If no manifest exists, make changes according to the story's `steps`
4. Mark each step's `done` field as you complete it
5. Use TodoWrite for in-session tracking

**Implementation Rules**:
- Follow existing code patterns (check progress.md for learnings)
- Make minimal, focused changes
- Don't over-engineer
- Don't add features not in the story

### 5. Run Quality Gates

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

### 5b. Browser Verification (if applicable)

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

### 6. Commit Changes

If all quality gates pass:

```bash
git add [specific files from story]
git commit -m "[STORY-XXX] [Story title]

[Story description]

Implemented by Spectrum iteration"
```

Capture the commit hash for the story record.

### 7. Update State Files

**Update stories.json**: Set story `status` to `"complete"`, `completedAt` to ISO timestamp, `commitHash` to the new commit hash, and all steps to `done: true`. (`spectrum.sh` will independently verify this state post-iteration.)

**Append to progress.md**: Add a brief entry with what was done, learnings for future iterations, files changed, and quality gate results. If new general patterns were discovered, add them to the "Codebase Patterns" section at the top of progress.md.

### 8. Signal Continuation

Emit the appropriate signal tag at the end of your response. `spectrum.sh` will independently verify story completion state post-iteration, so focus on accurate reporting rather than defensive counting.

- Story completed successfully: `<spectrum-continue>STORY_COMPLETE: [STORY-XXX]</spectrum-continue>`
- All stories now complete: `<promise>COMPLETE</promise>`
- Quality gate failed: `<spectrum-retry reason="QUALITY_GATE_FAILED">[details]</spectrum-retry>`
- Story blocked: `<spectrum-blocked reason="...">[details]</spectrum-blocked>`
- Fatal error: `<spectrum-error reason="...">[details]</spectrum-error>`

## Error Handling

| Scenario | Action |
|----------|--------|
| Story requirements unclear | Record question in progress.md, signal `<spectrum-blocked>` |
| Quality gate fails | Run auto-debug (see below), signal `<spectrum-retry>` |
| Merge conflict | Record conflict, signal `<spectrum-error>` |
| File not found | Check if it should be created, adapt or record in learnings |

## Rules

1. **Load state fresh** - Never assume prior context, always read files
2. **One story only** - Execute exactly the story specified by spectrum.sh
3. **Quality gates mandatory** - No commit without all checks passing
4. **Atomic commits** - Each story = exactly one commit
5. **Record learnings** - Help future iterations succeed
6. **Clean output** - Use signal tags for orchestrator parsing
7. **Follow existing patterns** - Check progress.md before implementing

## Debug Integration

When quality gates fail, automatically invoke debug investigation before retrying.

### Auto-Debug Flow

On quality gate failure:

1. **Capture** full error output (messages, file:line refs, stack traces)
2. **Spawn 3 debug agents in parallel**:
   - `Task(subagent_type="log-investigator")` — check logs for related errors
   - `Task(subagent_type="state-investigator")` — check app state for anomalies
   - `Task(subagent_type="git-investigator")` — check recent changes that might cause failure
3. **Synthesize** findings into root cause hypothesis and fix approach
4. **Record** in progress.md: error output, investigation findings, root cause, suggested fix, files to examine

### Debug Signal

Include debug context in the retry signal so the next iteration can act on it:

```xml
<spectrum-retry reason="QUALITY_GATE_FAILED">
  <error>npm test failed: 2 tests failing</error>
  <root_cause>Missing mock for AuthService in test setup</root_cause>
  <suggested_fix>Add AuthService mock to test/setup.ts beforeEach</suggested_fix>
  <files>src/auth/auth.service.ts:45, test/auth.test.ts:12</files>
</spectrum-retry>
```

## Example Session Flow

```
1. Read prompt → "Execute story STORY-003 from .prism/stories/stories.json"
2. Load stories.json, progress.md, CLAUDE.md
3. Read story STORY-003 context: why, risks, patterns, edge cases
4. Announce: <spectrum-story>ID: STORY-003, Title: Add password validation</spectrum-story>
5. Read files: src/auth/login.ts, src/types/auth.ts
6. Implement: Add password validation
7. Run quality gates: typecheck ✓, lint ✓, test ✓
8. Commit: "[STORY-003] Add password validation"
9. Update: stories.json (status: complete), progress.md (learnings)
10. Signal: <spectrum-continue>STORY_COMPLETE: STORY-003</spectrum-continue>
```
