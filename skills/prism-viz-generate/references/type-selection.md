# Choosing the type — it chooses the renderer

`diagram_type` is not a label. It is the routing decision, read by
`apps/prism-viz-engine/src/layers/02-render/route.ts`, and layer 02's own rule is
**"the right canvas per shape."** Pick it from what the subject IS, not from what the
request called it.

| Type | The shape it fits | Renderer |
|---|---|---|
| `architecture` | Components and how they relate. **Lifts to isometric** if it is real deployment topology — see below. | node-graph, or isometric |
| `workflow` | An ordered chain where sequence is the meaning. CC5 → Reallusion → Blender. | node-graph |
| `sequence` | Ordered exchange between participants over time. | node-graph |
| `dataflow` | Directed movement between stages; the edges are the subject. | node-graph |
| `lifecycle` | States and the transitions between them; the reachable set matters. | node-graph |

## The architecture fork — flat or isometric

This is the one that matters, and it is not a style preference. **Gavin asked for the
isometric camera on certain diagrams — deployment topology, things that occupy
somewhere — and explicitly not on everything.** An isometric render of an application
architecture invents a geography the data does not contain.

The test is archify's own, not one invented here. `deploymentOwnershipDiagnostics`
(`vendor/archify/renderers/shared/engineering-profiles.mjs`) defines a deployment diagram
as one that satisfies:

- at least one `region` **and** one `security-group` boundary (`:30-41`)
- every non-`external` component names its operator in `tag` (`:45-54`)
- every component belongs to exactly one `region` (`:56-78`)
- every `database` sits inside a `security-group` (`:80-92`)
- region-consistency inside private boundaries (`:95-117`)
- a named label on every boundary-crossing connection (`:119-142`)

`gate-ir.mjs` runs that profile and tells you which renderer you are getting **before**
the canvas opens. If you wanted isometric and got flat, the diagnostics say exactly which
of those six you did not satisfy.

**Why ownership is the discriminator:** a real deployment diagram names who operates each
box. An application architecture does not. Three earlier attempts at this test failed —
a word list over labels, then the boundary `kind` (meaningless: the schema's enum is only
`["region","security-group"]`, reused for any grouping, so `kind=region` labels both
"AWS us-east-1 / production" and "archify/ skill package"), then cloud-provider regexes.
Ownership separated them where none of those could.

## Do not force the fork

If a system genuinely is deployment topology, satisfying the profile is honest work that
makes the diagram better — owners and regions are facts worth recording. If it is not,
**leave it flat.** Adding a fake `region` boundary to get the isometric look is exactly
the invention this engine exists to prevent, and it will read as a floor plan of a place
that does not exist.
