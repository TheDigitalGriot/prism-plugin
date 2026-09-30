# Canvas node schema â€” what xyflow reads directly

**Why this shape.** Decision 4 in the stage contract: the canvas is xyflow (layer 02) because
nodes are a plain JSON array an agent reads and writes directly, with no canvas-widget
indirection. The substrate is the live code graph plus the viz-engine (layer 03), which stays
unsurfaced by this skill â€” this skill's only job is to emit an array in the shape below so an
xyflow canvas can render it with zero translation step.

Every node MUST validate against this shape before it is written. `scripts/emit-canvas-nodes.mjs`
enforces it â€” hand-authoring a node file bypasses the one check that keeps the canvas honest and
is exactly what the contract's success criteria forbid ("not from a hand-authored node list").

## Shape

```json
{
  "id": "genoffice-mail-compose-modal",
  "type": "screen",
  "label": "Compose Modal",
  "layer": "Creation · build/content/3D",
  "position": { "x": 0, "y": 0 },
  "data": {
    "walkLevel": "screen",
    "parentId": "genoffice-mail-shell",
    "origin": {
      "repo": "genoffice",
      "file": "apps/mail/src/components/Compose.tsx",
      "line": 42
    },
    "mountPoint": "apps/mail -> MailShell -> ComposeModal",
    "provenance": {
      "harvestedBy": "griot-harvest-ux-ui",
      "harvestedAt": "2026-09-11",
      "sourceCommit": null
    },
    "licence": "spdx:Apache-2.0",
    "notCopy": []
  }
}
```

## Field rules

| Field | Required | Rule |
|---|---|---|
| `id` | yes | stable, kebab-case, unique within the target's node array â€” used for idempotent merge |
| `type` | yes | one of `component \| screen \| flow \| workflow` |
| `label` | yes | human-readable name |
| `layer` | yes | one of the nine verbatim strings in [layer-roles.md](./layer-roles.md), or the literal `unplaceable` |
| `position` | yes | `{x, y}` â€” placeholder coordinates; xyflow's own layout pass may relocate, the emitter never invents meaning here |
| `data.origin.file` + `data.origin.line` | yes | the file:line the claim is grounded in â€” a node without this is rejected, not defaulted |
| `data.mountPoint` | yes | the render path from app root to this node |
| `data.provenance.harvestedBy` | yes | which skill/agent produced this node |
| `data.licence` | yes | `spdx:<id>` or `"none declared"` â€” a fact field, never a verdict, never omitted |
| `data.notCopy` | no | array of UX antipattern strings, each with its own file:line if applicable |
| `data.parentId` | no | for `flow`/`workflow` nodes composed from earlier `component`/`screen` nodes |

## Output file

One JSON array per target, at `GriotSandbox/<cluster>/<repo>/.griot-ux-canvas-nodes.json` by
default (override with `--out`). The emitter merges by `id` â€” re-running a walk updates existing
nodes in place rather than duplicating them.
