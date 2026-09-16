# Headless answer resolution (release-cycle skills)

Shared reference for the four release-cycle skills — **prism-bookend**, **prism-docs-update**,
**prism-release**, **prism-closing-ceremony**. It defines the one mechanism that lets the whole
cycle run headless (Cowork cloud, `claude -p`, CI) **without touching the interactive path**.

> Design provenance: `.prism/shared/research/2026-08-15-headless-release-cycle-research.md`
> (gate inventory §1, mechanism §3, blast-radius §4) and the passive-bus / headless mandate in
> `skills/griot-agent-architect/references/channel-patterns.md:76-78`. This file is the concrete,
> shippable form of that reference's durable target — a `run_device_skill(skill, args, answers)`
> verb — with the answers file as the injected `answers` payload.

## The rule every gate follows

Each interactive gate in the four skills is wrapped with the same preamble:

> **If `PRISM_NONINTERACTIVE` is set**, resolve this gate's answer from the answers file
> (`node scripts/resolve-answer.mjs <key> <safeDefault>`) instead of prompting.
> **Otherwise, prompt exactly as today.**

Absent `PRISM_NONINTERACTIVE`, the answers file is **ignored entirely** and every gate behaves
byte-for-byte as it does now. This is purely additive.

## Activation & discovery

- **Activation switch:** env `PRISM_NONINTERACTIVE=1`. Absent ⇒ interactive, file ignored.
- **Answers-file discovery precedence** (mirrors `digital-griot-mcp` `resolveStateDir`):
  1. `--answers <path>` argument
  2. `PRISM_RELEASE_ANSWERS` env var
  3. default `.prism/local/release-answers.json`
- **Gitignored:** `.prism/local/release-answers.json` is git-ignored — the answers blob is
  machine-specific and possibly secret-adjacent; it must never land in a release commit.

## Resolver contract — `scripts/resolve-answer.mjs`

`resolve(key, safeDefault)` (and the CLI `node scripts/resolve-answer.mjs <key> [safeDefault]`)
returns:

1. `answers[key]` when the key is present (dotted keys like `docs.proceed` traverse the object);
2. else, for a **destructive** key (`push`, `githubRelease`, `syncMirror`) → **`false`** (fail-closed);
3. else, for `tagCollision` → **`"abort"`** (never auto delete+recreate);
4. else → the caller's `safeDefault`.

Self-test: `node scripts/resolve-answer.mjs self-test` (exit 0 = pass).

**Why fail-closed inverts "always push":** the interactive ceremony policy is *always push*
(`prism-closing-ceremony/SKILL.md`). For an *unattended* run that inversion is deliberate — an
unwanted push / public GitHub release / mirror force-push is far costlier than "built but not
pushed." Destructive gates fire **only** when the answers file sets them `true` explicitly.

## Schema (v1)

```json
{
  "schemaVersion": 1,
  "dryRun": true,
  "version": "4.9.1",
  "bump": null,
  "confirmVersion": true,
  "review": { "overrideHigh": false },
  "cleanTree": "porcelain-empty-only",
  "docs": { "proceed": true, "editConfig": false },
  "push": false,
  "githubRelease": false,
  "syncMirror": false,
  "nativeBuilds": true,
  "tagCollision": "abort"
}
```

- **`dryRun`** — template default `true`: the first headless run of a cycle rehearses the whole
  pipeline up to, but not including, any commit/tag/push/GitHub-release step.
- **`version` vs `bump`** — prefer an explicit `version:"X.Y.Z"` (resolved via
  `bump-version.py --set`). `bump:"patch|minor|major"` is a discouraged fallback that must be
  opted into; a wrong auto-bump double-increments or ships a major as a patch. Never hand-edit
  `VERSION` first (the bump then reports success while changing 0 files).

## Per-gate key map

Keys and safe headless defaults, keyed to the research §1 gate table. Destructive gates (⚠) are
fail-closed in the resolver regardless of the `safeDefault` a gate passes.

| Gate (research #) | Skill | `key` | Safe default | ⚠ |
|---|---|---|---|---|
| G0-A / G0-B | closing-ceremony | `review.overrideHigh` | `false` → unresolved High **halts** | |
| G0-C | closing-ceremony | `cleanTree` | `porcelain-empty-only` (halt unless clean) | |
| B1 / R1 | bookend / release | `confirmVersion`, `version` | accept suggested bump only if `confirmVersion:true`; else explicit `version` | |
| B2 / B4 / D-B | bookend / docs-update | `docs.proceed` | `true` (proceed) | |
| B3 / D-C | bookend / docs-update | `docs.editConfig` | `false` (skip VitePress config edits) | |
| R2 | release | `cleanTree` | `porcelain-empty-only` | |
| R5 | release | `tagCollision` | `abort` | ⚠ |
| R7 | release | `push` | `false` (fail-closed) | ⚠ |
| R8 | release | `githubRelease` | `false` (fail-closed) | ⚠ |
| R9 | release | `nativeBuilds` | `true` (local artifacts only) | |
| R10 | release | `syncMirror` | `false` (fail-closed) | ⚠ |
| — | all | `dryRun` | `true` (stop before commit/tag/push/GH-release) | |

**Not gated** (per research §1 "absent by design"): no VitePress build/deploy step, no
commit-message approval (message is fixed `v{VERSION}`), no separate docs-version prompt (version
is derived from the source filename + `cat VERSION`). The deterministic exit-gates R3
(`verify-branch-integrated.mjs`) and R4 (`claude plugin validate .` + porter) are already
headless-clean — the injection layer adds **no** bypass for them; a non-zero exit halts the run.

## Templates

- `scripts/release-answers.template.json` — dryRun-first rehearsal template (safe default).
- `scripts/release-answers.full-push.example.json` — a full push release
  (push + githubRelease + docs true) — the shape an orchestrator writes when Gavin means a full
  release. This lives in the **answers an orchestrator writes**, never as the skill default; the
  mechanism itself stays fail-closed on every missing key.
