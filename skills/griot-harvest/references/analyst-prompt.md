# The analyst prompt — how to make an agent GROUND rather than confirm

> L3 factory material. This is the single highest-value part of `griot-harvest`. On 2026-09-06 it
> produced **16+ corrections across six repos** — every repo overturned something the planning
> session believed. A prompt without these moves produces confident agreement instead.

## The core move: state the hypothesis so it can be attacked

An agent asked *"document how X works"* returns a plausible description. An agent asked
*"prior research says X works like THIS — confirm or correct it, and say so loudly if it is wrong"*
returns the truth, because you have given it something to falsify.

Put the prior belief **in the prompt, in full, labelled as unverified**. Never paraphrase it away.

```
Prior research says (UNVERIFIED — treat as a hypothesis to confirm or correct):
- the broker mints a (forward, backward) UUID pair at launch, each side gets one
- the envelope is {$:'puter-ipc', v, msg, appInstanceID, uuid, parameters}
- appInstanceID is checked against a live registry
CONFIRM OR CORRECT each against the actual code. If it works differently, say so plainly.
```

What came back: pair minting confirmed — but they are **pseudo-IDs**, the child's real instance id
is never disclosed; the envelope has an **`env` field** the hypothesis omitted *and it is checked
first*; `uuid` is an incrementing integer, not a UUID; minting is **conditional**; there is **no
permission model** at all. Five corrections from one framed question.

## The seven required clauses

**1. Name the destination.** Why we are reading this repo, and what Griot code it would land in.
An agent that knows the target documents the seam; one that doesn't writes a book report.

**2. Demand file:line for every claim.** Non-negotiable. It converts assertion into evidence and
makes every claim auditable later.

**3. Demand the SOURCE of every metric.** The expensive lesson: waggle's headline "~15×" and "~37%"
were **Anthropic's** and **Berkeley/MAST's** measurements of *the problem* — not the tool's results.
A third number (37.9%) existed in the tool's own benchmark and was trivially confusable with the
second. Always ask: *who measured this, of what, and where is it stated?*

**4. Ask for corrections LOUDLY.** *"Where the prior hypothesis is WRONG, say so explicitly and
loudly — that is the single most valuable output here."* Otherwise a correction gets buried on
line 340 of a 500-line document.

**5. Ask what NOT to copy.** Defects are a first-class output. Puter's bus **hangs the caller's
promise** on a failed registry lookup and **never deletes** from its connections map — both would
have been lifted verbatim from a prompt that only asked for the pattern.

**6. Bound the output.** *"Write findings to `<path>`. Return only a ~10-line summary; the detail
belongs in the file."* This is what keeps the orchestrator's context clean (invariant I3) while
~340KB lands on disk (I2).

**7. Documentarian stance.** *"Describe what exists. Do not critique or propose improvements beyond
the lift notes."* Analysis and advocacy are different jobs; mixing them corrupts both.

## Agent-type constraint — check tools before dispatching

| agent | can write? | use for |
|---|---|---|
| `codebase-analyzer` | **yes** (Read/Glob/Grep/Bash) | anything that must persist a doc |
| `web-search-researcher` | **no** — WebSearch/WebFetch/Read only | live-web facts; **orchestrator must write the result** |

Two research docs were nearly lost on 2026-09-06 because a web agent was told to write a file it
had no tool to create. It returned the content in its summary and the orchestrator persisted it —
recoverable, but only because the agent said so plainly.

## One agent per PATTERN, not per repo

Puter carried two independent liftable patterns (the interop bus and the MCP server) and got two
agents; they returned different corrections and neither diluted the other. Conversely two thin
related repos (Weave Router + open-connector) shared one agent because they answered **one**
question — how to add a provider axis.

Ask: *how many distinct questions am I asking of this code?* That is the agent count.

## Worked skeleton

```
Analyze <repo path> and document <the ONE pattern> at file:line precision.

We are lifting this into <exact Griot target>, so I need the real mechanism, not a summary.

Prior research says (UNVERIFIED — confirm or correct, and say so LOUDLY if wrong):
  <the full prior belief, verbatim, not paraphrased>

Specifically find and document:
  1..N  <numbered, mechanism-level questions — not "explain the architecture">

Also document explicitly:
  - any DEFECT in this implementation we should NOT copy
  - the SOURCE of any metric the repo quotes (who measured it, of what)

Method: Glob/Grep to locate, then read ONLY the slices you need — never whole large files.

Write findings to `.prism/shared/research/<date>-<tool>.md` with sections:
  Mechanism (file:line for every claim) · <pattern-specific sections> ·
  What NOT to copy · Lift notes for <target>
Correct any prior claim that is wrong. Documentarian only — describe what exists.

Return only a ~10-line summary; the detail belongs in the file.
```

## Smell test before dispatching

- Could this prompt be answered without opening the repo? → too vague, add mechanism questions.
- Does it state a hypothesis the agent can attack? → if not, expect agreement, not grounding.
- Does it name the Griot landing zone? → if not, expect a book report.
- Does it ask what not to copy? → if not, you will lift the defects with the pattern.
