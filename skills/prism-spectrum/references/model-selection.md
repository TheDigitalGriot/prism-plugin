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

### Use Opus (Most Capable — Opus 5 is the ceiling) When:
- Task requires architectural judgment or design decisions
- Task involves complex multi-file refactoring
- Task requires understanding intent behind existing code
- Task involves review or quality assessment

> **Opus 5 is the routine ceiling.** `claude-opus-5` supersedes Opus 4.8 as the most capable routine tier at the **same $5 / $25 price**, so the ceiling is now cheaper-per-capability — `medium` effort on Opus 5 covers work that used to need `high`/`xhigh`. Opus 4.8 stays reachable under its own alias for A/B eval (see [model-config.md §2](../../cl-plugin-structure/references/model-config.md)). Fable 5 remains the gated escalation above the ceiling, never a routing default.

### Fable 5 (Maximum Capability) — ENABLED, HITL-GATED
> ⚠️ **`claude-fable-5` is opt-in and gated, never a routing default.** It is enabled under the Max/Team Premium subscription, but every use passes a human-in-the-loop gate: the workspace `.prism/local/fable.flag` + a confirm/deny modal in the app, and the `fable-gate.sh` PreToolUse hook on Task dispatches. No agent auto-selects it, no `role_defaults` targets it, and no agent frontmatter sets it as a resting default — it is reached only by explicit, confirmed escalation. Auto-selecting Fable during routine dispatch is still a defect; a deliberate, gated escalation is not.

The justification bar for escalating to Fable 5 (active):

- A story Opus 4.8 **genuinely failed** on a prior run — not "did slightly worse," but produced incorrect or incomplete work after a real attempt
- Long-horizon agentic work where the model must hold a multi-step plan across many tool calls without losing the thread
- One-shot critical decisions (security-sensitive refactor, irreversible migration) where the cost of getting it wrong dwarfs the spend

**Never the default.** Fable draws on a *capped weekly Max allowance* (and is API-metered ≈2.6× Opus 4.8 on non-subscription surfaces), so the gate exists to protect that headroom — reach for it the way you'd reserve `effort: max`. Its API surface also differs (always-on thinking, `refusal` stop reason, heavier tokenizer, 30-day retention) — see [cl-plugin-structure/references/model-config.md §5](../../cl-plugin-structure/references/model-config.md). Everything routine stays on Opus 4.8 or below.

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
| codebase-analyzer | opus | Simple lookups, single-file reads | Never (Opus 5 is the ceiling) |
| codebase-pattern-finder | sonnet | Simple pattern match | Cross-domain pattern analysis |
| prism-locator | haiku | Never | Never |
| prism-analyzer | opus | Shallow reads | Never (Opus 5 is the ceiling) |
| web-search-researcher | sonnet | Simple URL fetch | Never |
| graph-navigator | haiku | Never | Never |
| browser-verifier | haiku | Never | Never |
| spec-reviewer | sonnet | Config-only changes | Complex architectural review |
| quality-reviewer | sonnet | Small mechanical changes | Large multi-file reviews |

**Opus 5 is the routing ceiling for every dispatch.** `claude-opus-5` is the ceiling; Opus 4.8 stays reachable under its own alias for A/B eval, and both sit below the Fable escalation. The override table above never auto-selects Fable 5 — Fable is reached only through the explicit HITL gate (flag + modal/hook), as a deliberate escalation, not a routing decision. No row in this table auto-escalates up to Fable. Opus 5 carries **no Fable-style gate**; its only guard is a one-shot confirm on `effort: xhigh|max` (a per-call effort control, not a model gate — see [model-config.md §4](../../cl-plugin-structure/references/model-config.md)).

## Cost Impact

Rough token cost ratios (relative to haiku=1x):
- Haiku: 1x
- Sonnet: 3-5x
- Opus (Opus 5 / Opus 4.8): 15-20x — **same $5 / $25 price**, so the ceiling costs the same per token as the prior tier while delivering more per token; drop the effort dial (Opus 5 `medium` ≈ prior `high`) to spend less without leaving the ceiling
- Fable 5: ~40-50x on metered API (≈2.6× Opus); on Max it draws from a capped weekly allowance rather than per-call $ — gated escalation only, never a routing default

A Spectrum run with 20 stories, each dispatching 5 agents:
- All-opus: 100 opus calls ≈ expensive
- Smart selection: ~60 haiku + ~30 sonnet + ~10 opus ≈ 70-80% cost reduction

## When NOT to Override

- Don't override reviewer agents down to haiku — reviews require judgment
- Don't override opus agents for deep analysis tasks — they need the reasoning
- Don't override when the task description is ambiguous — use the default
