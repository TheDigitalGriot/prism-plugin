#!/usr/bin/env node
// resolve-answer.mjs — headless answer-injection resolver for the release-cycle skills
// (prism-bookend, prism-docs-update, prism-release, prism-closing-ceremony).
//
// One job: under a headless `claude -p` run, let each interactive gate read its answer from a
// static JSON snapshot instead of prompting — while an interactive TTY run is byte-for-byte
// unchanged. See skills/prism-release/references/answers-resolution.md for the schema + per-gate
// keys, and .prism/shared/research/2026-08-15-headless-release-cycle-research.md §1/§3.
//
// Contract (locked by the plan):
//   - Activation:  PRISM_NONINTERACTIVE=1. Absent ⇒ the answers file is ignored ENTIRELY, so a
//     stray file can never silently change an interactive run.
//   - Discovery precedence:  --answers <path>  →  PRISM_RELEASE_ANSWERS env  →
//     default .prism/local/release-answers.json  (mirrors digital-griot-mcp resolveStateDir).
//   - resolve(key, safeDefault):  returns answers[key] when defined, else safeDefault.
//   - Destructive gates (push, githubRelease, syncMirror) with NO answer  ⇒ false  (fail-closed).
//   - tagCollision with no answer  ⇒ "abort"  (never auto delete+recreate).
//   - Dotted keys (e.g. "docs.proceed", "review.overrideHigh") traverse the JSON object.
//
// CLI:
//   node scripts/resolve-answer.mjs <key> [safeDefault]   → prints the resolved value
//   node scripts/resolve-answer.mjs self-test             → runs the self-test (exit 0 = pass)
//   node scripts/resolve-answer.mjs                       → runs the self-test
//
// Exit 0 = OK · Exit 1 = self-test failure.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Destructive gates fail closed: missing key ⇒ false. Explicit `true` in the answers file is the
// ONLY way they fire. This deliberately inverts the interactive "always push" policy for headless —
// an unwanted push/GH-release/mirror force-push is far costlier than "built but not pushed".
export const DESTRUCTIVE_KEYS = new Set(['push', 'githubRelease', 'syncMirror']);

// Non-safeDefault fallbacks for keys whose safe headless value is a fixed policy, not the caller's
// safeDefault. tagCollision must never auto delete+recreate a tag.
export const KEY_DEFAULTS = { tagCollision: 'abort' };

export function isHeadless(env = process.env) {
  const v = env.PRISM_NONINTERACTIVE;
  return typeof v === 'string' && v !== '' && v !== '0';
}

// --answers <path> | --answers=<path>  →  PRISM_RELEASE_ANSWERS  →  default .prism/local/…
export function resolveAnswersPath(argv = process.argv.slice(2), env = process.env) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--answers' && argv[i + 1]) return argv[i + 1];
    if (a.startsWith('--answers=')) return a.slice('--answers='.length);
  }
  if (env.PRISM_RELEASE_ANSWERS) return env.PRISM_RELEASE_ANSWERS;
  const projectDir = env.PRISM_PROJECT_DIR || process.cwd();
  return path.join(projectDir, '.prism', 'local', 'release-answers.json');
}

// Load the answers snapshot. Returns {} (⇒ every gate falls to its safe default) when:
//   - not headless and not forced (interactive stays default), or
//   - the file is absent / unreadable / not a JSON object.
export function loadAnswers({ argv, env = process.env, force = false } = {}) {
  if (!force && !isHeadless(env)) return {};
  const p = resolveAnswersPath(argv, env);
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getPath(obj, key) {
  const parts = String(key).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, p)) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

// Pure resolver against an explicit answers object — the testable core.
export function resolveWith(answers, key, safeDefault) {
  const v = getPath(answers, key);
  if (v !== undefined && v !== null) return v;
  if (DESTRUCTIVE_KEYS.has(key)) return false; // fail-closed
  if (Object.prototype.hasOwnProperty.call(KEY_DEFAULTS, key)) return KEY_DEFAULTS[key];
  return safeDefault;
}

// Module-singleton convenience: resolve(key, safeDefault) against the loaded snapshot.
let _answers = null;
export function resolve(key, safeDefault) {
  if (_answers === null) _answers = loadAnswers();
  return resolveWith(_answers, key, safeDefault);
}

// --- self-test ---------------------------------------------------------------
function selfTest() {
  let failed = 0;
  const eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
    if (!ok) failed++;
  };

  // Destructive gates fail closed when omitted.
  eq('push omitted ⇒ false', resolveWith({}, 'push', true), false);
  eq('githubRelease omitted ⇒ false', resolveWith({}, 'githubRelease', true), false);
  eq('syncMirror omitted ⇒ false', resolveWith({}, 'syncMirror', true), false);

  // Explicit answer wins even over fail-closed.
  eq('push:true explicit ⇒ true', resolveWith({ push: true }, 'push', false), true);
  eq('push:false explicit ⇒ false', resolveWith({ push: false }, 'push', true), false);

  // tagCollision fixed policy default.
  eq('tagCollision omitted ⇒ abort', resolveWith({}, 'tagCollision', undefined), 'abort');
  eq('tagCollision explicit ⇒ value', resolveWith({ tagCollision: 'recreate' }, 'tagCollision', undefined), 'recreate');

  // Non-destructive keys fall through to the caller's safeDefault.
  eq('cleanTree omitted ⇒ safeDefault', resolveWith({}, 'cleanTree', 'porcelain-empty-only'), 'porcelain-empty-only');
  eq('confirmVersion omitted ⇒ safeDefault', resolveWith({}, 'confirmVersion', false), false);

  // Dotted-key traversal.
  eq('docs.proceed present ⇒ value', resolveWith({ docs: { proceed: true, editConfig: false } }, 'docs.proceed', false), true);
  eq('docs.editConfig present ⇒ value', resolveWith({ docs: { proceed: true, editConfig: false } }, 'docs.editConfig', true), false);
  eq('review.overrideHigh omitted ⇒ safeDefault', resolveWith({}, 'review.overrideHigh', false), false);

  // Activation switch.
  eq('isHeadless PRISM_NONINTERACTIVE=1', isHeadless({ PRISM_NONINTERACTIVE: '1' }), true);
  eq('isHeadless unset ⇒ false', isHeadless({}), false);
  eq('isHeadless =0 ⇒ false', isHeadless({ PRISM_NONINTERACTIVE: '0' }), false);

  // Discovery precedence: --answers arg beats env beats default.
  eq('path: --answers arg wins',
    resolveAnswersPath(['--answers', '/tmp/a.json'], { PRISM_RELEASE_ANSWERS: '/tmp/b.json' }),
    '/tmp/a.json');
  eq('path: env when no arg',
    resolveAnswersPath([], { PRISM_RELEASE_ANSWERS: '/tmp/b.json' }),
    '/tmp/b.json');
  eq('path: default tail',
    resolveAnswersPath([], { PRISM_PROJECT_DIR: '/proj' }).replace(/\\/g, '/'),
    '/proj/.prism/local/release-answers.json');

  // Interactive ⇒ file ignored entirely, even if it exists.
  const tmp = path.join(tmpdir(), 'prism-release-answers-selftest.json');
  try {
    writeFileSync(tmp, JSON.stringify({ push: true, dryRun: false }));
    eq('loadAnswers ignores file when NOT headless',
      loadAnswers({ argv: ['--answers', tmp], env: {} }), {});
    eq('loadAnswers reads file when headless',
      loadAnswers({ argv: ['--answers', tmp], env: { PRISM_NONINTERACTIVE: '1' } }),
      { push: true, dryRun: false });
    // End-to-end fail-closed still holds through the loaded file for an omitted destructive key.
    const loaded = loadAnswers({ argv: ['--answers', tmp], env: { PRISM_NONINTERACTIVE: '1' } });
    eq('loaded: githubRelease omitted ⇒ false', resolveWith(loaded, 'githubRelease', true), false);
    eq('loaded: push present ⇒ true', resolveWith(loaded, 'push', false), true);
  } finally {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
  }

  console.log(failed === 0 ? '\nself-test: PASS' : `\nself-test: FAIL (${failed})`);
  return failed === 0 ? 0 : 1;
}

function coerce(raw) {
  if (raw === undefined) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

// --- CLI ---------------------------------------------------------------------
const invokedDirectly = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => a !== '--answers' && !a.startsWith('--answers='));
  // Drop the value that follows a bare `--answers`.
  const key = (() => {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--answers') { i++; continue; }
      if (argv[i].startsWith('--answers=')) continue;
      return argv[i];
    }
    return undefined;
  })();
  if (!key || key === 'self-test' || key === '--self-test') {
    process.exit(selfTest());
  } else {
    const answers = loadAnswers({ argv });
    const safeIdx = positional.indexOf(key);
    const safeRaw = safeIdx >= 0 ? positional[safeIdx + 1] : undefined;
    const val = resolveWith(answers, key, coerce(safeRaw));
    process.stdout.write((typeof val === 'string' ? val : JSON.stringify(val)) + '\n');
    process.exit(0);
  }
}
