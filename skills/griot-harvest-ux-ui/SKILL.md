---
name: griot-harvest-ux-ui
description: Walk a sandboxed target's real UI — component, screen, flow, workflow, provenance — and route every finding to one of the eleven Griot Stack layer roles, emitting xyflow-ready canvas nodes with file:line origins. Use once griot-harvest has already cloned/surveyed a target in GriotSandbox (e.g. genoffice, orca) and Gavin wants its screens placed on the layer canvas — "walk the UI on X", "harvest the screens from X", "route X's UI into the layer roles", "what layer does this screen belong in", or "build canvas nodes for X". Never clones or surveys itself — that is griot-harvest's job, called not reimplemented. Never writes the DGS plan — that is dgs-plan-update's job. Demands file:line for every finding and treats licence as a fact, never a verdict.
model: opus
---

# Griot Harvest — UX/UI

Take a target already on disk in `GriotSandbox/`. Walk its **real, rendered** UI. Place every
screen on the layer canvas. Nothing sketched, nothing inferred.

> **Stuck Protocol (non-negotiable):** if any tool returns empty/`[]`/"not connected"/403 or fails
> first-call, do NOT report it blocked. Retry 2-3x â†’ switch surface â†’ replay the logs â†’ then ask
> Gavin ONE direct question. "Blocked" without those steps is a DEFINED ERROR.

## Composition — one home per fact

This skill owns exactly one thing: **the UI walk (component â†’ screen â†’ flow â†’ workflow â†’
provenance) and the layer routing.** Everything else is a call, never a reimplementation:

| Job | Owner | This skill's move |
|---|---|---|
| Clone + survey the repo, ground the fit | `griot-harvest` | **Call it.** If the target isn't already surveyed in `GriotSandbox/`, stop and say so — do not clone here. |
| Shelf search | `griot-potluck-search` | Call it only if a harvested pattern needs shelf grounding. |
| Plan writes | `dgs-plan-update` | Never write `POT_T`, `oss-inspo`, or `CODEXES[]` from here. |

## ENTER

A target directory already on disk, e.g. `GriotSandbox/genoffice`, `GriotSandbox/orca`. If it
isn't there, this skill cannot start — hand off to `griot-harvest` first.

## The walk

### 1. Confirm the target is surveyed
Check `GriotSandbox/<cluster>/<repo>` exists. If not, stop — do not clone. Read whatever
`griot-harvest` already wrote to `.prism/shared/research/` for this target so the walk isn't
starting cold.

### 2. Dispatch one `codebase-analyzer` agent per screen cluster, not per repo
Follow [references/ui-walk-prompt.md](./references/ui-walk-prompt.md) exactly — do not improvise
the prompt shape. Each agent walks **real rendered UI only**: component â†’ screen â†’ flow â†’
workflow, cites file:line for every claim, records provenance, and proposes a layer role from
[references/layer-roles.md](./references/layer-roles.md) — or flags the finding **unplaceable**
rather than force-fitting a tenth role.

### 3. Route — eleven roles, verbatim, no twelfth
Layer roles are locked, verbatim from the Griot Stack (`griot-suite-map.html` LNAME array,
artifact `c389ca6c`): **Djeli · container · Collaboration · GenTeam · Creation · build/content/3D ·
Capture · Intelligence · Super Agent · Governance · Governor · Model-making / data science ·
Memory · foundation · Deployment.** Full heuristics per role: [references/layer-roles.md](./references/layer-roles.md).
Every finding gets exactly one of these, or `unplaceable`. Never invent an additional role.

### 4. Emit canvas nodes — mechanical, not prose
Run the validator/emitter rather than hand-authoring JSON:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/griot-harvest-ux-ui/scripts/emit-canvas-nodes.mjs \
  --cluster <cluster-name> --in <agent-findings.json> --out <GriotSandbox path>
```
It rejects (never silently drops) any node missing file:line, missing a valid layer role, or
malformed against [references/canvas-node-schema.md](./references/canvas-node-schema.md), and
merges idempotently by `id` into the target's node array. See the schema doc for the exact shape
xyflow (layer 02) reads directly — no canvas-widget indirection, no hand-authored node list.

### 5. GATE — before anything is called done
- every finding carries file:line
- every quoted metric carries its source (who measured it, of what)
- licence recorded as a field (`spdx | none declared`) — never a verdict; never narrows what Gavin
  forks, studies, or remixes
- corrections to any prior assumption about the target stated loudly, not buried
- `unplaceable` findings reported, not force-routed
- heartbeat advanced at `.prism/local/<cluster>-uxui-progress.txt`

## What this skill does not do

No cloning, no shelf search, no plan writes, no canvas rendering UI of its own — it emits the data
xyflow renders from. Stage 2 (running this against `GriotSandbox/genoffice` and `GriotSandbox/orca`)
and Stage 3 (composing the canvas) are Gavin's calls, not this skill's.

## Nomenclature

**Spectrum** (ours) not ICM · **Djeli** is the container, **Orca** (stablyai/orca) is the fork base
both Djeli and Prism share, **GenOffice** (genspark-ai/genoffice) is the office surface folded in —
not the fork base. Do not reintroduce the overturned Sep-5 denial of this lineage.
