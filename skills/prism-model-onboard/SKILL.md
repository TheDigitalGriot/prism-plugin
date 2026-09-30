---
name: prism-model-onboard
description: Add a model to Arkestra — Prism's model-governance layer ("the Governor"). Use when Gavin says "onboard <model>", "add <model> to Arkestra/the Governor", "wire up <provider>'s models", "add the new Codex/Gemini/local roster", or when a provider ships a model line Prism should be able to route to. Web-verifies the model's facts TODAY (never from memory), places it on the right provider chain, and writes it into the roster + policy + docs. Refuses to write a model whose identifier, status or effort values have not been confirmed against a primary source this session.
model: opus
---

# Prism Model Onboard

Put a model into **Arkestra** — the model-governance layer. (Everyday name: "the Governor".
The old name "Model Control Plane" is retired; it collided with MCP = Model Context Protocol.)

> **Stuck Protocol:** a device/cloud tool returning empty/`[]`/"not connected"/403 is NOT
> "blocked". Retry 2-3x → switch surface → replay the logs → then ask ONE direct question.

## The Iron Law

**Never onboard a model from memory.** On 2026-09-06 a planning session's Codex roster was wrong
in five places — a "retiring" model had already retired, two effort values did not exist (they
were ChatGPT UI labels, rejected by the API), two retired ids were missing entirely, and a preview
model was assumed token-metered when it has no price at all. Every one would have been hard-coded
into routing. **The model line moves weekly. Your training data is stale by construction.**

## The walk

### 1. VERIFY — today, against primary sources

Dispatch **`web-search-researcher`** with the prior belief stated **as a hypothesis to attack**
(see `griot-harvest`'s [analyst-prompt](../griot-harvest/references/analyst-prompt.md) — same move).

Confirm for each model:

| field | why it bites |
|---|---|
| exact identifier | the string the CLI/API actually accepts |
| status | `default \| current \| preview \| legacy \| retired` |
| `retiredOn` | a **date**, so the check is a comparison — never a boolean that goes stale |
| effort values | the **lowercase API values**, never UI display labels |
| context / max output | truncation risk if wrong |
| pricing | `null` if genuinely not token-metered — **never estimate** |
| how effort is set | exact flag / config key / param |
| provider's own fallback | mirror it rather than inventing one |

> ⚠️ **`web-search-researcher` has NO Write tool.** It cannot save the doc. Have it return the
> content and write the file yourself, or the research evaporates.

Write to `.prism/shared/research/<date>-<provider>-model-roster.md` with a **Corrections** section
and a URL + retrieval date per claim. **If a fact cannot be confirmed, do not write the model.**

### 2. PLACE — decide the provider and the chain position

- `provider` — the Arkestra axis. Models are keyed `${provider}:${model}`.
- chain position — by capability, most-capable first.
- **the chain must never leave the provider.** A denied model steps down within its own
  provider or fails closed. Crossing providers means the wrong account is billed, or a local
  model escapes to the cloud.

### 3. WRITE — data, not logic

`packages/prism-core/src/core/api/model-roster.ts` — add a `RosterEntry`. That is usually the
**only** edit: `PROVIDER_CHAINS` is derived via `chainFor(provider)`, which filters retired
entries by date and sorts by status.

A genuinely new provider also needs its `PROVIDER_CHAINS` / `PROVIDER_FLOORS` entry in
`model-policy.ts`, plus the mirror in `apps/prism-mobile/.../agent/model-policy.ts`.

**Do NOT put non-Anthropic ids in `claude-sdk.ts` `MODEL_IDS`** — that is the Anthropic SDK's
alias table. Conflating the namespaces is how config drift starts.

### 4. GATE — three checks, all must pass

```bash
node scripts/verify-model-policy-conformance.mjs     # the 5 mirrored copies + the provider axis
npx vitest run src/core/api/__tests__/               # from apps/prism-vscode
node scripts/verify-invariants.mjs
```

Add a test that would have caught the failure — for a new provider, at minimum:
*a denied model of this provider never resolves to another provider's model.*

### 5. DOCUMENT

Update `skills/griot-agent-architect/references/model-config.md` when the **Claude** line moves.
Other providers live in the roster + their research doc; do not duplicate a fact into both.

## What "done" means

- [ ] every fact carries a URL + retrieval date from **this session**
- [ ] corrections to the prior belief stated loudly
- [ ] retired models present but marked, with `retiredOn` — so routing rejects rather than attempts
- [ ] effort values are the API set, not UI labels
- [ ] pricing `null` where not token-metered
- [ ] the chain never leaves its provider
- [ ] conformance gate green · tests green · a new test for the new failure mode

## Worked precedent

The OpenAI/Codex roster (`57d64c7`) is the reference: 10 entries, 5 corrections to the planning
assumptions, retirement by date, chain derived so a retired id cannot enter it, and 3 tests
including *"a denied Codex model downgrades WITHIN openai, never to Anthropic."*
