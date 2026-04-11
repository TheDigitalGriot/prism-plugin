---
name: prism-brainstorm
description: Interactive brainstorming with optional browser-based visual companion. Use when starting creative design work before planning. Triggers on "brainstorm this", "design options", "explore approaches", "let's think about", or when the user needs to make design decisions before implementation.
model: opus
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
- [ ] 4. **Propose 2-3 approaches** — With trade-offs for each
- [ ] 5. **Present design in sections** — Get user approval after each section
- [ ] 6. **Write decision ledger** — Save to `.prism/shared/brainstorms/YYYY-MM-DD-<topic>.md` (NOT `plans/` — brainstorm is upstream of design)
- [ ] 7. **Self-review** — Check for TODOs, contradictions, missing requirements
- [ ] 8. **User reviews spec** — Present the saved file for review
- [ ] 9. **Transition** — Offer `/prism-design` (if architecture needed) or `/prism-plan` (direct to implementation)

## Visual Companion

When visual decisions are ahead, offer the browser-based companion:

> "This design involves visual choices. I can show interactive mockups in your browser for comparing options. Want me to start the visual companion?"

This offer MUST be its own message. Do not combine it with clarifying questions.

If accepted, load `visual-companion.md` for the full integration guide.

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

- Final hi-fi mockup screen path
- Visual companion session paths
- External references

## §4 · Implementation Handoff Notes

**This file is the handoff to `prism-design`.** When the next session runs `/prism-design` against this ledger, it should:

1. Preserve §1 decisions verbatim in the design's "Locked Decisions" section
2. Carry §2 Deferred Concerns forward as a first-class appendix
3. Use §3 reference HTML as visual-layout reference for the `.pen` file
4. Generate architecture (mermaid diagrams, contracts, data models)
5. Write `.prism/shared/designs/<date>-<topic>-design.md` + `.pen`
```

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
