#!/usr/bin/env node
// pre-release-audit.mjs — the deterministic half of the closing-ceremony Review & Audit gate.
// Run from the repo root:  node scripts/pre-release-audit.mjs
// Runs `claude plugin validate .`, discovers + runs every scripts/verify-*.mjs, and checks a few
// cl-plugin-structure best practices. Exits non-zero on any failure so the ceremony can gate on it.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = 0;
const line = (mark, msg) => console.log(`[${mark}] ${msg}`);
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });

// 1. Mandatory: claude plugin validate .  (trust the exit code, not output wording)
{
  const r = run('claude', ['plugin', 'validate', '.']);
  const ok = r.status === 0;
  if (!ok) failed++;
  const detail = (r.error && r.error.message) || ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter(Boolean).pop() || 'nonzero exit';
  line(ok ? 'PASS' : 'FAIL', `claude plugin validate .${ok ? '' : ' — ' + detail}`);
}

// 2. Discover + run every scripts/verify-*.mjs
if (existsSync('scripts')) {
  for (const f of readdirSync('scripts').filter(f => /^verify-.*\.mjs$/.test(f))) {
    const r = run('node', [`scripts/${f}`, '--all']);
    const ok = r.status === 0;
    if (!ok) failed++;
    line(ok ? 'PASS' : 'FAIL', `scripts/${f}${ok ? '' : ' — exit ' + r.status}`);
  }
}

// 3. Structural best practices (cl-plugin-structure) — SCOPED to this release's changed files.
// A release gate blocks on what THIS release introduces, not the repo's whole backlog. Plugin-validate
// and the verify-*.mjs scripts above already cover whole-plugin correctness.
const walk = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = `${dir}/${e.name}`;
  return e.isDirectory() ? walk(p) : [p];
}) : [];
const base = (run('git', ['describe', '--tags', '--abbrev=0']).stdout || '').trim()
  || (run('git', ['rev-parse', '--verify', 'main']).status === 0 ? 'main' : '');
let changed = null;
if (base) {
  const r = run('git', ['diff', '--name-only', `${base}..HEAD`]);
  if (r.status === 0) changed = new Set(r.stdout.split('\n').map(s => s.trim()).filter(Boolean));
}
if (changed === null) line('WARN', 'no base tag/branch to diff against — structural checks skipped (run in a repo with history)');
else if (changed.size === 0) line('WARN', `no files changed vs ${base} — structural checks scanned 0 files (bootstrap / first release?)`);
const inScope = (p) => changed !== null && changed.has(p);

// 3a. SKILL.md size — progressive disclosure (< 500 lines)
for (const p of walk('skills').filter(p => p.endsWith('SKILL.md') && inScope(p))) {
  const n = readFileSync(p, 'utf8').split('\n').length;
  if (n > 500) { failed++; line('FAIL', `${p} is ${n} lines (>500 — push detail to references/)`); }
}
// 3b. Frontmatter present on changed skills/commands/agents
for (const p of [...walk('skills').filter(p => p.endsWith('SKILL.md')), ...walk('commands'), ...walk('agents')].filter(p => p.endsWith('.md') && inScope(p))) {
  if (!readFileSync(p, 'utf8').startsWith('---')) { failed++; line('FAIL', `${p} missing YAML frontmatter`); }
}
// 3c. No hardcoded absolute plugin paths in changed skills/commands/hooks
const HARDCODED = /[A-Za-z]:\\Users\\|\/(?:Users|home)\/[^\/\s"']+\//;
for (const p of [...walk('skills'), ...walk('commands'), ...walk('hooks')].filter(p => /\.(md|json|sh|js)$/.test(p) && inScope(p))) {
  if (HARDCODED.test(readFileSync(p, 'utf8'))) { failed++; line('FAIL', `${p} contains a hardcoded absolute path (use \${CLAUDE_PLUGIN_ROOT} / project-relative)`); }
}

line(failed === 0 ? 'PASS' : 'FAIL', `structural checks (scoped to ${changed ? changed.size + ' changed files' : 'skipped'})`);
console.log(`\n${failed === 0 ? 'AUDIT CLEAN' : failed + ' AUDIT FAILURE(S)'}`);
process.exit(failed === 0 ? 0 : 1);
