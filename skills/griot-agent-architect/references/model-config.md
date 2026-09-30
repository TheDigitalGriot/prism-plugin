# Model Configuration (Claude Code, Current Model Line)

> Last updated 2026-09-30 (Opus 5.5 / Sonnet 5.5 delta pass; see `.prism/shared/research/2026-09-30-claude-codex-model-roster.md` for full sourcing). This is the Claude-Code-specific guidance that drifts fastest as new models ship. When in doubt, cross-check [platform.claude.com/docs/en/models/overview](https://platform.claude.com/docs/en/models/overview) and [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config) — the model line moves quarterly.

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

As of **2026-09-30**:

| Model | Full Model ID | Alias | Pricing (in / out per MTok) | Context | Max output | Effort levels |
|---|---|---|---|---|---|---|
| **Fable 5.1** | `claude-fable-5-1` | none — use pinned ID | $10 / $50 | 1M | 128K | low, medium, high (default), xhigh, max (see §5) |
| **Opus 5.5** | `claude-opus-5-5` | `opus`, `best` | $4 / $20 | 1M | 128K (300K on Batch API) | low, **medium (default)**, high, xhigh, max |
| **Opus 5** | `claude-opus-5` | `opus5` (explicit; legacy pin) | $5 / $25 | 1M | 128K | low, medium, high (default), xhigh, max |
| **Opus 4.8** | `claude-opus-4-8` | `opus48` (explicit; legacy pin) | $5 / $25 | 1M | 128K | low, medium, high (default), xhigh, max |
| **Sonnet 5.5** | `claude-sonnet-5-5` | `sonnet` | $2 / $10 | 1M | 128K (300K on Batch API) | low, medium, high (default), xhigh, max |
| **Sonnet 5** | `claude-sonnet-5` | `sonnet5` (explicit; legacy pin) | $2 / $10 | 1M | 128K | low, medium, high (default), xhigh, max |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | `haiku` (also `claude-haiku-4-5`) | $1 / $5 | 200K | 64K | none (effort not supported) |

Cache-read pricing diverges between the two 5.5 models: Opus 5.5 reads cache at **$0.20/MTok, 5% of input** — a special lower rate vs. the standard 10%; Sonnet 5.5 reads cache at $0.20/MTok too, but that's the *standard* 10% of its lower $2 input price. Cache-write pricing: Opus 5.5 $5/MTok (5m) / $8/MTok (1h); Sonnet 5.5 $2.50/MTok (5m) / $4/MTok (1h).

> ⚠️ **Fable 5.1 — ENABLED, HITL-GATED.** It is reachable under the Max/Team Premium subscription, but never as a resting default: every use passes the human-in-the-loop gate (`.prism/local/fable.flag` + a confirm/deny modal, and the `fable-gate.sh` PreToolUse hook on Task dispatches), and nothing in routing auto-escalates to it. Opus 5.5 is the routine ceiling for standard Prism work. The SDK handles the `refusal` stop reason (§5, shipped). Read §5 before using — Fable's API surface differs from the Opus family, and it draws on a *capped weekly Max allowance* (~2.5× Opus 5.5 on list price if metered on the API — $10/$50 vs $4/$20; the effective/thinking-token multiplier behind the prior "≈2.6× Opus 5" figure was not re-derived for the 5.5 line).

**Fable 5.1** (`claude-fable-5-1`) is Anthropic's most capable widely released model, for the most demanding reasoning and long-horizon agentic work. It supersedes Fable 5 (`claude-fable-5`, now legacy). It has a different API surface from the Opus family — see [§5](#5-fable-51-api-differences--before-you-adopt) before adopting.

**Opus 5.5** (`claude-opus-5-5`) is the **routine ceiling** for standard Prism work as of Claude Code v2.1.280+. Released 2026-09-22. Its default effort is **`medium`**, not `high` — a genuine, verified asymmetry (every other current-tier model defaults to `high`); Anthropic's docs confirm this on the model's own page, not the general catalog. Thinking on Opus 5.5 **cannot be disabled at all** (a step past Opus 5, which could still disable it outside `xhigh`/`max`) — every request now runs with adaptive thinking, so `max_tokens` budgets tuned for a no-thinking baseline can truncate. Breaking changes vs. Opus 5: forced tool use now returns an error instead of being silently allowed; thinking blocks are tied to the model+conversation that produced them; the `computer_20251124` computer-use tool version is no longer accepted.

**Opus 5** (`claude-opus-5`) is now **legacy** — superseded by Opus 5.5 as the routine ceiling on 2026-09-22, kept explicitly reachable under the `opus5` key for reproducible runs and eval comparisons. It became generally available 2026-07-24 and was the routine ceiling until the 5.5 flip. It matches Opus 4.8's $5 / $25 price with a 128K max-output ceiling on a 1M context window. Its API surface is Opus-family — **no Fable-style HITL gate** and no `opus5.flag`; the only add-on was a light effort guard: `effort: xhigh|max` triggers a **one-shot confirm** (§4), a per-call effort control, not a model-level gate.

**Sonnet 5.5** (`claude-sonnet-5-5`) is the **default Sonnet tier** as of Claude Code v2.1.284+, replacing Sonnet 5 on 2026-09-28. Same $2 / $10 price as Sonnet 5 — the cost improvement Anthropic reports for 5.5 comes from fewer tool calls and faster completions per task, not a lower sticker price. It runs adaptive thinking by default like Opus 5.5, but exposes a new `between_tools` setting that can turn off up-front thinking (at `high` effort or below) for a streaming consumer that wants quiet gaps between tool calls. Breaking change vs. Sonnet 5: the advisor tool now rejects Opus 4.8, Opus 4.7, and Sonnet 5 as advisor pairings.

**Sonnet 5** (`claude-sonnet-5`) is now **legacy** — kept explicitly reachable under the `sonnet5` key. It replaced Sonnet 4.6 and was the only tier in that generation that got **cheaper** — $2 / $10 vs 4.6's $3 / $15 (a 33% cut, now permanent). It also gained a native 1M context window and full effort support, neither of which 4.6 had.

**Opus 4.8** (`claude-opus-4-8`) is **legacy**, kept explicitly reachable under the `opus48` key for A/B eval and reproducible pins. It is not a routing target.

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

**The generation-pin convention.** This is the pattern the Opus line established and the one every later tier follows: a **numbered** policy key / SDK alias (`opus48`, `opus5`, `opus55`) is a **permanent pin** to that exact generation — it is never reassigned when a newer one ships. Only the **bare** routing name (`opus`, `sonnet`) tracks "whichever is current." So `opus5` will keep meaning Opus 5 forever, the same way `opus48` still means Opus 4.8 today; it is `opus` (bare) that moved.

**The Opus 5 alias flip landed 2026-07-24; the Opus 5.5 alias flip landed 2026-09-22 (Claude Code v2.1.280+).** `opus`/`best` now resolve to `claude-opus-5-5`. Opus 5 remains reachable under the explicit `opus5` key (never reassigned — see the pin convention above), and Opus 4.8 remains reachable under `opus48`, so neither A/B comparison is lost. The same shape happened on the Sonnet side: **the Sonnet 5.5 alias flip landed 2026-09-28 (Claude Code v2.1.284+).** `sonnet` now resolves to `claude-sonnet-5-5`; Sonnet 5 remains reachable under the explicit `sonnet5` key.

**Namespace discipline — two different `opus`es (and now two `sonnet`s).** Keep these straight; conflating them is how config drift starts:

| Namespace | Where | Keys |
|---|---|---|
| **Policy keys** — govern approval mode + the downgrade chain | `model-policy.ts`, `fable-gate.sh`, `statusline-model.sh`, mobile `model-policy.ts` | `fable5`, `opus55`, `opus5`, `opus48` — **no bare `opus`** (the downgrade chain, in order: `fable5 → opus55 → opus5 → opus48`) |
| **SDK aliases** — map a friendly name to an API ID | `claude-sdk.ts` `MODEL_IDS` | `opus` (→ Opus 5.5), `opus55` (→ Opus 5.5, explicit pin), `opus5`, `opus48`, `sonnet` (→ Sonnet 5.5), `sonnet5`, `haiku`, `fable` |

The bare `opus` and bare `sonnet` survive only as *user-facing SDK aliases* (agent frontmatter depends on them tracking "current"). In the policy namespace, the current ceiling is always addressed by its numbered pin (`opus55`) so a policy key never silently means "whichever Opus is current" — that ambiguity is exactly what the `opus` → `opus48` rename solved the first time this pattern appeared, and `opus55` now carries it forward. Sonnet has no separate policy/downgrade-chain namespace today (only the Opus line is HITL-gated and chain-governed), so `sonnet`/`sonnet5` exist only as SDK aliases.

---

## 3. Per-Provider Alias Resolution

Aliases resolve differently per provider — the same `model: opus` may run a different model depending on where Claude Code is connecting:

| Provider | `opus` resolves to | `sonnet` resolves to | Fable |
|---|---|---|---|
| Anthropic API (direct) | Opus 5.5 (`claude-opus-5-5`) | Sonnet 5.5 (`claude-sonnet-5-5`) | none — use `claude-fable-5-1` |
| Claude Platform on AWS | *(pin explicitly — confirm listing before relying on the alias)* | Sonnet 5.5 | `claude-fable-5-1` |
| Amazon Bedrock | `anthropic.claude-opus-5-5` | `anthropic.claude-sonnet-5-5` | `anthropic.claude-fable-5-1` |
| Google Cloud / Microsoft Foundry | `claude-opus-5-5` | `claude-sonnet-5-5` | `claude-fable-5-1` |

Every provider surfaces the same bare, dateless ids for the 5.5 line (`claude-opus-5-5` / `claude-sonnet-5-5`) — Anthropic's own docs for both models list only that one id on every platform, with no alternate dated variant shown anywhere (checked 2026-09-30). This differs from Haiku's alias→dated-snapshot indirection; see §2.

**Fable 5.1 has no alias** — always use the full pinned ID `claude-fable-5-1` in agent/skill frontmatter.

**If you ship plugins to third-party providers**, set the env vars rather than rely on alias resolution:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-5-5'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-5-5'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5-20251001'
```

For Bedrock specifically, use the provider-prefixed form: `us.anthropic.claude-opus-5-5`. Note that Bedrock dropped the `-v1` suffix starting with Sonnet 4.6 — Opus 4.6 (`anthropic.claude-opus-4-6-v1`) was the last ID to carry it.

---

## 4. Effort Levels — Per-Model Capability

The `effort` field in agent or skill frontmatter controls adaptive reasoning. Higher effort = deeper thinking = more tokens spent. Models 4.6+ use adaptive reasoning by default (no fixed thinking budget).

| Model | Supported effort levels |
|---|---|
| **Fable 5.1**, Mythos 5.1 | `low`, `medium`, `high`, `xhigh`, `max` — via `output_config.effort` API param (see §5) |
| **Opus 5.5** | `low`, `medium` (**default — the exception**), `high`, `xhigh`, `max` — via frontmatter `effort` (`xhigh`/`max` trigger a one-shot confirm — see below); thinking cannot be disabled at any level |
| **Opus 5** | `low`, `medium`, `high`, `xhigh`, `max` — via frontmatter `effort` (`xhigh`/`max` trigger a one-shot confirm — see below) |
| **Sonnet 5.5** | `low`, `medium`, `high`, `xhigh`, `max` — adaptive thinking by default, with a `between_tools` opt-out at `high` or below |
| **Sonnet 5** | `low`, `medium`, `high`, `xhigh`, `max` — **`xhigh` is new in Sonnet 5**; 4.6 lacked it |
| Opus 4.8, Opus 4.7 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 4.6, Sonnet 4.6 | `low`, `medium`, `high`, `max` — **no `xhigh`** |
| **Haiku 4.5** / earlier | **none** — effort is not supported |

**Defaults:** every effort-supporting model in the current line defaults to `high` **except Opus 5.5, which defaults to `medium`.** This is verified against Opus 5.5's own model page (2026-09-30), not inferred — it is a real, documented asymmetry and not an oversight to normalize away. (`high` is exactly equivalent to omitting the parameter on every other tier; on Opus 5.5, omitting it gets you `medium`.)

> ⚠️ **`high` is NOT comparable across models.** Anthropic states the token allocation behind each effort level changed between generations: *"Run a fresh effort sweep on your own evals rather than reusing them."* Do not assume Opus 5.5 `high` costs what Opus 5 `high` cost, or that either costs what Opus 4.8 `high` cost. Re-measure; never port an effort setting between tiers on faith.

If you set a level the active model doesn't support, Claude Code falls through to the highest supported level at or below it. Example: `xhigh` runs as `high` on Opus 4.6 and Sonnet 4.6.

**Opus-line effort posture (cost discipline).** Anthropic's recommended starting point dropped from `xhigh` (the Opus 4.7/4.8 guidance) to **`high` on Opus 5, and to `medium` as the shipped default on Opus 5.5**, with `low`/`medium` used "liberally as your primary control for token cost and response time." The Opus 5.5 default already sits where Opus 5 needed an explicit dial-down, so the cheaper way to save further spend is still to **lower the effort dial, not disable thinking (impossible on 5.5 regardless) or route to a weaker tier**.

> ⚠️ **Effort no longer controls response length on the Opus line.** *"Effort controls thinking volume, not visible response length: on Claude Opus 5, changing effort does not reliably shorten responses, so prompt for length instead."* This carries forward to Opus 5.5. On Opus 4.8 the effort dial did more of this work. On Opus 5.5 you need **two levers**: `effort` for thinking tokens, and an explicit concision/length instruction for visible output. Budgeting with effort alone will under-predict cost.

**Thinking defaults and disable rules, by generation.** On Opus 4.8, a request that omitted the `thinking` parameter ran *without* thinking. On Opus 5, the same request ran with adaptive thinking **on**, but thinking could still be explicitly disabled outside `xhigh`/`max`. **On Opus 5.5, thinking cannot be disabled at all, at any effort level** — a request setting `thinking: {"type": "disabled"}` now returns an error unconditionally, not just at `xhigh`/`max`. Sonnet 5.5 also defaults to adaptive thinking on, but is less strict: it exposes a `between_tools` setting that turns off up-front thinking at `high` effort or below. In every case, thinking tokens bill as output tokens *and* count against `max_tokens` — a workload tuned for a no-thinking baseline can **truncate**, not merely cost more, on any current-tier Opus or Sonnet model. Re-baseline `max_tokens` before flipping a workload onto the 5.5 line. Opus 4.8 and Opus 5 are confirmed to share the same tokenizer (§5's Fable comparison); whether Opus 5.5 / Sonnet 5.5 also share it was **not independently re-verified** in the 2026-09-30 delta pass — don't assume parity without checking, per the Iron Law.

**`effort: xhigh|max` one-shot confirm (Opus visibility add-on).** On the current Opus ceiling, requesting `xhigh` or `max` triggers a **one-shot confirm** — a per-call effort guard, categorically different from Fable's model-level HITL gate (there is **no** Fable-style gate on Opus 5.5 or Opus 5, and no `opus55.flag`/`opus5.flag`). The confirm is an **app-surface control**: it is **headless-aware** — in non-interactive runs it auto-resolves via the `resolve-answer.mjs` pattern rather than blocking — and it **always emits a visibility event** to the file bus so the escalation is legible on the Cowork/headless surface (never silent).

On Opus 5, thinking could not be disabled at `xhigh` or `max` specifically (a request setting `thinking: {"type": "disabled"}` at those levels returned a 400); on Opus 5.5 that restriction now applies unconditionally, at every effort level (see above).

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

| What you send | Opus 5.5 | Opus 5 | Fable 5.1 |
|---|---|---|---|
| Omit `thinking` | Works (adaptive thinking ON, unconditionally) | Works (adaptive thinking ON) | Works (adaptive thinking on) |
| `{type: "adaptive"}` | Works | Works | Works |
| `{type: "disabled"}` | **400 error, at every effort level** | Works — **except** at `xhigh`/`max` (400) | **400 error** |
| `{type: "enabled", budget_tokens: N}` | 400 (deprecated after 4.6) | 400 (deprecated after 4.6) | **400 error** |

Don't pass `thinking` at all when targeting Opus 5.5 or Fable 5.1 — both now reject an explicit disable unconditionally. Control depth with `effort` (frontmatter) or `output_config.effort` (API) — not with `thinking`.

### `refusal` stop reason — check before reading content

Safety classifiers may decline a request: **HTTP 200**, `stop_reason: "refusal"`, empty `content` array. A pre-output refusal is not billed. A mid-stream refusal bills already-streamed output — discard the partial.

```
if stop_reason === "refusal":
    # content is empty or partial — do not use it
    # retry with rephrased prompt or fall back to Opus 5.5
```

Any SDK wrapper that reads `content` without checking `stop_reason` first will silently receive an empty or partial response with no error. **Always check `stop_reason` before reading `content`.**

> SDK type note: many SDK versions still don't include `"refusal"` in the `stop_reason` union type — it was added with Fable 5. Cast to `string` for the comparison to avoid TypeScript narrowing errors.

### Tokenizer — already the current one

Fable 5.1 uses the same newer tokenizer as all Claude 4.7+ models (~30% more tokens for the same text than the pre-4.7 tokenizer). Opus 5 and Sonnet 5 are confirmed on it too, so there is **no tokenizer differential between Fable 5.1 and those tiers** — the cost delta is price ($10/$50 vs $5/$25) and thinking volume, not encoding. Historical cost estimates calibrated against Sonnet 4.6 or earlier are still ~30% low on token count. (Opus 5.5 / Sonnet 5.5 tokenizer parity with this family was not independently re-verified in the 2026-09-30 delta pass — see the note in §4.)

### Cheap cache reads — a real optimization

Cache hits on Fable 5.1 and Mythos 5.1 cost **0.025×** base input ($0.25/MTok), not the standard 0.1×. Cache writes are unchanged (1.25× for 5m, 2× for 1h). Long, stable system prefixes are therefore disproportionately cheap to re-read on Fable — worth structuring prompts around when a gated Fable run is justified.

### Per-message effort changes (beta)

Fable 5.1, Mythos 5.1, and Opus 5 support changing effort mid-conversation via a `role: "system"` message carrying `output_config.effort`, **preserving the prompt cache**. Requires the beta header `mid-conversation-output-config-2026-07-01`. Fable 5 (non-.1) does *not* support this and returns a 400. Whether Opus 5.5 / Sonnet 5.5 carry this feature forward was not checked in the 2026-09-30 delta pass — verify before relying on it for either.

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

**Every model in the current line except Haiku 4.5 has a native 1M-token context window** — Fable 5.1, Opus 5.5, Opus 5, Opus 4.8, Sonnet 5.5, and Sonnet 5 all ship 1M by default. Haiku 4.5 remains 200K. Opus 5.5 and Sonnet 5.5 additionally support a **300K max output** on the Batch API (beta header `output-300k-2026-03-24`), up from the standard 128K sync ceiling.

This makes the `[1m]` suffix a **no-op for the current line**. It remains meaningful only when pinning an older model that gated 1M behind it:

```yaml
model: opus[1m]              # no-op on Opus 5.5 — already 1M
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
| **Sonnet 5.5** (`claude-sonnet-5-5`) default | **v2.1.284** |
| **Opus 5.5** (`claude-opus-5-5`) default | **v2.1.280** |
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

Run `claude update` before relying on the newest model. If you're shipping a plugin that targets Fable 5.1, document **v2.1.257** as the minimum in your README; for Opus 5.5, **v2.1.280**; for Sonnet 5.5, **v2.1.284**.

---

## 9. Currency Check Protocol

When auditing a plugin against the current model line:

1. **Grep for pinned IDs** in runtime code:
   ```bash
   grep -rE 'claude-(opus|sonnet|haiku|fable|mythos)-[0-9a-z-]+' . --include='*.ts' --include='*.js' --include='*.json' --include='*.md'
   ```
   Superseded IDs to flag: `claude-opus-5` (outside a deliberate `opus5` pin), `claude-opus-4-8` (outside a deliberate `opus48` pin), `claude-sonnet-5` (outside a deliberate `sonnet5` pin), `claude-sonnet-4-6`, `claude-fable-5` (without the `-1`), `claude-mythos-5`, `claude-mythos-preview`.
2. **Check the alias defaults** by reading any provider-specific env-var pins (`ANTHROPIC_DEFAULT_*_MODEL`) — confirm they point at the 5.5 line (`claude-opus-5-5` / `claude-sonnet-5-5`), not the superseded 5-generation ids.
3. **Confirm current model line** against [platform.claude.com](https://platform.claude.com/docs/en/models/overview) — don't trust this file's table alone; it ages.
4. **Verify Claude Code version** with `claude --version` against the §8 table if any agent uses `effort: xhigh`, `effort: max`, `model: claude-fable-5-1` (requires v2.1.257+), or relies on the bare `opus`/`sonnet` aliases resolving to the current 5.5 line (v2.1.280+ / v2.1.284+ — behavior on older versions is not verified here; don't assume a graceful fallback).
5. **Skill/agent frontmatter using aliases** (`model: sonnet`) — usually fine, auto-updates. Skill/agent frontmatter using pinned IDs (`model: claude-opus-4-6`, `model: claude-fable-5-1`) — audit each one.
6. **Any Fable 5.1 usage** — verify `stop_reason` is checked before reading `content`; confirm account retention policy allows Covered Models; re-baseline `max_tokens` and cost estimates with `count_tokens`.
7. **Prefix-match check on the gate.** `fable-gate.sh` must match Fable IDs by **prefix**, not exact string. An exact `claude-fable-5` match silently fails to gate `claude-fable-5-1`, letting a premium model dispatch ungated. Re-verify this whenever a point release ships.
8. **Policy-key vs SDK-alias namespaces** (§2) — confirm no bare `opus` key has crept back into the policy namespace, and that the downgrade chain (`fable5 → opus55 → opus5 → opus48`) is complete wherever it is mirrored (core `model-policy.ts`, the mobile mirror, `fable-gate.sh`, `statusline-model.sh`) — a mirror missing `opus55` will mis-key or silently no-op on any request for the current ceiling.

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

*2026-09-30 delta pass — Opus 5.5 / Sonnet 5.5: [Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview), [Sonnet 5.5 overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Sonnet 5 overview](https://platform.claude.com/docs/en/models/sonnet-5/overview) (comparison table), [Claude Code changelog](https://code.claude.com/docs/en/changelog) (v2.1.280, v2.1.284). Full sourcing and the corrections found along the way: `.prism/shared/research/2026-09-30-claude-codex-model-roster.md`. Retrieved 2026-09-30.*
