# The Prism ICM Run-Contract

> L3 factory material — stable across runs. This is the **ICM↔Prism binding**: how an Isolated
> Context Method stage contract drives one stage of the Prism pipeline (research, plan, design,
> implement, validate, prd, decompose, spectrum, subagent). It points at the method; it does not
> re-inline it. One home per fact — a link beats a copy (`references/core.md`, "Library rules").

Every pipeline skill carries a one-line pointer at the top of its workflow: *if this run was
launched with a stage contract (a `*-CONTEXT.md` in `.prism/shared/plans/`, or the path in
`$PRISM_ICM_CONTRACT`), read it first and honor its Inputs / Locked Decisions / Success criteria
before anything else.* This file is what that pointer resolves to.

## The stage-contract shape

Start from the blank ICM template `assets/templates/stage-CONTEXT.md` (Inputs · Process · Outputs ·
Human check) and add the two Prism-pipeline blocks. The filled Prism-flavored template is
`assets/templates/prism-stage-CONTEXT.md` — instantiate by copying it (never author from a blank
page; ICM invariant 10). Its sections:

- **Role** — where the run executes and the ONE stage it drives. No scope-widening.
- **Inputs — Working vs Reference** — *Working* = the exact paths this run edits/produces; *Reference*
  = stable material pulled via code-intel, never inlined. Plus an explicit **Do NOT load** line.
- **Locked Decisions** *(Prism addition)* — the calls already made, which the agent must honor and
  must NOT relitigate or ask about. A headless run cannot answer a question, so every fork it would
  otherwise stop on is decided here in advance.
- **Process** — short, numbered, checkable steps.
- **Success criteria** — checkable outcomes (a command that passes, a file that exists) plus a scope
  guard (only the intended files changed).
- **Heartbeat tokens** *(Prism addition)* — the token sequence appended per step (see below).

## The code-intel-slice rule

Ground every claim through the Prism discovery agents — **graph-navigator** (structure, call-chains,
blast-radius), **codebase-analyzer** (HOW, file:line), **codebase-locator** (WHERE), **prism-locator**
(existing `.prism/` research/plans/handoffs). Query the graph; read only the slice each step needs;
**never photocopy whole files**. This mirrors the ICM token discipline (`references/core.md`, "Token
discipline"): a stage's full context — entry + contract + references + inputs — should land around
**2,000–8,000 tokens**, the range where the model performs best and every load stays auditable. If a
stage balloons, split it, tighten the Inputs list, or push detail into an L3 file the contract points
at but does not inline.

## The heartbeat protocol

Append **one timestamped token line per numbered step** to `.prism/local/<stage>-progress.txt`. The
tokens are declared in the contract's Heartbeat block; a final `DONE` line records the outcome (e.g.
commit shas), and any blocker is written as `BLOCKED-<one-word-why>`. This is the file-bus a
supervising session polls to watch a headless run without attaching to it.

## The honor rule

Read the contract first. **Do not relitigate its Locked Decisions.** Proceed autonomously — **do not
ask** (a headless run hangs on interactive prompts; there is no one to answer). On a genuine blocker,
write the `BLOCKED-<why>` heartbeat and stop the stage cleanly — leave the tree committed or clean,
never half-edited.

## Concision (Opus 5)

Opus 5 defaults to longer output; on this pipeline that reads as noise, not thoroughness. Answer at
the altitude the contract asks: prefer the smallest correct edit, do not restate the task back, do
not summarize files you did not change. Keep thinking ON and lower the effort dial for cost rather
than dropping to a weaker tier (see `skills/griot-agent-architect/references/model-config.md` §4). This
concision rule applies pipeline-wide because every stage points here.

## Sliced source artifacts (`.prism/local/slices/`)

When a stage needs part of a large file, **carve the slice to disk and work from the slice** —
do not carry the whole file in context.

```
.prism/local/slices/<source-stem>/<what-it-is>.<ext>
```

Rules:
- Name the slice for **what it is**, not where it came from — `proto-css.css`, not `part2.txt`.
- Record the origin (path + line range) in the stage heartbeat, so the slice is traceable.
- Slices are **derived artifacts**: regenerate freely, never hand-edit, never treat as truth.
  The source file remains the truth.
- A slice survives compaction. Re-reading a 40-line slice costs nothing; re-deriving it costs
  the original read again.

Worked example: a 220KB recovered prototype split into `proto-css.css` (464 lines),
`proto-markup.html` (235), `proto-js.js` (215) — the 122KB base64 blob discarded. Every later
stage read only the slice it needed.

## Heartbeat applies to every run, not only ICM runs

The heartbeat is **not** conditional on a stage contract existing. Any multi-step run appends one
timestamped token line per step to `.prism/local/<stage>-progress.txt`.

- With a contract: use the contract's declared tokens.
- Without one: use `<verb>-<noun>` tokens of your own — `RESEARCH-DONE`, `IMPL-header`,
  `VERIFY-themes`.

Why it is unconditional: the heartbeat is what lets a *supervising* session — or a future you —
see where a run got to without attaching to it, and it is the cheapest possible compaction
insurance. An interactive run that heartbeats zero times is indistinguishable from one that
never happened.
