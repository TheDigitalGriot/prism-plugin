---
description: Create handoff document for transferring work to another session
model: sonnet
---

# Create Handoff

Write a handoff document to transfer work to another session. Be thorough but concise - compact and summarize your context without losing key details.

## Process

### 1. Filepath & Metadata

Create file at `thoughts/shared/handoffs/YYYY-MM-DD_HH-MM-SS_description.md`:
- YYYY-MM-DD: Today's date
- HH-MM-SS: Current time (24-hour format)
- description: Brief kebab-case description

Get metadata:
```bash
git rev-parse HEAD      # commit hash
git branch --show-current  # branch name
```

### 2. Write Handoff

Use this template:

```markdown
---
date: [ISO format with timezone]
researcher: Claude
git_commit: [from git rev-parse HEAD]
branch: [from git branch --show-current]
topic: "[Feature/Task] Handoff"
tags: [handoff, component-names]
status: complete
---

# Handoff: {concise description}

## Task(s)
{Task description with status (completed, in progress, planned). Reference plan documents you're working from.}

## Critical References
{2-3 most important file paths that must be followed. Leave blank if none.}

## Recent Changes
{Changes made in file:line syntax}

## Learnings
{Important patterns, root causes, or information. Include explicit file paths.}

## Artifacts
{Exhaustive list of artifacts produced/updated as filepaths}

## Action Items & Next Steps
{List of next steps for resuming agent}

## Other Notes
{Other useful references or information}
```

### 3. Complete

After writing the handoff, respond:

```
Handoff created! Resume in a new session with:

/resume_handoff thoughts/shared/handoffs/YYYY-MM-DD_HH-MM-SS_description.md
```

## Guidelines

- **More information, not less** - This is the minimum; include more if needed
- **Be thorough and precise** - Include objectives and details
- **Avoid excessive code snippets** - Prefer `file:line` references over large blocks
