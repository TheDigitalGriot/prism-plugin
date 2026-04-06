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
