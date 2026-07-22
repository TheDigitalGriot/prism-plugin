#!/usr/bin/env node
// verify-ceremony-gate.mjs — static guard that the closing ceremony actually wires the Review & Audit
// gate ahead of bookend. Run from repo root:  node scripts/verify-ceremony-gate.mjs
import { readFileSync, existsSync } from 'node:fs';

let failed = 0;
const ok = (m) => console.log(`[PASS] ${m}`);
const bad = (m) => { failed++; console.log(`[FAIL] ${m}`); };

const skill = 'skills/prism-closing-ceremony/SKILL.md';
const ref = 'skills/prism-closing-ceremony/references/review-audit-gate.md';

if (!existsSync(skill)) bad(`${skill} missing`);
else {
  const t = readFileSync(skill, 'utf8');
  // the gate must exist and precede Bookend in the sequence
  const gate = t.search(/review\s*&?\s*audit/i);
  const bookend = t.search(/\bbookend\b/i);
  if (gate === -1) bad('SKILL.md does not declare a Review & Audit gate');
  else if (bookend !== -1 && gate > bookend) bad('Review & Audit gate appears AFTER bookend (must be first)');
  else ok('Review & Audit gate declared ahead of bookend');

  for (const needle of ['spec-reviewer', 'quality-reviewer', 'pre-release-audit', 'review-audit-gate']) {
    t.includes(needle) ? ok(`ceremony references ${needle}`) : bad(`ceremony does not reference ${needle}`);
  }
}

existsSync(ref) ? ok('review-audit-gate.md reference exists') : bad(`${ref} missing`);
existsSync('scripts/pre-release-audit.mjs') ? ok('pre-release-audit.mjs exists') : bad('scripts/pre-release-audit.mjs missing');

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
