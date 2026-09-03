#!/usr/bin/env node
// verify-story-unification.mjs — static guard that the plan → story → execute flow
// stays unified on stories.json. Run from the repo root (where .prism/ lives):
//   node scripts/verify-story-unification.mjs                 # Phase 1 (generation)
//   node scripts/verify-story-unification.mjs --check-consumers   # + Phase 2 (implement/subagent)
//   node scripts/verify-story-unification.mjs --check-coherence   # + Phase 3 (iterate/validate)
//   node scripts/verify-story-unification.mjs --all               # every phase
import { readFileSync, existsSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const want = {
  gen: true,
  consumers: args.has('--check-consumers') || args.has('--all'),
  coherence: args.has('--check-coherence') || args.has('--all'),
};

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const has = (p, ...needles) => {
  const t = read(p);
  if (t === null) return { ok: false, why: `missing: ${p}` };
  const miss = needles.filter((n) => !t.includes(n));
  return miss.length ? { ok: false, why: `${p} missing: ${miss.join(', ')}` } : { ok: true };
};

const checks = [];
const add = (phase, name, fn) => checks.push({ phase, name, fn });

// ---- Phase 1: generation ----
add('gen', 'stories contract exists', () =>
  existsSync('.prism/shared/contracts/stories-contract.md') ? { ok: true } : { ok: false, why: 'no stories-contract.md' });
add('gen', 'prism-plan emits stories', () =>
  has('skills/prism-plan/SKILL.md', 'Emit Stories', 'stories.json', 'decompose_plan'));
add('gen', 'plan-template has epic field', () =>
  has('skills/prism-plan/references/plan-template.md', 'epic:'));
add('gen', 'create_plan emits stories', () =>
  has('commands/create_plan.md', 'Emit Stories', 'stories.json'));
add('gen', 'decompose_plan is the canonical engine', () =>
  has('commands/decompose_plan.md', 'canonical plan', 'stories-contract.md'));
add('gen', 'stories.json schema valid (if present)', () => {
  const t = read('.prism/stories/stories.json');
  if (t === null) return { ok: true, why: 'none yet — skipped' };
  let j;
  try { j = JSON.parse(t); } catch (e) { return { ok: false, why: 'invalid JSON' }; }
  const stories = Array.isArray(j) ? j : j.stories;
  if (!Array.isArray(stories)) return { ok: false, why: 'no stories[] array' };
  const req = ['id', 'title', 'description', 'priority', 'status', 'blockedBy', 'files', 'steps'];
  for (const s of stories) {
    const miss = req.filter((k) => !(k in s));
    if (miss.length) return { ok: false, why: `story ${s.id ?? '?'} missing: ${miss.join(', ')}` };
  }
  return { ok: true, why: `${stories.length} stories valid` };
});

// ---- Phase 2: consumers read stories.json ----
add('consumers', 'prism-implement reads stories.json', () =>
  has('skills/prism-implement/SKILL.md', 'stories.json'));
add('consumers', 'implement_plan reads stories.json', () =>
  has('commands/implement_plan.md', 'stories.json'));
add('consumers', 'prism-subagent reads stories.json', () =>
  has('skills/prism-subagent/SKILL.md', 'stories.json'));
add('consumers', 'subagent state keyed by story id', () =>
  has('skills/prism-subagent/references/state-schema.md', 'stories.json'));
add('consumers', 'prism-implement dropped legacy phase-parsing as primary', () => {
  const t = read('skills/prism-implement/SKILL.md');
  if (t === null) return { ok: false, why: 'missing' };
  // the pre-unification primary instruction — must be gone, not just shadowed by a stories.json mention
  return t.includes('Load phases into TodoWrite')
    ? { ok: false, why: 'still contains legacy "Load phases into TodoWrite"' }
    : { ok: true };
});

// ---- Phase 3: coherence guards ----
add('coherence', 'iterate re-emits stories', () =>
  has('skills/prism-iterate/SKILL.md', 'stories.json'));
add('coherence', 'iterate_plan re-emits stories', () =>
  has('commands/iterate_plan.md', 'stories.json'));
add('coherence', 'validate checks story coverage', () =>
  has('skills/prism-validate/SKILL.md', 'stories.json'));
add('coherence', 'validate_plan checks story coverage', () =>
  has('commands/validate_plan.md', 'stories.json'));
add('coherence', 'locator co-surfaces stories', () =>
  has('agents/prism-locator.md', 'stories.json'));

let failed = 0;
for (const c of checks) {
  if (!want[c.phase]) continue;
  let r;
  try { r = c.fn(); } catch (e) { r = { ok: false, why: e.message }; }
  if (!r.ok) failed++;
  const mark = r.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] (${c.phase}) ${c.name}${r.why ? ' — ' + r.why : ''}`);
}
console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
