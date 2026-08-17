# Drawer State — `state/decisions.json`

The visual companion's right-side drawer renders from a single state file: `$STATE_DIR/decisions.json`. Whenever you classify a user message as `decide` or `park`, write the file directly via the Write tool. The brainstorm server watches the file and broadcasts a `state-update` message to the browser, which re-renders the drawer in real time. **No round-trip through the user is needed.**

## Schema

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

### Field reference

- `decisions[].q` — short ID like `Q1`, `Q2`, `Q3` (track question order)
- `decisions[].label` — one-line summary of what was being decided
- `decisions[].choice` — letter or short identifier of the pick
- `decisions[].summary` — one-line description of the chosen option
- `parked[].fromQ` — the question this concern branched off (back-pointer)
- `parked[].label` — short title of the parked concern
- `parked[].concern` — one-sentence description
- `parked[].revisit` — when/how it should be revisited

## Read-merge-write protocol

Always read the existing file first (it may already contain entries from earlier in the session), append, then write the merged state back. **Never overwrite existing entries.**

## Health signal

When `parked.length >= 5`, the drawer auto-renders a yellow warning *"Long parking lot — session may be over-scoped"*. Treat this as a prompt to pause and ask the user whether the brainstorm scope should be narrowed before continuing. Do NOT silently keep parking.
