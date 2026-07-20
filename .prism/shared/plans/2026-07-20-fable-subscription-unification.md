# Plan — Fable 5: Subscription Auth Unification + Gate Reframe

**Date:** 2026-07-20
**Status:** IMPLEMENTED 2026-07-20 — Phases 1/2/4 (Fable reframe) + Phase 3 Path A (subscription-first auth) shipped & verified (typecheck clean, 16 unit tests green). One runtime billing check + a Path-B fallback remain, noted below. Not yet committed.
**Companion:** [2026-07-20-fable-current-vs-desired.md](../research/2026-07-20-fable-current-vs-desired.md)
**Prior art:** [2026-06-12 integration research](../research/2026-06-12-fable-5-integration.md) · [2026-07-12 fable5 plan](2026-07-12-fable5-memory-browser-tooling.md) · T1–T4 commits (`ab36395`, `fa3adf2`, `ae678f4`, `f2a0cdc`)

---

## Objective

Bring Fable 5 in line with reality: it is now **included in Max/Team Premium** (capped weekly), so the metered-cost / temporary / 🔒 RESERVED framing is false. Retire that framing and unify all surfaces onto subscription auth — **while keeping the HITL gate mechanism exactly as built.**

## Guardrails / Non-goals (the firewall — do not cross)

- ❌ **No change to role/default/dispatch model selection.** The year-long orchestration design is untouched.
- ❌ **Fable never becomes a default**, never enters `role_defaults`, stays opt-in + HITL-gated.
- ❌ **Not the fable-method Router refactor** ([brainstorm](../brainstorms/2026-07-18-fable-method-prism-integration.md)) — that is a separate track.
- ❌ **Do not edit** `.prism/shared/evals/*-snapshot/**` (frozen time capsules).
- ✅ HITL gate mechanism (flag + modal + PreToolUse hook + Opus fallback) is **preserved verbatim**; only its *copy/rationale* changes.

## Governance split (which tool touches what)

| Surface | Files | How it gets modified |
|---|---|---|
| **Plugin** | `scripts/fable-gate.sh`, `hooks/hooks.json`, `skills/**/references/*.md`, other `skills/`,`agents/`,`commands/` | **`/cl-plugin-structure`** (per standing rule) |
| **VS Code app** | `apps/prism-vscode/src/**` | Normal dev in that app |
| **Mobile/server app** | `apps/prism-mobile/**` | Normal dev, per that repo's own CLAUDE.md rules |
| **Setup mirrors** | `apps/prism-setup/resources/plugin/**` | Sync to match plugin after plugin edits land |

---

## Phases (ordered lowest-risk first)

### Phase 1 — Docs & framing true-up  *(plugin → `/cl-plugin-structure`)*  · **safe, reversible**
Un-freeze the disavowal; reframe cost → capped allowance. No logic anywhere.
- [model-selection.md](../../../skills/prism-spectrum/references/model-selection.md) — replace the 🔒 RESERVED/NOT-ENABLED block with "enabled under Max subscription; HITL-gated; draws on a capped weekly Fable allowance." Keep the "never the default / escalation-only" bar.
- [model-config.md §1, §5](../../../skills/cl-plugin-structure/references/model-config.md) — drop the 🔒 RESERVED banner; keep the API-surface facts (always-on thinking, `refusal`, tokenizer). **Remove** the ZDR/retention warning as a blocker (non-issue for this work).
- [2026-06-12 research doc](../research/2026-06-12-fable-5-integration.md) — update Status from "Deferred" to "Superseded by 2026-07-20 (built + subscription)".

### Phase 2 — Gate copy reframe  *(plugin hook via `/cl-plugin-structure` + VS Code app)*  · **copy-only, no logic**
Reword "~2.6× Opus cost" → "counts against your capped weekly Max Fable allowance — confirm?" in:
- [fable-gate.sh](../../../scripts/fable-gate.sh) `permissionDecisionReason` strings (plugin).
- [fable-gate.ts](../../../apps/prism-vscode/src/core/api/fable-gate.ts) modal message (app).
- Existing tests assert `stringContaining("Fable 5")` → still pass; add/adjust only if copy assertions tighten. **Gate logic and Opus fallback unchanged.**

### Phase 3 — Auth unification  *(apps)*  · **investigated + Path A shipped 2026-07-20**

Investigation of the real code (it was a fork, not a transport swap):
- **CLI TUI (Go): already subscription — no change.** [claude.go](../../../apps/prism-cli/app/adapter/claude.go) reads `~/.claude/projects/*.jsonl` (Claude Code's own subscription sessions); makes no metered calls.
- **Server/mobile: the reference.** [claude-agent.ts](../../../apps/prism-mobile/packages/server/src/server/agent/providers/claude-agent.ts) drives the `claude` binary via `@anthropic-ai/claude-agent-sdk` (`~/.claude` login) = subscription.
- **VS Code extension: sole metered outlier**, contradicting its own walkthrough ("Max subscription via the Claude CLI") — used `new Anthropic({ apiKey })`.
- **Blocker for the Agent-SDK route:** `PrismTask` owns a Cline-style agent loop with its own `PRISM_TOOL_DEFINITIONS` + approval gating; the Agent SDK owns a *different* loop — not a drop-in.

**Path A — OAuth-token auth (SHIPPED; engine untouched).** `PrismApiHandler` now resolves credentials subscription-first via `resolveAnthropicAuth` (shared prism-core): `CLAUDE_CODE_OAUTH_TOKEN` → `authToken` + `anthropic-beta: oauth-2025-04-20`; the metered API key is the automatic fallback; an `authMode` getter exposes which is active. `createMessage`, the Fable gate, and model selection are byte-unchanged. Verified: typecheck clean, 16 unit tests green.
  - ✅ **Confidence: high — quick confirm, not a risk.** Mobile / always-on / daemon already bill Max with this *same* subscription OAuth credential (via the Agent SDK transport). Path A sends the same credential over a raw `Authorization: Bearer` request — a documented pattern (`ant auth print-credentials --access-token` + `oauth-2025-04-20`). **Billing follows the credential, not the transport**, so it should draw on Max like every other surface. Only residual: whether Anthropic client-gates raw Messages-API OAuth to Claude Code's own client identity — one real call settles it.

**Path B — converge on the Agent SDK (DEFERRED; only if A fails the runtime check).** Rebuild `createMessage` on `@anthropic-ai/claude-agent-sdk` `query()`, matching the server, reconciling PrismTask's tool/approval model with the SDK's — its own staged, TDD build (reference skill: `cl-agent-sdk`).

### Phase 4 — Setup-mirror sync + verification  *(plugin mirrors)*
- Sync `apps/prism-setup/resources/plugin/{scripts/fable-gate.sh,hooks/hooks.json,skills/...}` to match the plugin edits from Phases 1–2.
- Leave `.prism/shared/evals/*-snapshot/**` untouched.

---

## Success criteria

### Automated verification
- [ ] `apps/prism-vscode` build + typecheck pass (`make`/`npm` per app).
- [ ] `fable-gate.test.ts` + `fable-flag.test.ts` still green (gate behavior unchanged).
- [ ] No diff to any `role_defaults` / dispatch model table / agent frontmatter `model:` field (grep guard).
- [ ] Plugin validator (`/cl-plugin-structure` bundled validator) passes after doc/hook edits.

### Manual verification
- [ ] With flag OFF: Fable request → denied (hook) / falls back to Opus (app) — unchanged.
- [ ] With flag ON: modal/hook now reads "capped weekly allowance," confirm → Fable, deny → Opus.
- [ ] Reference docs no longer say RESERVED; no ZDR blocker language remains.
- [ ] (Phase 3) A VS Code Fable call is served by the **subscription**, not a metered key — verified against usage/billing.

---

## Open decisions

1. ~~Scope~~ — **RESOLVED:** all four phases authorized + shipped (Path A for Phase 3).
2. ~~CLI TUI auth~~ — **RESOLVED:** already subscription (reads `~/.claude`); not a holdout.
3. **Runtime billing check (open, Gavin — low risk):** one live call to confirm — same subscription credential your other surfaces already bill Max with, just a different transport. Path B only in the unlikely case raw-OAuth is client-gated.
4. **HITL source doc (open, minor):** fold [2026-07-18-multi-model-fleet-orchestration.md](../brainstorms/2026-07-18-multi-model-fleet-orchestration.md) in as canonical HITL rationale, or leave the T3/T4 + integration-doc design authoritative?
5. **Commit:** run `detect_changes` per repo rule, then commit the staged set on your go.
