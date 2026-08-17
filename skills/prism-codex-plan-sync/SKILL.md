---
name: prism-codex-plan-sync
description: >-
  Bidirectional bridge between a Griot codex (the one-page architecture artifact for an app)
  and Prism's plan/stories execution layer. Use this WHENEVER the codex needs to become
  executable work OR the build needs to flow back into the codex: "plan out the <app> codex",
  "decompose the <app> codex into stories", "take <app>-codex to implementation", "turn the
  architecture doc into a prism plan", "hold a Gavel ceremony on the codex's open decisions",
  "sync the codex with what we built", "the build diverged from the codex - reconcile it", or
  "send this change back to the codex". It resolves the codex's OPEN decisions first (Gavel),
  emits an epic-keyed prism plan + stable stories.json, routes execution to the right Prism
  executor (implement / subagent / dispatch / spectrum) from the story graph, and harvests
  build-time discoveries executor-agnostically (git commit scopes) to amend the codex with
  evidence. Trigger even on "codex to plan", "plan the architecture", or "the plan drifted
  from the codex" - do not hand-roll a plan from a codex without it.
model: opus
effort: xhigh
---

# prism-codex-plan-sync

A codex is the **locked architecture** for an app (thesis, components, spine, build order,
OSS+license, OPEN decisions). A Prism plan + `stories.json` is the **executable truth**. This
skill is the bridge in **both** directions: it turns a codex into runnable work, and it carries
what the build discovers back into the codex so the architecture never silently goes stale.

The bridge is deliberately thin: it keys on the durable substrate both sides already own —
the `epic:` back-link, `stories.json`, and **git commit scopes** — rather than re-inventing
state. Read the reference file for whichever direction you are running.

## Forward: codex → executable work  → `references/forward.md`

The pipeline, in order (details + exact schemas in the reference):

1. **Read the codex.** Stage the live `<app>-codex` artifact or read `live/<app>-codex.html`
   from `griot-live-artifacts`; extract thesis, components, spine, build order, OSS/license,
   and every `[OPT:OPEN]` open decision.
2. **Gavel ceremony on the OPEN decisions.** A plan legally carries *no* placeholders, but a
   codex legitimately carries open questions - so resolve them first. For each open decision,
   surface it, get Gavin's ruling (`decision` adopt/trial/defer/pass · `role` scaffold/component/pattern
   · `stage` now/next/later, or a resolved design answer), and **close it to the DGS store via
   the `dgs-plan-update` loop**. An unresolved decision must be resolved or explicitly scoped
   out - never passed through (it trips the No-Placeholders gate).
3. **Scaffold.** Ensure `.prism/` exists (`/prism:prism-init` if bare) - plan/stories/research
   all live under it.
4. **Emit the plan + stories together.** Write `.prism/shared/plans/YYYY-MM-DD-<app>.md` with an
   `epic:` slug (the spine that joins plan↔stories), mapping codex sections → plan sections; then
   emit `.prism/stories/stories.json` with **stable `STORY-NNN` ids** + `coverage.md`. A plan
   without stories is incomplete.
5. **Route the executor from the story graph** (do not hard-wire one): disjoint `files[]` + all
   `blockedBy:null` → `prism-dispatch` (parallel, ≤5/wave); any file overlap or dep → `prism-subagent`
   (serial, isolated+reviewed) for 3-10 stories, `prism-implement` for a single phase, `prism-spectrum`
   for 10+. Recommend, then hand off.

## Reverse: build → codex  → `references/reverse.md`

The build **will** discover things the codex got wrong. Catch them and flow them back - with
evidence, never inference.

- The **one executor-agnostic record is git**: both executors emit conventional commits scoped by
  story id (`feat(STORY-007): …`) + a sha. Walk `git log` for those scopes.
- Then reconcile against whichever status store exists: `prism-implement` writes `stories.json`
  (+ the live `## Mismatch` Option-B gate + Session Notes); `prism-subagent` writes gitignored
  `state.json` under `.prism/local/subagent/<slug>/` (`concerns[]`, `clarifications[]` - the
  `answer` is the resolved decision - `raised_issues[]`) which you must **harvest before the local
  dir is cleaned**.
- **Normalize** an implement Option-B edit and a subagent clarification into one discovery record,
  then amend the codex's `[OPT:OPEN]` / component / license claim **in place**, add a DGS `ITEMS[]`
  decision row, and **re-push the codex artifact** (SendUserFile → update_artifact - the step that
  goes stale if skipped). Amend only with evidence (`Found:` actual · `commitHash` · `file:line`).

## Load-bearing seams  → `references/mechanics.md`

The gotchas a codex→plan bridge dies on if it ignores them: the `epic:` back-link is the whole
spine; `stories.json` (not plan checkboxes) is status truth; `STORY-NNN` ids stay stable across
re-emits; masters are edited **add-in-place** (DGS single-quote / Potluck double-quote, lane Sets,
`tg` display-names vs `ITEMS.app` lowercase ids); decision axes set together; device-side git via
Windows-MCP; counts verified with Node regex, never PowerShell `.Matches.Count`.

## Authoring / plugin fit

This skill is authored via `skill-creator` and its plugin fit is verified with
`/prism:cl-plugin-structure` (run device-side in the Prism repo). It ships no MCP channel in v1 -
the Gavel ceremony is an in-chat decision step; the future `close_decision(id, decision, role,
stage)` MCP verb is noted for when the decision bus lands. Keep this SKILL.md lean; the three
reference files carry the exact schemas and are loaded only for the direction being run.
