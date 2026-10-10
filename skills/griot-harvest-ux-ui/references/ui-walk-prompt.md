# The UI-walk prompt — how to make an agent WALK rather than summarize

Modeled on griot-harvest's analyst-prompt (the highest-value part of that skill). An agent asked
"document the UI" returns a plausible tour. An agent asked to walk a named hierarchy, cite
file:line for every rung, and commit to a layer role returns evidence.

## The five rungs, in order

Every finding climbs this ladder — do not skip a rung:

1. **Component** — the smallest addressable unit (a button, a field, a card).
2. **Screen** — the component's mount context (what page/modal/pane renders it).
3. **Flow** — the sequence of screens a user or agent moves through for one outcome.
4. **Workflow** — the flow's place in the larger product loop (what triggers it, what it feeds).
5. **Provenance** — where this was found: repo, commit, file:line, and who/what harvested it.

A component with no screen, or a screen with no flow, is an incomplete finding — keep climbing or
say explicitly which rung it stalled on and why.

## The six required clauses

**1. Name the destination.** Which layer canvas this lands on and why this target is being walked
at all (e.g. "genoffice's mail surface, to place its screens on the layer canvas").

**2. Demand file:line for every claim.** No rung is exempt. A "screen" with no cited render call is
not a screen, it is a guess.

**3. Demand a layer-role candidate per finding**, chosen only from the nine roles in
[layer-roles.md](./layer-roles.md), or `unplaceable` with the reason. Never a tenth role.

**4. Demand the licence as a field, not a verdict.** `spdx:<id> | none declared`. The agent never
rules on what may be forked, studied, or remixed — that call is Gavin's alone.

**5. Ask what NOT to copy — UX antipatterns are a first-class output**, exactly like code defects:
a confirm-modal with no cancel path, a flow that silently drops state, a screen with no loading
state. Record separately from the pattern itself.

**6. Bound the output.** Write full findings to `.prism/shared/research/<date>-<target>-ux.md` (or
directly to a findings JSON consumed by `scripts/emit-canvas-nodes.mjs`). Return only a ~10-line
summary in-conversation — the detail belongs on disk (invariant I2/I3).

## Documentarian stance

Describe the UI that actually renders. Do not propose redesigns, critique choices, or suggest
improvements beyond noting antipatterns as "what not to copy." Analysis and advocacy are different
jobs.

## Worked skeleton

```
Walk <target repo path>'s <named surface, e.g. "mail compose flow"> and document it at
component -> screen -> flow -> workflow -> provenance precision.

We are placing this on the Griot Stack layer canvas, so I need the real rendered hierarchy,
not a summary.

For each finding:
  1. Component: name + file:line where it renders
  2. Screen: the mount context, file:line
  3. Flow: what sequence this belongs to
  4. Workflow: what triggers it / what it feeds
  5. Provenance: repo, commit (if known), harvested-by, date
  6. Layer-role candidate: one of the nine roles in layer-roles.md, or `unplaceable` + reason
  7. Licence: spdx id or "none declared" — a field, never a verdict
  8. What NOT to copy: any UX antipattern here, if present

Write full findings to `.prism/shared/research/<date>-<target>-ux.md`.
Documentarian only — describe what exists, do not propose redesigns.
Return only a ~10-line summary; the detail belongs in the file.
```

## Smell test before dispatching

- Does the prompt name all five rungs explicitly? If not, expect the agent to stop at "component."
- Does it demand a layer-role candidate? If not, you will get UI notes with nowhere to route.
- Does it ask what not to copy? If not, antipatterns get lifted silently with the pattern.
- Does it bound the output to a file? If not, the orchestrator's context absorbs the whole walk.
