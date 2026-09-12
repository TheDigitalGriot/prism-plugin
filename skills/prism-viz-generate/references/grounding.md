# Grounding — the rule the engine exists for

Every non-`external` component cites where it came from:

```json
"sources": [{ "path": "src/renderer/tab-manager.ts", "line": 61, "label": "WebContentsView host" }]
```

`path` is required, `line` / `end_line` / `label` optional, 1–3 entries
(`architecture.schema.json`, `components.items.properties.sources`).

## Why this field and not one of ours

archify already defined it — and **not one of its own examples uses it.** It was sitting
in the contract unused. Adopting it rather than inventing a parallel `provenance` field
keeps one home per fact: a diagram this skill emits stays a valid archify document that
archify's own tooling can read.

It is also the same discipline `griot-harvest-ux-ui` enforces on the UX walk, where every
finding carries `file:line` and the emitter rejects any node without it. Same rule, same
reason, two layers.

## The reason, plainly

An invented diagram is worse than no diagram, because it gets believed. It looks exactly
as authoritative as a true one — the same boxes, the same confident arrows — and the cost
lands later, silently, when someone builds against a component that was never there.

Citing source makes the difference checkable instead of a matter of trust.

## What counts as a source

| Subject | Cite |
|---|---|
| A repo | the file that implements the component, with the line where it is defined |
| Infrastructure | the config that declares it — `wrangler.toml`, a compose file, a terraform block, a dashboard export saved to disk |
| A harvest | the research doc, plus the `file:line` that doc recorded |
| A codex | the codex path and section — it is grounded work already |

## What does not count

- A URL to documentation. Documentation describes intent; the config is the fact.
- "It's obviously there." If it is obvious, the citation is cheap.
- A path you did not open. Do not cite by inference from a filename.
- A screenshot with no path. Save it, cite the saved path, or record it as ungrounded.

## The exemption, and it is narrow

`type: "external"` components are exempt — a customer, a third-party API, the public
internet. They are outside the system, so there is no source of ours to cite. Do not
relabel an internal component `external` to dodge the gate; the type is also a visual
treatment and a lie there shows up in the render.

## When there is genuinely nothing to cite

A proposed design, a whiteboard, a system that does not exist yet. Pass
`--allow-ungrounded`, and **say so wherever the diagram is published.** An ungrounded
diagram is a legitimate artifact — a speculative one presented as observed is not.

The gate prints the ratio either way (`7/9 components cite a source`), so the honest
number travels with the run.
