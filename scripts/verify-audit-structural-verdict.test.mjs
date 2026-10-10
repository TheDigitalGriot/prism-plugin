// verify-audit-structural-verdict.test.mjs - the six F-A cases from Cinopsis
// tests/test_audit_structural_verdict.py (0f1f5f8, drift 253), ported to node:test.
// Runs inside pre-release-audit.mjs (every scripts/verify-*.mjs), or: node --test scripts/verify-audit-structural-verdict.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { structuralVerdict } from './audit-structural-verdict.mjs';

const verdict = (changed, scanned, failedDuring = false) =>
  structuralVerdict({ changed: changed === null ? null : new Set(changed), scanned, failedDuring });

test('a range with no structural files passes explicitly', () => {
  const v = verdict(['scripts/workgraph-index.mjs', 'CHANGELOG.md', 'VERSION'], 0);
  assert.equal(v.mark, 'PASS');
  assert.equal(v.countsAsFailure, false);
  assert.equal(v.message, 'structural checks: 0 in-scope files (range touches no skills/commands/agents/hooks)');
});

test('in-scope files but none examined still fails zero-scan', () => {
  const v = verdict(['scripts/a.mjs', 'skills/prism/references/notes.txt'], 0);
  assert.equal(v.mark, 'FAIL');
  assert.equal(v.countsAsFailure, true);
  assert.match(v.message, /AUDIT_STRUCTURAL_ZERO_SCAN/);
});

test('normal case: in scope and examined passes', () => {
  const v = verdict(['skills/prism/SKILL.md', 'scripts/a.mjs'], 2);
  assert.equal(v.mark, 'PASS');
  assert.equal(v.countsAsFailure, false);
  assert.match(v.message, /1 in-scope, 2 examined/);
});

test('normal case reports FAIL when a check failed', () => {
  const v = verdict(['commands/plan.md'], 1, true);
  assert.equal(v.mark, 'FAIL');
  assert.equal(v.countsAsFailure, false); // the failing check already counted itself
});

test('an empty change set fails closed (a self-diff looks the same)', () => {
  const v = verdict([], 0);
  assert.equal(v.mark, 'FAIL');
  assert.equal(v.countsAsFailure, true);
  assert.match(v.message, /AUDIT_STRUCTURAL_ZERO_SCAN/);
});

test('no range stays fail-closed', () => {
  const v = verdict(null, 0);
  assert.equal(v.mark, 'FAIL');
  assert.equal(v.countsAsFailure, true);
  assert.match(v.message, /AUDIT_STRUCTURAL_ZERO_SCAN/);
});
