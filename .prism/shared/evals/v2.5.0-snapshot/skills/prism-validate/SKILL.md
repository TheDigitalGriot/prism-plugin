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

### 3b. Structural Validation (if codebase-memory-mcp available)

Run graph-based verification to catch issues tests might miss:

| Check | How | What It Catches |
|-------|-----|-----------------|
| No new dead code | `search_graph(max_degree=0, exclude_entry_points=true)` | Orphaned functions from refactoring |
| Dependency integrity | `trace_call_path` for all modified functions | Broken call chains |
| Boundary violations | `search_graph(file_pattern, relationship="CALLS")` | Cross-boundary calls |

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

## Rules

1. **Verify against plan** - Check promised vs delivered
2. **Run all commands** - Don't trust checkboxes
3. **Document deviations** - Any difference recorded
4. **Severity matters** - Critical blocks, low follows up
5. **Update the plan** - Mark actual completion
