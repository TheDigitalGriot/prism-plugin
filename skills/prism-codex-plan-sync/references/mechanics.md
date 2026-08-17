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
(`prism-plan`, `decompose_plan`, `prism-implement`, `cl-plugin-structure`) load only inside the repo;
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

## Codex artifact freshness

Every edit to a codex (forward emit-notes or reverse amend) requires re-pushing the artifact
(`SendUserFile` → `update_artifact`) — the step that silently goes stale. The live gallery card must
never lag the git repo.

## Rename sweeps: guard on the SPECIFIC token

If this skill ever drives a rename across the masters, guard on the exact token, never a loose
`A|B` OR — a broad guard catches incidental *historical* mentions (e.g. a prose "Model Maker" in an
item detail) and corrupts already-correct data. Two-pass any collision (temp-placeholder the winner),
protect external-OSS name collisions, and verify counts with Node regex before and after.
