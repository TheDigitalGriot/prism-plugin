---
date: 2026-03-07
author: Claude
repository: prism-plugin
branch: feat/accuracy-context-upgrade
ticket: N/A
status: implemented
research: .prism/shared/research/2026-03-07-prism-v250-gap-analysis.md
---

# Plan: Prism Accuracy & Context Upgrade (Research-v5 Immediate Tier)

## Overview

**Goal**: Implement the three zero-dependency upgrade recommendations from the gap analysis — script-backed Spectrum operations, agent frontmatter standardization, and story manifests with contracts layer — to close accuracy gaps (80% → 100% on deterministic operations), reduce `prism-spectrum` context by ~120 lines, and add structured cross-session coordination state.

**Research**: `.prism/shared/research/2026-03-07-prism-v250-gap-analysis.md`

**Complexity**: Medium

**Estimated Phases**: 6

## Success Criteria

### Automated Verification
- [ ] `spectrum.sh` passes all existing tests: `bash scripts/tests/test_install.sh`
- [ ] New `spectrum.sh` functions pass dedicated unit tests (story selection, status update, schema validation)
- [ ] `jq` story selection produces identical results to manual selection on sample `stories.json`
- [ ] `stories.json` with missing fields or invalid schema is rejected before loop entry
- [ ] All 11 agent `.md` files have valid YAML frontmatter (parseable `---` blocks)
- [ ] `decompose_plan` generates valid `story-manifest.json` alongside `stories.json`

### Manual Verification
- [ ] Run `spectrum.sh` against a test `stories.json` — observe deterministic story picking (no LLM involvement)
- [ ] Signal detection works correctly: COMPLETE, continue, retry, blocked, error, and no-signal-fallback
- [ ] `prism-spectrum` skill still functions correctly with reduced line count
- [ ] `/decompose_plan` on an existing plan produces both `stories.json` and `story-manifest.json`
- [ ] `.prism/shared/contracts/` directory is created by `init_prism.py`

## Phases

### Phase 1: Script-back `spectrum.sh` Deterministic Operations

**Goal**: Move story selection, status updates, and post-iteration state checks from LLM to deterministic `jq` functions in `spectrum.sh`.

**Files to modify**:
| File | Change |
|------|--------|
| `scripts/spectrum.sh` | Add `select_next_story()`, `update_story_status()`, `validate_schema()`, `append_progress()` functions; update `run_iteration()` to pre-select story and pass ID to Claude; add post-iteration `jq` state check alongside signal parsing |

**Steps**:
1. [x] Add `validate_schema()` function (~line 94, after `check_prerequisites`) — validates `stories.json` has `.epic.name`, `.stories` array, each story has `id`, `status`, `priority`, `blockedBy` fields. Exit with clear error if invalid.
2. [x] Add `select_next_story()` function (~line 104, after `count_total`) — `jq` query: filter stories where `status != "complete"`, exclude stories whose `blockedBy` references an incomplete story, sort by `.priority`, take first. Return story ID or empty string if none available.
3. [x] Add `update_story_status()` function — takes story ID and new status, uses `jq` to update in-place: `.stories[] | select(.id == $ID) .status = $STATUS`. Write to temp file, validate JSON, then `mv` to original.
4. [x] Add `append_progress()` function — takes iteration number, story ID, outcome string. Appends timestamped entry to `$PROGRESS_FILE` via `cat >>`.
5. [x] Update `run_iteration()` (line 155) — call `select_next_story()` first. If empty, return COMPLETE signal directly (no Claude invocation needed). Pass selected story ID in the Claude prompt: `"Execute story $STORY_ID from $STORIES_FILE..."`.
6. [x] Add post-iteration state verification after `check_signals()` (line 253) — re-read `stories.json` via `count_remaining`. If `remaining == 0`, override signal to COMPLETE regardless of what Claude emitted. If remaining unchanged from before iteration, treat as retry.
7. [x] Call `validate_schema` in `main()` after `check_prerequisites` (line 213).

**Verification**:
```bash
# Schema validation rejects bad input
echo '{"bad": true}' > /tmp/test-stories.json
bash scripts/spectrum.sh /tmp/test-stories.json  # Should exit with schema error

# Story selection picks lowest priority pending unblocked story
# (manual check with sample stories.json)
```

**Checkpoint**: [x] Phase 1 complete

---

### Phase 2: Harden `spectrum.sh` Error Handling

**Goal**: Fix the 4 error handling gaps identified in the gap analysis — exit code swallowing, missing signal fallback, no lockfile, no post-iteration verification.

**Files to modify**:
| File | Change |
|------|--------|
| `scripts/spectrum.sh` | Fix `run_iteration` exit code handling, improve no-signal behavior, add lockfile, log iteration outcomes |

**Steps**:
1. [x] Fix `run_iteration()` exit code (line 249) — replace `output=$(run_iteration) || true` with proper exit code capture: `local iter_exit=0; output=$(run_iteration) || iter_exit=$?`. If `iter_exit != 0`, log the exit code and treat as retry (not silent continue). *(Done in Phase 1)*
2. [x] Improve no-signal fallback (line 207-208) — instead of silently returning "continue", log a warning: `warn "No signal detected in output ($(echo "$output" | wc -c) bytes). Treating as retry."` and return 2 (retry) instead of 1 (continue).
3. [x] Add lockfile mechanism — create `$PROJECT_DIR/.prism/local/spectrum.lock` with PID at start of `main()`. Check for existing lock and exit if another instance is running. Remove lock in a `trap EXIT`.
4. [x] Add iteration outcome logging — after each iteration, append a one-line summary to `$PROGRESS_FILE` via `append_progress()`: timestamp, iteration number, story ID, signal received, remaining count. *(Done in Phase 1)*

**Verification**:
```bash
# Lockfile prevents concurrent runs
bash scripts/spectrum.sh &
bash scripts/spectrum.sh  # Should exit with "already running" error
kill %1

# No-signal now warns and retries instead of silently continuing
```

**Checkpoint**: [x] Phase 2 complete

---

### Phase 3: Reduce `prism-spectrum` Skill

**Goal**: Remove mechanical JSON/signal instructions from `prism-spectrum` SKILL.md now that `spectrum.sh` handles them deterministically. Reduce from ~406 to ~280 lines.

**Files to modify**:
| File | Change |
|------|--------|
| `skills/prism-spectrum/SKILL.md` | Remove story selection logic (now in spectrum.sh), remove JSON status update instructions (now in spectrum.sh), simplify signal emission section (spectrum.sh verifies post-hoc), remove stories.json manipulation examples |

**Steps**:
1. [x] Read the full `prism-spectrum/SKILL.md` and identify all sections that describe deterministic operations now handled by `spectrum.sh`.
2. [x] Remove/simplify the story selection section — replaced Sections 2+3 (Check Completion + Pick Next Story) with single "Identify Your Story" section referencing spectrum.sh pre-selection.
3. [x] Remove/simplify JSON status update instructions — condensed Section 8 to single paragraph noting spectrum.sh verifies post-iteration.
4. [x] Simplify signal emission section — replaced Section 9 with compact signal list, removed re-read/count logic.
5. [x] Remove the `stories.json` re-reading and counting instructions — removed from Section 9, Example Flow, and Rules.
6. [x] Verify the skill still correctly describes: implementation workflow, quality gate execution, debug agent spawning on failure, commit protocol, progress.md context. Also: condensed Debug Integration (ASCII art → numbered list), removed redundant Output Signals table, renumbered sections 2-8.

**Verification**:
```bash
# Line count check
wc -l skills/prism-spectrum/SKILL.md  # Target: ~280 lines (down from ~406)

# Manual: invoke /prism-spectrum in a test session and verify it still runs the implementation workflow correctly
```

**Checkpoint**: [x] Phase 3 complete

---

### Phase 4: Standardize Agent Frontmatter

**Goal**: Add YAML frontmatter to the 3 debug investigators and add the "documentarian, not critic" constraint to `prism-analyzer`.

**Files to modify**:
| File | Change |
|------|--------|
| `agents/git-investigator.md` | Add YAML frontmatter with `name`, `description`, `tools: Bash`, `model: haiku` |
| `agents/log-investigator.md` | Add YAML frontmatter with `name`, `description`, `tools: Bash`, `model: haiku` |
| `agents/state-investigator.md` | Add YAML frontmatter with `name`, `description`, `tools: Bash`, `model: haiku` |
| `agents/prism-analyzer.md` | Add "documentarian, not critic" note to behavioral constraints |

**Steps**:
1. [x] Add YAML frontmatter to `git-investigator.md` — prepend `---` block with `name: git-investigator`, `description: Analyzes git history to find changes related to a reported issue. Use Task tool with subagent_type="git-investigator" for git state and history analysis during debug investigations.`, `tools: Bash`, `model: haiku`. Remove the `## Model` heading and its `haiku` content (lines 5-6) since model is now in frontmatter.
2. [x] Add YAML frontmatter to `log-investigator.md` — same pattern. `name: log-investigator`, description about log analysis, `tools: Bash`, `model: haiku`. Remove `## Model` section.
3. [x] Add YAML frontmatter to `state-investigator.md` — same pattern. `name: state-investigator`, description about application state examination, `tools: Bash`, `model: haiku`. Remove `## Model` section.
4. [x] Add documentarian constraint to `prism-analyzer.md` — after the "Filter Aggressively" section (~line 20), add a note: "When analyzing research documents, describe findings factually. Do not critique the codebase, suggest improvements, or editorialize beyond what the document states. Your role is to extract and relay insights, not to generate new opinions about the code."

**Verification**:
```bash
# All 11 agents now have YAML frontmatter
for f in agents/*.md; do head -1 "$f"; done
# All should output "---"
```

**Checkpoint**: [x] Phase 4 complete

---

### Phase 5: Create Story Manifest Schema + Contracts Layer

**Goal**: Define the `story-manifest.json` schema, create the `.prism/shared/contracts/` directory convention, and update `init_prism.py` to include the new directories.

**Files to modify**:
| File | Change |
|------|--------|
| `skills/prism/scripts/init_prism.py` | Add `.prism/shared/contracts/` and `.prism/shared/validation/baselines/` to directory creation list |

**Files to create**:
| File | Purpose |
|------|---------|
| `skills/prism-spectrum/references/story-manifest-schema.md` | JSON schema documentation for `story-manifest.json` |
| `skills/prism-spectrum/references/contracts-convention.md` | Convention documentation for `.prism/shared/contracts/` directory |

**Steps**:
1. [x] Create `story-manifest-schema.md` — documented JSON schema with field reference, usage in prism-spectrum, generation by decompose_plan, and fallback behavior.
2. [x] Create `contracts-convention.md` — documented directory structure, contract lifecycle (proposed → agreed → verified), file format examples (interfaces.json, api-endpoints.json, dependencies.json), and Spectrum integration.
3. [x] Update `init_prism.py` (line 35, directory list) — added `shared/contracts` and `shared/validation/baselines`. Also updated README template and final output to mention contracts directory.

**Verification**:
```bash
# init_prism.py creates new directories
python skills/prism/scripts/init_prism.py --help  # Verify it runs
ls -la .prism/shared/contracts/  # Should exist after running
ls -la .prism/shared/validation/baselines/  # Should exist after running
```

**Checkpoint**: [x] Phase 5 complete

---

### Phase 6: Update `/decompose_plan` for Manifest Generation

**Goal**: Extend the `/decompose_plan` command to generate `story-manifest.json` files alongside `stories.json`, and update `prism-spectrum` to read manifests when available.

**Files to modify**:
| File | Change |
|------|--------|
| `commands/decompose_plan.md` | Add Step 7: generate `story-manifest.json` per story from phase steps and success criteria |
| `skills/prism-spectrum/SKILL.md` | Add manifest-aware requirement tracking — if `story-manifest.json` exists for the current story, track per-requirement pass/fail |

**Steps**:
1. [x] Add manifest generation step to `decompose_plan.md` — added Step 9c after story generation. Maps each story step to a requirement with id, description, depends_on, owns_files, gate, contracts_to_read/write. References schema doc.
2. [x] Add manifest consumption to `prism-spectrum` SKILL.md — added to "Implement Story" section (step 2): check for manifest, implement per-requirement with gate verification, skip passing requirements, read contracts.
3. [x] Add contracts initialization to `decompose_plan.md` — added Step 9d: create interfaces.json when cross-domain dependencies detected. Also updated Step 10 output to list manifest and contract files.

**Verification**:
```bash
# Manual: run /decompose_plan on an existing plan
# Verify both stories.json and story-manifest.json files are created
# Verify manifest requirements map to story steps
```

**Checkpoint**: [x] Phase 6 complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `spectrum.sh` script changes break existing workflows | Medium | High | Phase 2 adds tests; keep old signal parsing as fallback alongside new state verification |
| `prism-spectrum` skill reduction removes necessary instructions | Low | High | Careful diff review; manual test run before committing |
| Story manifest schema is too rigid for diverse projects | Medium | Medium | Keep manifests optional — `prism-spectrum` works with or without them |
| Agent frontmatter changes affect Claude Code discovery | Low | Low | YAML frontmatter is the standard format; this fixes an inconsistency |
| `decompose_plan` manifest generation adds complexity to already-large command (306 lines) | Medium | Medium | Keep manifest generation as a clearly separated step; consider extracting to a script if over 400 lines |

## Edge Cases

| Case | Handling |
|------|----------|
| `stories.json` with no pending stories | `select_next_story()` returns empty; `spectrum.sh` exits with COMPLETE |
| Story blocked by another story that was skipped | `select_next_story()` treats skipped/blocked stories as non-complete; blocked story stays in queue |
| `story-manifest.json` doesn't exist for a story | `prism-spectrum` falls back to current behavior (implement all steps, no per-requirement tracking) |
| Multiple stories depend on the same contract | First story creates the contract; subsequent stories read it. No locking needed (sequential execution in Spectrum) |
| `init_prism.py` run on a project that already has `.prism/` | `mkdir -p` with `exist_ok=True` handles idempotently |
| Agent frontmatter migration on projects using old agents | YAML frontmatter is additive; old agent behavior preserved, just formalized |

## Out of Scope

Explicitly excluded:
- [ ] Deferred loading (`defer_loading: true`) — blocked on Claude Code API
- [ ] Programmatic Tool Calling (PTC) — blocked on Claude Code API
- [ ] Agent Teams integration — experimental, API unstable
- [ ] Visual regression testing (`visual-regression.sh`) — separate plan
- [ ] Neo4j eval backbone — separate plan
- [ ] `/loop` continuous validation — depends on visual regression
- [ ] Scheduled tasks integration — depends on validation architecture
- [ ] Agent deferral (deferring specialist agents) — blocked on Claude Code API

## Rollback Plan

If critical issues arise:
```bash
git revert HEAD~N..HEAD  # Revert all commits from this feature branch
```

Each phase produces independent commits, so partial rollback is possible:
- Phase 1-2 (spectrum.sh) can be reverted independently of Phase 3-6
- Phase 4 (agent frontmatter) is purely additive and safe
- Phase 5-6 (manifests/contracts) are new files only — revert by removing

## Dependencies

**Must complete first**:
- [ ] None — all phases use zero-dependency techniques

**Can parallelize with**:
- [ ] Visual regression testing plan (independent concern)
- [ ] Neo4j eval backbone plan (independent concern)

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: Script-back spectrum.sh | Complete | 2026-03-07 | 2026-03-07 | 486 lines (up from 313). All 7 steps done. jq queries verified with sample data. |
| Phase 2: Harden error handling | Complete | 2026-03-07 | 2026-03-07 | 518 lines. Lockfile w/ stale PID detection, no-signal→retry, exit code capture + logging all done. Steps 1&4 were already addressed in Phase 1. |
| Phase 3: Reduce prism-spectrum | Complete | 2026-03-07 | 2026-03-07 | 253 lines (down from 406, 38% reduction). Removed story selection, counting, Output Signals table, ASCII debug flowchart. Renumbered sections. |
| Phase 4: Standardize agent frontmatter | Complete | 2026-03-07 | 2026-03-07 | All 11 agents now have YAML frontmatter. 3 investigators got tools:Bash. prism-analyzer got documentarian constraint. |
| Phase 5: Story manifest + contracts | Complete | 2026-03-07 | 2026-03-07 | Created story-manifest-schema.md + contracts-convention.md. Updated init_prism.py (2 new dirs + README + output). |
| Phase 6: Update decompose_plan | Complete | 2026-03-07 | 2026-03-07 | Added Steps 9c (manifest gen) + 9d (contracts init) to decompose_plan. Added manifest consumption to prism-spectrum Section 4. Updated Step 10 output. |

---

## Session Notes

[Space for implementation notes, discoveries, blockers]
