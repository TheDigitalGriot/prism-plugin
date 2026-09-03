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
than dropping to a weaker tier (see `skills/cl-plugin-structure/references/model-config.md` §4). This
concision rule applies pipeline-wide because every stage points here.
