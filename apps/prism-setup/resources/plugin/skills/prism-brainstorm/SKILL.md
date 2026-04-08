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
Brainstorming produces a design document, not code.
</HARD-GATE>

## Workflow

- [ ] 1. **Explore project context** — Read relevant files, check `.prism/shared/research/` for existing research
- [ ] 2. **Offer visual companion** — If visual questions ahead, offer the browser companion (load `visual-companion.md`)
- [ ] 3. **Ask clarifying questions** — One at a time, wait for answers
- [ ] 4. **Propose 2-3 approaches** — With trade-offs for each
- [ ] 5. **Present design in sections** — Get user approval after each section
- [ ] 6. **Write decision ledger** — Save to `.prism/shared/brainstorms/YYYY-MM-DD-<topic>.md` (NOT `plans/` — brainstorm is upstream of design, see corrected skill graph in `prism-design/SKILL.md`)
- [ ] 7. **Self-review** — Check for TODOs, contradictions, missing requirements
- [ ] 8. **User reviews spec** — Present the saved file for review
- [ ] 9. **Transition** — Offer `/prism-plan` to create implementation plan from the design

## Visual Companion

When visual decisions are ahead, offer the browser-based companion:

> "This design involves visual choices. I can show interactive mockups in your browser for comparing options. Want me to start the visual companion?"

This offer MUST be its own message. Do not combine it with clarifying questions.

If accepted, load `visual-companion.md` for the full integration guide.

## Fidelity Engine

When the visual companion is running, every screen Claude renders has a **fidelity level** that signals how polished the mockup should look. The companion's frame template defines three levels via a `data-fidelity` attribute on the body (or any fragment root):

| Level | Vocabulary | What it looks like | When |
|---|---|---|---|
| `lo` | sketch | dashed borders, desaturated, no glass blur, no bloom — wireframe energy | early questions, throwaway exploration |
| `mid` | structured | solid borders, light blur, no bloom — functional but unpolished | once direction is forming |
| `hi` | polished | full griotwave glass — backdrop blur, ember bloom, neural-blue accents | confirmed picks, ceremonial final render |

CSS variables `--fidelity-blur`, `--fidelity-shadow`, `--fidelity-bloom`, `--fidelity-border-style`, `--fidelity-saturation`, `--fidelity-opacity` are reshaped by `[data-fidelity="lo|mid|hi"]` selectors in `frame-template.html`. New components reference these instead of hard-coding effects.

### Classifier — every user message is one of:

- **decide** → user committed to a pick. Advance to the next question. Render the next screen at the carry-forward fidelity (or `lo` if no carry-forward yet). **Append the pick to `decisions[]` in `state/decisions.json`** (Drawer renders this — see below).
- **clarify** → user wants more detail or comparison on the *current* question. Re-render the current screen one fidelity level higher (`lo` → `mid` → `hi` → stays `hi`).
- **park** → user (or you, when a side concern surfaces mid-flow) wants to defer this question without answering it. **Append to `parked[]` in `state/decisions.json`** with a back-pointer to the question it branched from. Carry on with the original question. Parked items are NOT unanswered — they are deferred on purpose, and the final design doc carries them as "Deferred Concerns".

The user signals **park** with phrases like *"park this"*, *"defer that"*, *"come back to it later"*, or any explicit call-out. You may also park on your own when a clarifying side-thread is clearly out-of-scope for the current question — but say so explicitly so the user can override.

### Slash-command override

The user can jump fidelity at any point with an explicit command. These take precedence over the classifier for the next render only:

- `/lo` — render the next screen at `lo`
- `/mid` — render the next screen at `mid`
- `/hi` — render the next screen at `hi`

After the override fires, carry-forward resumes from the override level.

### Carry-forward rule

Fidelity persists across questions. If you escalated Q2 to `mid`, Q3 starts at `mid` automatically. Downshifting is explicit (slash command or a fresh `decide` after a long lull).

### Final-hi ceremonial rule

The **last** decision-confirm screen before the design document is **always** rendered at `hi`, regardless of the carry-forward state. This is the ceremonial render — the finished prototype the user signs off on. Do not skip it.

### How to set fidelity in HTML

Set `data-fidelity` on the root element of the fragment Claude writes to `$SCREEN_DIR`:

```html
<div data-fidelity="lo" class="options">
  <div class="option" data-choice="A">...</div>
  <div class="option" data-choice="B">...</div>
</div>
```

For full documents, set it on `<body data-fidelity="hi">`. The CSS cascade does the rest — components automatically pick up the level via the `--fidelity-*` variables.

## Drawer State — `state/decisions.json`

The visual companion's right-side drawer renders from a single state file: `$STATE_DIR/decisions.json`. Whenever you classify a user message as `decide` or `park`, write the file directly via the Write tool. The brainstorm server watches the file and broadcasts a `state-update` message to the browser, which re-renders the drawer in real time. **No round-trip through the user is needed.**

### Schema

```json
{
  "decisions": [
    { "q": "Q1", "label": "Re-skin fidelity", "choice": "B", "summary": "Hybrid (inlined + regen script)" }
  ],
  "parked": [
    { "fromQ": "Q2", "label": "/hi mid-stream priority", "concern": "Classifier vs command override is unspecified", "revisit": "during Q2 implementation" }
  ]
}
```

- `decisions[].q` — short ID like `Q1`, `Q2`, `Q3` (track question order)
- `decisions[].label` — one-line summary of what was being decided
- `decisions[].choice` — letter or short identifier of the pick
- `decisions[].summary` — one-line description of the chosen option
- `parked[].fromQ` — the question this concern branched off (back-pointer)
- `parked[].label` — short title of the parked concern
- `parked[].concern` — one-sentence description
- `parked[].revisit` — when/how it should be revisited

Always read the existing file first (it may already contain entries from earlier in the session), append, then write the merged state back. Never overwrite existing entries.

### Health signal

When `parked.length >= 5`, the drawer auto-renders a yellow warning *"Long parking lot — session may be over-scoped"*. Treat this as a prompt to pause and ask the user whether the brainstorm scope should be narrowed before continuing. Do NOT silently keep parking.

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
3. **User approval per section** — Don't write the full design in one shot
4. **Visual companion is optional** — Only offer when visual decisions are involved
5. **Save and commit** — Design documents are committed to `.prism/shared/plans/`

## Integration

- **Follows:** `/prism-research` (optional — brainstorming can start from scratch)
- **Precedes:** `/prism-plan` (design document becomes planning input)
- **Visual companion:** Stored in `.prism/local/brainstorm/` (gitignored)
