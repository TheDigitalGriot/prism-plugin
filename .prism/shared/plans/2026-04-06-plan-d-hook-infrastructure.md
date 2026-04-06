# Plan D: Hook Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SubagentStart/Stop tracking hooks and dynamic model selection for agent dispatching. (Observational context hooks are already implemented — Phase 8 is complete.)

**Architecture:** New SubagentStart/SubagentStop hooks log agent dispatches to `.prism/local/agent-log.jsonl` for debugging and cost analysis. Dynamic model selection adds guidance to skills that dispatch agents, allowing them to override the default model based on task complexity.

**Tech Stack:** Python scripts (cross-platform hooks), markdown skill/agent files, hooks.json configuration.

**Note:** Phase 8 (Observational Context Hooks) was found to be **already implemented** in the current codebase. `hooks/hooks.json` already registers `PreCompact` (`pre-compact.py`), `PostCompact` (`post-compact.py`), and `PostToolUse` on Write|Edit|Bash (`log-observation.py`). This plan covers only Phases 7 and 9.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `scripts/log-agent.py` | SubagentStart/Stop hook: log agent dispatches |
| Modify | `hooks/hooks.json` | Add SubagentStart/SubagentStop hooks |
| Create | `skills/prism-spectrum/references/model-selection.md` | Dynamic model selection guide |
| Modify | `skills/prism-research/SKILL.md` | Add model selection guidance |
| Modify | `skills/prism-spectrum/SKILL.md` | Reference model selection guide |

---

### Task 1: Create the Agent Logging Script

**Files:**
- Create: `scripts/log-agent.py`

- [ ] **Step 1: Create the Python agent logging script**

```python
#!/usr/bin/env python3
"""
SubagentStart/SubagentStop hook: log agent dispatches to .prism/local/agent-log.jsonl.
Cross-platform (Windows, macOS, Linux).

Receives hook event JSON on stdin. Appends one JSON line per event.
"""
import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path


def find_project_root():
    """Walk up from cwd to find .prism/ directory."""
    current = Path.cwd()
    while current != current.parent:
        if (current / ".prism").is_dir():
            return current
        current = current.parent
    return Path.cwd()


def main():
    # Read event from stdin
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    # Determine event type from hook context
    # SubagentStart provides: agent_name, agent_type, model
    # SubagentStop provides: agent_name, agent_type, model, duration_ms, token_usage
    agent_name = event.get("agent_name", event.get("subagent_type", "unknown"))
    agent_type = event.get("agent_type", "unknown")
    model = event.get("model", "unknown")

    # Determine if this is start or stop based on presence of duration
    is_stop = "duration_ms" in event or "status" in event

    # Build log entry
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": "stop" if is_stop else "start",
        "agent": agent_name,
        "type": agent_type,
        "model": model,
    }

    if is_stop:
        entry["duration_ms"] = event.get("duration_ms", 0)
        entry["status"] = event.get("status", "unknown")
        # Include token usage if available
        token_usage = event.get("token_usage", {})
        if token_usage:
            entry["tokens"] = token_usage

    # Write to .prism/local/agent-log.jsonl
    project_root = find_project_root()
    log_dir = project_root / ".prism" / "local"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "agent-log.jsonl"

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `python3 -c "import py_compile; py_compile.compile('scripts/log-agent.py', doraise=True)"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scripts/log-agent.py
git commit -m "feat: add agent dispatch logging script for SubagentStart/Stop hooks"
```

---

### Task 2: Add SubagentStart/Stop Hooks

**Files:**
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Read the current hooks.json**

Run: `cat hooks/hooks.json`

- [ ] **Step 2: Add SubagentStart and SubagentStop hooks**

Add two new entries to the hooks object after the existing entries (after WorktreeRemove if Plan C has been applied, otherwise after PostToolUse):

```json
    "SubagentStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py"
          }
        ]
      }
    ]
```

Both events use the same script — the script determines start vs stop by checking for `duration_ms` in the event payload.

- [ ] **Step 3: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('hooks/hooks.json'))"`
Expected: No errors

- [ ] **Step 4: Verify both hooks are registered**

Run: `python3 -c "import json; h=json.load(open('hooks/hooks.json')); print('SubagentStart' in h.get('hooks',{}), 'SubagentStop' in h.get('hooks',{}))"` 
Expected: `True True`

- [ ] **Step 5: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat: add SubagentStart/SubagentStop hooks for agent dispatch tracking"
```

---

### Task 3: Create the Model Selection Guide

**Files:**
- Create: `skills/prism-spectrum/references/model-selection.md`

- [ ] **Step 1: Create the dynamic model selection reference**

```markdown
# Dynamic Model Selection Guide

When dispatching agents, select the model based on task complexity rather than always using the agent's default. The agent frontmatter `model` field is the default — it can be overridden at dispatch time.

## Complexity Signals

### Use Haiku (Fast/Cheap) When:
- Task touches 1-2 files with a complete, unambiguous spec
- Task is mechanical: rename, move, copy pattern, update config
- Task has no integration concerns (self-contained change)
- Task is a lookup or search operation

### Use Sonnet (Standard) When:
- Task touches 3-5 files with integration concerns
- Task requires pattern matching across the codebase
- Task involves debugging or root cause analysis
- Task requires generating new code (not just modifying existing)

### Use Opus (Most Capable) When:
- Task requires architectural judgment or design decisions
- Task involves complex multi-file refactoring
- Task requires understanding intent behind existing code
- Task involves review or quality assessment

## Override Pattern

When dispatching an agent via `Task(subagent_type="...")`, you can override the model:

```
Task(subagent_type="codebase-analyzer", model="haiku")
"Simple lookup: find where function X is defined"
```

vs.

```
Task(subagent_type="codebase-analyzer")  # Uses default (opus)
"Trace the full data flow from API endpoint to database for the auth module"
```

## Agent Default Models (Reference)

| Agent | Default Model | Override Down When | Override Up When |
|-------|--------------|-------------------|------------------|
| codebase-locator | haiku | Never (already cheapest) | Complex search patterns |
| codebase-analyzer | opus | Simple lookups, single-file reads | Never (already most capable) |
| codebase-pattern-finder | sonnet | Simple pattern match | Cross-domain pattern analysis |
| prism-locator | haiku | Never | Never |
| prism-analyzer | opus | Shallow reads | Never |
| web-search-researcher | sonnet | Simple URL fetch | Never |
| graph-navigator | haiku | Never | Never |
| browser-verifier | haiku | Never | Never |
| spec-reviewer | sonnet | Config-only changes | Complex architectural review |
| quality-reviewer | sonnet | Small mechanical changes | Large multi-file reviews |

## Cost Impact

Rough token cost ratios (relative to haiku=1x):
- Haiku: 1x
- Sonnet: 3-5x
- Opus: 15-20x

A Spectrum run with 20 stories, each dispatching 5 agents:
- All-opus: 100 opus calls ≈ expensive
- Smart selection: ~60 haiku + ~30 sonnet + ~10 opus ≈ 70-80% cost reduction

## When NOT to Override

- Don't override reviewer agents down to haiku — reviews require judgment
- Don't override opus agents for deep analysis tasks — they need the reasoning
- Don't override when the task description is ambiguous — use the default
```

- [ ] **Step 2: Commit**

```bash
git add skills/prism-spectrum/references/model-selection.md
git commit -m "feat: add dynamic model selection guide for agent dispatching"
```

---

### Task 4: Add Model Selection Guidance to Research Skill

**Files:**
- Modify: `skills/prism-research/SKILL.md`

- [ ] **Step 1: Read the current research skill**

Run: `cat skills/prism-research/SKILL.md`

- [ ] **Step 2: Add model selection note to the agent dispatch section**

After the "Available Agents" table (around line 43), add a brief note:

```markdown
### Model Selection

When the research scope is narrow (single file, specific function), consider overriding agent models down to haiku for faster, cheaper results. When the scope is broad (full subsystem, cross-cutting concern), use default models. See `references/model-selection.md` in `prism-spectrum` for the full guide.
```

- [ ] **Step 3: Commit**

```bash
git add skills/prism-research/SKILL.md
git commit -m "feat: add model selection guidance to prism-research"
```

---

### Task 5: Add Model Selection Reference to Spectrum Skill

**Files:**
- Modify: `skills/prism-spectrum/SKILL.md`

- [ ] **Step 1: Read the current spectrum skill**

Run: `head -30 skills/prism-spectrum/SKILL.md`

- [ ] **Step 2: Add model selection reference**

In the "Implement Story" section (Section 4), add a brief note:

```markdown
### Model Selection for Agent Dispatches

When dispatching agents during implementation, select the model based on task complexity. Load `references/model-selection.md` for the full guide. Quick rule: mechanical tasks (1-2 files, clear spec) → haiku; integration tasks → sonnet; design/review → opus.
```

- [ ] **Step 3: Commit**

```bash
git add skills/prism-spectrum/SKILL.md
git commit -m "feat: add model selection reference to Spectrum implementation phase"
```

---

### Task 6: Integration Verification

**Files:**
- Verify: All created/modified files

- [ ] **Step 1: Verify all files exist**

Run: `ls scripts/log-agent.py skills/prism-spectrum/references/model-selection.md`
Expected: Both files listed

- [ ] **Step 2: Verify hooks.json is valid and has new events**

Run: `python3 -c "import json; h=json.load(open('hooks/hooks.json')); events=list(h.get('hooks',{}).keys()); print(sorted(events))"`
Expected: List includes `SubagentStart` and `SubagentStop` alongside existing hooks

- [ ] **Step 3: Test agent logging script with mock input**

Run: `echo '{"agent_name":"codebase-locator","agent_type":"agent","model":"haiku"}' | python3 scripts/log-agent.py && cat .prism/local/agent-log.jsonl | tail -1`
Expected: JSON line with `"event":"start"`, `"agent":"codebase-locator"`, `"model":"haiku"`

- [ ] **Step 4: Clean up test log**

Run: `rm -f .prism/local/agent-log.jsonl`

- [ ] **Step 5: Verify model selection guide is referenced**

Run: `grep -c "model-selection" skills/prism-spectrum/SKILL.md skills/prism-research/SKILL.md`
Expected: At least 1 match per file

- [ ] **Step 6: Final commit if needed**

```bash
git status
# Commit any remaining changes
```

---

## Success Criteria

### Automated Verification
- [ ] `python3 -c "import py_compile; py_compile.compile('scripts/log-agent.py', doraise=True)"` — no errors
- [ ] `python3 -c "import json; json.load(open('hooks/hooks.json'))"` — valid JSON
- [ ] `grep "SubagentStart" hooks/hooks.json` — hook registered
- [ ] `grep "SubagentStop" hooks/hooks.json` — hook registered
- [ ] `ls skills/prism-spectrum/references/model-selection.md` — guide exists
- [ ] Mock agent event produces valid JSONL in agent-log.jsonl
- [ ] Both prism-spectrum and prism-research reference model selection

### Manual Verification
- [ ] Dispatch a real agent — verify `agent-log.jsonl` captures start and stop events
- [ ] Read model-selection.md — confirms clear complexity signals and override patterns
- [ ] Read updated prism-research/SKILL.md — model selection note is non-intrusive
- [ ] Read updated prism-spectrum/SKILL.md — model selection reference loads conditionally
- [ ] Verify hooks.json still loads correctly when plugin is enabled
