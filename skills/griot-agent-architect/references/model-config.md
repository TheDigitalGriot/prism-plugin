# Model Configuration (Claude Code, Current Model Line)

> Last updated September 2026. This is the Claude-Code-specific guidance that drifts fastest as new models ship. When in doubt, cross-check [platform.claude.com/docs/en/models/overview](https://platform.claude.com/docs/en/models/overview) and [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config) — the model line moves quarterly.

---

## Table of Contents

1. [Current Model Line](#1-current-model-line)
2. [Aliases vs Pinned IDs — The Rule Changed at 4.6](#2-aliases-vs-pinned-ids--the-rule-changed-at-46)
3. [Per-Provider Alias Resolution](#3-per-provider-alias-resolution)
4. [Effort Levels — Per-Model Capability](#4-effort-levels--per-model-capability)
5. [Fable 5.1 API Differences — Before You Adopt](#5-fable-51-api-differences--before-you-adopt)
6. [`ultrathink` — One-Off Deep Reasoning](#6-ultrathink--one-off-deep-reasoning)
7. [1M-Token Context](#7-1m-token-context)
8. [Minimum Claude Code Versions](#8-minimum-claude-code-versions)
9. [Currency Check Protocol](#9-currency-check-protocol)

---

## 1. Current Model Line

As of **September 2026**:

| Model | Full Model ID | Alias | Pricing (in / out per MTok) | Context | Max output | Effort levels |
|---|---|---|---|---|---|---|
| **Fable 5.1** | `claude-fable-5-1` | none — use pinned ID | $10 / $50 | 1M | 128K | low, medium, high (default), xhigh, max (see §5) |
| **Opus 5** | `claude-opus-5` | `opus`, `best` | $5 / $25 | 1M | 128K | low, medium, high (default), xhigh, max |
| **Opus 4.8** | `claude-opus-4-8` | `opus48` (explicit; legacy) | $5 / $25 | 1M | 128K | low, medium, high (default), xhigh, max |
| **Sonnet 5** | `claude-sonnet-5` | `sonnet` | **$2 / $10** | 1M | 128K | low, medium, high (default), xhigh, max |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | `haiku` (also `claude-haiku-4-5`) | $1 / $5 | 200K | 64K | none (effort not supported) |

> ⚠️ **Fable 5.1 — ENABLED, HITL-GATED.** It is reachable under the Max/Team Premium subscription, but never as a resting default: every use passes the human-in-the-loop gate (`.prism/local/fable.flag` + a confirm/deny modal, and the `fable-gate.sh` PreToolUse hook on Task dispatches), and nothing in routing auto-escalates to it. Opus 5 is the routine ceiling for standard Prism work. The SDK handles the `refusal` stop reason (§5, shipped). Read §5 before using — Fable's API surface differs from the Opus family, and it draws on a *capped weekly Max allowance* (≈2.6× Opus 5 if metered on the API).

**Fable 5.1** (`claude-fable-5-1`) is Anthropic's most capable widely released model, for the most demanding reasoning and long-horizon agentic work. It supersedes Fable 5 (`claude-fable-5`, now legacy). It has a different API surface from the Opus family — see [§5](#5-fable-51-api-differences--before-you-adopt) before adopting.

**Opus 5** (`claude-opus-5`) is the **routine ceiling** for standard Prism work. It became generally available **2026-07-24** and is the default model on Claude Max; Anthropic's own guidance is "start with Claude Opus 5 for most workloads." It matches Opus 4.8's $5 / $25 price with a 128K max-output ceiling on a 1M context window. Its API surface is Opus-family — **no Fable-style HITL gate** and no `opus5.flag`; the only add-on is a light effort guard: `effort: xhigh|max` triggers a **one-shot confirm** (§4), a per-call effort control, not a model-level gate.

**Sonnet 5** (`claude-sonnet-5`) replaces Sonnet 4.6 and is the only tier in this line that got **cheaper** — $2 / $10 vs 4.6's $3 / $15 (a 33% cut, now permanent; the scheduled Sept 1 2026 increase back to $3/$15 was cancelled). It also gains a native 1M context window and full effort support, neither of which 4.6 had.

**Opus 4.8** (`claude-opus-4-8`) is now **legacy**, kept explicitly reachable under the `opus48` key for A/B eval and reproducible pins. It is not a routing target.

> **Mythos 5.1** (`claude-mythos-5-1`) — API ID confirmed in Anthropic's [effort](https://platform.claude.com/docs/en/build-with-claude/effort) and [pricing](https://platform.claude.com/docs/en/about-claude/pricing) docs; identical to Fable 5.1 in capability, price, and API surface, with more permissive safeguards. **Available by invitation only under [Project Glasswing](https://anthropic.com/glasswing)** (vetted US cybersecurity / life-sciences organizations) — which is why it is absent from the public models-overview table. **NOT routable from Prism**: do not put it in agent/skill frontmatter, `MODEL_IDS`, or the model policy. Everything in §5 applies to it if access is ever granted. Legacy `claude-mythos-5` and `claude-mythos-preview` exist under the same program.

---

## 2. Aliases vs Pinned IDs — The Rule Changed at 4.6

| Before Claude 4.6 | From Claude 4.6 onward |
|---|---|
| Dateless IDs like `claude-opus-4-1` were **evergreen pointers** that resolved to a dated ID | Dateless IDs like `claude-opus-5` are **pinned snapshots** — the same string always refers to the same release |
| Aliases (`opus`, `sonnet`, `haiku`) rolled forward at each release | Aliases still roll forward — but the dateless IDs themselves are now also pinned |

Anthropic states it directly: *"A common misconception is that dateless model IDs such as `claude-sonnet-4-6` behave as evergreen pointers that route to the latest or best-performing version. That is not the case."*

**Practical impact:**

- Use `model: sonnet` / `model: opus` / `model: haiku` in agent/skill frontmatter when you want automatic updates to the latest model in that family. **This is the default for Prism's own agents — all 14 use aliases, zero pinned IDs.**
- Use `model: claude-opus-4-8` (the dateless pinned form) when you want to lock to a specific version — useful for reproducible eval runs, marketplace plugin pins, or freezing critical-path agents.
- For Haiku, the date suffix is still meaningful: `claude-haiku-4-5` is the alias that resolves to the dated `claude-haiku-4-5-20251001`. It is the **only** tier in the current line that still has real alias→snapshot indirection.

This change matters most for plugin authors. A plugin shipping `model: claude-opus-4-6` in 2025 used to drift forward automatically; today the same string is pinned to the 4.6 release. Update intentionally.

**The Opus 5 alias flip has LANDED.** `opus`/`best` now resolve to `claude-opus-5`. The parallel-key rollout period (during which `opus` stayed pinned to Opus 4.8 while Opus 5 rode a separate key for A/B eval) is over. Opus 4.8 remains reachable under the explicit `opus48` key so the A/B comparison is not lost.

**Namespace discipline — two different `opus`es.** Keep these straight; conflating them is how config drift starts:

| Namespace | Where | Keys |
|---|---|---|
| **Policy keys** — govern approval mode + the downgrade chain | `model-policy.ts`, `fable-gate.sh`, `statusline-model.sh`, mobile `model-policy.ts` | `fable5`, `opus5`, `opus48` — **no bare `opus`** |
| **SDK aliases** — map a friendly name to an API ID | `claude-sdk.ts` `MODEL_IDS` | `opus` (→ Opus 5), `opus5`, `opus48`, `sonnet`, `haiku`, `fable` |

The bare `opus` survives only as a *user-facing SDK alias* (agent frontmatter depends on it). In the policy namespace it was renamed to `opus48` so a policy key never silently means "whichever Opus is current."

---

## 3. Per-Provider Alias Resolution

Aliases resolve differently per provider — the same `model: opus` may run a different model depending on where Claude Code is connecting:

| Provider | `opus` resolves to | `sonnet` resolves to | Fable |
|---|---|---|---|
| Anthropic API (direct) | Opus 5 | Sonnet 5 | none — use `claude-fable-5-1` |
| Claude Platform on AWS | *(Opus 5 not listed on this platform — pin explicitly)* | Sonnet 5 | `claude-fable-5-1` |
| Amazon Bedrock | `anthropic.claude-opus-5` | `anthropic.claude-sonnet-5` | `anthropic.claude-fable-5-1` |
| Google Cloud / Microsoft Foundry | `claude-opus-5` | `claude-sonnet-5` | `claude-fable-5-1` |

**Fable 5.1 has no alias** — always use the full pinned ID `claude-fable-5-1` in agent/skill frontmatter.

**If you ship plugins to third-party providers**, set the env vars rather than rely on alias resolution:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-5'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-5'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5-20251001'
```

For Bedrock specifically, use the provider-prefixed form: `us.anthropic.claude-opus-5`. Note that Bedrock dropped the `-v1` suffix starting with Sonnet 4.6 — Opus 4.6 (`anthropic.claude-opus-4-6-v1`) was the last ID to carry it.

---

## 4. Effort Levels — Per-Model Capability

The `effort` field in agent or skill frontmatter controls adaptive reasoning. Higher effort = deeper thinking = more tokens spent. Models 4.6+ use adaptive reasoning by default (no fixed thinking budget).

| Model | Supported effort levels |
|---|---|
| **Fable 5.1**, Mythos 5.1 | `low`, `medium`, `high`, `xhigh`, `max` — via `output_config.effort` API param (see §5) |
| **Opus 5** | `low`, `medium`, `high`, `xhigh`, `max` — via frontmatter `effort` (`xhigh`/`max` trigger a one-shot confirm — see below) |
| **Sonnet 5** | `low`, `medium`, `high`, `xhigh`, `max` — **`xhigh` is new in Sonnet 5**; 4.6 lacked it |
| Opus 4.8, Opus 4.7 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 4.6, Sonnet 4.6 | `low`, `medium`, `high`, `max` — **no `xhigh`** |
| **Haiku 4.5** / earlier | **none** — effort is not supported |

**Defaults:** every effort-supporting model in the current line defaults to `high`. (`high` is exactly equivalent to omitting the parameter.)

> ⚠️ **`high` is NOT comparable across models.** Anthropic states the token allocation behind each effort level changed between generations: *"Run a fresh effort sweep on your own evals rather than reusing them."* Do not assume Opus 5 `high` costs what Opus 4.8 `high` cost. Re-measure; never port an effort setting between tiers on faith.

If you set a level the active model doesn't support, Claude Code falls through to the highest supported level at or below it. Example: `xhigh` runs as `high` on Opus 4.6 and Sonnet 4.6.

**Opus 5 effort posture (cost discipline).** Anthropic's recommended starting point dropped from `xhigh` (the Opus 4.7/4.8 guidance) to **`high`, with `low` and `medium` used "liberally as your primary control for token cost and response time."** Opus 5's `low`/`medium` reach what took `high`/`xhigh` on prior Opus tiers, so the cheaper way to save spend is to **lower the effort dial, not disable thinking or route to a weaker tier**.

> ⚠️ **Effort no longer controls response length on Opus 5.** *"Effort controls thinking volume, not visible response length: on Claude Opus 5, changing effort does not reliably shorten responses, so prompt for length instead."* On Opus 4.8 the effort dial did more of this work. On Opus 5 you need **two levers**: `effort` for thinking tokens, and an explicit concision/length instruction for visible output. Budgeting with effort alone will under-predict cost.

**Thinking is on by default on Opus 5 — a real cost change.** On Opus 4.8, a request that omitted the `thinking` parameter ran *without* thinking. On Opus 5 the same request runs with adaptive thinking **on**. Thinking tokens bill as output tokens *and* count against `max_tokens`. Any workload that previously ran thinking-off will produce more output tokens per request at the same per-token rate — and can **truncate** if `max_tokens` was tuned for a no-thinking baseline. Re-baseline `max_tokens` before flipping a workload to Opus 5. (Opus 4.8 and Opus 5 share the same tokenizer, so there is **no** tokenizer differential between them — any delta is behavioral.)

**`effort: xhigh|max` one-shot confirm (Opus 5 visibility add-on).** On Opus 5, requesting `xhigh` or `max` triggers a **one-shot confirm** — a per-call effort guard, categorically different from Fable's model-level HITL gate (there is **no** Fable-style gate on Opus 5, and no `opus5.flag`). The confirm is an **app-surface control**: it is **headless-aware** — in non-interactive runs it auto-resolves via the `resolve-answer.mjs` pattern rather than blocking — and it **always emits a visibility event** to the file bus so the escalation is legible on the Cowork/headless surface (never silent).

On Opus 5, thinking cannot be disabled at `xhigh` or `max`: a request setting `thinking: {"type": "disabled"}` at those levels returns a 400.

**Usage in plugin agent/skill frontmatter (Opus-tier):**

```yaml
---
name: my-deep-reasoner
model: opus
effort: xhigh
---
```

**Usage with Fable 5.1** (gated escalation — see §1; reached via the HITL gate, not set as a resting default) — `effort` frontmatter maps to `output_config.effort` automatically with `model: claude-fable-5-1`:

```yaml
---
name: my-critical-agent
model: claude-fable-5-1   # gated escalation only — never a resting default
effort: xhigh
---
```

**`max` caveat:** session-only for all models. It can't be set persistently through `effortLevel` in settings. Use for one-shot critical work, not as a default.

**`ultracode` (Claude Code only, not in agent frontmatter):** beyond effort levels. Sets `xhigh` per-message PLUS triggers an orchestrated dynamic workflow for substantive tasks. Set via `/effort` interactively or `"ultracode": true` in an Agent SDK control request. Session-only.

---

## 5. Fable 5.1 API Differences — Before You Adopt

> ✅ **ENABLED, HITL-GATED** (see §1). The `refusal` handler has shipped (`apps/prism-vscode/src/core/api/claude-sdk.ts`), so this section describes the live API surface to respect when Fable runs — not a future spec. Fable is still reached only through the gate, never as a resting default.

Fable 5.1 and Mythos 5.1 share a different API surface from the Opus family. These will cause errors or silent failures if you drop `claude-fable-5-1` into existing agent/skill infrastructure without code changes.

### Thinking is always on — omit the `thinking` parameter

| What you send | Opus 5 | Fable 5.1 |
|---|---|---|
| Omit `thinking` | Works (adaptive thinking ON) | Works (adaptive thinking on) |
| `{type: "adaptive"}` | Works | Works |
| `{type: "disabled"}` | Works — **except** at `xhigh`/`max` (400) | **400 error** |
| `{type: "enabled", budget_tokens: N}` | 400 (deprecated after 4.6) | **400 error** |

Don't pass `thinking` at all when targeting Fable 5.1. Control depth with `effort` (frontmatter) or `output_config.effort` (API) — not with `thinking`.

### `refusal` stop reason — check before reading content

Safety classifiers may decline a request: **HTTP 200**, `stop_reason: "refusal"`, empty `content` array. A pre-output refusal is not billed. A mid-stream refusal bills already-streamed output — discard the partial.

```
if stop_reason === "refusal":
    # content is empty or partial — do not use it
    # retry with rephrased prompt or fall back to Opus 5
```

Any SDK wrapper that reads `content` without checking `stop_reason` first will silently receive an empty or partial response with no error. **Always check `stop_reason` before reading `content`.**

> SDK type note: many SDK versions still don't include `"refusal"` in the `stop_reason` union type — it was added with Fable 5. Cast to `string` for the comparison to avoid TypeScript narrowing errors.

### Tokenizer — already the current one

Fable 5.1 uses the same newer tokenizer as all Claude 4.7+ models (~30% more tokens for the same text than the pre-4.7 tokenizer). Since Opus 5 and Sonnet 5 are also on it, there is **no tokenizer differential between Fable 5.1 and the rest of the current line** — the cost delta is price ($10/$50 vs $5/$25) and thinking volume, not encoding. Historical cost estimates calibrated against Sonnet 4.6 or earlier are still ~30% low on token count.

### Cheap cache reads — a real optimization

Cache hits on Fable 5.1 and Mythos 5.1 cost **0.025×** base input ($0.25/MTok), not the standard 0.1×. Cache writes are unchanged (1.25× for 5m, 2× for 1h). Long, stable system prefixes are therefore disproportionately cheap to re-read on Fable — worth structuring prompts around when a gated Fable run is justified.

### Per-message effort changes (beta)

Fable 5.1, Mythos 5.1, and Opus 5 support changing effort mid-conversation via a `role: "system"` message carrying `output_config.effort`, **preserving the prompt cache**. Requires the beta header `mid-conversation-output-config-2026-07-01`. Fable 5 (non-.1) does *not* support this and returns a 400.

### 30-day data retention (factual note)

Fable 5.1 and Mythos 5.1 are "Covered Models": they require 30-day retention and are not available under a zero-data-retention (ZDR) agreement — a ZDR org gets `400 invalid_request_error`. Not a concern for Prism's own usage (no production data or PII flows to the model); noted here only as a factual API constraint.

### No assistant prefill

Same as the rest of the 4.6+ family — can't pass an assistant message as the last conversation turn to steer output format.

### Sampling parameters rejected

`temperature`, `top_p`, and `top_k` all return 400 on Fable 5.1. Don't pass them when targeting this model.

---

## 6. `ultrathink` — One-Off Deep Reasoning

Include the literal keyword `ultrathink` anywhere in a prompt, and Claude Code adds an in-context instruction for deeper reasoning on that single turn. Doesn't change session-level effort. Doesn't persist across messages.

Cheap pattern: weave `ultrathink` into the prompt body of specific skill files where one hard turn of reasoning matters more than steady-state effort:

```markdown
# In skill body:
For this brainstorm, ultrathink the problem space and surface assumptions
that aren't being questioned yet.
```

Other phrases (`think`, `think hard`, `think more`) are passed through as ordinary prompt text and are **not** recognized as keywords. Only `ultrathink` is the trigger.

---

## 7. 1M-Token Context

**Every model in the current line except Haiku 4.5 has a native 1M-token context window** — Fable 5.1, Opus 5, Opus 4.8, and Sonnet 5 all ship 1M by default. Haiku 4.5 remains 200K.

This makes the `[1m]` suffix a **no-op for the current line**. It remains meaningful only when pinning an older model that gated 1M behind it:

```yaml
model: opus[1m]              # no-op on Opus 5 — already 1M
model: claude-sonnet-4-6[1m] # meaningful: 4.6 gated 1M behind the suffix
```

**When the large window matters:**

- Long autonomous runs that need to keep a large state file in context (autoresearch-style multi-cycle execution)
- Multi-document analysis where the docs themselves total 200K+ tokens
- Compaction-survival-sensitive workflows where holding the full history is safer than risking a summary

**Availability and cost:**

| Plan | 1M context |
|---|---|
| Max / Team / Enterprise | Included |
| Pro | Requires usage credits |
| API / pay-as-you-go | Full access, standard pricing |

1M context uses standard model pricing — no premium per token beyond 200K. A 900k-token request bills at the same per-token rate as a 9k-token request. Disable globally with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`.

Note the practical unit change: on the current tokenizer, 1M tokens ≈ 555k words (models before Opus 4.7 fit ~750k words in 1M tokens). The window grew, but so did the tokens-per-word — budget by measurement, not by the old word-count intuition.

---

## 8. Minimum Claude Code Versions

| Feature | Minimum Claude Code |
|---|---|
| **Fable 5.1** (`claude-fable-5-1`) access | **v2.1.257** |
| **Opus 5** (`claude-opus-5`) access | **v2.1.219** |
| **Sonnet 5** (`claude-sonnet-5`) access | **v2.1.197** |
| Fable 5 (legacy) access | v2.1.173 |
| Opus 4.8 access | v2.1.154 |
| `xhigh` effort level | v2.1.111 |
| Session-only effort (`/effort s`) | v2.1.257 |
| `/model` saves default | v2.1.153 |
| Deterministic subagent caps (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`) | v2.1.217 |
| Haiku 4.5 access | *not documented in any changelog entry — treat as long-supported* |
| `effort: max` (bare) | *not documented; it predates `xhigh` — do **not** cite v2.1.111 as its minimum* |

**Deterministic subagent caps.** `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` and `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` bound how many subagents a run spawns at once and how deep the spawn tree goes, making fan-out reproducible run-to-run. Set them in the launcher env (Prism pins them in `scripts/spectrum.sh`, defaults `3` / `2`). They require **Claude Code ≥ 2.1.217**; older versions ignore the vars harmlessly. Pair the caps with the effort posture in §4 rather than leaving concurrency unbounded.

Run `claude update` before relying on the newest model. If you're shipping a plugin that targets Fable 5.1, document **v2.1.257** as the minimum in your README.

---

## 9. Currency Check Protocol

When auditing a plugin against the current model line:

1. **Grep for pinned IDs** in runtime code:
   ```bash
   grep -rE 'claude-(opus|sonnet|haiku|fable|mythos)-[0-9a-z-]+' . --include='*.ts' --include='*.js' --include='*.json' --include='*.md'
   ```
   Superseded IDs to flag: `claude-opus-4-8` (outside a deliberate `opus48` pin), `claude-sonnet-4-6`, `claude-fable-5` (without the `-1`), `claude-mythos-5`, `claude-mythos-preview`.
2. **Check the alias defaults** by reading any provider-specific env-var pins (`ANTHROPIC_DEFAULT_*_MODEL`).
3. **Confirm current model line** against [platform.claude.com](https://platform.claude.com/docs/en/models/overview) — don't trust this file's table alone; it ages.
4. **Verify Claude Code version** with `claude --version` against the §8 table if any agent uses `effort: xhigh`, `effort: max`, or `model: claude-fable-5-1` (requires v2.1.257+).
5. **Skill/agent frontmatter using aliases** (`model: sonnet`) — usually fine, auto-updates. Skill/agent frontmatter using pinned IDs (`model: claude-opus-4-6`, `model: claude-fable-5-1`) — audit each one.
6. **Any Fable 5.1 usage** — verify `stop_reason` is checked before reading `content`; confirm account retention policy allows Covered Models; re-baseline `max_tokens` and cost estimates with `count_tokens`.
7. **Prefix-match check on the gate.** `fable-gate.sh` must match Fable IDs by **prefix**, not exact string. An exact `claude-fable-5` match silently fails to gate `claude-fable-5-1`, letting a premium model dispatch ungated. Re-verify this whenever a point release ships.
8. **Policy-key vs SDK-alias namespaces** (§2) — confirm no bare `opus` key has crept back into the policy namespace.

Historical pins in `.prism/shared/docs/`, `.prism/shared/research/`, or `.prism/shared/evals/` style notes are time capsules — leave them alone unless the user asks. Research docs date themselves intentionally.

---

## Cross-References

- [token-optimization-research.md](./token-optimization-research.md) — full theory for picking the lowest-effort model that does the job
- [folder-architecture-routing.md](./folder-architecture-routing.md) — cheap-context-first principle (Cliefnotes routing-table pattern)
- [component-patterns.md](./component-patterns.md) — agent / skill / command frontmatter rules
- [manifest-reference.md](./manifest-reference.md) — plugin.json and marketplace.json schema, including the dateless-snapshot rule for marketplace pins
- [statusline-model.md](./statusline-model.md) — surfacing the active model + its policy mode in the statusline

---

*Sources: [platform.claude.com — Models overview](https://platform.claude.com/docs/en/models/overview), [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions), [Migrating to Claude Opus 5](https://platform.claude.com/docs/en/models/opus-5/migration-guide), and Claude Code release tags v2.1.197 / v2.1.219 / v2.1.257. Retrieved 2026-09-02.*
