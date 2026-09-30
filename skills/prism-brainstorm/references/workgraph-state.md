# Workgraph State — `state/workgraph.json`

The qrail-graph rail's WORKGRAPH direction lane, LAYERS state lane, and TIMELINE view all read a
second state file, alongside `$STATE_DIR/decisions.json`: `$STATE_DIR/workgraph.json`. It carries
harvested/emitted nodes — what `griot-viz-engine`'s `scripts/emit-screen.mjs --companion` target
draws — so the rail reflects the canvas, not just the decision spine.

**decisions.json and workgraph.json are two independent channels, not one merged file.** The
drawer (Decisions / Parked panes) reads decisions.json only. The qrail-graph rail reads both and
renders them as one picture — decisions never appear as workgraph nodes and vice versa.

## Schema

```json
{
  "nodes": [
    {
      "id": "genesis",
      "q": "genesis",
      "label": "Session opened",
      "summary": "Inbound context or the opening question — the FIRST thing shown, one line",
      "state": "open",
      "layer": null,
      "at": 1757740800000
    },
    {
      "id": "genoffice-shell-appframe",
      "label": "AppFrame (shell chrome)",
      "state": "open",
      "layer": "Djeli · container",
      "screen": "viz-harvested-components-companion.html",
      "at": 1757740801000
    }
  ],
  "edges": [
    { "id": "genoffice-shell-appframe->genoffice-shell-tabbar", "fromNode": "genoffice-shell-appframe", "toNode": "genoffice-shell-tabbar" }
  ]
}
```

### Field reference

- `nodes[].id` — stable identifier (also used for `data-q` and dedup on read-merge-write)
- `nodes[].label` — one line, shown in the rail row
- `nodes[].state` — `done` | `superseded` | `parked` | `open` — decides the LAYERS lane, same
  four buckets decisions use. Default `open` when omitted.
- `nodes[].layer` — one of the eleven roles in `src/core/layer-roles.ts` (or `null` for a
  marker that isn't a component, like the genesis seed)
- `nodes[].destination` / `.source` / `.maps` — optional, same shape as a decision's direction
  fields. Omitted (the common case for a freshly-harvested node) files the row into the
  **local** WORKGRAPH lane — a node that hasn't been routed anywhere yet is local to this
  canvas, not invisible.
- `nodes[].screen` — content-dir filename the node's card came from, if any (enables the
  rail-row → screen click-through the same way a decision's `screen` field does)
- `nodes[].at` — epoch ms, the only ordering key TIMELINE mode has for this channel (decisions
  order by `q`, not by time — see the Two Channels, One Timeline note below)
- `edges[].fromNode` / `.toNode` — for parity with the canvas; not currently rendered as rail
  rows, only used by future graph-shaped views

## Seed requirement — panels are never empty (Decision 7)

**Write a genesis node before asking Q1.** The very first thing a brainstorm session does —
starting the companion server — should be followed by writing a `state/workgraph.json` with one
node: `id: "genesis"`, `state: "open"`, and a `summary` naming the actual inbound context or the
opening question for THIS session. This is what makes LAYERS and TIMELINE non-empty from the
first paint, before any decision exists — an empty panel at session start is a defect, not a
neutral initial state.

If `griot-viz-engine`'s `emit-screen.mjs --companion` target runs first (because the session's
first screen is a harvested-component canvas), it writes this seed for you — it is one write in
the same file, not two competing writers. If your session has no engine screen, write the seed
yourself, same as decisions.json:

```json
{ "nodes": [{ "id": "genesis", "state": "open", "label": "Session opened",
              "summary": "<the inbound context or opening question>", "at": <Date.now()> }],
  "edges": [] }
```

`server.cjs`'s `GET /state/workgraph.json` route also defaults to a (generic) genesis-only
payload when the file doesn't exist yet, as a second line of defense — but a real seed with the
actual session context is always better than the generic fallback text.

## Read-merge-write protocol

Identical discipline to decisions.json (see `drawer-state.md`): read the existing file first, add
what's new by `id`, write the merged state back. **Never overwrite or remove an existing node or
edge** — supersede in place (`supersededBy` on the node, same convention decisions use) rather
than deleting.

## Live updates

`server.cjs` watches `$STATE_DIR` for both `decisions.json` and `workgraph.json` (separately
debounced). A workgraph.json change broadcasts:

```json
{ "type": "workgraph-update", "payload": { "nodes": [...], "edges": [...] } }
```

`helper.js` keeps the two channels' last-known state cached and re-renders the rail from both on
either update — there is also a `GET /state/workgraph.json` route helper.js calls once on initial
connect, mirroring the decisions.json route.

## Two Channels, One Timeline

TIMELINE mode renders workgraph nodes (sorted by `at`) as a leading block, followed by the
existing decision/parked/upcoming spine (ordered by `q`). This is a real simplification, not a
hidden one: the two channels don't share an ordering key yet, so they render as two blocks in one
spine rather than one fully interleaved chronology. An entry that arrives later always **appends**
— nothing already rendered is replaced.
