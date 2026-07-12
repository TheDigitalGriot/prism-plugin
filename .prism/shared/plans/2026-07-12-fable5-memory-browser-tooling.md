# Fable 5 Enablement + Memory Semantic Search + Browser Tooling — Implementation Plan

**Date:** 2026-07-12
**Source ledger:** `.prism/shared/brainstorms/2026-07-12-fable5-memory-browser-tooling.md`
**Status:** Ready for implementation
**Quality gates:** `claude plugin validate .` · `cd apps/prism-vscode && npx tsc --noEmit` · `hooks/` linted with `scripts/hook-linter.sh`

## Overview

Three workstreams, risk-ordered:
- **A · Fable 5 (Phases 1–4)** — temporary ~12h enablement, mandatory confirm/deny gate on both surfaces, reversible by deleting one flag file. **Deadline: usable before midnight tonight.**
- **B · Memory (Phases 5–6)** — semantic search via local GitNexus dual-index + the four as-researched gaps.
- **C · Browser tooling (Phase 7)** — split Playwright (verification) / chrome-devtools MCP (debugging) with explicit-name override.

All plugin changes go through `/cl-plugin-structure`.

## Structural Impact (graph-informed)

Verified by direct read of `apps/prism-vscode/src/core/api/claude-sdk.ts`:
- `MODEL_IDS` (:19-23) — additive (one new key); no callers break.
- `createMessage` `message_delta` case (:124) — additive (a new `if` before the existing `usage` handling); `createMessage`'s signature is unchanged, so its callers are unaffected.

**Blast Radius: LOW.** Every Phase-1 change is additive; no signature or existing-control-flow changes.
**Dead code candidates:** none for this change.

## Success Criteria

### Automated Verification
- [ ] `claude plugin validate .` passes clean
- [ ] `cd apps/prism-vscode && npx tsc --noEmit` passes
- [ ] Refusal-handler unit test: a mocked `message_delta` with `delta.stop_reason === "refusal"` makes `createMessage` throw
- [ ] Flag-reader test: returns `false` when `.prism/local/fable.flag` is absent or malformed, `true` when contents are `{"enabled":true}`
- [ ] `scripts/hook-linter.sh hooks/hooks.json` passes

### Manual Verification
- [ ] Flag ON: app modal appears before a Fable call; Confirm → Fable, Deny/timeout → Opus
- [ ] Flag ON: Claude Code `Task(model: fable)` prompts confirm/deny; Deny → blocked → Opus
- [ ] Flag OFF (or file deleted): no Fable path reachable; behavior byte-identical to today
- [ ] Semantic query ("find the auth flow") returns hits via GitNexus; codemem still answers structural
- [ ] chrome-devtools debugging works; Playwright verification unchanged; saying "playwright"/"devtools" overrides routing

---

## Phase 1 — Fable 5 SDK foundation (gates everything)

**Goal:** Make `fable` a valid model id and make safety-declined calls fail loudly instead of silently.

**Files:** `apps/prism-vscode/src/core/api/claude-sdk.ts`

**Steps:**
1. In `MODEL_IDS` (after line 22, before the closing `} as const`), add: `fable: "claude-fable-5",`. `ModelName` widens automatically — no separate type edit.
2. In the `message_delta` case (line 124), immediately **before** `if (event.usage) {`, insert:
   ```ts
   if ((event.delta.stop_reason as string) === "refusal") {
     throw new Error(
       "Request declined by safety classifier (stop_reason: refusal). " +
       "Can occur with Claude Fable 5 on certain content. Retry or rephrase.",
     )
   }
   ```
   Cast to `string`: the Anthropic SDK types predate Fable 5 and its `stop_reason` union omits `"refusal"`.
3. Do NOT add `thinking`, `temperature`, `top_p`, or `top_k` — all 400 on Fable 5. The current call passes none; keep it that way.

**Automated Verification:**
- [ ] `cd apps/prism-vscode && npx tsc --noEmit` passes
- [ ] Unit test: mocked stream emitting `message_delta` with `delta.stop_reason === "refusal"` causes `createMessage` to throw the descriptive error
**Manual Verification:**
- [ ] `MODEL_IDS.fable` resolves to `"claude-fable-5"`

---

## Phase 2 — Fable flag + reader (single source of truth)

**Goal:** One on/off flag both surfaces read; default OFF; delete-to-remove.

**Files:** `apps/prism-vscode/src/core/api/fable-flag.ts` (new) · `.gitignore` (verify `.prism/local/`) · runtime file `.prism/local/fable.flag` (created at enable time, not committed)

**Steps:**
1. Confirm `.prism/local/` is gitignored (per `.prism/` structure it is; add an explicit `.prism/local/fable.flag` line if not).
2. New `fable-flag.ts` exporting `isFableEnabled(workspaceRoot: string): boolean`: read `<root>/.prism/local/fable.flag`; return `true` only if it parses to an object with `enabled === true`; return `false` on missing file, read error, parse error, or `enabled !== true`.
3. Hook-side reader: a shell/node one-liner in the Phase-4 gate script that checks the same file with the same semantics.

**Automated Verification:**
- [ ] Unit test: `isFableEnabled` → `false` (absent), `false` (`not json`), `false` (`{"enabled":false}`), `true` (`{"enabled":true}`)
**Manual Verification:**
- [ ] Creating `.prism/local/fable.flag` with `{"enabled":true}` flips it on; deleting flips it off

---

## Phase 3 — Fable gate · Surface 1 (app SDK modal)

**Goal:** Mandatory confirm/deny modal before any Fable SDK call; Deny → Opus.

**Files:** the prism-vscode call site that instantiates `PrismApiHandler` and selects the model (model-selection path in `apps/prism-vscode/src/core/`) · the webview modal component

**Steps:**
1. At the model-selection point: if the chosen model is `"fable"` and `!isFableEnabled(root)` → substitute `"opus"` (Fable treated as unavailable).
2. If `"fable"` and enabled → present a modal: title "Fable 5 requested", body "~2.6× Opus cost for this call", buttons Confirm / Deny.
3. Confirm → construct the handler with `model: "fable"`. Deny or timeout (no response) → construct with `model: "opus"` and continue (never block).

**Automated Verification:**
- [ ] `cd apps/prism-vscode && npx tsc --noEmit` passes
**Manual Verification:**
- [ ] Flag ON + fable selected → modal shows; Confirm → Fable, Deny → Opus
- [ ] Flag OFF + fable selected → no modal, runs on Opus

---

## Phase 4 — Fable gate · Surface 2 (Claude Code hook)

**Goal:** Gate `model: fable` agent dispatches inside Claude Code.

**Files:** `hooks/hooks.json` · `scripts/fable-gate.sh` (new) · `skills/prism-spectrum/references/model-selection.md` (leave the `🔒 DO NOT DISPATCH` guard in place)

**Steps:**
1. Add a `PreToolUse` hook with matcher `Task` running `${CLAUDE_PLUGIN_ROOT}/scripts/fable-gate.sh`.
2. `fable-gate.sh`: read the tool input JSON; if the requested model is not `fable`/`claude-fable-5` → emit allow (exit 0). If it is Fable:
   - flag OFF → deny: print `{"hookSpecificOutput":{"permissionDecision":"deny"},"systemMessage":"Fable 5 disabled — enable via .prism/local/fable.flag"}` (exit 0 with JSON, or exit 2).
   - flag ON → ask: print `{"hookSpecificOutput":{"permissionDecision":"ask"},"systemMessage":"Fable 5 (~2.6× Opus) requested — confirm?"}`. On the user's deny the dispatch is blocked; the orchestrator retries on Opus.
3. The `model-selection.md` `🔒` guard stays as documentation; the hook is the runtime enforcement, so nothing is permanently unlocked.

**Automated Verification:**
- [ ] `scripts/hook-linter.sh hooks/hooks.json` passes
- [ ] `claude plugin validate .` passes clean
**Manual Verification:**
- [ ] Flag OFF → `Task(model: fable)` is blocked; Flag ON → prompts; Deny → blocked

---

## Phase 5 — Memory Gap 3 · GitNexus dual-index (local only)

**Goal:** Add semantic search alongside codemem, without shipping a noncommercial dependency.

**Files:** a **local, non-distributed** MCP config (e.g. the project `.mcp.json` on this machine, or `.claude/settings.local.json`) — NOT the plugin's shipped `.mcp.json` · `.prism/shared/docs/code-intel/` note documenting the licence boundary

**Steps:**
1. Install GitNexus locally and register it as a local MCP server (project/user scope), not in the plugin distribution.
2. Document in a code-intel note: structural queries → codemem; semantic ("find the auth flow") → GitNexus; **GitNexus is PolyForm Noncommercial → never bundle/ship it**.
3. Update the research/graph-navigator guidance (routing note in project CLAUDE.md or the code-intel doc) to prefer codemem for structure and GitNexus for semantic.

**Automated Verification:**
- [ ] GitNexus MCP appears in `claude mcp` / tool list locally; NOT present in the plugin's committed `.mcp.json` (grep confirms absence)
**Manual Verification:**
- [ ] A semantic query returns relevant results; a structural query still routes to codemem

---

## Phase 6 — Memory gaps 1 / 2 / 4 / 5 (as-researched)

**Goal:** Close the four remaining deferred gaps per the 2026-04-11 research.

**Files (new/edited):** `scripts/prism-sync-skills.py` · a CLAUDE.md marker-injection script · `hooks/hooks.json` (PostToolUse) · `commands/prism-wiki.md`

**Steps:**
1. **Skill-gen** — `scripts/prism-sync-skills.py`: read communities from codemem, write `skills/generated/<cluster>/SKILL.md` (regenerate on reindex).
2. **Live-stats CLAUDE.md** — marker-aware upsert of a `<!-- prism:start -->…<!-- prism:end -->` block with live node/edge counts; preserve user content outside markers.
3. **detect_changes gate** — `PostToolUse` hook that runs `detect_changes` and surfaces HIGH/CRITICAL as a blocking signal.
4. **/prism-wiki** — `commands/prism-wiki.md`: enumerate communities via `get_graph_schema`/`query_graph`, summarize each with Claude (no external API key) → `.prism/shared/docs/`.

**Automated Verification:**
- [ ] `prism-sync-skills.py` produces at least one valid `SKILL.md` with frontmatter for the current index
- [ ] Marker injection is idempotent (running twice yields identical CLAUDE.md)
- [ ] `claude plugin validate .` passes after the new command + hook
**Manual Verification:**
- [ ] Generated skills read sensibly; `/prism-wiki` output is accurate to the graph

---

## Phase 7 — Browser tooling split (Playwright + chrome-devtools MCP)

**Goal:** Playwright keeps verification; chrome-devtools MCP added for debugging; explicit tool name overrides routing.

**Files:** the plugin `.mcp.json` (ensure chrome-devtools present + documented) · a routing note in project `CLAUDE.md` (or a `commands/prism-debug`-adjacent doc) · leave `agents/browser-verifier.md`, `commands/prism-verify.md`, `commands/prism-screenshot.md`, `commands/prism-browse.md` unchanged

**Steps:**
1. Confirm chrome-devtools MCP is enabled and documented as the **debugging** surface.
2. Add a routing note: default — verification/CI → Playwright (`browser-verifier`, `prism-verify`); interactive debugging → chrome-devtools MCP. **Override:** if the user names "playwright" or "devtools" explicitly, use that tool regardless of task.
3. No change to the existing Playwright agents/commands.

**Automated Verification:**
- [ ] `claude plugin validate .` passes
- [ ] Playwright components unchanged (git diff shows no edits to `browser-verifier.md`, `prism-verify.md`)
**Manual Verification:**
- [ ] A debugging task uses chrome-devtools; a verification task uses Playwright; naming a tool overrides the default

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Fable API surface drift (thinking/sampling 400s) | Phase 1 step 3 forbids adding those params; current code passes none |
| Account has zero-data-retention → Fable 400s | Pre-check account config before enabling (not a code fix); documented in the flag note |
| Hook denies but orchestrator still tries Fable | Deny path returns a systemMessage instructing Opus fallback; verify in Phase 4 manual test |
| GitNexus licence leak into distribution | Phase 5 keeps it local-only; automated grep asserts absence from committed `.mcp.json` |
| Forgetting to disable Fable at midnight | Removal = delete `.prism/local/fable.flag`; add a reminder; code is inert when off regardless |

## Edge Cases

- `.prism/local/fable.flag` present but malformed JSON → reader returns `false` (fail safe to OFF).
- Deny on an unattended Spectrum run → Opus fallback keeps the run alive.
- Fable selected while flag OFF → silently uses Opus, no modal, no error.
- `refusal` on the very first `message_delta` → throws before any partial output is mistaken for success.

## Rollback

- **Fable:** delete `.prism/local/fable.flag` (instant OFF). The `MODEL_IDS` entry, refusal handler, and hook are inert when off; the refusal handler is kept permanently (pure hardening). Full revert = `git revert` the Phase 1–4 commits.
- **GitNexus:** remove the local MCP registration; nothing shipped to revert.

## What We're NOT Doing

- Gap-3 **Option C** native semantic layer (sqlite-vec + BM25 + vector + RRF) — separate **heavy plan** (own `/prism-plan`).
- **Mythos 5** (`claude-mythos-5`) — only if Glasswing access is confirmed.
- **Shipping** GitNexus in the plugin (noncommercial licence).
- Making Fable 5 the default or permanent.
- Changing existing Playwright agents/commands.
