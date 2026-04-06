# Prism Plugin Audit Remediation Plan

**Date**: 2026-04-03
**Source**: `.prism/shared/docs/prism-plugin-audit-report.md`
**Reference**: `cl-plugin-structure` skill (Claude Code plugin specification)
**Scope**: 6 priorities from audit, mapped to concrete file-level changes

---

## Executive Summary

The audit found Prism's architecture fundamentally sound but identified six mechanical gaps — all fixable without changing design philosophy. This plan maps each gap to specific files, frontmatter fields, and new artifacts required by the `cl-plugin-structure` specification.

**Estimated total file touches**: 18 modified, 4 created
**No architectural changes**: Every fix is additive frontmatter, new hook files, or text extraction

---

## Phase 1: Agent Frontmatter Hardening (Priority 1)

**Audit Finding**: All 12 agents missing `maxTurns`, `effort`, and `disallowedTools`
**cl-plugin-structure Spec**: Agent frontmatter supports `effort` (low|medium|high), `maxTurns` (integer), `disallowedTools` (comma-separated tool names)

### Impact Analysis

Without these fields:
- **Unbounded execution**: A haiku locator agent meant for 3-5 turns can spiral to 20+, wasting tokens at ~500-1000 tokens/turn
- **No effort calibration**: Haiku agents over-reason on simple lookups; opus agents may under-reason on deep analysis
- **Tool deliberation cost**: 7 read-only agents (prism-locator, prism-analyzer, codebase-locator, codebase-analyzer, codebase-pattern-finder, graph-navigator, visual-regression-grader) currently enforce read-only via prose. The agent still *deliberates* about whether to write — each deliberation costs tokens even when the answer is always "no"

### Changes Required

| File | Add `maxTurns` | Add `effort` | Add `disallowedTools` |
|------|---------------|-------------|----------------------|
| `agents/codebase-locator.md` | `8` | `low` | `Write, Edit, NotebookEdit` |
| `agents/codebase-analyzer.md` | `15` | `high` | `Write, Edit, NotebookEdit` |
| `agents/codebase-pattern-finder.md` | `15` | `medium` | `Write, Edit, NotebookEdit` |
| `agents/prism-locator.md` | `5` | `low` | `Write, Edit, NotebookEdit, Bash` |
| `agents/prism-analyzer.md` | `12` | `high` | `Write, Edit, NotebookEdit, Bash` |
| `agents/web-search-researcher.md` | `12` | `medium` | `Write, Edit, NotebookEdit` |
| `agents/browser-verifier.md` | `8` | `low` | `Write, Edit, NotebookEdit, Read, Glob, Grep` |
| `agents/graph-navigator.md` | `5` | `low` | `Write, Edit, NotebookEdit, Bash` |
| `agents/git-investigator.md` | `8` | `low` | `Write, Edit, NotebookEdit, Read, Glob, Grep` |
| `agents/log-investigator.md` | `8` | `low` | `Write, Edit, NotebookEdit, Read, Glob, Grep` |
| `agents/state-investigator.md` | `8` | `low` | `Write, Edit, NotebookEdit` |
| `agents/visual-regression-grader.md` | `8` | `medium` | `Write, Edit, NotebookEdit, Bash` |

### Rationale for Values

**maxTurns by model tier** (from cl-plugin-structure spec):
- **Haiku agents (5-8 turns)**: codebase-locator, prism-locator, browser-verifier, graph-navigator, git/log/state-investigators. These are fast-lookup agents — if they haven't found it in 8 turns, they won't find it in 20
- **Sonnet agents (12-18 turns)**: web-search-researcher, codebase-pattern-finder, visual-regression-grader. General-purpose work requiring moderate exploration
- **Opus agents (12-15 turns)**: codebase-analyzer, prism-analyzer. Deep analysis but still bounded

**effort calibration**:
- `low`: Locators and investigators — find and report, don't analyze deeply
- `medium`: Pattern-finders and graders — some reasoning required
- `high`: Analyzers — deep reasoning is the point

**disallowedTools logic**:
- All read-only agents get `Write, Edit, NotebookEdit` disallowed at minimum
- Agents with `tools: Read, Glob, Grep` (no Bash) also get `Bash` disallowed to prevent shell escape
- Bash-only agents (browser-verifier, git/log-investigator) get file-reading tools disallowed since they operate exclusively through shell commands

### Example Change (codebase-locator.md)

**Before:**
```yaml
---
name: codebase-locator
description: Locates files, directories, and components...
tools: Read, Glob, Grep, Bash
model: haiku
---
```

**After:**
```yaml
---
name: codebase-locator
description: Locates files, directories, and components...
tools: Read, Glob, Grep, Bash
model: haiku
effort: low
maxTurns: 8
disallowedTools: Write, Edit, NotebookEdit
---
```

### Verification

```bash
claude plugin validate .    # Must pass clean after all 12 edits
```

Spot-check: invoke each agent type once with a trivial task and confirm it completes within its turn budget.

---

## Phase 2: Compaction Survival Hooks (Priority 2)

**Audit Finding**: Zero hooks — no `PreCompact` snapshot, no `PostCompact` state re-injection
**cl-plugin-structure Spec**: Hooks go in `hooks/hooks.json` with `command` type preferred (zero LLM cost)

### Impact Analysis

In long interactive sessions (non-Spectrum), when Claude's context window fills and compaction triggers:
- **Current pipeline stage** is lost — Claude forgets whether it's in Research, Plan, Implement, or Validate
- **Active story/phase tracking** vanishes — partial work state disappears
- **Unresolved errors** are forgotten — bugs discovered but not yet fixed get dropped
- **Agent assignment awareness** resets — Claude doesn't know which agents already ran

Spectrum sidesteps this (fresh context per story), but interactive sessions are equally important.

### Files to Create

#### 1. `hooks/hooks.json` — Hook Configuration

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.sh"
          }
        ]
      }
    ],
    "PostCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/post-compact.sh"
          }
        ]
      }
    ]
  }
}
```

#### 2. `scripts/pre-compact.sh` — Snapshot Script

Captures current state to `.prism/local/compact-snapshot.json`:
- Current workflow phase (detect from recent `.prism/shared/` file timestamps)
- Active story ID (parse from `stories.json` for `in_progress` status)
- Recent errors (tail of any log files or test output)
- Session working context (what files were recently modified via `git diff --name-only`)

**Output format** (JSON to stdout, which becomes the hook result):
```json
{
  "phase": "implement",
  "active_story": "STORY-003",
  "recent_files": ["src/auth.ts", "src/middleware.ts"],
  "pending_errors": ["TypeError in auth.test.ts line 42"],
  "timestamp": "2026-04-03T14:30:00Z"
}
```

#### 3. `scripts/post-compact.sh` — Re-injection Script

Reads `.prism/local/compact-snapshot.json` and outputs a structured summary that gets injected into the compacted context:
```
[Compaction Recovery] You were in the IMPLEMENT phase, working on STORY-003.
Files recently modified: src/auth.ts, src/middleware.ts.
Pending error: TypeError in auth.test.ts line 42.
Read .prism/shared/plans/ and stories.json to recover full context.
```

### Why `command` Type

Per cl-plugin-structure: *"Prefer command type (zero LLM cost). Use prompt/agent only when semantic judgment is genuinely required."* Compaction snapshots are mechanical state capture — no judgment needed.

### Cross-Platform Consideration

Scripts should be written in Python (like `bump-version.py`) or as `.sh` + `.ps1` pairs (like `prism-cli-install`) to support Windows natively. Given that the user is on Windows 11, recommend the Python approach for portability.

### Verification

- Trigger compaction manually in a long session (or simulate by asking Claude to compact)
- Confirm `.prism/local/compact-snapshot.json` is written on PreCompact
- Confirm recovery message appears in context after PostCompact

---

## Phase 3: Spectrum Skill Decomposition (Priority 3)

**Audit Finding**: `prism-spectrum` SKILL.md is 291 lines with ~86 lines (~30%) conditionally relevant
**cl-plugin-structure Spec**: *"Progressive disclosure: SKILL.md under 800 tokens. Detailed rules in separate files loaded on demand."*

### Impact Analysis

`prism-spectrum` is the most frequently executed skill (runs every Spectrum iteration). Currently:
- **Browser verification** (lines ~139-161, ~23 lines): Only needed when story involves UI files
- **Visual regression** (lines ~163-197, ~35 lines): Only needed when visual baselines exist
- **Debug integration** (lines ~248-275, ~28 lines): Only needed when quality gates fail

These ~86 lines load on every single iteration. Over a 30-story epic at ~50 iterations, that's ~4,300 lines of unnecessary context loaded.

### Files to Modify

#### 1. Extract to `skills/prism-spectrum/references/browser-verification.md`

Move browser verification protocol (step 5b) to a reference file. The SKILL.md replaces the inline content with:
```markdown
### 5b. Browser Verification (UI stories only)
If story `files[]` includes UI paths (`.tsx`, `.css`, `.html`, webview dirs):
→ Load `references/browser-verification.md` and follow the protocol.
Skip entirely for backend-only stories.
```

#### 2. Extract to `skills/prism-spectrum/references/visual-regression.md`

Move visual regression protocol (step 5c) to a reference file. The SKILL.md replaces with:
```markdown
### 5c. Visual Regression (when baselines exist)
If `.prism/local/baselines/` exists and contains PNGs matching story scope:
→ Load `references/visual-regression.md` and follow the protocol.
Skip if no baselines directory exists.
```

#### 3. Extract to `skills/prism-spectrum/references/debug-integration.md`

Move debug integration protocol to a reference file. The SKILL.md replaces with:
```markdown
### Error Handling — Debug Integration
If quality gates fail after retry:
→ Load `references/debug-integration.md` and follow the 3-agent parallel debug flow.
```

#### 4. Link existing unused references

The `references/` directory already contains `story-manifest-schema.md` and `contracts-convention.md` but these are **not linked from SKILL.md**. Add conditional load directives:
```markdown
### 1b. Load Story Context
If `.prism/stories/<story-id>-manifest.json` exists:
→ Load `references/story-manifest-schema.md` for manifest-driven execution.

If story has `contracts_to_read` or `contracts_to_write`:
→ Load `references/contracts-convention.md` for contract lifecycle.
```

### Net Result

| Metric | Before | After |
|--------|--------|-------|
| SKILL.md lines | ~291 | ~205 |
| Reference files | 2 (unused) | 5 (all conditionally loaded) |
| Lines loaded per backend story | 291 | ~205 |
| Lines loaded per UI story | 291 | ~263 (loads browser + visual) |
| Lines loaded on debug | 291 | ~233 (loads debug only) |

### Verification

- Run a backend-only story through Spectrum and confirm browser/visual sections are not loaded
- Run a UI story and confirm references are loaded on demand
- Run `claude plugin validate .` to confirm no structural issues

---

## Phase 4: CLAUDE.md Compaction Survival Section (Priority 4)

**Audit Finding**: CLAUDE.md has zero compaction survival directives
**cl-plugin-structure Spec**: Compaction survival is a core token optimization pattern

### Impact Analysis

CLAUDE.md survives compaction (it's always re-injected). Adding compaction directives here costs ~5-10 lines but ensures Claude knows what to recover after context compression, even without hooks.

This is a belt-and-suspenders approach alongside Phase 2 hooks — the CLAUDE.md section works even if hooks fail or aren't installed.

### Change Required

Add the following section to `CLAUDE.md` after the "Key Principles" section:

```markdown
## Compaction Survival

When context is compacted, immediately recover state by reading these files:

1. **Current phase**: Check `.prism/local/compact-snapshot.json` if it exists (written by PreCompact hook)
2. **Active plan**: Read the most recent file in `.prism/shared/plans/` — it's the current contract
3. **Story state**: Read `stories.json` — look for `status: "in_progress"` to find your active story
4. **Recent progress**: Read `.prism/shared/spectrum/progress.md` tail for latest learnings
5. **Unresolved work**: Run `git diff --name-only` to see uncommitted changes in progress

Do NOT ask the user what you were doing. Recover from files.
```

### Verification

- Confirm CLAUDE.md stays under 5,000 tokens after addition (currently ~768 words / ~135 lines, well within budget)
- Test in a long interactive session by letting compaction trigger naturally

---

## Phase 5: Observational Context Hooks (Priority 5)

**Audit Finding**: No `PostToolUse` observation logging for session continuity
**cl-plugin-structure Spec**: Hooks support `PostToolUse` event with matchers

### Impact Analysis

In long interactive sessions, Claude loses track of:
- Which files it already read (re-reads the same files)
- Which commands it already ran (re-runs tests that already passed)
- What errors it already investigated (re-investigates solved problems)

An observation log captures a lightweight trail of tool usage, reducing redundant work.

### Files to Create/Modify

#### 1. Add to `hooks/hooks.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-observation.sh"
          }
        ]
      }
    ]
  }
}
```

**Why only Write|Edit|Bash**: These are the mutation tools. Read/Glob/Grep are cheap and don't change state — logging them would add noise. We care about tracking *what changed*, not what was inspected.

#### 2. Create `scripts/log-observation.sh`

Appends a one-line entry to `.prism/local/observations.log`:
```
2026-04-03T14:30:00 Write src/auth.ts
2026-04-03T14:30:05 Edit src/middleware.ts
2026-04-03T14:30:10 Bash npm test
```

The log is:
- **Append-only**: Never truncated during a session
- **In `.prism/local/`**: Gitignored, per-developer
- **One line per tool use**: Tool name + primary argument (file path or command)
- **Timestamped**: ISO-8601 for ordering

#### 3. Update `scripts/pre-compact.sh` (from Phase 2)

Include the last 20 lines of `observations.log` in the compact snapshot, giving PostCompact a trail of recent actions.

### Design Decision: `command` vs `prompt` Type

`command` is correct here. The hook just appends a log line — no semantic judgment. Per cl-plugin-structure: *"Default to command type (zero LLM cost)."*

### Verification

- Run an interactive session with several tool uses
- Confirm `.prism/local/observations.log` accumulates entries
- Trigger compaction and confirm the observation trail is included in recovery

---

## Phase 6: Cross-Platform spectrum.sh Rewrite (Priority 6)

**Audit Finding**: `spectrum.sh` (518 lines) is Unix/WSL only — no Windows-native equivalent
**cl-plugin-structure Spec**: Use `${CLAUDE_PLUGIN_ROOT}` for portable paths

### Impact Analysis

- User is on Windows 11 — currently must use WSL or Git Bash
- `visual-regression.sh` (250 lines) is also Unix-only
- `bump-version.py` proves the Python approach works — it's already cross-platform
- Python is available on all target platforms and already a dependency (used by `init_prism.py`, `bump-version.py`)

### Approach: Python Rewrite

Rewrite `spectrum.sh` as `spectrum.py` using only Python stdlib:
- `subprocess` for spawning `claude` CLI
- `json` for `stories.json` / `progress.md` management
- `pathlib` for cross-platform paths
- `argparse` for CLI interface
- `signal` for graceful shutdown
- `fcntl`/`msvcrt` for cross-platform file locking

### Files to Create/Modify

| Action | File | Notes |
|--------|------|-------|
| Create | `scripts/spectrum.py` | Full rewrite of spectrum.sh (518 lines) |
| Create | `scripts/visual-regression.py` | Full rewrite of visual-regression.sh (250 lines) |
| Modify | `skills/prism-spectrum/SKILL.md` | Update references from `.sh` to `.py` |
| Modify | `CLAUDE.md` | Update Spectrum section to reference `.py` |
| Keep | `scripts/spectrum.sh` | Retain as legacy for existing Unix users (deprecation notice) |
| Keep | `scripts/visual-regression.sh` | Retain as legacy |

### Key Functions to Port

From `spectrum.sh`:
- `acquire_lock()` / `release_lock()` → Python `filelock` or stdlib equivalent
- `check_prerequisites()` → `shutil.which("claude")`, `shutil.which("jq")` (jq no longer needed — Python handles JSON natively)
- `validate_schema()` → Native Python JSON validation (removes `jq` dependency entirely)
- `select_next_story()` → Python dict filtering
- `update_story_status()` → Python JSON read/modify/write
- `append_progress()` → Python file append
- `run_iteration()` → `subprocess.run(["claude", ...])` with stdout capture
- `check_signals()` → Python regex on captured output
- `derive_progress_path()` → `pathlib.Path` operations

### Removed Dependencies

| Dependency | Used By | Replaced By |
|------------|---------|-------------|
| `jq` | spectrum.sh (JSON parsing) | Python `json` stdlib |
| `bash` | spectrum.sh, visual-regression.sh | Python interpreter |
| ANSI color codes (hardcoded) | spectrum.sh terminal output | Python `colorama` or manual ANSI (Windows Terminal supports ANSI natively) |

### Verification

- Run `python scripts/spectrum.py` on Windows natively (no WSL)
- Run on macOS/Linux to confirm cross-platform
- Compare output against `spectrum.sh` for identical behavior on a test `stories.json`
- Run `claude plugin validate .` after all changes

---

## Plugin Manifest Updates

### `.claude-plugin/plugin.json` — Add hooks declaration

The current manifest is minimal (name, description, version, author). After Phase 2 and 5, it should declare the hooks:

```json
{
  "name": "prism",
  "description": "Structured 4-phase development workflow (Research -> Plan -> Implement -> Validate) with Spectrum-style iterative execution with TUI",
  "version": "2.5.3",
  "author": {
    "name": "Prism Team"
  },
  "hooks": "hooks/hooks.json"
}
```

**Version bump**: 2.5.2 → 2.5.3 (minor patch for mechanical improvements, no breaking changes)

---

## Complete File Change Matrix

| Phase | File | Action | Lines Changed |
|-------|------|--------|--------------|
| 1 | `agents/codebase-locator.md` | Modify | +3 (frontmatter) |
| 1 | `agents/codebase-analyzer.md` | Modify | +3 |
| 1 | `agents/codebase-pattern-finder.md` | Modify | +3 |
| 1 | `agents/prism-locator.md` | Modify | +3 |
| 1 | `agents/prism-analyzer.md` | Modify | +3 |
| 1 | `agents/web-search-researcher.md` | Modify | +3 |
| 1 | `agents/browser-verifier.md` | Modify | +3 |
| 1 | `agents/graph-navigator.md` | Modify | +3 |
| 1 | `agents/git-investigator.md` | Modify | +3 |
| 1 | `agents/log-investigator.md` | Modify | +3 |
| 1 | `agents/state-investigator.md` | Modify | +3 |
| 1 | `agents/visual-regression-grader.md` | Modify | +3 |
| 2 | `hooks/hooks.json` | **Create** | ~30 |
| 2 | `scripts/pre-compact.py` | **Create** | ~60 |
| 2 | `scripts/post-compact.py` | **Create** | ~40 |
| 3 | `skills/prism-spectrum/SKILL.md` | Modify | -86, +15 |
| 3 | `skills/prism-spectrum/references/browser-verification.md` | **Create** | ~23 |
| 3 | `skills/prism-spectrum/references/visual-regression.md` | **Create** | ~35 |
| 3 | `skills/prism-spectrum/references/debug-integration.md` | **Create** | ~28 |
| 4 | `CLAUDE.md` | Modify | +10 |
| 5 | `hooks/hooks.json` | Modify | +10 (add PostToolUse) |
| 5 | `scripts/log-observation.py` | **Create** | ~25 |
| 6 | `scripts/spectrum.py` | **Create** | ~400 |
| 6 | `scripts/visual-regression.py` | **Create** | ~200 |
| — | `.claude-plugin/plugin.json` | Modify | +1 (hooks field) |

**Totals**: 15 files modified, 8 files created, 0 files deleted

---

## Automated Verification (Success Criteria)

```bash
# Plugin structure validation
claude plugin validate .

# Agent frontmatter check — all 12 agents have maxTurns, effort, disallowedTools
grep -l "maxTurns:" agents/*.md | wc -l    # Should be 12
grep -l "effort:" agents/*.md | wc -l      # Should be 12
grep -l "disallowedTools:" agents/*.md | wc -l  # Should be 12

# Hooks exist
test -f hooks/hooks.json && echo "PASS" || echo "FAIL"

# Spectrum skill is smaller
wc -l skills/prism-spectrum/SKILL.md    # Should be < 210 lines

# Reference files exist
ls skills/prism-spectrum/references/    # Should show 5 files

# CLAUDE.md has compaction section
grep -c "Compaction Survival" CLAUDE.md  # Should be 1

# Cross-platform scripts exist
test -f scripts/spectrum.py && echo "PASS" || echo "FAIL"
```

## Manual Verification

- [ ] Run a Spectrum iteration with a backend story — confirm browser/visual references NOT loaded
- [ ] Run a Spectrum iteration with a UI story — confirm browser/visual references ARE loaded
- [ ] Run a long interactive session until compaction triggers — confirm state recovery
- [ ] Run `python scripts/spectrum.py` on Windows natively (no WSL)
- [ ] Invoke one agent of each model tier — confirm it completes within maxTurns budget

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `maxTurns` too restrictive for edge cases | Medium | Agent fails to complete legitimate work | Start with generous bounds (upper end of recommended range), tighten after data collection |
| Hook scripts fail silently | Low | Compaction survival doesn't work | Add error handling + stderr logging in Python scripts |
| Reference file extraction breaks skill flow | Low | Spectrum skill loses coherence | Keep conditional load directives crystal clear with exact trigger conditions |
| Python spectrum.py behavior differs from bash | Medium | Subtle bugs in story selection or signal parsing | Run both side-by-side on the same stories.json and diff outputs |
| `disallowedTools` blocks a legitimately needed tool | Low | Agent can't complete task | Review each agent's actual tool usage patterns before finalizing the list |

---

## Implementation Order

Phases 1-4 are independent and can be parallelized. Phase 5 depends on Phase 2 (extends hooks.json). Phase 6 is independent but high-effort.

```
Phase 1 (agents) ──┐
Phase 2 (hooks)  ──┼── can run in parallel ──→ Phase 5 (observation hooks, extends Phase 2)
Phase 3 (spectrum)─┤
Phase 4 (CLAUDE.md)┘

Phase 6 (Python rewrite) ── independent, can run anytime
```

Recommended session plan:
- **Session 1**: Phases 1 + 3 + 4 (all frontmatter/text edits, low risk)
- **Session 2**: Phase 2 (hooks infrastructure, needs testing)
- **Session 3**: Phase 5 (observation hooks, extends Phase 2)
- **Session 4**: Phase 6 (Python rewrite, highest effort)
