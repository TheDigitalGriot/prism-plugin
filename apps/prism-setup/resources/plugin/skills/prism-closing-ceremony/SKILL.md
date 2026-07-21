---
name: prism-closing-ceremony
description: Run the full Prism end-of-cycle closing ceremony in one pass — prism-docs-update, then prism-bookend, then prism-release — instead of invoking the three separately. Use when wrapping a release cycle. Triggers on "closing ceremony", "close out the release", "run the ceremonies", "docs + bookend + release", "wrap the release", or "ship vX.Y.Z". Sequential and fail-fast; honors each sub-skill's own gates (push, GitHub release, native builds).
---

# Prism Closing Ceremony

The three end-of-cycle skills, run back-to-back in the correct order, so a release wraps in one command instead of three separate asks.

## Sequence (run in order — do not skip or reorder)

1. **Bookend** — invoke **`prism-bookend`**. Analyze commits since the last version, suggest the semantic bump, create the documentation snapshot, and update `VERSION`. **The version is decided here** and carried into the rest of the ceremony.
2. **Docs** — invoke **`prism-docs-update`**. Sync the VitePress docs site (`prism-docs/`) from the newest `PRISM-DOCUMENTATION-[version].md`. Bookend produces that snapshot, so this runs after it. Must complete clean before the release.
3. **Release** — invoke **`prism-release`**. Bump every version file, build the artifacts (CLI binaries, VSIX, Electron, Tauri/NSIS installers), commit, tag, push, and create the GitHub release.

> Order note: bookend produces the doc snapshot that docs-update consumes, so bookend leads. (bookend also chains docs-update + release internally; this ceremony makes the whole sequence one explicit, named entry point.)

## Rules

- **Sequential + fail-fast.** Each phase finishes clean before the next begins. If bookend or docs error, **stop and report** — never cut a release on a broken base.
- **Decide the version once, in bookend**, then carry it into release. Do not re-derive it per phase (re-running a bump would double-increment).
- **Honor every sub-skill's gates.** `prism-release` performs git push, a GitHub release, and native installer builds — surface those exactly as that skill defines them and get the user's go where it asks. This orchestrator adds no bypass.
- **Pre-flight before starting:** run `git status`; confirm the working tree is committed (or intentionally staged) so the release captures the intended change set.
- **Plugin edits go through `/cl-plugin-structure`** — if any phase modifies plugin components, follow that skill and finish with `claude plugin validate .`.

## When to use

- Any request to do bookend + docs-update + release together as one wrap-up.
- **Not** for a docs-only touch or a version-only bump — invoke the single relevant skill for a one-phase job.
