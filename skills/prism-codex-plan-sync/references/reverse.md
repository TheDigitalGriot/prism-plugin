# Reverse channel — build → codex

The build **will** discover things the codex got wrong: a component that does not exist as drawn,
a license that bites, an open decision whose real answer only surfaced under implementation. Catch
those and flow them back into the codex — **with evidence, never inference**. This is what keeps
the architecture honest instead of silently drifting from what was built.

## The one executor-agnostic record: git

Both executors emit **conventional commits scoped by the story/task id** and record a sha:

- `prism-implement` → `feat(STORY-007): …`, sha stored as `stories.json.commitHash`
- `prism-subagent` → `feat(T2): …` / `feat(STORY-007): …`, sha stored as
  `state.json.tasks[*].commit_sha` (verified via `git log -1 --format=%H` before `DONE` is accepted)

So the backbone of the harvest is: **walk `git log` for `(<id>): ` commit scopes.** A commit whose
diff touches a component the codex declared out of scope, or whose body records a deviation, is
catchable regardless of which executor ran. Everything else about status diverges — read the right
store per executor:

## Per-executor status stores

**prism-implement (serial, in-repo):**
- Authoritative status → `.prism/stories/stories.json` directly (`status: done`, `completedAt`,
  `steps[].done`). This is the truth every executor reads; plan checkboxes are narrative mirrors.
- Discoveries surface **interactively** via the `## Mismatch in Phase [N]` STOP-and-confirm gate:
  `Plan said` / `Found` / `Impact` / `Options: A) adapt · B) update plan · C) discuss`.
  **Option B is the literal upstream branch.** But the record is ephemeral unless B is chosen or it
  lands in the plan's `## Session Notes` (Completed / In Progress / Next action). So for an implement
  run, catch it live at the gate, and also read `stories.json` deltas + Session Notes after.

**prism-subagent (dispatched, isolated):**
- A dispatched implementer **cannot STOP-and-confirm** — it returns one of five statuses to the
  controller, not the user. So do NOT rely on the interactive gate here.
- Status + discoveries → `.prism/local/subagent/<plan-slug>/state.json` — **gitignored and per-run**
  (`.prism/local/` is in `.gitignore`; atomic tmp-then-rename writes). It does **not** write
  `status: done` back into `stories.json`. Harvest these structured fields:
  - `tasks[*].concerns[]` — `DONE_WITH_CONCERNS`; may be silently accepted, re-surfaces in final pass
  - `tasks[*].clarifications[]` — `{question, answer, asked_at, answered_at}`; **the `answer` IS the
    resolved upstream decision**
  - `tasks[*].pending_question` + `status: awaiting_user` — an open `NEEDS_CLARIFICATION`
  - `raised_issues[]` — normalized reviewer-issue fingerprints `{kebab-summary}:{file-path}`
  - `tasks[*].commit_sha`, `completed_at`, `implementer_status`
- Because state.json is gitignored and per-run, **harvest it before the local dir is cleaned** —
  locate the run by newest `last_updated` under `.prism/local/subagent/`.

`prism-dispatch` / `spectrum` runs still leave git commits + (for spectrum) per-branch state;
fall back to the git-scope walk as the common denominator.

## Normalize, then amend with evidence

An implement Option-B plan-edit and a subagent `clarification.answer` are the **same semantic
event**: a resolved change that contradicts an upstream lock. Normalize both into one discovery
record before touching the codex.

A discovery is codex-worthy when it contradicts a **codex-locked claim**: the thesis, a component,
the license posture, or a resolved OPEN decision. When it is:

1. **Carry the evidence.** `Found:` actual · `commitHash` · `file:line`. The codex ritual's
   ground-before-you-draw HARD GATE runs in reverse too — an *inferred* upstream edit reintroduces
   the exact failure the codex discipline exists to prevent. No evidence → no amend.
2. **Amend the codex in place** — never rewrite Gavin's existing entries; adjust the specific
   `[OPT:OPEN]` / component / license claim. Add the `mharvest`/decision note where the change
   landed.
3. **Add a DGS `ITEMS[]` decision row** (`type:'decision'`/`'open-question'`) recording the ruling,
   and update the `oss-inspo` decision axes if an OSS choice changed — via the `dgs-plan-update` loop.
4. **Re-push the codex artifact** — `SendUserFile` → `update_artifact`. This is the step that goes
   stale if skipped (the whole reason `dgs-plan-update` exists). The live gallery card must not lag
   the repo.
5. **If the discovery landed a UI, carry the device too** — the device seam below.

## Device seam — a landed UI flows back into the codex device

The device block is read in both directions: forward extracts it, reverse writes back to it. When a
build lands a UI — a commit on a story whose `context.surface` is set, or a discovery whose diff touches
the code that renders a surface — the codex device is now as stale as a wrong component claim.

The normalized discovery record then carries, in addition to `Found:` · `commitHash` · `file:line`:

- **`surface`** — the surface key (`context.surface`, or the key matched through `context.graphTargets`).
- **re-render-the-frame** — which frame ids change, rendered from the REAL landed build (never a mock),
  at the surface's natural width, as the frame's `src` data-URL, with the `*-cap` provenance line updated
  to the new source + date. This is evidence in the same sense as `file:line`: no capture of the landed
  UI → no device amend.
- **re-push-the-artifact** — always set when the device changes. Same two halves as every codex amend:
  the griot-live-artifacts commit AND the top-level `Artifact` publish.

Then write back **additively**, in this order of preference:

1. **Existing surface, existing view** → re-render that frame record's `src` in place; its `id` stays
   stable (like `STORY-NNN`). Adjust `label` / `note` / `t` only where they actually changed.
2. **Existing surface, new view** → append a new frame record with a new id and `s:"<key>"`. Never
   repurpose an existing id.
3. **A self-declaring placeholder that now has a real export** → fill that surface's slot. This is the
   placeholder's declared purpose (the template's own text: "This frame embeds the real UX/UI once it
   is — the codex re-pushes on that edit"), not an overwrite of a frame.
4. **A surface that did not exist → a NEW TOGGLE STATE.** Add one toggle (`data-surf="<new key>"`,
   `aria-pressed="false"`) after the existing toggles, append its frame records, and extend `RIGMODE`
   only if the new surface needs a non-desktop rig (`phone` / `term`). Never overwrite an existing frame,
   toggle or surface to make room, and never remove a form-factor device to add a surfaces device —
   the two coexist.

Every one of these writes matches the destination's class prefix and passes the refuse-to-write triad
(`mechanics.md` → "Codex device injection"). A new-surface write expects exactly +1 toggle and exactly
the intended number of new frame records; anything else is refused.

## Trigger policy (default: never silent)

Propose the codex amendment to Gavin with its evidence, get his nod, then re-push — do not amend the
architecture silently. A build discovery is a claim about what is true; the human ratifies it before
it overwrites the locked codex.
