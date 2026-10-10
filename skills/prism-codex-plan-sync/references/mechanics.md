# Mechanics & load-bearing seams

The gotchas a codex→plan bridge dies on if it ignores them. Every one of these is a real failure
that has bitten before — respect them.

## The spine: `epic:` back-link

`plan.md` ↔ `stories.json` are joined **only** by the `epic:` frontmatter (kebab-slug of the plan
filename) matching `stories.json`'s `epic`. If the bridge emits a plan without setting `epic:` and
emitting `stories.json` in the same pass, `prism-implement` refuses and prompts to run
`decompose_plan`. "A plan without a `stories.json` is incomplete."

## `stories.json` is status truth, not the plan

`prism-implement` writes `status: done` / `completedAt` into `stories.json`; plan checkboxes
(`**Checkpoint**: [x]`) are narrative mirrors only. Any reverse-channel read of "what got built"
reads `stories.json` (implement) or the newest `state.json` (subagent) or `git log` — **never** the
plan checkboxes.

## Stable `STORY-NNN` ids across re-emits

Re-running `decompose_plan` after a codex edit must NOT renumber existing stories — the ids are
stable, or you break `blockedBy` graphs and resume-awareness (`completedAt` / `commitHash`). When a
codex change adds work, append new `STORY-NNN` ids; don't reflow the existing ones.

## `.prism/` must exist first

Plan / stories / research all live under `.prism/`. Run `/prism:prism-init` if the app repo is bare.

## No-Placeholders gate blocks unresolved codex decisions

A codex legitimately carries `[OPT:OPEN]`; a plan legally carries none (`TBD`/`TODO`/"see above"/
vague quantifiers fail). The Gavel ceremony (see `forward.md` step 2) exists precisely to resolve or
explicitly scope-out every open decision before it becomes a task. You cannot pass an open decision
through.

## Editing the masters: add-in-place, never rewrite

The DGS plan and Potluck are single self-contained HTML files whose data lives in JS arrays
(`APPS[]`, `EDGES[]`, `ITEMS[]`, `MODELS[]`, `T[]`); counts / tabs / matrices auto-recompute from
array length + field values, so you never hand-edit a count.

- **Append before the closing `];`** with `Edit`/targeted insert — never `Write` the whole file.
- **DGS uses single quotes; Potluck uses double quotes.** Match the file.
- Potluck lanes (`core`/`client`/`personal`/`inspo`) are explicit slug-membership **Sets** — NOT
  derived from `tg` weight. Never move a slug to "tidy" a lane.
- `tg` uses display names (`"Prism"`); DGS `ITEMS[].app` uses lowercase ids (`prism`, `ashe`).
- Set the decision axes (`decision` + `role` + `stage`) **together** — a partially-set `oss-inspo`
  item renders inconsistently in the Gavel cockpit.
- **External OSS names that collide with app names are NOT renamed** (e.g. `Kente / KRBN`,
  `calesthio/OpenMontage`) — protect them before any rename sweep.

## Device-side execution + git

The masters' git source of truth is `<GriotMeta>/griot-live-artifacts/live/`. Scans and
git write-backs run **device-side via Windows-MCP PowerShell** — NOT `device_bash` (its VM has no
GitHub network and times out on big trees) and NOT cloud egress (blocked). Prism plugin skills
(`prism-plan`, `decompose_plan`, `prism-implement`, `griot-agent-architect`) load only inside the repo;
run them device-side via headless `claude.exe -p` in `GriotApps\Prism` (the daemon is NOT required —
it is mobile/remote-only). "Won't run here" is a routing problem, not a blocker.

## Counting + staging gotchas (both have bitten)

- **Count with Node regex, never PowerShell `Select-String .Matches.Count`** — the latter miscounts
  over the bridge. Use `fs.readFileSync(p,'utf8')` then `(c.match(/token/g)||[]).length`.
- **`device_stage_files` can serve a STALE cached copy when re-staging the same path** (the cloud
  mount dir-cache). To force a fresh copy for an artifact push, `Copy-Item` the device file to a
  never-staged filename, stage THAT, then delete the temp.
- **Verify data-array edits parse** before committing: extract the data `<script>` and
  `new Function(body)` it (a `SyntaxError` throws) — the JSON-LD `<script type="application/json">`
  and `text/plain` design-prompt blocks are expected non-JS false-positives, skip them.

## Propagation targets - every copy needs a gate (invariant I11)

The law: a propagation target is any copy that something WRITES TO and nothing CHECKS. Before
claiming a codex or plan is synced, ENUMERATE every target holding a copy of what changed and NAME
the gate for each. A target with no named gate is STALE BY DEFAULT. This is invariant I11 in the
ontology; four instances have been found, the fourth measured 2026-09-12.

This skill's own targets, as a list: the codex HTML in griot-live-artifacts (gate: git commit), the
live gallery card (gate: the top-level Artifact publish), .prism/shared/plans/<plan>.md (gate: the
epic back-link), .prism/stories/stories.json (gate: stable STORY-NNN ids), and the DGS master
ITEMS[] decision row (gate: the dgs-plan-update loop).

Every edit to a codex (forward emit-notes or reverse amend) requires re-pushing the artifact
(the top-level `Artifact` tool — republish the same file path to keep the URL, or pass `url=` to
update from another conversation) — the step that silently goes stale. Both halves are required:
the griot-live-artifacts commit AND the Artifact publish. The live gallery card must
never lag the git repo.

## Codex device injection — prefix split, accent chain, refuse-to-write triad

Every write into a codex's device block (a reverse frame re-render, a new toggle state, filling a
placeholder) obeys all three below. Grounding with line cites:
`.prism/shared/research/2026-09-15-codex-device-contract.md`.

### Prefix split — match the destination, never the template

The same device renders under different class prefixes depending on where it lives. Read the
destination's prefix before writing: a selector aimed at the wrong prefix matches zero elements, and
the write "succeeds" invisibly.

| Destination | Device | Prefix | Real export | Placeholder |
|---|---|---|---|---|
| filled form-factor codexes | `[OPT:DEVICE]` | `tsd-*` | `<img class="tsd-shot">` inside `.tsd-screen`, CSS `object-fit:cover; object-position:top center` | `<div class="tsd-ph">` |
| template surfaces device | `[OPT:DEVICE-SURFACES]` | `tsdx-*` | frame record `src` data-URL painted into `#tsdxImg` (`height:auto`, no object-fit) | — |
| Prism (`prism-codex.html`) | surfaces | `pfx-*` (ids `pfxSurf` · `pfxFrames` · `pfxRig` · `pfxImg` · `pfxData`) | 15 frame records in `#pfxData` | none |
| Prism legacy CSS | form-factor era | bare `.stage` · `.rig` · `.frame` · `.screen` · `.placeholder` | CSS rules only — no element carries them | — |

Prism carries **no `tsd-` prefix**. Its bare `.placeholder` / `.screen` / `.rig` rules survive in its
CSS, but its live device markup is `pfx-*` — write to `pfx-*`.

### Accent fallback chain

Codexes name their accent differently: most define `--ember`; Prism defines only `--mint` (no
`--ember`, no `--accent`). Any device CSS injected into a codex resolves its accent through

`var(--accent,var(--ember,var(--mint,#e0a458)))` — `--accent` → `--ember` → `--mint` → literal.

Without the chain, an `--ember`-keyed active chip in Prism resolves to nothing and the active toggle is
invisible. (The template's form-factor `.tsd-btn.on` still uses a bare `var(--ember)` — do not copy
that into a codex that has no `--ember`.)

### Refuse-to-write triad — mandatory for EVERY codex injection (N29)

Compute the predictions before writing. Assert them on the candidate content before it replaces the
destination, then re-assert on a fresh read of the destination. If any assertion fails, refuse — the
destination keeps its original bytes.

1. **Lead / element count unchanged** except by the exact intended delta — toggle buttons `+1` for a
   new surface and `0` for a re-render; frame records `+N` exactly; every other section/device element
   count identical.
2. **Final size == predicted** (original − removed + inserted bytes), within ±4 bytes.
3. **Unique id present exactly once** — the new frame id / surface key / injected element id occurs
   exactly once.

Rules that ride with the triad:

- **Never search a generated document for a token you just wrote into it** to locate the next write —
  the first hit may be your own insertion. Anchor on structure that existed before the write, and never
  trust a `-1` index into a slice. (N29: that collision duplicated a whole codex.)
- Count with Node regex (above), never PowerShell `.Matches.Count`; classify by element, never by a raw
  token count (`tsd-shot` also appears in the CSS rule).
- The device JSON payload must still parse: `JSON.parse` the `<script type="application/json">` body
  after the write.
- A placeholder surface is a gap, not an open decision — it routes to a task or to
  `## What We're NOT Doing` (`forward.md` step 2), never silently through the No-Placeholders gate.

## Rename sweeps: guard on the SPECIFIC token

If this skill ever drives a rename across the masters, guard on the exact token, never a loose
`A|B` OR — a broad guard catches incidental *historical* mentions (e.g. a prose "Model Maker" in an
item detail) and corrupts already-correct data. Two-pass any collision (temp-placeholder the winner),
protect external-OSS name collisions, and verify counts with Node regex before and after.
