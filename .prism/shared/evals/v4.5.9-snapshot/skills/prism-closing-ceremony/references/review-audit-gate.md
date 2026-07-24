# Review & Audit Gate

The fail-fast first step of `prism-closing-ceremony`. Runs the same independent review + best-practices
audit that a careful release does by hand — **before** bookend, docs, or release — so the ceremony
hardens its own output. Nothing ships on a broken or unreviewed base.

## A. Scope the change set

```bash
LAST=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
[ -n "$LAST" ] && git diff "$LAST"..HEAD || git log --oneline    # window if no tag yet
```
Also identify the plan(s) / stories that drove the changes (`.prism/shared/plans/` + `.prism/stories/`)
so the reviewers can judge intent, not just mechanics.

## B. Two-stage independent review

Dispatch both reviewers on the **diff + the plan(s)/stories** (pass content inline — do not assume the
reviewer can reach the repo):

1. `spec-reviewer` — spec compliance: missing requirements, over-building, scope drift vs the plan.
2. `quality-reviewer` — correctness, coherence (no leftover instructions that contradict the change),
   broken cross-references, terminology, markdown/frontmatter validity.

Reviewers see diffs, not full files (the established prism-subagent review discipline).

## C. Deterministic best-practices audit

```bash
node scripts/pre-release-audit.mjs
```
Runs `claude plugin validate .` (the mandatory cl-plugin-structure gate), discovers and runs every
`scripts/verify-*.mjs`, and checks structure (SKILL.md sizes, frontmatter presence, no hardcoded
absolute plugin-resource paths). Exits non-zero on any failure.

The auto-discovered set includes **`verify-branch-integrated.mjs`** — the release-integration guard.
It fails the gate unless HEAD is `main`, the base version is tagged, and no finalized release is left
untagged. That makes the **stranding** failure mode unshippable and removes the *reason* to cherry-pick
a change forward: an arbitrary cherry-pick can't be detected from `main` alone, so the guard instead
forces whole-branch integration — extracting one commit is never necessary. (Provenance: v4.5.7 +
v4.5.8 shipped off a feature branch, untagged, and `main` drifted two releases behind before it was caught.)

## D. Gate rule

- Rank all findings (review + audit) by severity.
- Fix — or have the user fix — every **High**, then re-run B + C until clean.
- **Do not proceed to Bookend with an unresolved High.** This is the ceremony's fail-fast contract.
- A human may override a specific High to proceed, but the override must be explicit and logged in the
  release notes / bookend snapshot (never a silent bypass).

Only when the gate is clean (or explicitly overridden) does the ceremony continue to Bookend → Docs → Release.
