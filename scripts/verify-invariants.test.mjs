// Regression tests for verify-invariants.mjs -- added with the v4.15.1 code-review
// fixes. The script reads global state (git, ~/.claude/projects, .prism/local), so
// these run it as a subprocess against real repo state, plus a fixtured projects
// dir (PRISM_VERIFY_PROJECTS_DIR) to prove the I3 ROOT-scoping fix in isolation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, 'verify-invariants.mjs')
const REPO = join(HERE, '..')

function run(env = {}) {
  try {
    const out = execFileSync('node', [SCRIPT], { cwd: REPO, env: { ...process.env, ...env }, encoding: 'utf-8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } // exit 1 on a failing invariant is normal
  }
}

test('golden path: runs without throwing and reports all nine invariants + a summary', () => {
  const { out } = run()
  for (const id of ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9']) {
    assert.match(out, new RegExp(`\\b${id}\\b`), `${id} missing from report`)
  }
  assert.match(out, /pass .*fail .*unverified/, 'summary footer missing')
})

test('I3 ROOT-scoping: a newer FOREIGN-repo transcript never stands in for this repo', () => {
  // Fixture projects dir with ONLY a foreign repo's transcript (its dir name
  // decodes to a different cwd than ROOT). Post-fix, I3 must skip it -> unverified,
  // never reporting a verdict computed from another repo's reading discipline.
  const proj = mkdtempSync(join(tmpdir(), 'vi-proj-'))
  const foreign = join(proj, 'D--Users-someone-OtherRepo')
  mkdirSync(foreign, { recursive: true })
  const line = JSON.stringify({ type: 'assistant', message: { content: [
    { type: 'tool_use', name: 'Read', input: { file_path: 'D:/Users/someone/OtherRepo/huge.txt' } },
  ] } })
  writeFileSync(join(foreign, 'sess.jsonl'), line + '\n')
  const { out } = run({ PRISM_VERIFY_PROJECTS_DIR: proj })
  const i3 = out.split('\n').find(l => /\bI3\b/.test(l)) || ''
  assert.match(i3, /unverified/i, `I3 should be unverified with only foreign transcripts, got: ${i3.trim()}`)
  assert.doesNotMatch(i3, /OtherRepo|huge\.txt/, 'I3 must not report the foreign transcript')
})

test('I3 ROOT-scoping: an empty fixture yields unverified, not a crash', () => {
  const proj = mkdtempSync(join(tmpdir(), 'vi-empty-'))
  const { out, code } = run({ PRISM_VERIFY_PROJECTS_DIR: proj })
  const i3 = out.split('\n').find(l => /\bI3\b/.test(l)) || ''
  assert.match(i3, /unverified/i, `I3 should be unverified for an empty projects dir, got: ${i3.trim()}`)
  assert.ok(code === 0 || code === 1, 'script should exit cleanly (0/1), not crash')
})
