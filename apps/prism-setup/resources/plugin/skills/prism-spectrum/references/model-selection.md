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
