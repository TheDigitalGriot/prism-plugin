// audit-structural-verdict.mjs - the structural-check verdict of pre-release-audit.mjs, pulled
// out as a pure function so it can be tested without running the whole gate (which shells out
// to `claude plugin validate` and reads the marketplace mirror over HTTPS).
//
// F-A (2026-10-06-cinopsis-v3-RESULT.md, re-measured 2026-10-08-cc5-ceremony-RESULT.md): the
// zero-scan guard read "examined 0 files" as a failure even when the release range touched no
// skill/command/agent/hook file at all, so every scripts-only release went red by construction.
// "Nothing in scope" and "in scope but nothing examined" are different facts; only the second
// is the silent-pass defect the guard exists to catch.

export const STRUCTURAL_ROOTS = ['skills/', 'commands/', 'agents/', 'hooks/'];

// The audit's tag-fallback test uses the same roots: one source for the scope (quality review, v5.0.2).
export const SCANNABLE = new RegExp('^(' + STRUCTURAL_ROOTS.map((r) => r.slice(0, -1)).join('|') + ')/');

// Paths in the changed set that the structural checks are responsible for.
export const inScopePaths = (changed) =>
  changed === null ? null : [...changed].filter((p) => STRUCTURAL_ROOTS.some((r) => p.startsWith(r)));

// changed: Set of changed paths, or null when no base could be diffed against.
// scanned: how many files the structural checks actually opened.
// failedDuring: whether any structural check recorded a failure.
// Returns { mark: 'PASS' | 'FAIL', message, countsAsFailure }.
export function structuralVerdict({ changed, scanned, failedDuring }) {
  const inScope = inScopePaths(changed);
  if (inScope === null) {
    // No range means the empty set is not PROVEN empty - stay fail-closed.
    return {
      mark: 'FAIL',
      countsAsFailure: true,
      message: 'structural checks scanned 0 files (scoped to skipped) - AUDIT_STRUCTURAL_ZERO_SCAN, not a pass',
    };
  }
  if (changed.size === 0) {
    // An empty change set is indistinguishable from a range that diffs HEAD against itself (N91):
    // fail closed. A tagged HEAD is handled upstream by diffing against the previous tag.
    return {
      mark: 'FAIL',
      countsAsFailure: true,
      message: 'structural checks scanned 0 files (empty change set: the range diffs HEAD against itself) - AUDIT_STRUCTURAL_ZERO_SCAN, not a pass',
    };
  }
  if (inScope.length === 0) {
    return {
      mark: 'PASS',
      countsAsFailure: false,
      message: 'structural checks: 0 in-scope files (range touches no skills/commands/agents/hooks)',
    };
  }
  if (scanned === 0) {
    return {
      mark: 'FAIL',
      countsAsFailure: true,
      message: `structural checks scanned 0 files of ${inScope.length} in-scope (scoped to ${changed.size} changed files) - AUDIT_STRUCTURAL_ZERO_SCAN, not a pass`,
    };
  }
  return {
    mark: failedDuring ? 'FAIL' : 'PASS',
    countsAsFailure: false, // the individual checks already counted their own failures
    message: `structural checks (scoped to ${changed.size} changed files, ${inScope.length} in-scope, ${scanned} examined)`,
  };
}
