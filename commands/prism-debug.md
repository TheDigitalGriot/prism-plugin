---
description: Debug issues by investigating logs, application state, and git history using parallel agents
model: sonnet
---

# Prism Debug

Debug issues during manual testing or implementation by examining logs, application state, and git history. This command spawns parallel investigation agents without consuming the primary conversation context.

## Initial Response

When invoked WITH a plan/ticket file:
```
I'll help debug issues with [file name]. Let me understand the current state.

What specific problem are you encountering?
- What were you trying to test/implement?
- What went wrong?
- Any error messages?

I'll investigate logs, application state, and git history to help figure out what's happening.
```

When invoked WITHOUT parameters:
```
I'll help debug your current issue.

Please describe what's going wrong:
- What are you working on?
- What specific problem occurred?
- When did it last work?

I can investigate logs, application state, and recent changes to help identify the issue.
```

## Investigation Areas

Adapt these to your project's structure:

**Logs** (common locations):
- Application logs: `logs/`, `./logs/`, `~/.local/share/appname/logs/`
- Framework logs: Check your framework's default log location
- System logs: `journalctl`, Event Viewer, etc.

**Database/State**:
- SQLite: `*.db`, `*.sqlite` files in project or config directories
- State files: JSON/YAML config, cache directories
- Environment: `.env` files, environment variables

**Git State**:
- Current branch and recent commits
- Uncommitted changes
- Diff from expected state

**Service Status**:
- Process checks: `ps aux | grep [service]`
- Port checks: `netstat -tlnp`, `lsof -i :PORT`
- Health endpoints if applicable

## Process Steps

### Step 1: Understand the Problem

After the user describes the issue:

1. **Read any provided context** (plan or ticket file):
   - Understand what they're implementing/testing
   - Note which phase or step they're on
   - Identify expected vs actual behavior

2. **Quick state check**:
   - Current git branch and recent commits
   - Any uncommitted changes
   - When the issue started occurring

### Step 2: Investigate the Issue

Spawn parallel Task agents for efficient investigation:

```
Task 1 - Check Recent Logs:
Find and analyze the most recent logs for errors:
1. Locate log files in common locations
2. Search for errors, warnings, or issues around the problem timeframe
3. Look for stack traces or repeated errors
Return: Key errors/warnings with timestamps
```

```
Task 2 - Application State:
Check the current application state:
1. Find database or state files
2. Query recent data if applicable
3. Look for stuck states or anomalies
Return: Relevant state findings
```

```
Task 3 - Git and File State:
Understand what changed recently:
1. Check git status and current branch
2. Look at recent commits: git log --oneline -10
3. Check uncommitted changes: git diff
4. Verify expected files exist
Return: Git state and any file issues
```

### Step 3: Present Findings

Based on the investigation, present a focused debug report:

```markdown
## Debug Report

### What's Wrong
[Clear statement of the issue based on evidence]

### Evidence Found

**From Logs**:
- [Error/warning with timestamp]
- [Pattern or repeated issue]

**From Application State**:
- [Finding from database/state]
- [Anomaly detected]

**From Git/Files**:
- [Recent changes that might be related]
- [File state issues]

### Root Cause
[Most likely explanation based on evidence]

### Next Steps

1. **Try This First**:
   ```bash
   [Specific command or action]
   ```

2. **If That Doesn't Work**:
   - [Alternative approach]
   - [Diagnostic command]

### Can't Access?
Some issues might be outside my reach:
- Browser console errors (F12 in browser)
- External service state
- System-level issues

Would you like me to investigate something specific further?
```

## Important Notes

- **Focus on investigation** - This is for debugging, not fixing
- **Always require problem description** - Can't debug without knowing what's wrong
- **Read files completely** - No limit/offset when reading context
- **Guide back to user** - Some issues (browser console, external services) are outside reach
- **No file editing** - Pure investigation only

## Quick Reference

**Find Logs**:
```bash
find . -name "*.log" -mtime -1  # Logs modified in last day
ls -lt logs/ | head             # Most recent logs
```

**Check Processes**:
```bash
ps aux | grep [service]
lsof -i :PORT
```

**Git State**:
```bash
git status
git log --oneline -10
git diff
```

Remember: This command helps you investigate without burning the primary window's context. Perfect for when you hit an issue during manual testing and need to dig into logs, state, or git history.
