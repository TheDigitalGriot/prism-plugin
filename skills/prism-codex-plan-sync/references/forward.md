# Forward pipeline — codex → executable work

The forward direction turns a locked codex into a runnable Prism plan + `stories.json`, with a
Gavel ceremony resolving the codex's open decisions first (so the plan passes its
No-Placeholders gate). Run the steps in order.

## 1. Read the codex

Codexes are single self-contained HTML artifacts (`<app>-codex.html`) in the Griotwave
ember-bloom style, produced by `griot-app-codex`. They live **both** as a live Cowork artifact
(id `<app>-codex`) **and** in git at `TheDigitalGriot/griot-live-artifacts/live/<app>-codex.html`.

Read the git copy (source of truth) or stage the live artifact. Extract:

- **Thesis** — the ~6-word locked premise + body + a real quote.
- **Components** — the `.mod` grid (borrowed ones carry `.mod.enrich` + `.mharvest`).
- **Spine** — one component's hard technical pipeline (kept separate from the component list).
- **Flows** — control-in/out or capture/playback dualities.
- **Build order** — `.step` cards (`.step.gate` = the long pole).
- **OSS harvest + license posture** — per borrowed repo, `code-safe` (permissive, may lift code)
  vs `pattern-only` (GPL/AGPL, re-implement native). Travels with the component that borrows it.
- **OPEN decisions** — the `[OPT:OPEN]` callouts + any DGS `ITEMS[]` row with
  `type:'open-question'`/`'decision'` and `decision:'undecided'` for this app.
- **Device** — the codex's real UX/UI: which device block it carries, its surfaces, the frames per
  surface, and per surface whether the destination holds a real export or a self-declaring
  placeholder. Extract it with the named step below; never skip it because a codex "has no UI yet".

The ember/accent comes from the DGS plan's `APPS[].color` for the app.

### Device extraction — real export vs self-declaring placeholder

The device block is where a codex shows what the app actually looks like, and where it admits what
does not exist yet. Read it; don't count it. (Full contract with template + reference line cites:
`.prism/shared/research/2026-09-15-codex-device-contract.md` in the Prism repo.)

1. **Identify the device block(s).** Two device kinds exist, and one never replaces the other:
   - **form-factor device** — `[OPT:DEVICE]`, `tsd-*` classes, `.tsd-btn` desktop/tablet/phone toggles
     over ONE design;
   - **surfaces device** — `[OPT:DEVICE-SURFACES]`, toggles are the app's NAMED SURFACES (VS Code ·
     desktop · CLI/TUI · mobile · foundation). Template prefix `tsdx-*`; Prism's live codex uses `pfx-*`.
   Read every device block present. No device block at all, for an app that has a UI, is itself a gap
   (step 2).
2. **Enumerate surfaces and frames.** For a surfaces device, read the toggle buttons
   (`data-surf="KEY"` · `<b>NAME</b>`) and the JSON payload (`<script id="…Data" type="application/json">`
   → `frames[]` records `{id, s, t, label, note, src}` + `turns{}`). Frames for a surface = records whose
   `s` equals its key. A frame is a JSON record painted into one shared `<img>`, not a DOM node. For a
   form-factor device the single surface is the design inside `.tsd-screen`.
3. **Classify each surface by what the DESTINATION holds** — never by a raw token count:
   - **real export** — a real image is there: frame records carrying a `src` data-URL (surfaces device),
     or an `<img>` inside `.tsd-screen` (form-factor; usually `class="tsd-shot"`, but anansi and kora
     carry a class-less `<img>`);
   - **self-declaring placeholder** — the surface says it is empty: `<div class="tsd-ph">`, usually with
     `<div class="pt">Design pending` (sometimes inline-styled, sometimes with different text);
   - **absent** — a surface the app ships (per the codex's components/thesis) with no toggle at all.
   A bare `tsd-shot` count is polluted by the CSS rule, and an exact `class="tsd-ph">` string misses an
   inline-styled placeholder — match the element. (N16/B27: the "empty" slots were never empty; each
   held an explicit self-declaring placeholder, and seven codexes already held real exports.)
4. **Carry the provenance line.** The `*-cap` element (`.tsd-cap` / `.tsdx-cap` / `.pfx-cap`) names the
   source `.dc.html`, the Claude Design project, the recovery channel (`griot-cc-cd-sync`) and the date.
   Keep it verbatim per surface — step 4 seeds surface-scoped stories from it.

Output: one row per surface — `surface key · device kind · frame ids · real export | placeholder |
absent · provenance line`. Steps 2 and 4 consume this table.

## 2. Gavel ceremony — resolve the OPEN decisions FIRST

A codex legitimately carries open questions; a plan legally carries **none** (the No-Placeholders
IRON LAW rejects `TBD`/`TODO`/"see above"/vague quantifiers). So every open decision must be
**resolved or explicitly scoped out** before it can become a plan task — you cannot pass an open
decision straight through.

For each `[OPT:OPEN]` / `decision:'undecided'` item:

1. Surface it to Gavin with the codex's framing of the trade-off.
2. Get his ruling — the three axes **set together**:
   - `decision`: `adopt` (SOTA pick, building on it) · `trial` (evaluate first) · `defer` (good, later) · `pass` (reviewed, not using)
   - `role`: `scaffold` (app built on it) · `component` (library dropped in) · `pattern` (approach reimplemented)
   - `stage`: `now` · `next` · `later`
   — or, for a design question, a resolved answer.
3. **Close it to the DGS store via the `dgs-plan-update` loop**: sync-check → edit the item's
   `decision`/`role`/`stage` → verify render (Node regex counts) → git commit → `update_artifact`.
   A tool not yet on the shelf is added to BOTH the Potluck `T[]` and a paired DGS `oss-inspo`
   item first, then decided.
4. Anything Gavin defers/passes that would otherwise be a task → record it in the plan's
   `## What We're NOT Doing`, not as a task.
5. **A placeholder surface is a GAP, not a decision.** A self-declaring placeholder or an absent
   surface from the device extraction (step 1) is NOT an `[OPT:OPEN]` item and is not put to the
   Gavel — there is nothing to rule on; the codex already says the design does not exist yet. Route
   every one explicitly, one of two ways:
   - **a task** — "export/render the `<surface>` design" becomes a surface-scoped story (step 4); or
   - **`## What We're NOT Doing`** — named, with its surface key, when this plan will not produce it.
   It never passes silently through the No-Placeholders gate as if resolved: a plan that says nothing
   about a placeholder surface has hidden a known gap. `coverage.md` lists each placeholder/absent
   surface under a story or under `## Intentional Exclusions`.

The Gavel ceremony is an in-chat decision step in v1 (no MCP). The future
`close_decision(id, decision, role, stage)` MCP verb is where this moves once the decision bus
(Kit-for-AI / Parallel MCP / Almanac) is wired.

## 3. Scaffold `.prism/`

Plan, stories, and research all live under `.prism/`. If the app repo has none, run
`/prism:prism-init` first (the codex consolidation ritual already does this in its Phase 4).
A plan written into a bare directory is an orphan.

## 4. Emit the plan + stories TOGETHER

A plan without a `stories.json` is incomplete — emit both in one pass.

**Plan** → `.prism/shared/plans/YYYY-MM-DD-<app>.md` (template: `prism-plan`'s `references/plan-template.md`):
- Frontmatter **`epic:`** = kebab-slug of the plan filename. This is the spine joining
  `plan.md` ↔ `stories.json`; either is findable from the other. **Set it, or implement refuses.**
- Sections: `## My Understanding` (Goal / Key Files / Patterns / Constraints / Questions) ·
  `## Approach Options` · `## Proposed Phases` · **Success Criteria** split into
  `#### Automated Verification:` and `#### Manual Verification:` (each a `- [ ]` list) ·
  per-phase files/steps + verification commands + `**Checkpoint**: [x] Phase N complete` ·
  `## Structural Impact (graph-informed)` (optional, only if the codebase-memory-mcp graph was
  indexed) · mandatory `## What We're NOT Doing` · `## Session Notes - [Date]`.
- Map codex → plan: thesis → Goal/My Understanding; components + spine → Phases; build order →
  Proposed Phases; license band → Constraints + What We're NOT Doing; resolved decisions →
  Approach Options.

**Stories** → `.prism/stories/stories.json` (flat) or `.prism/stories/<epic-slug>/stories.json`
(per-epic) + `coverage.md`. Emit via `decompose_plan` (the command `prism-plan` Step 6 calls);
for a very large codex, delegate to the `prism-decompose` skill. Schema:

```json
{
  "epic": { "name", "source", "qualityGates":[], "decisions":[], "references":[], "outOfScope":[], "risks":[] },
  "stories": [{
    "id": "STORY-001",            // zero-padded, sequential, STABLE across re-emits
    "title": "Short verb phrase",
    "description": "Full behavioral requirement (the acceptance criteria)",
    "priority": 1,
    "status": "pending",          // pending -> done
    "blockedBy": null,            // story id of dependency, or null
    "files": [{"path":"src/...","action":"modify"}],
    "steps": [{"description":"...","done": false}],
    "context": { "why", "risks":[], "edgeCases":[], "patterns":[], "graphTargets":["qualified::name#Function"] }
  }]
}
```

`coverage.md` is mandatory: a `Requirement → Story Mapping` table + an `## Intentional Exclusions`
section. Requirements found MUST equal stories emitted + intentional exclusions. Populate
`context.graphTargets` from the codex spine where you can.

**Surface-scoped stories.** Any story that produces or changes a UI is scoped to ONE device surface
from the step-1 device table:

- `context.surface` — the surface key (`data-surf`, e.g. `vscode` · `electron` · `cli` · `mobile` ·
  `foundation`; for a form-factor device, the app's single surface). One surface per story — work that
  spans surfaces is one story per surface, chained with `blockedBy`.
- `context.graphTargets` — seeded from that surface's **provenance line** as well as the spine: the
  named source export (`"<Source>.dc.html#<frameId>"`) for the design side, plus the code symbols that
  render the surface (`qualified::name#Function`) for the build side. The reverse channel matches a
  landed UI back to its frame through these.
- A placeholder or absent surface routed to a task in step 2 is a story here, with `context.surface`
  set and acceptance criteria that name the real export it must produce.
- A surface the codex does not have yet is scoped as a **new toggle state** — its acceptance criteria
  say "adds the `<key>` toggle and its frames", never "replaces frame X".

## 5. Route the executor from the story graph

Do NOT hard-wire one executor. Read the graph you just emitted (`files[]`, `blockedBy`, `priority`)
and recommend:

| Signal | Executor |
|---|---|
| single phase / quick fix | `prism-implement` (serial, in-conversation) |
| 3–10 stories, any file overlap OR any `blockedBy` edge | `prism-subagent` (serial, fresh-context-isolated + 2-stage review + retry/escalation) |
| disjoint `files[]` **and** all `blockedBy: null` | `prism-dispatch` (real fan-out, ≤5 agents/wave) |
| 10+ autonomous stories | `spectrum` (per-branch/worktree) |

**Note the correction:** `prism-subagent` is NOT parallel — its Iron Law is "one implementer at a
time" (files overlap). Its edge over `prism-implement` is isolation + review, not concurrency. True
concurrent implementers require filesystem isolation (dispatch's disjoint-domain rule, or worktrees).

Hand the plan + stories to the chosen executor. The reverse channel (see `reverse.md`) then
harvests whatever it discovers, executor-agnostically.
