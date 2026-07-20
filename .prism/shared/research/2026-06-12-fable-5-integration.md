# Fable 5 / Mythos 5 — Integration Research & Implementation Plan

**Date:** 2026-06-12  
**Status:** Superseded 2026-07-20 — built (T1–T4) + enabled under Max subscription, HITL-gated. See [2026-07-20-fable-subscription-unification.md](../plans/2026-07-20-fable-subscription-unification.md) (this doc retained as historical record)  
**Scope:** `prism-plugin` application code only (cl-plugin-structure docs completed separately)

---

## Background

User asked whether Claude Fable 5 and Mythos 5 are part of the `cl-plugin-structure` skill, and whether a `model: fable` frontmatter flag could be added. Research confirmed neither model was documented anywhere in the plugin.

**Claude Fable 5** (`claude-fable-5`): Anthropic's most capable widely released model.  
**Claude Mythos 5** (`claude-mythos-5`): Identical capabilities/pricing/API to Fable 5; Project Glasswing access only. Succeeds `claude-mythos-preview`.

---

## Cost / Accuracy Analysis

The pricing looks like a simple 2× jump, but there's a compounding tokenizer effect:

| Factor | Value |
|---|---|
| Per-token price vs Opus 4.8 | 2× ($10/$50 vs $5/$25 per MTok) |
| Tokenizer overhead (same content) | ~+30% more tokens |
| **Effective total cost for same prompt** | **~2.6×** |

**Example — `prism-research` deep run** (~200K in / 50K out on Opus 4.8):

| Model | Input | Output | Total |
|---|---|---|---|
| Opus 4.8 | 200K × $5/M = $1.00 | 50K × $25/M = $1.25 | **$2.25** |
| Fable 5 (with tokenizer) | 260K × $10/M = $2.60 | 65K × $50/M = $3.25 | **$5.85** |

**When the cost is justified:**
- Overnight Spectrum runs on the hardest stories (blockers, complex multi-file refactors)
- Tasks where Opus 4.8 genuinely fails (not just does worse — fails)
- One-shot critical decisions (architecture review, security audit) where quality > cost

**When to stay on Opus 4.8:** Standard RPIV cycles (research → plan → implement → validate on a scoped feature). Opus 4.8 was specifically built to fix verbosity and tool-calling regressions and completes the Super-Agent benchmark. It's the right default for all of Prism's current workflow phases.

---

## API Breaking Changes — Know Before Adopting

These would cause errors or silent failures if `claude-fable-5` were dropped into the current SDK without code changes:

### 1. `thinking` parameter behavior (BREAKING)
- `{type: "disabled"}` → **400 error** on Fable 5
- `{type: "enabled", budget_tokens: N}` → **400 error** on Fable 5  
- Only `{type: "adaptive"}` or omitting the param entirely are valid
- Current `createMessage` in `claude-sdk.ts` omits `thinking` → **correct as-is, no change needed**
- Risk: if anyone adds explicit thinking control in the future, Fable 5 will 400

### 2. `refusal` stop reason — silent failure (NOT HANDLED)
- Safety classifier declines: HTTP 200, `stop_reason: "refusal"`, empty `content` array
- Current `createMessage` never checks `stop_reason` → caller gets an empty stream, looks like success
- **Must add:** check `event.delta.stop_reason === "refusal"` in `message_delta` handler; throw descriptive error
- Note: Anthropic SDK types predate Fable 5 — `stop_reason` union doesn't include `"refusal"` yet. Cast to `string` for the comparison.

### 3. New tokenizer — cost estimates wrong
- Default `_maxTokens = 8192` is fine as a cap
- Any cost tracking, budget alerts, or token-count-based decisions elsewhere that use Opus-calibrated numbers will be ~30% off
- Re-baseline with `count_tokens` endpoint before shipping any Fable 5 cost estimates

### 4. 30-day data retention required (account-level)
- Fable 5 not available under zero-data-retention (ZDR) orgs
- If account has ZDR, every Fable 5 call returns `400 invalid_request_error`
- Not a code problem — check account config before adopting

### 5. Sampling parameters rejected
- `temperature`, `top_p`, `top_k` all return 400 on Fable 5
- Current `createMessage` doesn't pass these → **no issue today**
- Risk: future additions would break silently on Fable without this check documented

---

## Implementation Plan (prism-plugin)

When ready to implement — do these in order:

### Phase 1: SDK layer (`apps/prism-vscode/src/core/api/claude-sdk.ts`)

**1a. Add `fable` to `MODEL_IDS`:**
```typescript
export const MODEL_IDS = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
  fable: "claude-fable-5",           // add this
} as const
```
`ModelName` automatically widens to `"opus" | "sonnet" | "haiku" | "fable"` — no separate type edit needed.

**1b. Add `refusal` stop reason handling in `createMessage`:**
```typescript
case "message_delta":
  // Fable 5 (and future models): safety classifier may decline a request
  // with HTTP 200, stop_reason "refusal", and empty content — throw so callers
  // don't silently receive an empty response and mistake it for success.
  // Cast to string: SDK types predate Fable 5 and don't include "refusal" yet.
  if ((event.delta.stop_reason as string) === "refusal") {
    throw new Error(
      "Request declined by safety classifier (stop_reason: refusal). " +
        "This can occur with Claude Fable 5 on certain content. " +
        "Check stop_details category if available and retry or rephrase.",
    )
  }
  if (event.usage) {
    // ... existing usage handling unchanged
  }
  break
```

### Phase 2: CLAUDE.md — model assignment convention

Add a fourth tier to the convention table:
```
- **Fable**: Most demanding long-horizon agentic work — overnight Spectrum runs on 
             blockers, critical architecture decisions. Never the default; opt-in per-agent 
             or per-story only.
```

### Phase 3: Soft test in `prism-analyzer`

Gate behind the Spectrum workflow review first (user preference). Once Spectrum is understood:
1. Add `model: fable` to `agents/prism-analyzer.md` frontmatter
2. Run a single deep research task manually to calibrate quality/cost
3. Compare output quality vs Opus 4.8 on the same prompt
4. Decide whether to keep or revert based on quality delta vs cost

### Phase 4: Spectrum integration (if warranted)

Option A: Per-story in `stories.json` context — add `"model": "fable"` to specific story objects for hardest tasks  
Option B: Epic-level in `stories.json` `epic.qualityGates` — a flag to run the full epic on Fable  
Option C: `spectrum.sh` env var — `SPECTRUM_MODEL=fable ./scripts/spectrum.sh`

Option A is the most surgical and recommended — lets you target Fable at individual blockers without paying 2.6× for all 50 stories.

---

## Deferred: Mythos 5

`claude-mythos-5` is identical to Fable 5 in API surface and pricing. Only add it if Project Glasswing access is confirmed. If added, it would be a second alias in `MODEL_IDS`:

```typescript
fable: "claude-fable-5",
mythos: "claude-mythos-5",    // only if Glasswing access confirmed
```

---

## Files to Touch (when ready)

| File | Change | Priority |
|---|---|---|
| `apps/prism-vscode/src/core/api/claude-sdk.ts` | Add `fable` to `MODEL_IDS`, add refusal handler | Phase 1 |
| `CLAUDE.md` | Add Fable tier to model assignment convention | Phase 2 |
| `agents/prism-analyzer.md` | Add `model: fable` frontmatter (test only) | Phase 3 |
| `scripts/spectrum.sh` | Consider `SPECTRUM_MODEL` env var | Phase 4 |

`cl-plugin-structure` docs (`model-config.md`, `SKILL.md`) — **already updated in this session**.

---

## Preserved Escalation Criteria (ready to activate)

> This is the model-selection language drafted for `skills/prism-spectrum/references/model-selection.md`. It is currently **locked there as RESERVED / NOT ENABLED** (Fable is documented but un-dispatchable). When Fable is enabled, this is the ready-to-paste "when to escalate" text — drop it back in unlocked, flip the override-table rows, and remove the `🔒 DO NOT DISPATCH` guard.

### "Use Fable 5 (Maximum Capability) When" — the justification bar

- A story Opus 4.8 **genuinely failed** on a prior run — not "did slightly worse," but produced incorrect or incomplete work after a real attempt
- Long-horizon agentic work where the model must hold a multi-step plan across many tool calls without losing the thread
- One-shot critical decisions (security-sensitive refactor, irreversible migration) where the ~2.6× cost is dwarfed by the cost of getting it wrong

**Never the default.** Effective cost is ~2.6× Opus 4.8 for the same prompt (2× price × ~1.3× tokenizer). Reach for it only on the hard tail of stories where Opus measurably falls short — reserve it the way you'd reserve `effort: max`.

### Override-table rows (the two sanctioned escalation points)

When enabled, only these two agents may override *up* to Fable, and only for the hard-tail case above:

| Agent | Default Model | Override Up When |
|-------|--------------|------------------|
| codebase-analyzer | opus | Fable 5 only on a story Opus failed |
| prism-analyzer | opus | Fable 5 only on a story Opus failed |

Every other agent tops out at its listed default. Fable stays opt-in per dispatch — no row defaults to it.

### Cost-ratio line (for the Cost Impact section)

```
- Fable 5: ~40-50x (≈2.6× Opus: 2× per-token price × ~1.3× heavier tokenizer)
```

### Activation checklist (what to flip when ready)

1. In `model-selection.md`: replace the `🔒 RESERVED, NOT ENABLED` section with the unlocked "Use Fable 5 When" text above
2. Flip the two override-table rows from "Never (Opus is the ceiling)" → "Fable 5 only on a story Opus failed"
3. Remove the "Opus 4.8 is the hard ceiling for every dispatch" guard line under the table
4. Un-tag the cost-ratio line (drop "*reserved, not enabled*")
5. Complete Phase 1 (SDK `refusal` handler + `MODEL_IDS` entry) from this doc **first** — never unlock the docs before the code handles the `refusal` stop reason
