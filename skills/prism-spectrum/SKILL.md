---
name: prism-spectrum
description: Spectrum-style single-story execution for iterative development. Executes one story per session with quality gates. Used by spectrum.sh orchestrator for autonomous feature implementation. Triggers on "spectrum", "execute story", "run spectrum", or when invoked by spectrum.sh loop.
model: sonnet[1m]
---

# Prism Spectrum

Execute a single story from the backlog with quality verification and atomic commits.

> **On model choice:** prism-spectrum is the *outer loop* — its job is dispatching stories and shepherding state, not deep reasoning. The actual heavy thinking happens inside the agents it spawns (codebase-analyzer, prism-analyzer, etc. — those already use opus where it matters). This is Karpathy's two-tier delegation pattern: cheap orchestrator, expensive workers. Putting opus on the spectrum outer loop pays for reasoning twice. Sonnet 4.6 at ~60% the cost benchmarks near Opus on coding tasks; the 1M context window — which IS the genuinely useful upgrade for long autonomous runs — works identically as `sonnet[1m]`. Don't reflexively bump this when a new Opus drops; the question is whether spectrum's outputs are under-reasoning, not whether a better model exists.

> **Context requirement:** Uses `sonnet[1m]` for the 1M context window needed to hold full session state during autonomous multi-story runs without compaction risk. Requires Max/Team/Enterprise plan for included 1M Sonnet context, or usage credits on Pro. Disable globally with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` if needed.

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

### 1b. Load Story Manifest & Contracts

If `.prism/stories/<story-id>-manifest.json` exists:
→ Load `references/story-manifest-schema.md` for manifest-driven execution.

If story has `contracts_to_read` or `contracts_to_write`:
→ Load `references/contracts-convention.md` for contract lifecycle.

### 1c. Load Epic + Story Context

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

### Model Selection for Agent Dispatches

When dispatching agents during implementation, select the model based on task complexity. Load `references/model-selection.md` for the full guide. Quick rule: mechanical tasks (1-2 files, clear spec) → haiku; integration tasks → sonnet; design/review → opus.

## 4a. Report Implementation Status

After implementing the story, self-assess your work and report one of four statuses:

| Status | When to Use | What Happens Next |
|--------|-------------|-------------------|
| **DONE** | Implementation complete, confident in quality | Proceed to quality gates |
| **DONE_WITH_CONCERNS** | Complete but with doubts about approach | Log concerns to progress.md, proceed to quality gates |
| **NEEDS_CONTEXT** | Missing information needed to complete | Emit `<spectrum-needs-context>` with what's needed |
| **BLOCKED** | Cannot complete the story | Emit `<spectrum-blocked>` with root cause |

### DONE_WITH_CONCERNS

If you completed the work but have doubts:
1. Log your concerns in progress.md under a `### Concerns` subsection
2. Proceed to quality gates — the two-stage review will catch real issues
3. Include concerns in the `<spectrum-continue>` signal:

```xml
<spectrum-continue>
  <concerns>
    - Concern 1: description
    - Concern 2: description
  </concerns>
</spectrum-continue>
```

### NEEDS_CONTEXT

If you cannot complete without additional information:
1. Do NOT commit partial work
2. Reset any uncommitted changes: `git checkout -- .`
3. Emit the signal with specific questions:

```xml
<spectrum-needs-context>
  <story>{STORY_ID}</story>
  <questions>
    - What is the expected behavior when X happens?
    - Which API endpoint should this call?
  </questions>
</spectrum-needs-context>
```

### BLOCKED

If the story cannot be completed:
1. Do NOT commit partial work
2. Reset any uncommitted changes: `git checkout -- .`
3. Emit the signal with root cause:

```xml
<spectrum-blocked>
  <story>{STORY_ID}</story>
  <reason>Description of why this is blocked</reason>
  <suggestion>What would unblock this</suggestion>
</spectrum-blocked>
```

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

## 5a. Two-Stage Review

After quality gates pass, dispatch two reviewer agents sequentially. This catches scope drift and quality issues that automated gates cannot detect.

### Stage 1: Spec Compliance

Load `references/spec-review-prompt.md` for the dispatch template.

1. Dispatch `spec-reviewer` agent with:
   - Full story object from stories.json
   - List of files modified (from story `files` array)
   - Quality gate results
2. If **❌ Issues Found**:
   - Fix the issues identified
   - Re-run quality gates
   - Re-dispatch spec reviewer
   - Do NOT proceed until ✅ Spec Compliant
3. If **✅ Spec Compliant**: Proceed to Stage 2

### Stage 2: Code Quality

Load `references/quality-review-prompt.md` for the dispatch template.

1. Dispatch `quality-reviewer` agent with:
   - Summary of changes
   - Story context (why, risks, patterns)
   - Changed files list
2. If **Critical or Important issues found**:
   - Fix the issues
   - Re-run quality gates
   - Re-dispatch quality reviewer
3. If **Minor only**: Note in progress.md, proceed
4. If **✅ Approved**: Proceed to commit

### Review Skip Conditions

Skip two-stage review ONLY when:
- Story modifies only configuration files (no logic changes)
- Story is documentation-only
- Story is a revert of a previous story

In all other cases, both review stages are REQUIRED.

### 5b. Browser Verification (UI stories only)

If story `files[]` includes UI paths (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`):
→ Load `references/browser-verification.md` and follow the protocol.
Skip entirely for backend-only stories.

### 5c. Visual Regression (when baselines exist)

If `.prism/shared/validation/baselines/{story-id}/` exists and contains PNGs matching story scope:
→ Load `references/visual-regression.md` and follow the protocol.
Skip if no baselines directory exists.

### 6. Commit Changes

If all quality gates pass:

Commit message format:
```
feat(STORY-XXX): Brief description of what was implemented

- Detail 1
- Detail 2
```

Use the appropriate prefix: `feat:` for new features, `fix:` for bug fixes, `docs:` for documentation, `refactor:` for refactoring, `test:` for tests.

```bash
git add [specific files from story]
git commit -m "feat(STORY-XXX): [Story title]

- [Key change 1]
- [Key change 2]"
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

## Iron Law

```
ONE STORY. ONE COMMIT. NOTHING ELSE.
```

"Violating the letter of this rule while adhering to the spirit" is violating the spirit.

## Rationalization Prevention

| Rationalization | Reality |
|----------------|---------|
| "I'll just fix this small thing while I'm here" | One story. One commit. Nothing else. |
| "This is a trivial fix that's obviously correct" | Nothing is obviously correct. Run quality gates. |
| "I can skip reading progress.md, I know the codebase" | You have ZERO prior context. Read ALL state files. |
| "I should refactor this while making changes" | Refactoring is a separate story. Do not scope-creep. |
| "The tests are probably passing" | "Probably" is not evidence. Run the commands. |
| "I'll just update this related file too" | If it's not in story.files, don't touch it. |

## Rules

1. **Load state fresh** - Never assume prior context, always read files
2. **One story only** - Execute exactly the story specified by spectrum.sh
3. **Quality gates mandatory** - No commit without all checks passing
4. **Atomic commits** - Each story = exactly one commit
5. **Record learnings** - Help future iterations succeed
6. **Clean output** - Use signal tags for orchestrator parsing
7. **Follow existing patterns** - Check progress.md before implementing

## Debug Integration

If quality gates fail after retry:
→ Load `references/debug-integration.md` and follow the 3-agent parallel debug flow.

## Example Session Flow

```
1. Read prompt → "Execute story STORY-003 from .prism/stories/stories.json"
2. Load stories.json, progress.md, CLAUDE.md
3. Read story STORY-003 context: why, risks, patterns, edge cases
4. Announce: <spectrum-story>ID: STORY-003, Title: Add password validation</spectrum-story>
5. Read files: src/auth/login.ts, src/types/auth.ts
6. Implement: Add password validation
7. Run quality gates: typecheck ✓, lint ✓, test ✓
8. Commit: "feat(STORY-003): Add password validation"
9. Update: stories.json (status: complete), progress.md (learnings)
10. Signal: <spectrum-continue>STORY_COMPLETE: STORY-003</spectrum-continue>
```

> See also: [cl-plugin-structure/references/model-config.md](../cl-plugin-structure/references/model-config.md) §6 for 1M context aliases (`opus[1m]`, `sonnet[1m]`) and availability by plan tier.
