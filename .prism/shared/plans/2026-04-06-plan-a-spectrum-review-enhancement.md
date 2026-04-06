# Plan A: Spectrum Review Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-stage review (spec compliance + code quality), implementer status protocol, and distrust pattern to Prism's Spectrum autonomous execution loop.

**Architecture:** Two new read-only reviewer agents are dispatched sequentially after quality gates pass in each Spectrum story. The implementer status protocol adds rich status codes (DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED) to the signal protocol. The distrust pattern is added to prism-validate to independently verify self-reported completion.

**Tech Stack:** Markdown agent definitions (YAML frontmatter), bash (spectrum.sh signal parsing), markdown skill files.

**Source Reference:** `.prism/shared/research/2026-04-06-superpowers-vs-prism-audit.md`, `.prism/shared/research/2026-04-06-plugin-structure-ecosystem-audit.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `agents/spec-reviewer.md` | Spec compliance verification agent |
| Create | `agents/quality-reviewer.md` | Code quality review agent |
| Create | `skills/prism-spectrum/references/spec-review-prompt.md` | Dispatch template for spec reviewer |
| Create | `skills/prism-spectrum/references/quality-review-prompt.md` | Dispatch template for quality reviewer |
| Modify | `skills/prism-spectrum/SKILL.md` | Add review steps, implementer status handling |
| Modify | `scripts/spectrum.sh` | Parse new signal tags (concerns, needs-context) |
| Modify | `skills/prism-validate/SKILL.md` | Add distrust pattern section |

---

### Task 1: Create the Spec Reviewer Agent

**Files:**
- Create: `agents/spec-reviewer.md`

- [ ] **Step 1: Create the spec-reviewer agent definition**

```markdown
---
name: spec-reviewer
description: Verify implementation matches story requirements exactly. Use Task tool with subagent_type="spec-reviewer" after quality gates pass to check for missing requirements, over-building, and scope drift.
tools: Read, Glob, Grep, Bash
model: sonnet
effort: medium
maxTurns: 10
disallowedTools: Write, Edit, NotebookEdit
---

# Spec Reviewer

You verify that an implementation matches its specification exactly. You are a compliance checker, not a code quality reviewer.

## Critical Directive

**DO NOT TRUST THE IMPLEMENTER'S SELF-REPORT.** The implementation may be incomplete, inaccurate, or optimistic. You MUST verify everything independently by reading the actual code.

## Your Job

Given a story specification and the files it claims to have modified, verify:

1. **Missing requirements** — Is anything in the spec NOT implemented in the code?
2. **Extra/unneeded work** — Is there code that goes BEYOND what the spec requested?
3. **Misunderstandings** — Does the implementation match the INTENT of the spec, not just the letter?

## How to Verify

1. Read the story specification completely
2. For each requirement in the spec:
   - Find the code that implements it (use Grep/Glob to locate)
   - Read the actual implementation
   - Verify it does what the spec says
3. Check for code that doesn't map to any requirement

## Output Format

```
## Spec Compliance Review

**Story:** {story_id} — {title}

### Status: ✅ Spec Compliant | ❌ Issues Found

### Requirements Checklist
- [x] Requirement 1 — Implemented in `file.ts:42-58`
- [ ] Requirement 2 — **MISSING**: Not found in any modified file
- [x] Requirement 3 — Implemented in `file.ts:60-75`

### Issues (if any)
1. **Missing:** {description} — Spec says "{quote}", but no implementation found
2. **Extra:** {description} — `file.ts:80-95` adds {feature} not in spec
3. **Misunderstanding:** {description} — Spec says "{quote}", implementation does {actual}

### Files Reviewed
- `path/to/file.ts` — {what was checked}
```

## Rules

1. Read every file the story claims to modify — do not skip any
2. Quote the spec when reporting issues — show exactly what was missed
3. Use file:line references for every finding
4. Do not suggest improvements — only report spec compliance
5. Do not review code quality — that is a separate review
6. If unsure whether something is missing, flag it as "Needs Clarification"
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -10 agents/spec-reviewer.md`
Expected: YAML frontmatter with `name: spec-reviewer`, `model: sonnet`, `maxTurns: 10`

- [ ] **Step 3: Commit**

```bash
git add agents/spec-reviewer.md
git commit -m "feat: add spec-reviewer agent for Spectrum two-stage review"
```

---

### Task 2: Create the Quality Reviewer Agent

**Files:**
- Create: `agents/quality-reviewer.md`

- [ ] **Step 1: Create the quality-reviewer agent definition**

```markdown
---
name: quality-reviewer
description: Review code quality, architecture, and testing after spec compliance passes. Use Task tool with subagent_type="quality-reviewer" as the second stage of two-stage review.
tools: Read, Glob, Grep, Bash
model: sonnet
effort: medium
maxTurns: 10
disallowedTools: Write, Edit, NotebookEdit
---

# Quality Reviewer

You review code quality, architecture, and testing for a completed implementation. You are dispatched ONLY after spec compliance has been verified.

## Critical Directive

You review the QUALITY of the implementation, not its completeness. Spec compliance has already been verified. Focus on: Is the code well-written? Is it tested? Is it maintainable?

## Review Checklist

### Code Quality
- [ ] Each file has one clear responsibility with a well-defined interface
- [ ] Units are decomposed for independent understanding and testing
- [ ] No unnecessary abstractions or over-engineering
- [ ] Error handling is appropriate (not excessive, not missing)
- [ ] No magic numbers, unclear variable names, or dead code

### Architecture
- [ ] Changes follow existing codebase patterns and conventions
- [ ] No new large files created (>300 lines) without justification
- [ ] Dependencies flow in one direction (no circular imports)
- [ ] Public interfaces are minimal and well-defined

### Testing
- [ ] Tests exist for new functionality
- [ ] Tests verify behavior, not implementation details
- [ ] Edge cases from the story context are covered
- [ ] Tests are independent and don't depend on execution order

### Production Readiness
- [ ] No debug code, console.log, or TODO comments left behind
- [ ] No hardcoded values that should be configurable
- [ ] No security vulnerabilities (injection, XSS, exposed secrets)

## Output Format

```
## Code Quality Review

**Story:** {story_id} — {title}

### Status: ✅ Approved | ⚠️ Issues Found

### Strengths
- {What was done well}

### Issues
| Severity | File:Line | Description |
|----------|-----------|-------------|
| Critical | `file.ts:42` | {Must fix before merge} |
| Important | `file.ts:80` | {Should fix, impacts maintainability} |
| Minor | `file.ts:95` | {Nice to fix, low impact} |

### Verdict
{APPROVED or list of required fixes}
```

## Rules

1. Only flag issues you can point to in actual code (file:line references)
2. Critical = blocks merge. Important = should fix. Minor = optional.
3. Do not re-check spec compliance — that review is already done
4. Do not suggest refactoring of code outside the story's scope
5. Be calibrated — 3-5 issues is normal. 0 issues is suspicious. 20 issues means the plan was bad.
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -10 agents/quality-reviewer.md`
Expected: YAML frontmatter with `name: quality-reviewer`, `model: sonnet`, `maxTurns: 10`

- [ ] **Step 3: Commit**

```bash
git add agents/quality-reviewer.md
git commit -m "feat: add quality-reviewer agent for Spectrum two-stage review"
```

---

### Task 3: Create the Spec Review Dispatch Template

**Files:**
- Create: `skills/prism-spectrum/references/spec-review-prompt.md`

- [ ] **Step 1: Create the dispatch template**

```markdown
# Spec Review Dispatch Template

Use this template when dispatching the `spec-reviewer` agent after quality gates pass.

## Dispatch Pattern

```
Task(subagent_type="spec-reviewer")

Story: {STORY_ID} — {STORY_TITLE}

## Story Specification
{Paste the full story object from stories.json including description, steps, context, and files}

## Files Modified
{List all files from the story's `files` array with their `action` (create/modify/delete)}

## Quality Gate Results
{Paste the output of all quality gate commands that passed}

## What to Verify
1. Every requirement in the story description is implemented
2. Every step marked as done actually has corresponding code
3. No code was added beyond what the story requested
4. Edge cases from story.context.edgeCases are handled
```

## Handling Results

- **✅ Spec Compliant**: Proceed to quality review
- **❌ Issues Found**: Fix the issues, re-run quality gates, re-dispatch spec reviewer
- Do NOT proceed to quality review until spec compliance passes
```

- [ ] **Step 2: Commit**

```bash
git add skills/prism-spectrum/references/spec-review-prompt.md
git commit -m "feat: add spec review dispatch template for Spectrum"
```

---

### Task 4: Create the Quality Review Dispatch Template

**Files:**
- Create: `skills/prism-spectrum/references/quality-review-prompt.md`

- [ ] **Step 1: Create the dispatch template**

```markdown
# Quality Review Dispatch Template

Use this template when dispatching the `quality-reviewer` agent after spec compliance passes.

## Dispatch Pattern

```
Task(subagent_type="quality-reviewer")

Story: {STORY_ID} — {STORY_TITLE}

## What Was Implemented
{Brief summary of the changes — 2-3 sentences}

## Story Context
Why: {story.context.why}
Risks: {story.context.risks}
Patterns to follow: {story.context.patterns}

## Files Changed
{Run `git diff --name-only HEAD~1` to get the actual changed files}

## Spec Review Status
The spec reviewer has already verified:
- All requirements are implemented
- No over-building or under-building
- Edge cases are covered
```

## Handling Results

- **✅ Approved**: Proceed to commit
- **⚠️ Issues Found**:
  - **Critical**: Fix immediately, re-run quality gates, re-dispatch quality reviewer
  - **Important**: Fix, re-dispatch quality reviewer
  - **Minor only**: Note in progress.md, proceed to commit
- Do NOT commit until Critical and Important issues are resolved
```

- [ ] **Step 2: Commit**

```bash
git add skills/prism-spectrum/references/quality-review-prompt.md
git commit -m "feat: add quality review dispatch template for Spectrum"
```

---

### Task 5: Update Spectrum SKILL.md with Two-Stage Review

**Files:**
- Modify: `skills/prism-spectrum/SKILL.md`

- [ ] **Step 1: Add the review section after Quality Gates (after current Section 5)**

Insert the following new section between the current "Run Quality Gates" section and the "Browser Verification" section. The new section should be numbered 5a:

```markdown
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
```

- [ ] **Step 2: Verify the section was inserted correctly**

Run: `grep -n "Two-Stage Review" skills/prism-spectrum/SKILL.md`
Expected: Line showing "## 5a. Two-Stage Review"

- [ ] **Step 3: Commit**

```bash
git add skills/prism-spectrum/SKILL.md
git commit -m "feat: add two-stage review (spec + quality) to Spectrum workflow"
```

---

### Task 6: Add Implementer Status Protocol to Spectrum SKILL.md

**Files:**
- Modify: `skills/prism-spectrum/SKILL.md`

- [ ] **Step 1: Add the implementer status handling section**

Insert the following after the "Implement Story" section (current Section 4), before Quality Gates:

```markdown
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
```

- [ ] **Step 2: Verify the section was inserted correctly**

Run: `grep -n "Report Implementation Status" skills/prism-spectrum/SKILL.md`
Expected: Line showing "## 4a. Report Implementation Status"

- [ ] **Step 3: Commit**

```bash
git add skills/prism-spectrum/SKILL.md
git commit -m "feat: add implementer status protocol (DONE/CONCERNS/NEEDS_CONTEXT/BLOCKED)"
```

---

### Task 7: Update spectrum.sh Signal Parsing

**Files:**
- Modify: `scripts/spectrum.sh`

- [ ] **Step 1: Add new signal tag parsing to the `check_signals` function**

In `scripts/spectrum.sh`, locate the `check_signals()` function (around line 324). After the existing signal checks for `<spectrum-blocked>` and before the default fallback, add parsing for the two new signals:

Add these two checks after the existing `spectrum-blocked` check (around line 352):

```bash
  # New: needs-context signal — treat as blocked, record questions
  if echo "$output" | grep -q '<spectrum-needs-context>'; then
    local questions
    questions=$(echo "$output" | sed -n '/<spectrum-needs-context>/,/<\/spectrum-needs-context>/p' | grep '^ *-' || echo "No specific questions provided")
    warn "Story needs additional context:"
    echo "$questions"
    return 1  # Same as blocked — try next story
  fi

  # New: concerns signal — log concerns but treat as continue
  if echo "$output" | grep -q '<spectrum-continue>' && echo "$output" | grep -q '<concerns>'; then
    local concerns
    concerns=$(echo "$output" | sed -n '/<concerns>/,/<\/concerns>/p' | grep '^ *-' || echo "No specific concerns")
    warn "Story completed with concerns:"
    echo "$concerns"
    return 0  # Treat as success — concerns are logged in progress.md
  fi
```

- [ ] **Step 2: Update the `append_progress` call in `main()` to include concerns**

In the main loop (around line 470), after a successful iteration where the signal is `continue` or `complete`, add concern logging. Locate the line that calls `append_progress` for the success case and modify the outcome string:

Find (around line 474):
```bash
        append_progress "$iteration" "$story_id" "completed" "$remaining/$total"
```

Replace with:
```bash
        local outcome="completed"
        if echo "$iteration_output" | grep -q '<concerns>'; then
          outcome="completed_with_concerns"
        fi
        append_progress "$iteration" "$story_id" "$outcome" "$remaining/$total"
```

Note: This requires capturing the output of `run_iteration` into a variable. If `iteration_output` is not already captured, add `iteration_output=$(run_iteration "$story_id" "$STORIES_FILE" "$PROGRESS_FILE")` and then `echo "$iteration_output" | check_signals`.

- [ ] **Step 3: Test signal parsing with mock output**

Run: `echo '<spectrum-needs-context><story>STORY-001</story><questions>- What API?</questions></spectrum-needs-context>' | bash -c 'source scripts/spectrum.sh 2>/dev/null; check_signals "$(cat)"' 2>&1 || echo "Exit code: $?"`

Expected: Warning message about needing context, exit code 1

- [ ] **Step 4: Commit**

```bash
git add scripts/spectrum.sh
git commit -m "feat: parse spectrum-needs-context and concerns signals in spectrum.sh"
```

---

### Task 8: Add Distrust Pattern to prism-validate

**Files:**
- Modify: `skills/prism-validate/SKILL.md`

- [ ] **Step 1: Add the distrust verification section**

In `skills/prism-validate/SKILL.md`, insert the following new section after "Verify Each Phase" (Section 2, around line 38) and before "Check Success Criteria" (Section 3):

```markdown
## 2a. Independent Verification (Distrust Pattern)

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
```

- [ ] **Step 2: Verify the section was inserted correctly**

Run: `grep -n "Distrust Pattern" skills/prism-validate/SKILL.md`
Expected: Line showing "## 2a. Independent Verification (Distrust Pattern)"

- [ ] **Step 3: Commit**

```bash
git add skills/prism-validate/SKILL.md
git commit -m "feat: add distrust pattern to prism-validate for independent verification"
```

---

### Task 9: Update Agent Registration (if needed)

**Files:**
- Verify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Check if agents are auto-discovered**

Run: `cat .claude-plugin/plugin.json`

If the manifest does NOT have an explicit `"agents"` array, agents are auto-discovered from `agents/` and no change is needed.

If it DOES have an explicit `"agents"` array, add the new agents:

```json
{
  "agents": ["./agents"]
}
```

This should already include all `.md` files in the `agents/` directory.

- [ ] **Step 2: Verify both new agents are discoverable**

Run: `ls agents/spec-reviewer.md agents/quality-reviewer.md`
Expected: Both files listed

- [ ] **Step 3: Final integration test**

Run through the full Spectrum flow mentally:
1. Story is selected → Implemented → Status reported (Task 6) → Quality gates run (existing) → Spec review (Task 5) → Quality review (Task 5) → Commit → Signal

Verify no gaps in the flow by reading the updated SKILL.md:

Run: `grep -n "##" skills/prism-spectrum/SKILL.md`
Expected: Sections in order: Load State → Load Manifest → Load Context → Graph Verification → Identify Story → Announce → Implement → **Report Status (4a)** → Quality Gates → **Two-Stage Review (5a)** → Browser Verification → Visual Regression → Commit → Update State → Signal

- [ ] **Step 4: Commit any registration changes**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: verify agent registration for spec-reviewer and quality-reviewer"
```

---

## Success Criteria

### Automated Verification
- [ ] `ls agents/spec-reviewer.md agents/quality-reviewer.md` — both files exist
- [ ] `ls skills/prism-spectrum/references/spec-review-prompt.md skills/prism-spectrum/references/quality-review-prompt.md` — both templates exist
- [ ] `grep -c "Two-Stage Review" skills/prism-spectrum/SKILL.md` — returns 1
- [ ] `grep -c "Report Implementation Status" skills/prism-spectrum/SKILL.md` — returns 1
- [ ] `grep -c "Distrust Pattern" skills/prism-validate/SKILL.md` — returns 1
- [ ] `grep -c "spectrum-needs-context" scripts/spectrum.sh` — returns at least 1
- [ ] YAML frontmatter in both agent files parses correctly (name, model, maxTurns present)

### Manual Verification
- [ ] Read `agents/spec-reviewer.md` — confirms distrust-first approach, read-only tools, compliance focus
- [ ] Read `agents/quality-reviewer.md` — confirms quality focus separate from spec compliance
- [ ] Read updated `skills/prism-spectrum/SKILL.md` — flow is coherent: implement → status → gates → spec review → quality review → commit
- [ ] Read updated `scripts/spectrum.sh` — new signal tags parsed without breaking existing signal handling
- [ ] Read updated `skills/prism-validate/SKILL.md` — distrust pattern verifies independently, doesn't trust self-reports
