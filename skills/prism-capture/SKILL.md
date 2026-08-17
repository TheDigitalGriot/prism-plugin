---
name: prism-capture
description: Capture and codify design inspiration before brainstorming. Use when the user has visual references they want to feed into the workflow before deciding anything. Triggers on "I have references", "let me show you what I'm drawn to", "capture this inspiration", "triage my references", "let me share my inspo". Outputs a capture ledger that prism-brainstorm reads as pre-loaded context instead of starting from scratch.
model: sonnet
effort: high
---

# Prism Capture

Codify design inspiration into a structured capture ledger that prism-brainstorm reads as pre-loaded context. Three stages: Genesis (what + where) → Triage (categorize) → Translate (render source vs Griotwave in the visual companion). Outputs to `.prism/shared/captures/`.

Capture documents what the user is drawn to. It decides nothing.

## Skill Graph

```
[user's inspiration — URLs, files, descriptions, source selections]
       ↓
prism-capture       (YOU ARE HERE — Genesis → Triage → Translate)
       ↓ writes
.prism/shared/captures/<date>-<topic>.md     ← capture ledger
       ↓ reads (automatically)
prism-brainstorm    (opens with references pre-loaded — skips the blank-slate start)
```

**If idea_init is installed:** its captures land directly in `.prism/shared/captures/` via the plugin handoff. Skip to Step 5 (Write Ledger) — the ledger is already there.

## When to Use

- User has visual references and wants to feed them in before deciding anything
- Starting brand, site, or product work where aesthetic direction is still discovery
- After running idea_init's capture pipeline (to formalize its output into prism's format)

Skip when the user already has a clear direction — go straight to `/prism-brainstorm`.

## Workflow

### 1. Genesis

Ask two questions in sequence — do not combine them:

1. "Describe what we're building — one sentence is enough."
2. "Which design sources are you drawing from?" — **load [references/capture-sources.md](references/capture-sources.md)** for the source vocabulary and selection question wording.

### 2. Capture

For each referenced source, document:
- The specific reference (URL, component name, screenshot description, or excerpt)
- Why it's relevant — the pattern, the feeling, the technique it demonstrates
- The tech stack — what's structurally translatable vs aesthetically reference-only

### 3. Triage

Categorize each captured reference:
- **active** — primary direction; drives brainstorm decisions; will be translated
- **parked** — interesting but secondary; carries forward as context without driving decisions
- **rejected** — noted but excluded (wrong register, already decided against)

Present the triage summary. Confirm with the user before translating.

### 4. Translate

Start the visual companion. For each **active** reference, render one translation canvas screen. **Load [references/translate-canvas.md](references/translate-canvas.md)** for the HTML fragment template, fidelity rules, and the decision/park protocol.

Skip translation for UX pattern references (Mobbin) — those are structural context, not visual. Note them in the ledger's structural context section.

### 5. Write Capture Ledger

Save to `.prism/shared/captures/YYYY-MM-DD-<topic>.md`:

```markdown
# {Topic} — Capture Ledger

**Date:** {date}
**Status:** Complete — ready for prism-brainstorm
**Sources:** {list of selected sources}

## Active References

### {source} · {reference name}
- **What:** {specific description}
- **Why relevant:** {what draws you to it}
- **Translatable:** {what carries into Griotwave} / {what is aesthetic-only}
- **Fidelity reached:** lo | mid | hi

## Parked References
{one line each — name + reason parked}

## Rejected References
{one line each — name + reason excluded}

## Source Vocabulary
{the selected sources — prism-brainstorm reads this to skip its source question}

## Structural Context
{any UX pattern / flow references — for prism-plan, not visual companion}
```

### 6. Transition

> "Capture complete — `.prism/shared/captures/{filename}` is ready.
> `/prism-brainstorm` will open with your references pre-loaded."

## Rules

1. **Document, don't decide** — this phase captures; prism-brainstorm decides
2. **Translate every active reference** — no active reference leaves Triage without a companion render
3. **Source vocabulary travels forward** — the ledger's source list supersedes prism-brainstorm's source question
4. **Gate on triage confirmation** — do not translate until the active/parked/rejected split is confirmed
5. **Structural references go to the ledger, not the canvas** — UX patterns inform architecture, not aesthetics

> See also: [prism-brainstorm/references/design-sources.md](../prism-brainstorm/references/design-sources.md) for the shared source vocabulary used across both skills.
