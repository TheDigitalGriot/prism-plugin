# Fable 5, Memory Semantic Search & Browser Tooling — Brainstorm Decisions Ledger

**Date:** 2026-07-12
**Status:** Complete — ready for `prism-plan` (skipping `prism-design`: this is plugin logic, not UI/architecture)
**Scope guardrail:** This brainstorm decided. It did not implement.
**Visual companion session:** `.prism/local/brainstorm/2213-1783873909/`

---

## §1 · Locked Decisions

### A · Fable 5 — temporary 12-hour enablement

Context: `claude-fable-5` is pre-researched (`.prism/shared/research/2026-06-12-fable-5-integration.md`) and deliberately locked OFF (`🔒 DO NOT DISPATCH` in `skills/prism-spectrum/references/model-selection.md`; absent from `MODEL_IDS`). User wants it usable for ~12 hours (removed at midnight), reversibly. Dominant constraint: **simplicity + clean reversibility**, not robustness.

### A1 · Surfaces → **Both**
Reachable from (a) the Prism app SDK (`apps/prism-vscode/src/core/api/claude-sdk.ts`) and (b) Claude Code plugin agents (`model: fable` frontmatter). A gate lives at each call site.

### A2 · Gate → **Per-call; Deny → Opus fallback**
Every Fable invocation shows a confirm/deny CTA. Confirm → runs on Fable. Deny / timeout / unattended → silently falls back to Opus 4.8 (never blocks, never surprise-bills). App surface = GUI modal; Claude Code surface = `PreToolUse` hook. Trade-off accepted: a mandatory click is interactive by nature — the Opus fallback is what keeps unattended Spectrum runs alive.

### A3 · Flag + reversibility → **single gitignored flag file**
`.prism/local/fable.flag` — absent = OFF (today's locked behavior, unchanged); `{"enabled":true}` = ON. Both surfaces read this one file. Midnight removal = **delete the file**; all code paths stay inert when off.

### A4 · Prerequisite → **SDK `refusal` stop-reason handler first**
Non-negotiable (per the spec): handle `stop_reason: "refusal"` in `createMessage` before unlocking, else declined calls silently look like success. Keep this handler **permanently** (defensive hardening) even after Fable is gone.

### B · Memory layer — semantic search (the 5 gaps)

Context: codemem = STRUCTURE (this repo now indexed, 61k nodes). The 5 gaps from `.prism/shared/docs/code-intel/2026-04-11-memory-and-context-research.md` were deferred to v3.5 (`CHANGELOG.md`) and never shipped.

### B1 · Gap 3 (semantic search) → **A · Dual-index GitNexus locally now**
Structural → codemem, semantic → GitNexus, as a local dual-tool experiment (research's #1 ranked action, ~30 min, zero-risk). **⚠ Licence:** GitNexus is PolyForm Noncommercial — run locally as an external MCP only; do **NOT** bundle/ship it inside Prism. The shippable end-state is Option C (native layer) — see §2.

**Gaps 1, 2, 4, 5 → build as-researched** (not re-litigated): (1) community skill-gen `scripts/prism-sync-skills.py`; (2) live-stats CLAUDE.md marker injection; (4) `detect_changes` `PostToolUse` hard gate; (5) `/prism-wiki` LLM-summarized module docs.

### C · Browser tooling — Playwright & Chrome DevTools MCP

### C1 · → **A · Split by role, with explicit-name override**
Default routing: automated verification / CI / regression → **Playwright** (keeps `browser-verifier`, `prism-verify` as-is); interactive / exploratory debugging → **Chrome DevTools MCP** (newly wired in). **Override caveat (user):** when the user explicitly names a tool — "playwright" or "devtools" — that tool's flow is used regardless of the role-based default.

---

## §2 · Deferred Concerns (parking lot)

1. **Mythos 5 alias** — from A. `claude-mythos-5` (Project Glasswing-only) is API-identical to Fable 5. Skipped for the 12h window.
   - Revisit: only if Glasswing access is confirmed.

2. **Gap-3 Option C — native semantic layer** — from B1. The real *shippable* end-state: `sqlite-vec` + BM25 + vector + RRF native in Prism (à la Atomic), not GitNexus.
   - Revisit: **heavy plan next** — this is the priority follow-on, its own `/prism-plan`.

---

## §3 · Reference Artifacts

**Visual companion session:** `.prism/local/brainstorm/2213-1783873909/`
**Final hi-fi screen:** `.prism/local/brainstorm/2213-1783873909/content/decisions-locked.html`
**Decisions state:** `.prism/local/brainstorm/2213-1783873909/state/decisions.json`
**External references:**
- `.prism/shared/research/2026-06-12-fable-5-integration.md` — Fable 5 spec + activation checklist
- `.prism/shared/docs/code-intel/2026-04-11-memory-and-context-research.md` — the 5 gaps
- `.prism/shared/brainstorms/2026-06-12-code-intel-memory-layer.md` — STRUCTURE (codemem) vs STORE (graphify)

**Design tokens:** N/A — this brainstorm is plugin logic, not visual design. No `.pen` / Claude Design handoff.

---

## §4 · Implementation Handoff Notes

**This file hands off to `prism-plan`** (NOT `prism-design` — plugin logic, no UI/architecture layer). The plan should:

1. Preserve §1 decisions verbatim.
2. Carry §2 deferred concerns forward — especially the **native semantic layer** (heavy-plan priority).
3. **Sequence by urgency:** Fable 5 (A) is time-boxed (**midnight tonight**) — plan it first and thinnest so it's usable ASAP; memory gaps (B) and browser tooling (C) are unhurried.
4. Fable order-of-operations: SDK `refusal` handler + `MODEL_IDS` entry gate everything → then the flag file → then the two gates (modal + hook).
5. **All plugin code changes go through `/cl-plugin-structure`.**

**Post-plan (not now):** `prism-docs-update` → `prism-bookend` → `prism-release 4.1.0`.

---

## Session meta

- Also completed this session (out-of-band tooling fixes, already applied): `prism-brainstorm` skill hardened to render **visual-first** (`visual-companion.md` + `SKILL.md`), global `CLAUDE.md` companion + operating-principles rules, and the **Prism glyph (`#00BFA6`)** added to the companion frame header (`scripts/frame-template.html`, repo + cache). Plugin validated clean. These are uncommitted in the working tree.
