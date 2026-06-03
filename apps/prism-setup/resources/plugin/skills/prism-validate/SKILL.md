---
name: prism-validate
description: Validation phase for complex coding tasks. Use when verifying implementation against plan before shipping. Triggers on "validate the plan", "verify implementation", "check if complete", or after implementation finishes. Compares actual changes to plan, runs all verification commands.
model: sonnet
---

# Prism Validate

Verify implementation matches the plan before shipping.

## Prerequisites

- Plan exists in `.prism/shared/plans/`
- Implementation complete (or partially complete)

## Workflow

### 1. Load Plan and Git State

```bash
# Recent commits
git log --oneline -20

# Changes in scope
git diff HEAD~N..HEAD --stat

# Run tests
make check test  # or npm test, etc.
```

### 2. Verify Each Phase

For each phase in plan:

1. **Check completion** - Look at `- [x]` checkboxes
2. **Verify code** - Read files, confirm changes match
3. **Run commands** - Execute verification from plan
4. **Document** - Note pass/fail/deviations

### 2a. Independent Verification (Distrust Pattern)

**Do NOT trust self-reported completion.** Implementation phases may report success while missing requirements, over-building beyond scope, or misunderstanding intent. Verify independently.

### For Each Plan Phase:

1. **Read the plan phase requirements** — extract every specific deliverable
2. **Read the actual code** — do not rely on checkbox status in the plan
3. **Check for missing requirements:**
   - For each requirement, grep/glob for the implementing code
   - If you cannot find it, it is MISSING regardless of what the plan says
4. **Check for over-building:**
   - Run `git diff --stat` against the base branch
   - Identify files changed that are NOT mentioned in any plan phase
   - Unplanned changes are over-building unless they are necessary refactors
5. **Check for scope drift:**
   - Compare the plan's stated goal with what was actually built
   - Flag any feature that wasn't requested

### Output for This Section:

```
### Independent Verification
| Requirement | Plan Says | Code Says | Status |
|-------------|-----------|-----------|--------|
| {req 1} | ✅ Done | Found in `file:line` | ✅ Verified |
| {req 2} | ✅ Done | NOT FOUND | ❌ Missing |
| {req 3} | Not mentioned | Found in `file:line` | ⚠️ Over-built |
```

### Unplanned Changes:
- `path/to/file.ts` — {why this was changed, whether it's justified}

### 3. Check Success Criteria

**Automated**:
| Criterion | Command | Result |
|-----------|---------|--------|
| Tests | `npm test` | ? |
| Lint | `npm run lint` | ? |
| Build | `npm run build` | ? |

**Manual**:
| Criterion | Status |
|-----------|--------|
| User can [action] | Needs verification |

### 3a. Tier 1.5: Visual Regression Gate

If baselines exist in `.prism/shared/validation/baselines/` for any story in the plan:

1. Start the dev server (same pattern as prism-verify: read `package.json`, detect command and port, poll for readiness with 30s timeout)
2. For each baseline directory matching a story/phase in the plan:
   ```bash
   ls .prism/shared/validation/baselines/{story-id}/*.png 2>/dev/null
   ```
3. For each baseline found, run:
   ```bash
   bash scripts/visual-regression.sh {url} \
     .prism/shared/validation/baselines/{story-id} {baseline-name}
   ```
4. If any diff exceeds threshold, spawn `visual-regression-grader` agent:
   ```
   Task(subagent_type="visual-regression-grader")
   "Diff JSON: {JSON output}
   Diff image: {diff_path}
   Story: {story-id}, modifies: {files}
   Plan criteria: {manual verification criteria}"
   ```
5. Record results in the validation report under "### Visual Regression"
6. A grader verdict of `regression` counts as a **validation failure**
7. Kill the dev server after all checks complete

If no baselines exist, skip with note: "Visual regression skipped: no baselines found".

If `playwright-cli` is not installed, skip with note: "Visual regression skipped: playwright-cli not installed".

If visual regression fails, consider running `/prism-verify` for interactive investigation before marking the plan as incomplete.

### 3b. Structural Validation (if codebase-memory-mcp available)

Run graph-based verification to catch issues tests might miss:

| Check | How | What It Catches |
|-------|-----|-----------------|
| No new dead code | `search_graph(max_degree=0, exclude_entry_points=true)` | Orphaned functions from refactoring |
| Dependency integrity | `trace_call_path` for all modified functions | Broken call chains |
| Cross-service contracts | `search_graph(relationship="HTTP_CALLS")` | Contract breaks at service boundaries |
| Boundary violations | `search_graph(file_pattern="ui/*", relationship="CALLS")` | Cross-boundary calls (e.g., UI calling DB directly) |

**Cross-service contracts check in detail**: For each HTTP or IPC boundary annotated in the graph (`search_graph(relationship="HTTP_CALLS")`), verify that callers of changed functions that cross service boundaries are explicitly listed in the plan's "Structural Impact" section. If a changed function has cross-service callers not previously documented, flag as a validation warning.

If no HTTP_CALLS edges exist in the graph (single-service codebase), skip the cross-service check with note: "Cross-service contracts check skipped: no HTTP_CALLS edges in graph."

Include results in the validation report under "## Structural Validation Results".

If codebase-memory-mcp is not available, skip with note: "Structural validation skipped: graph not indexed".

### 4. Document Deviations

```markdown
| Deviation | Reason | Impact |
|-----------|--------|--------|
| [What changed] | [Why] | [Effect] |
```

### 5. Generate Report

Save to `.prism/shared/validation/YYYY-MM-DD-report.md`

See [references/validation-template.md](references/validation-template.md) for full template.

## Output Summary

```markdown
## Validation Report: [Feature]

| Metric | Result |
|--------|--------|
| Phases | [N/M] complete |
| Automated | [N/M] passing |
| Manual | [N/M] verified |
| Status | PASS / FAIL / PARTIAL |

### Issues Found
- [Issue with severity and location]

### Recommendations
- [Immediate actions]
- [Follow-up items]
```

## Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

"Violating the letter of this rule while adhering to the spirit" is violating the spirit.

Every claim of "passing" or "complete" must be backed by command output from THIS session. Stale checkboxes, memory of previous runs, and "it worked before" are not evidence. When a validation gate ambiguously passes, ultrathink whether the success criteria were genuinely met or just papered over.

| Claim | Required Evidence |
|-------|------------------|
| "Tests pass" | Actual `npm test` / `make test` output showing 0 failures |
| "Build succeeds" | Actual build command output with exit code 0 |
| "Phase complete" | Every checkbox verified by reading the actual file |
| "No regressions" | Diff comparison or visual regression output |

## Rules

1. **Verify against plan** - Check promised vs delivered
2. **Run all commands** - Don't trust checkboxes
3. **Document deviations** - Any difference recorded
4. **Severity matters** - Critical blocks, low follows up
5. **Update the plan** - Mark actual completion

> See also: [cl-plugin-structure/scripts/](../cl-plugin-structure/scripts/) for validator scripts (validate-agent.sh, validate-hook-schema.sh, validate-settings.sh) that can augment manual validation gates.
