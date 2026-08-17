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

`prism-dispatch` / `prism-spectrum` runs still leave git commits + (for spectrum) per-branch state;
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

## Trigger policy (default: never silent)

Propose the codex amendment to Gavin with its evidence, get his nod, then re-push — do not amend the
architecture silently. A build discovery is a claim about what is true; the human ratifies it before
it overwrites the locked codex.
