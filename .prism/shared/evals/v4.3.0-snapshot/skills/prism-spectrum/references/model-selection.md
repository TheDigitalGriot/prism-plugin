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

### Fable 5 (Maximum Capability) — RESERVED, NOT ENABLED
> 🔒 **DO NOT DISPATCH `claude-fable-5`.** This tier is documented for future planning only. It is **not enabled** in this plugin — no agent may select it, no override may target it, and no frontmatter sets it. If you are an agent choosing a model during a dispatch, treat Opus 4.8 as the ceiling and ignore this tier entirely. Selecting Fable 5 is a defect, not an escalation.

When Fable 5 is eventually enabled (tracked in `.prism/shared/research/2026-06-12-fable-5-integration.md`), the justification bar *will* be — but is not yet active:

- A story Opus 4.8 **genuinely failed** on a prior run — not "did slightly worse," but produced incorrect or incomplete work after a real attempt
- Long-horizon agentic work where the model must hold a multi-step plan across many tool calls without losing the thread
- One-shot critical decisions (security-sensitive refactor, irreversible migration) where the ~2.6× cost is dwarfed by the cost of getting it wrong

Until that work ships, the bar above is informational. Effective cost would be ~2.6× Opus 4.8 (2× price × ~1.3× tokenizer), and the API surface differs (always-on thinking, `refusal` stop reason, heavier tokenizer, 30-day retention) — see [cl-plugin-structure/references/model-config.md §5](../../cl-plugin-structure/references/model-config.md). None of that is reachable today.

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
| codebase-analyzer | opus | Simple lookups, single-file reads | Never (Opus is the ceiling) |
| codebase-pattern-finder | sonnet | Simple pattern match | Cross-domain pattern analysis |
| prism-locator | haiku | Never | Never |
| prism-analyzer | opus | Shallow reads | Never (Opus is the ceiling) |
| web-search-researcher | sonnet | Simple URL fetch | Never |
| graph-navigator | haiku | Never | Never |
| browser-verifier | haiku | Never | Never |
| spec-reviewer | sonnet | Config-only changes | Complex architectural review |
| quality-reviewer | sonnet | Small mechanical changes | Large multi-file reviews |

**Opus 4.8 is the hard ceiling for every dispatch.** Fable 5 is documented above as a reserved tier but is **not enabled** — never select it. No row may override up to Fable.

## Cost Impact

Rough token cost ratios (relative to haiku=1x):
- Haiku: 1x
- Sonnet: 3-5x
- Opus: 15-20x
- Fable 5: ~40-50x (≈2.6× Opus) — *reserved, not enabled; shown for future cost planning only*

A Spectrum run with 20 stories, each dispatching 5 agents:
- All-opus: 100 opus calls ≈ expensive
- Smart selection: ~60 haiku + ~30 sonnet + ~10 opus ≈ 70-80% cost reduction

## When NOT to Override

- Don't override reviewer agents down to haiku — reviews require judgment
- Don't override opus agents for deep analysis tasks — they need the reasoning
- Don't override when the task description is ambiguous — use the default
