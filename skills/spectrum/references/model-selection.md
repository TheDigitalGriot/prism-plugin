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

### Use Opus (Most Capable — Opus 5.5 is the ceiling) When:
- Task requires architectural judgment or design decisions
- Task involves complex multi-file refactoring
- Task requires understanding intent behind existing code
- Task involves review or quality assessment

> **Opus 5.5 is the routine ceiling (as of 2026-09-22, Claude Code v2.1.280+).** `claude-opus-5-5` supersedes Opus 5 as the most capable routine tier at a **lower $4 / $20 price** (down from Opus 5's $5 / $25) — the ceiling got both cheaper *and* more capable in the same release. Its shipped default effort is `medium` (Opus 5 defaulted to `high`), so the everyday dispatch cost drops again on top of the list-price cut — two compounding decreases, not one. Thinking can no longer be disabled on Opus 5.5 at any effort level (Opus 5 could disable it outside `xhigh`/`max`), so a `max_tokens` budget carried over from an Opus 5 workload should be re-baselined, not assumed safe. The `opus`/`best` alias flip has landed; Opus 5 and Opus 4.8 stay reachable under the explicit `opus5` / `opus48` keys — permanent generation pins, per the naming convention — for A/B eval (see [model-config.md §2](../../griot-agent-architect/references/model-config.md)). Fable 5.1 remains the gated escalation above the ceiling, never a routing default.

### Sonnet — now Sonnet 5.5

> **Sonnet 5.5 is the default general-work tier (as of 2026-09-28, Claude Code v2.1.284+).** `claude-sonnet-5-5` supersedes Sonnet 5 at the **same $2 / $10 price** — Anthropic's own cost-reduction claim for 5.5 comes from fewer tool calls and faster completions per task, not a lower sticker price, so the improvement shows up in the *effective* column below, not the list-price one. Sonnet 5 stays reachable under the explicit `sonnet5` key. Sonnet has no HITL gate or downgrade chain of its own — this is purely an alias-resolution change.

### Fable 5.1 (Maximum Capability) — ENABLED, HITL-GATED
> ⚠️ **`claude-fable-5-1` is opt-in and gated, never a routing default.** It is enabled under the Max/Team Premium subscription, but every use passes a human-in-the-loop gate: the workspace `.prism/local/fable.flag` + a confirm/deny modal in the app, and the `fable-gate.sh` PreToolUse hook on Task dispatches (which matches Fable IDs by **prefix**, so point releases cannot slip past ungated). No agent auto-selects it, no `role_defaults` targets it, and no agent frontmatter sets it as a resting default — it is reached only by explicit, confirmed escalation. Auto-selecting Fable during routine dispatch is still a defect; a deliberate, gated escalation is not.

The justification bar for escalating to Fable 5 (active):

- A story Opus 5.5 **genuinely failed** on a prior run — not "did slightly worse," but produced incorrect or incomplete work after a real attempt
- Long-horizon agentic work where the model must hold a multi-step plan across many tool calls without losing the thread
- One-shot critical decisions (security-sensitive refactor, irreversible migration) where the cost of getting it wrong dwarfs the spend

**Never the default.** Fable draws on a *capped weekly Max allowance* (and is API-metered ~2.5× Opus 5.5 on list price on non-subscription surfaces — $10/$50 vs $4/$20; the prior "≈2.6× Opus 5" figure was against Opus 5's now-superseded $5/$25 and does not carry forward as-is), so the gate exists to protect that headroom — reach for it the way you'd reserve `effort: max`. Its API surface also differs (always-on thinking, `refusal` stop reason, 30-day retention, and 0.025× cache reads) — see [griot-agent-architect/references/model-config.md §5](../../griot-agent-architect/references/model-config.md). Everything routine stays on Opus 5.5 or below.

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
| codebase-analyzer | opus | Simple lookups, single-file reads | Never (Opus 5.5 is the ceiling) |
| codebase-pattern-finder | sonnet | Simple pattern match | Cross-domain pattern analysis |
| prism-locator | haiku | Never | Never |
| prism-analyzer | opus | Shallow reads | Never (Opus 5.5 is the ceiling) |
| web-search-researcher | sonnet | Simple URL fetch | Never |
| graph-navigator | haiku | Never | Never |
| browser-verifier | haiku | Never | Never |
| spec-reviewer | sonnet | Config-only changes | Complex architectural review |
| quality-reviewer | sonnet | Small mechanical changes | Large multi-file reviews |

**Opus 5.5 is the routing ceiling for every dispatch.** `claude-opus-5-5` is the ceiling and the `opus` alias now resolves to it; Opus 5 and Opus 4.8 stay reachable under the explicit `opus5` / `opus48` keys for A/B eval, and all three sit below the Fable escalation. The override table above never auto-selects Fable 5.1 — Fable is reached only through the explicit HITL gate (flag + modal/hook), as a deliberate escalation, not a routing decision. No row in this table auto-escalates up to Fable. Opus 5.5 carries **no Fable-style gate**; its only guard is a one-shot confirm on `effort: xhigh|max` (a per-call effort control, not a model gate — see [model-config.md §4](../../griot-agent-architect/references/model-config.md)).

## Cost Impact

Rough token cost ratios (relative to haiku=1x), re-baselined 2026-09-30 for the Opus 5.5 / Sonnet 5.5 refresh:
- Haiku 4.5: 1x ($1 / $5) — no effort support, so no thinking-token tail
- Sonnet 5.5: **2x list price** ($2 / $10, unchanged from Sonnet 5), effective multiplier likely *improves* vs Sonnet 5 per Anthropic's own claim of fewer tool calls and faster completions per task — not independently re-measured here, so don't bank a specific number, just expect it to trend down, not up
- Opus 5.5: **4x list price** ($4 / $20 — a real cut from Opus 5's $5 / $25, i.e. 5x), effective cost drops *again* on top of that because the shipped default effort is now `medium` where Opus 5 defaulted to `high` — two compounding decreases in the same release, not one. Opus 5 / Opus 4.8 (legacy pins) remain at the old 5x list-price ratio
- Fable 5.1: **10x list price**, ~40-50x effective against the *old* Opus 5 baseline (≈2.6×) — that multiplier has **not been re-derived** against Opus 5.5's lower price and lower default effort; expect the true ratio to be somewhat higher now that the ceiling moved down while Fable did not, but treat any precise number here as unverified until re-measured. List-price ratio alone: ~2.5× Opus 5.5 ($10/$50 vs $4/$20). On Max it draws from a capped weekly allowance rather than per-call $ — gated escalation only, never a routing default. Its cache *reads* are only 0.025× base input, so a long stable prefix is disproportionately cheap to re-read

**Two numbers, not one.** "List price" is the published $/MTok ratio; "effective" folds in how many tokens each tier actually spends on a task. They diverge because thinking volume and default effort differ by tier — **Opus 5.5 cannot disable thinking at all** (stricter than Opus 5, which could disable it outside `xhigh`/`max`) but defaults to a lower effort level (`medium` vs `high`), so the two changes pull the effective multiplier in opposite directions and the net effect has not been independently measured against real Spectrum runs yet. Budget from measured evals, not from porting the old Opus 5 effective figures forward.

A Spectrum run with 20 stories, each dispatching 5 agents:
- All-opus: 100 opus calls ≈ expensive
- Smart selection: ~60 haiku + ~30 sonnet + ~10 opus ≈ 70-80% cost reduction

## When NOT to Override

- Don't override reviewer agents down to haiku — reviews require judgment
- Don't override opus agents for deep analysis tasks — they need the reasoning
- Don't override when the task description is ambiguous — use the default
