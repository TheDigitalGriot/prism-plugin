---
name: prism-brainstorm
description: Interactive brainstorming with optional browser-based visual companion. Use when starting creative design work before planning. Triggers on "brainstorm this", "design options", "explore approaches", "let's think about", or when the user needs to make design decisions before implementation.
model: opus
effort: xhigh
---

# Prism Brainstorm

Interactive design exploration with optional browser-based visual companion for mockups and A/B choices.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any
implementation action until you have presented a design and the user has approved it.
Brainstorming produces a decision ledger, not code.
</HARD-GATE>

## Workflow

- [ ] 1. **Explore project context** — Read relevant files, check `.prism/shared/research/` for existing research
- [ ] 2. **Offer visual companion** — If visual questions ahead, offer the browser companion (load `visual-companion.md`)
- [ ] 3. **Ask clarifying questions** — One at a time, wait for answers
- [ ] 4. **Propose 2-3 approaches** — With trade-offs for each. For the divergent-thinking phase, ultrathink the problem space and surface assumptions that aren't being questioned.
- [ ] 5. **Present design in sections** — Get user approval after each section
- [ ] 6. **Write decision ledger** — Save to `.prism/shared/brainstorms/YYYY-MM-DD-<topic>.md` (NOT `plans/` — brainstorm is upstream of design)
- [ ] 7. **Self-review** — Check for TODOs, contradictions, missing requirements
- [ ] 8. **User reviews spec** — Present the saved file for review
- [ ] 9. **Visual companion exit ceremony** — If the visual companion ran, load `visual-companion.md` → **"Session Exit"** for the full exit sequence (artifact packaging, §3 population, server stop, user confirmation). After completion, proceed to step 10.
- [ ] 10. **Transition to design** — Offer the next phase with context:
  > "Your brainstorm is complete. The decision ledger is at `.prism/shared/brainstorms/<file>.md`.
  >
  > **Next:** `/prism-design` to architect the system (mermaid diagrams, interface contracts, visual layout via Pencil.dev or Claude Design).
  > Or go straight to `/prism-plan` if the implementation approach is already obvious from the ledger."

## Visual Companion

When visual decisions are ahead, offer the browser-based companion:

> "This design involves visual choices. I can show interactive mockups in your browser for comparing options. Want me to start the visual companion?"

This offer MUST be its own message. Do not combine it with clarifying questions.

If accepted, load `visual-companion.md` for the full integration guide.

**Render visual-first.** Lead every screen with a visual form — a `.diagram`/`.arc` box, a `.split`/`.cards` comparison, or `.options` cards — not headings and bullet lists. A screen that is mostly prose is a failure, not a fallback. Before the first render, read `scripts/frame-template.html` (the full component vocabulary) and `references/griotwave.md` (tokens). See `visual-companion.md` → **Render visual-first**.

### Source Awareness

If the visual companion is accepted AND the work is visual or brand-driven, ask about design sources before rendering the first screen. **Load [references/design-sources.md](references/design-sources.md)** for the source vocabulary, the question wording, and how selections enrich downstream artifacts (design_prompt.yaml, Claude Design context).

Skip this if a prism-capture ledger exists in `.prism/shared/captures/` — the sources are already documented there. Use the ledger's `## Source Vocabulary` section instead.

### Fidelity Engine

When the visual companion is running, every rendered screen has a **fidelity level** (`lo` / `mid` / `hi`) set via a `data-fidelity` attribute. This governs how polished mockups look — from wireframe energy (lo) through structured (mid) to full griotwave glass (hi). A classifier (`decide` / `clarify` / `park`) decides how user messages advance the level, with slash-command overrides (`/lo` `/mid` `/hi`) and carry-forward rules.

**Load [references/fidelity-engine.md](references/fidelity-engine.md) when you're about to render a screen** — it has the full level table, classifier rules, slash overrides, carry-forward, final-hi ceremonial rule, and HTML usage examples.

### Drawer State

The visual companion's right-side drawer renders from `$STATE_DIR/decisions.json`. When you classify a message as `decide` or `park`, write the file directly via the Write tool — the server watches the file and broadcasts a `state-update` to the browser in real time.

**Load [references/drawer-state.md](references/drawer-state.md) when you're about to write the first decision or parked item** — it has the JSON schema, field reference, read-merge-write protocol, and the 5-item health signal.

## Decision Ledger Format

Save to `.prism/shared/brainstorms/YYYY-MM-DD-<topic>.md`. Brainstorm produces a *ledger* of locked decisions and parked concerns — NOT an architectural design doc. Architecture is the next phase's job (`/prism-design`).

```markdown
# {Topic} — Brainstorm Decisions Ledger

**Date:** {date}
**Status:** Complete — ready for `prism-design` phase
**Scope guardrail:** This brainstorm decided. It did not implement.

---

## §1 · Locked Decisions

### Q1 · {decision name} → **{letter} · {chosen option}**
{Why, trade-offs accepted, what's kept in awareness circle}

### Q2 · {decision name} → **{letter} · {chosen option}**
...

## §2 · Deferred Concerns (parking lot)

These survived the brainstorm as first-class items. They are known, deferred, and should be revisited.

1. **{concern title}** — from Q{n}
   - Concern: ...
   - Revisit: ...

## §3 · Reference Artifacts

**Visual companion session:** `.prism/local/brainstorm/<session-id>/` *(or "none — text-only session")*
**Final hi-fi screen:** `.prism/local/brainstorm/<session-id>/content/<filename>.html` *(prism-design uses this as the visual layout reference for the `.pen` file)*
**Decisions state:** `.prism/local/brainstorm/<session-id>/state/decisions.json`
**External references:** *(none | list URLs or file paths)*

**Design tokens (Griotwave baseline):**
```yaml
design_tokens:
  palette: { void: "#000", neural: "#3B82F6", bio: "#10B981", violet: "#A855F7" }
  surface: glassmorphic   # backdrop-filter: blur(40px) saturate(140%)
  typography: { display: Inter, eyebrow: "JetBrains Mono" }
  motion: { language: ember-bloom, easing: "spring 50/22" }
```
*Override any field if the brainstorm locked a different palette, typeface, or motion language. If no overrides were decided, these are the defaults prism-design and Claude Design should use.*

> **Note for prism-design:** The "Final hi-fi screen" path above is the HTML mockup that represents the visual intent. Pass it to `mcp__pencil__batch_design()` as the layout reference when materializing the `.pen` file. The design_tokens block above is the token baseline for the `.pen` file's design system — apply overrides from §1 Locked Decisions where relevant. If the path is "none", the design phase proceeds from the ledger text and tokens alone.

## §4 · Implementation Handoff Notes

**This file is the handoff to `prism-design`.** When the next session runs `/prism-design` against this ledger, it should:

1. Preserve §1 decisions verbatim in the design's "Locked Decisions" section
2. Carry §2 Deferred Concerns forward as a first-class appendix
3. Load the §3 hi-fi screen HTML as visual-layout reference for the `.pen` file (see note above)
4. Generate architecture (mermaid diagrams, interface contracts, data models)
5. Write `.prism/shared/designs/<date>-<topic>-design.md` + `.pen`
```

## Visual Companion — Version Requirements

The brainstorm-channel MCP server provides active wake (click → Claude wakes):

| Feature | Requirement |
|---------|-------------|
| Active wake (click → Claude wakes) | Claude Code ≥ v2.1.80 + `brainstorm-channel` MCP running |
| Events file logging (fallback) | Any version — events written to `$STATE_DIR/events`, read on next user message |
| Passive mode indicator | Automatic — `/status` endpoint returns `{passive: true}` when active wake unavailable |

**Session registration** (multi-session safety): after starting the companion server, the skill should POST to claim its wake slot:

```bash
curl -s -X POST http://127.0.0.1:52342/register \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\"}"
```

This prevents concurrent brainstorm sessions from racing to wake each other. The registration persists until the session ends or `POST /unregister` is called. Single-session usage (no other brainstorm sessions running) works without registration — the channel fires unconditionally when the registry is empty.

## Rules

1. **Design before code** — Never write implementation code during brainstorming
2. **One question at a time** — Don't overwhelm with multiple questions
3. **User approval per section** — Don't write the full ledger in one shot
4. **Visual companion is optional** — Only offer when visual decisions are involved
5. **Save and commit** — Ledgers are committed to `.prism/shared/brainstorms/`

## Integration

- **Follows:** `/prism-research` (optional — brainstorming can start from scratch)
- **Precedes:** `/prism-design` (architecture) or `/prism-plan` (direct implementation)
- **Visual companion:** Stored in `.prism/local/brainstorm/` (gitignored)

### Complementary output paths after brainstorm

Two paths can coexist — they serve different layers:

| Path | Tool | What it produces |
|------|------|-----------------|
| **Architecture** | `/prism-design` | Mermaid diagrams, interface contracts, visual layout (Pencil or Claude Design) |
| **Visual prototype** | `idea_init` → emit | `design_prompt.yaml` → Claude Design — visual prototype + design system tokens |

> See also: [cl-plugin-structure/references/model-config.md](../cl-plugin-structure/references/model-config.md) §5 for `ultrathink` keyword behavior — this skill uses it in Step 4 to trigger deeper divergent-thinking reasoning.
