---
name: prism-debug
description: Debug issues by investigating logs, application state, and git history using parallel agents. Use when encountering failures during implementation, quality gate failures in Ralph, or any unexpected behavior. Triggers on "debug this", "why is this failing", "investigate the error", "prism debug", or when Ralph encounters quality gate failures.
model: sonnet
---

# Prism Debug

Orchestrate parallel debug investigation to diagnose issues during development or Ralph execution.

## Philosophy

1. **Investigate, Don't Fix**: This skill diagnoses problems, it doesn't implement fixes
2. **Parallel Investigation**: Spawn multiple agents to check different areas simultaneously
3. **Structured Output**: Produce actionable debug reports
4. **Context Preservation**: Capture findings for future iterations (especially Ralph)

## Integration Points

### Standalone Usage
```
/prism-debug [optional: context file or error description]
```

### Ralph Integration
Automatically invoked when quality gates fail during `/prism-ralph` execution.

### Workflow Position
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Implement  │────▶│   Debug     │────▶│   Iterate   │
│  (failure)  │     │  (You Are   │     │  (with      │
│             │     │   Here)     │     │  findings)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Workflow

### 1. Gather Context

When invoked, first understand the situation:

**If invoked with context file**:
- Read the file completely
- Identify current phase/story
- Note expected vs actual behavior

**If invoked standalone**:
- Ask user to describe the issue
- What were they trying to do?
- What went wrong?
- Any error messages?

**If invoked from Ralph**:
- Read stories.json for current story
- Read progress.md for recent history
- Capture quality gate failure output

### 2. Spawn Investigation Agents

Launch parallel agents to investigate different areas:

```
Task(subagent_type="log-investigator")
"Investigate recent logs for errors related to: [issue description]
Look in common locations: logs/, ./logs/, application output
Search for: errors, warnings, stack traces, timestamps around failure
Return: Key findings with timestamps and severity"
```

```
Task(subagent_type="state-investigator")
"Check application state for anomalies related to: [issue description]
Examine: database files, state files, config, environment
Look for: stuck states, invalid data, missing config
Return: State findings with file paths"
```

```
Task(subagent_type="git-investigator")
"Analyze git history for changes related to: [issue description]
Check: recent commits, uncommitted changes, branch state
Look for: relevant changes, potential regressions, merge issues
Return: Git state and relevant change analysis"
```

### 3. Analyze Failure Output

If quality gate failure output is available:

**For typecheck errors**:
- Parse error locations (file:line)
- Identify type mismatches
- Check for missing imports

**For lint errors**:
- Categorize by severity
- Group by file
- Note auto-fixable issues

**For test failures**:
- Identify failing test names
- Extract assertion errors
- Note test file locations

### 4. Synthesize Findings

Combine agent results into a structured report:

```markdown
## Debug Report: [Issue Summary]

### Problem Statement
[Clear description of what's failing and when]

### Error Analysis
**Type**: [typecheck/lint/test/runtime]
**Location**: [file:line if applicable]
**Message**: [error message]

### Investigation Findings

**From Logs**:
- [Finding with timestamp]
- [Relevant error pattern]

**From Application State**:
- [State anomaly found]
- [Config issue detected]

**From Git History**:
- [Recent relevant change]
- [Potential regression point]

### Root Cause Hypothesis
[Most likely explanation based on evidence]

### Suggested Fix Approach
1. [First thing to try]
2. [Alternative approach]
3. [If those fail, try this]

### Files to Examine
- [file1.ts:line] - [why]
- [file2.ts:line] - [why]
```

### 5. Output for Ralph

When invoked from Ralph, format findings for progress.md:

```markdown
## [Timestamp] - Debug Investigation for [STORY-ID]

**Quality Gate Failed**: [which gate]

**Error Output**:
```
[captured error]
```

**Investigation Findings**:
- **Logs**: [summary]
- **State**: [summary]
- **Git**: [summary]

**Root Cause**: [hypothesis]

**Suggested Fix**: [approach for next iteration to try]
```

## Agents

This skill orchestrates these specialized agents:

| Agent | Purpose | Model |
|-------|---------|-------|
| `log-investigator` | Analyze logs for errors | haiku |
| `state-investigator` | Check application state | haiku |
| `git-investigator` | Analyze git history | haiku |

## Rules

1. **Read-only investigation** - Never modify files during debug
2. **Parallel agents** - Always spawn investigation agents in parallel
3. **Structured output** - Always produce the debug report format
4. **Capture everything** - Better to include too much context than too little
5. **Hypothesize carefully** - Root cause is a hypothesis, not certainty
6. **Actionable suggestions** - Fix approaches should be specific and testable

## Quick Reference

**Common Log Locations**:
```bash
find . -name "*.log" -mtime -1  # Logs modified in last day
ls -lt logs/ | head             # Most recent logs
```

**Common State Locations**:
```bash
find . -name "*.db" -o -name "*.sqlite"  # Database files
find . -name ".env*"                      # Environment files
```

**Git Commands**:
```bash
git status                       # Current state
git log --oneline -10           # Recent commits
git diff                        # Uncommitted changes
git diff HEAD~5                 # Changes in last 5 commits
```

## Error Patterns

| Pattern | Likely Cause | Investigation Focus |
|---------|--------------|---------------------|
| Type 'X' is not assignable | Type mismatch | Check imports, interface definitions |
| Cannot find module | Missing dependency | Check package.json, node_modules |
| Test timeout | Async issue | Check for unresolved promises |
| ENOENT | File not found | Check file paths, working directory |
| ECONNREFUSED | Service down | Check if required services running |
