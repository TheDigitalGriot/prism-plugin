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
- [ ] 6. **Write design document** — Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md`
- [ ] 7. **Self-review** — Check for TODOs, contradictions, missing requirements
- [ ] 8. **User reviews spec** — Present the saved file for review
- [ ] 9. **Transition** — Offer `/prism-plan` to create implementation plan from the design

## Visual Companion

When visual decisions are ahead, offer the browser-based companion:

> "This design involves visual choices. I can show interactive mockups in your browser for comparing options. Want me to start the visual companion?"

This offer MUST be its own message. Do not combine it with clarifying questions.

If accepted, load `visual-companion.md` for the full integration guide.

## Design Document Format

Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md`:

```markdown
# {Topic} Design Document

**Date:** {date}
**Status:** Approved | Draft
**Author:** AI + {user}

## Problem Statement
{What we're solving and why}

## Design Decision
{The chosen approach}

## Alternatives Considered
### Option A: {name}
{Description, trade-offs}

### Option B: {name}
{Description, trade-offs}

## Technical Design
{Architecture, data flow, key interfaces}

## Success Criteria
{How we'll know this works}

## Open Questions
{Anything unresolved}
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
