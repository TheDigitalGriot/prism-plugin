---
name: prism-viz-generate
description: Layer 01 of prism-viz-engine — turn a real system into a diagram. Authors archify-shaped JSON IR from source you can cite, gates it against archify's own validator plus a grounding rule, and hands it to the engine, which picks the renderer from the diagram's shape. Use when Gavin asks to diagram, map, or draw a system — "diagram our Cloudflare setup", "map the CC5 to Blender pipeline", "draw how this repo fits together", "show me the deployment" — or when a harvest or codex needs a picture. Never invents a component: every non-external node cites path and line. Does not render (layer 02 does) and does not decide the canvas (route.ts does).
model: opus
---

# prism-viz-generate — layer 01

Take a real system. Produce IR. The engine draws it.

There is no parser here and no prompt engine — **the model reading this file IS the
generator.** That is archify's own architecture (`package.json:6` calls the package
"JSON-IR diagram renderers"; NL never reaches a renderer), and it is why layer 01 is a
skill and not a module.

## Composition — one home per fact

| Job | Owner | This skill's move |
|---|---|---|
| Schema validation | archify's vendored `validator.mjs` | **Call it.** Never write a second validator against the same five schemas. |
| Choosing the canvas | `apps/prism-viz-engine/src/layers/02-render/route.ts` | Set `diagram_type` honestly; the router reads it. Do not pick a renderer here. |
| Drawing | layer 02 | Nothing in this skill renders. |
| Finding the source | `griot-harvest` / `griot-harvest-ux-ui` / the repo itself | Cite what they found; do not re-survey. |

## The walk

### 1. Pick the type — it picks the renderer
Five, from archify's schemas: `architecture` · `workflow` · `sequence` · `dataflow` ·
`lifecycle`. This choice has a consequence — see
[references/type-selection.md](./references/type-selection.md). Getting it wrong produces
a correct diagram in the wrong form, which reads as noise.

### 2. Ground it — every component cites source
`component.sources` is `[{path, line?, end_line?, label?}]`, `path` required, max 3.
**Every non-`external` component carries one.** `external` is exempt: it is outside the
system by definition.

This is the rule the whole engine exists for. A node nobody can trace is a node somebody
made up, and an invented diagram costs more than no diagram — it gets believed. If there
is genuinely nothing to cite (a proposed design, a whiteboard), pass `--allow-ungrounded`
and say so wherever it is published. Full rules:
[references/grounding.md](./references/grounding.md).

### 3. Author the IR
Read the mode schema **and** `common.schema.json` (the `$ref` target holding the shared
enums), both at `apps/prism-viz-engine/vendor/archify/schemas/`. Then read the nearest
example in `vendor/archify/examples/` for structure — and author fresh ids, wording,
facts and layout. archify's own authoring contract says it plainly:
*"Do not invent fields. Use the nearest matching example for structure."*
(`vendor/archify/references/authoring-contract.md`).

Component types are fixed: `frontend` `backend` `database` `cloud` `security`
`messagebus` `external`. Sides are `left` `right` `top` `bottom`. Position is `pos:[x,y]`
with `size:[w,h]`, or `row`/`col` for grid placement — not both.

### 4. Gate it
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/prism-viz-generate/scripts/gate-ir.mjs --in <diagram.json>
```
Runs archify's validator, enforces grounding, reports which renderer the diagram will get,
and places it where the engine reads. **The diagnostics are repair instructions** — they
name the path, the offending value and the allowed set, because archify built them "for
the LLM fixing the JSON" (`validator.mjs:4-5`). Act on them and re-run. It writes nothing
on failure, so there is no partial state to clean up.

### 5. Stop
The engine picks it up from the sidecar. Do not open the canvas on Gavin's behalf and do
not describe what it looks like — **show him the URL.** Describing a visual back to him is
the failure mode, not the fallback (griot-ontology, *"the visual layer IS the substance"*).

## GATE — before calling it done

- every non-`external` component cites `path` (or `--allow-ungrounded` was passed *and said aloud*)
- `diagram_type` was chosen for a reason that is stated, not defaulted
- the gate script exited zero
- nothing was invented to fill a gap — a thin diagram is reported thin
- the renderer the gate reported is the one Gavin expected; if not, say so before he opens it

## What this skill does not do

No rendering, no canvas choice, no repo surveying, no plan writes. It does not publish
artifacts and it does not decide layer roles — those are Gavin's to assign on the canvas.
