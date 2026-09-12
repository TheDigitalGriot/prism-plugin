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
