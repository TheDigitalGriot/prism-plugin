---
name: prism-closing-ceremony
description: Run the full Prism end-of-cycle closing ceremony in one pass — a Review & Audit gate (two-stage review + best-practices audit), then prism-bookend, prism-docs-update, prism-release — instead of invoking them separately. Use when wrapping a release cycle. Triggers on "closing ceremony", "close out the release", "run the ceremonies", "docs + bookend + release", "wrap the release", or "ship vX.Y.Z". Sequential and fail-fast; honors each sub-skill's own gates (push, GitHub release, native builds).
---

# Prism Closing Ceremony

A **Review & Audit gate**, then the three end-of-cycle skills, run back-to-back in the correct order — so a release both **proves itself** and wraps in one command instead of four separate asks.

## Sequence (run in order — do not skip or reorder)

0. **Review & Audit gate** — the release hardens its own output before anything ships. Run the independent
   two-stage review (`spec-reviewer` → `quality-reviewer`) on the diff since the last version tag (plus the
   plan/stories that drove it), and the deterministic best-practices audit — `node scripts/pre-release-audit.mjs`
   (`claude plugin validate` + every `scripts/verify-*.mjs` + structure checks). **Fail-fast: fix every High
   finding and re-run until clean before Bookend.** Full procedure: [`references/review-audit-gate.md`](references/review-audit-gate.md).
1. **Bookend** — invoke **`prism-bookend`**. Analyze commits since the last version, suggest the semantic bump, create the documentation snapshot, and update `VERSION`. **The version is decided here** and carried into the rest of the ceremony.
2. **Docs** — invoke **`prism-docs-update`**. Sync the VitePress docs site (`prism-docs/`) from the newest `PRISM-DOCUMENTATION-[version].md`. Bookend produces that snapshot, so this runs after it. Must complete clean before the release.
3. **Release** — invoke **`prism-release`**. Bump every version file, build the artifacts (CLI binaries, VSIX, Electron, Tauri/NSIS installers), commit, tag, push, and create the GitHub release.

> Order note: bookend produces the doc snapshot that docs-update consumes, so bookend leads. (bookend also chains docs-update + release internally; this ceremony makes the whole sequence one explicit, named entry point.)

## Rules

- **The gate is first and fail-fast.** Step 0 (Review & Audit) runs before Bookend; an unresolved **High** finding halts the ceremony (a human may override, but only explicitly and logged in the bookend snapshot). Each subsequent phase also finishes clean before the next — never cut a release on a broken or unreviewed base.
- **Decide the version once, in bookend**, then carry it into release. Do not re-derive it per phase (re-running a bump would double-increment).
- **Honor every sub-skill's gates.** `prism-release` performs git push, a GitHub release, and native installer builds — surface those exactly as that skill defines them and get the user's go where it asks. This orchestrator adds no bypass.
- **Pre-flight before starting:** run `git status`; confirm the working tree is committed (or intentionally staged) so the release captures the intended change set.
- **Release from `main`; integrate the whole branch, never cherry-pick.** A release lands on `main` as a unit — fast-forward or merge the *entire* branch, then run the ceremony **on `main`**. Never cherry-pick individual commits to extract a change: it strands the rest of the branch and drifts `main` from what actually shipped (this is exactly how v4.5.7 + v4.5.8 were released off a feature branch, left untagged, and lost from `main`). The Step-0 audit enforces the release-from-`main` discipline via `scripts/verify-branch-integrated.mjs` (auto-discovered by the audit): it fails the ceremony unless HEAD is `main`, the base version is tagged, and no finalized release is left untagged. (An arbitrary cherry-pick can't be detected from `main` alone — but requiring whole-branch integration removes the reason to make one.)
- **Plugin edits go through `/cl-plugin-structure`** — if any phase modifies plugin components, follow that skill and finish with `claude plugin validate .`.

## When to use

- Any request to do bookend + docs-update + release together as one wrap-up.
- **Not** for a docs-only touch or a version-only bump — invoke the single relevant skill for a one-phase job.
