# Claude Design Emit

Load this reference when executing **Step 6B** — generating the `design_prompt.yaml` for Claude Design.

## When to load

After the markdown sidecar is written (Step 5) and the user confirmed tool choice B. Generate the YAML entirely from the brainstorm ledger — no additional user input required.

## Schema

Save to `.prism/shared/designs/YYYY-MM-DD-<topic>-prompt.yaml`:

```yaml
# prism-design — emitted design prompt for Claude Design
# generated {date} · ledger: {ledger-filename}

meta:
  project: {topic}
  schema_version: 0.1.0
  source_ledger: .prism/shared/brainstorms/{ledger-filename}

locked_decisions:
  - id: Q{n}
    title: "{decision name}"
    choice: "{chosen option}"
    rationale: "{why — from the brainstorm ledger prose under that heading}"
  # one entry per §1 Locked Decision

deferred_concerns:
  - { id: C{n}, title: "{concern}", revisit: "{when}" }
  # verbatim from ledger §2 — do not summarize or reword

design_tokens:
  # Baseline from ledger §3. Override any field where §1 Locked Decisions
  # explicitly picked a different palette, typeface, or motion language.
  palette: { void: "#000", neural: "#3B82F6", bio: "#10B981", violet: "#A855F7" }
  surface: glassmorphic   # backdrop-filter: blur(40px) saturate(140%)
  typography: { display: Inter, eyebrow: "JetBrains Mono" }
  motion: { language: ember-bloom, easing: "spring 50/22" }

visual_reference:
  # Exact value from ledger §3 "Final hi-fi screen:" field.
  # Use "none" if the brainstorm was text-only (no visual companion).
  hi_fi_screen: "{path or none}"

handoff_notes: |
  {verbatim contents of ledger §4 Implementation Handoff Notes}
  {append any architectural decisions made during this prism-design session}
```

## Field mappings from ledger

| YAML field | Source |
|---|---|
| `meta.project` | Topic name from the ledger title |
| `meta.source_ledger` | Ledger filename (not full path) |
| `locked_decisions[].title` | Decision name from each `### Q{n} · {name}` heading in §1 |
| `locked_decisions[].choice` | The `→ **{letter} · {chosen option}**` pick |
| `locked_decisions[].rationale` | Body prose under that heading |
| `deferred_concerns[]` | Each numbered item from §2, verbatim |
| `design_tokens` | §3 baseline — override with §1 picks where applicable |
| `visual_reference.hi_fi_screen` | §3 `**Final hi-fi screen:**` field value |
| `handoff_notes` | §4 verbatim + any design-phase architecture additions |

## Emit instruction

After saving the YAML, tell the user:

> "Your design prompt is saved at `.prism/shared/designs/<filename>-prompt.yaml`.
> Open Claude Design — desktop app or [claude.ai/design](https://claude.ai/design) in a browser — and paste the file contents to begin the visual prototype."

Do NOT open a URL or assume which surface they are on. Clipboard and paste is the integration ceiling.
