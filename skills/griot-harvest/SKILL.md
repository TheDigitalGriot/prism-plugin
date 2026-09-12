---
name: griot-harvest
description: Ground an OSS repo against its actual code and decide how it fits the Griot ecosystem, then close the decision into the DGS plan. Use when Gavin points at a repo URL, says "harvest this", "what's in this repo", "how would this fit", "can we lift this", "add this to the lift", or hands over the results of a Cinopsis video run. Also use to re-ground a tool already on the Potluck shelf whose blurb is thin, stale, or unverified. Clones into the sandbox, dispatches one analyst agent PER PATTERN, demands file:line for every claim, and reports corrections to the prior hypothesis loudly. Ends by handing decisions to dgs-plan-update — it never writes the plan itself.
model: opus
---

# Griot Harvest

Take a repo. Find out what is **actually** in it. Decide how it fits. Close the decision.

> **Stuck Protocol (non-negotiable):** if any device/cloud tool returns empty/`[]`/"not connected"/403
> or fails first-call, do NOT report it blocked. Retry 2-3x → switch surface → replay the logs (last
> successful run, copy its tool sequence) → then ask Gavin ONE direct question. Gavin's word about
> his own machine is GROUND TRUTH. "Blocked" without those steps is a DEFINED ERROR.

## The Iron Law

**A harvest that repeats an unverified claim is worse than no harvest.** On 2026-09-06 every one of
six repos overturned something the planning session believed — token sizes, tool names, latency
figures, auth mechanisms, envelope shapes — and two headline metrics turned out to be *other
people's measurements of the problem*, not the tool's results. Grounding is the whole job.

## ENTER — three input types

| input | example |
|---|---|
| a **repo URL** or `owner/repo` | "harvest `github.com/x/y`" |
| a **Potluck shelf hit** | a tool from `griot-potluck-search` whose blurb is thin or unverified |
| a **Cinopsis result** | the tool list from a video run — `Cinopsis → griot-harvest → dgs-plan-update` |

**Never ingest video here.** Cinopsis owns that surface and earned it the hard way; treat its
output as the contract, never reach into its internals.

## The walk

### 1. Survey — run the script, do not improvise

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/griot-harvest/scripts/harvest-survey.mjs \
  --cluster <cluster-name> <repo-url|owner/repo> [...]
```

Shallow-clones into `GriotSandbox/<cluster>/` (idempotent — never re-clones or clobbers) and prints
last commit + age, file/dir counts, language mix, top-level layout, README head, and **licence**.
It never measures disk size: a `du` over a large tree once blew the tool timeout and took the whole
survey with it.

**Licence is a FACT for a field** (`spdx | none declared`) — never a verdict in prose. Do not tell
Gavin what he may do with a repo. Studying, forking and experimenting are never gated; that call is
his alone.

### 2. Check the shelf FIRST — my tools before the web

Run **`griot-potluck-search`** before any web search. It is usually already there.

Distil keywords to **mechanisms, and to the whole family**. The 2026-09-06 miss: a search for
`canvas, component, provenance` returned canvases and missed the entire *diagram* family — 7 of 9
repos Gavin named were already on the shelf, one already at `trial/next`. Also glob **artifact
names, not just `*codex*`**: the `prism-viz-engine-cluster` artifact was invisible to a `*codex*`
glob and turned out to hold the answer.

### 3. Delegate — one agent PER PATTERN, not per repo

Dispatch **`codebase-analyzer`** agents in parallel. A repo carrying two liftable patterns gets two
agents; three thin repos in one lane get one.

Each agent MUST: state the prior hypothesis, attack it, cite **file:line** for every claim, write
findings to `.prism/shared/research/<date>-<tool>.md`, and return **only ~10 lines**.

The prompt shape is the highest-value part of this skill — see
[references/analyst-prompt.md](./references/analyst-prompt.md). Do not improvise it.

> **Agent-type constraint:** `web-search-researcher` has **no Write tool** (WebSearch/WebFetch/Read
> only) — it cannot persist a doc. Use `codebase-analyzer` for anything that must write, or have
> the orchestrator write the returned content. Two docs were nearly lost to this.

**Never bulk-read in the main thread** (invariant I3). Delegate, write to disk (I2), return summaries.

### 4. Ground the LANDING ZONE — separately

Dispatch one more agent at **the Griot code the pattern would land in**. Fit is a claim about *two*
codebases; without this the harvest is aspirational.

This is where value concentrates: on 2026-09-06 it revealed the Prism broker was already **built**
(assumed spec-only), already minting a pairing token that is **never stored or compared**, and that
the file bus was not registered with it. That reframed the entire lift.

### 5. GATE — before any decision is written

- every claim carries file:line
- **every quoted metric carries its source** — who measured it, of what
- corrections to the prior hypothesis are stated **loudly**, not buried
- **defects are recorded separately from the pattern** — what NOT to copy is a first-class output
- licence recorded as a field
- heartbeat advanced at `.prism/local/<cluster>-harvest-progress.txt` (I5)

### 6. CLOSE — hand off, never write the plan yourself

Call **`dgs-plan-update`** with decision (`adopt|trial|defer|pass`) + role (`scaffold|component|pattern`)
+ stage (`now|next|later`) + targets. It owns `POT_T`, the derived `oss-inspo` mirror, codex harvest
rows and the `CODEXES[]` registry. One home per fact.

**The mirror is derived.** Adding to `POT_T` without regenerating the paired `oss-inspo` item leaves
the stat tiles wrong — caught when a tile read 1147 against a `POT_T` of 1149.

## Nomenclature

**Spectrum** (ours) not ICM (the upstream methodology it derives from) · **Arkestra** for the
model-governance layer ("the Governor" in speech) · **MCP** = Model Context Protocol.

## Composition — one home per fact

- **`griot-potluck-search`** owns shelf search + weighing. Call it; never re-implement it.
- **`dgs-plan-update`** owns every plan write. Call it; never edit `POT_T` here.
- **Cinopsis** owns video. Consume its output; never reach inside.
- `griot-harvest` owns the sandbox clone, the code-grounded research doc, and the fit verdict.

## Sequencing

**Harvest first, architect second.** Do not fix a layer graph or commit an architecture before the
repos are grounded — the harvest routinely surfaces pieces nobody knew were there.
