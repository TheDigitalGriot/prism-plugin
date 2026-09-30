#!/usr/bin/env node
/**
 * verify-invariants.mjs — run the ontology's invariants as checks.
 *
 * WHY THIS EXISTS
 * ---------------
 * Invariants I1-I6 were written into the agent ontology and then nothing
 * executed them. A declared invariant is a document; an executed one is a
 * control. This is the runner, and it is auto-discovered by
 * pre-release-audit.mjs (which globs scripts/verify-*.mjs), so it runs at the
 * ceremony gate — a path already travelled — rather than needing to be
 * remembered.
 *
 * HONESTY RULE (mirrors griot_assert): a check that cannot execute reports
 * UNVERIFIED. It never reports a pass it cannot stand behind, and unverified
 * is not failure — it is the absence of evidence, said out loud.
 *
 * Exit 0 = no invariant violated.  Exit 1 = at least one FAIL.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const results = []
const rec = (id, name, verdict, detail) => results.push({ id, name, verdict, detail })

const read = (p) => { try { return readFileSync(p, 'utf-8') } catch { return null } }
const dirs = (p) => { try { return readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) } catch { return [] } }
const newestFile = (p) => {
  try {
    const f = readdirSync(p).filter(x => x.endsWith('.html'))
      .map(x => ({ x, m: statSync(join(p, x)).mtimeMs })).sort((a, b) => b.m - a.m)
    return f.length ? f[0].x : null
  } catch { return null }
}

// ── I1 · the artifact shown IS the one being discussed ─────────────────────
{
  const base = join(ROOT, '.prism', 'local', 'brainstorm')
  const sessions = dirs(base)
  if (!sessions.length) {
    rec('I1', 'served artifact == current question', 'unverified', 'no brainstorm session in this repo')
  } else {
    const latest = sessions.map(s => ({ s, m: statSync(join(base, s)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0].s
    const sdir = join(base, latest)
    const state = read(join(sdir, 'state', 'decisions.json'))
    const newest = newestFile(join(sdir, 'content'))
    if (!state || !newest) {
      rec('I1', 'served artifact == current question', 'unverified', 'session has no state or no screens')
    } else {
      let claimed = null
      try { claimed = JSON.parse(state).currentScreen ?? null } catch { /* malformed */ }
      if (!claimed) {
        rec('I1', 'served artifact == current question', 'unverified',
            'state carries no currentScreen — use render-screen.sh so it does')
      } else if (claimed === newest) {
        rec('I1', 'served artifact == current question', 'pass', `${newest}`)
      } else {
        rec('I1', 'served artifact == current question', 'fail',
            `serving "${newest}" but state claims "${claimed}"`)
      }
    }
  }
}

// ── I2 · results that matter are written through to files ──────────────────
{
  const a = join(ROOT, '.prism', 'local', 'assertions', 'assertions.jsonl')
  rec('I2', 'write-through: verdicts exist on disk',
      existsSync(a) ? 'pass' : 'unverified',
      existsSync(a) ? a.replace(ROOT, '.') : 'no assertions recorded in this repo yet')
}

// ── I3 · bulk reading is delegated ─────────────────────────────────────────
// This USED to report "no telemetry exists". That was wrong, and the claim was
// never checked. The Claude Code session transcript records every Read with its
// file_path, so main-thread read sizes ARE recoverable: line-count each file the
// main thread read and flag anything over the threshold.
// Subagent reads live in their own transcripts, so what remains here is exactly
// what we want to measure -- the main thread.
{
  const BIG = 800
  const proj = process.env.USERPROFILE || process.env.HOME || ''
  const projects = process.env.PRISM_VERIFY_PROJECTS_DIR || join(proj, '.claude', 'projects')
  // I3 must reflect THIS repo's session, not whichever repo was touched last on
  // the machine. Claude Code names each project dir from its cwd, replacing the
  // path separators and the drive colon with '-' (C:\\Users\\x\\Prism -> C--Users-x-Prism).
  // Scope discovery to the dir that decodes to ROOT, so a newer transcript from an
  // unrelated repo can never stand in for this one.
  const ROOTKEY = ROOT.replace(/[\\/:]/g, '-').toLowerCase()
  let newest = null
  try {
    for (const d of readdirSync(projects)) {
      if (!d.toLowerCase().startsWith(ROOTKEY)) continue
      const dir = join(projects, d)
      let files = []
      try { files = readdirSync(dir).filter(f => f.endsWith('.jsonl')) } catch { continue }
      for (const f of files) {
        const full = join(dir, f)
        const m = statSync(full).mtimeMs
        if (!newest || m > newest.m) newest = { full, m }
      }
    }
  } catch { /* no transcripts */ }

  if (!newest) {
    rec('I3', 'bulk reading is delegated', 'unverified', 'no session transcript for this repo (ROOT-scoped)')
  } else {
    // Tail only: a full transcript can be enormous, and reading it whole here
    // would be the very sin this invariant checks for.
    let text = ''
    let tailNote = ''
    try {
      const size = statSync(newest.full).size
      const fd = readFileSync(newest.full)
      const CAP = 4_000_000
      text = fd.subarray(Math.max(0, size - CAP)).toString('utf-8')
      // Tail-only by design (reading the whole file would be the sin this checks
      // for). Surface the blind spot: an offending read earlier in a long session
      // that got pushed past this tail escapes -- a pass means "tail clean", not
      // "whole session clean". Say so in the detail so a PASS is not over-read.
      if (size > CAP) tailNote = ` (tail-only: last ${(CAP / 1e6) | 0}MB of ${(size / 1e6).toFixed(1)}MB scanned)`
    } catch { /* unreadable */ }

    // Capture the whole input object so `limit` is visible. A WINDOWED read
    // (offset/limit) is precisely the disciplined behaviour this invariant wants
    // -- charging it the file's full length would flag the good case and make the
    // check cry wolf, which is worse than no check at all.
    const reads = []
    // NOTE: coupled to Claude Code's current transcript JSON shape (name immediately
    // before input; no nested braces in the input object). A schema change degrades
    // to the looser fallback below, or to 'unverified' -- never a false pass -- but
    // diagnose the coupling here first.
    const re = /"name"\s*:\s*"Read"\s*,\s*"input"\s*:\s*(\{[^}]*\})/g
    let m
    while ((m = re.exec(text)) !== null) {
      try {
        const inp = JSON.parse(m[1])
        if (inp.file_path) reads.push({ f: inp.file_path, limit: Number(inp.limit) || null })
      } catch { /* malformed */ }
    }
    // fall back to the looser shape if the strict one matched nothing
    if (!reads.length) {
      const re2 = /"name"\s*:\s*"Read"[\s\S]{0,400}?"file_path"\s*:\s*"([^"]+)"/g
      let m2
      while ((m2 = re2.exec(text)) !== null) reads.push({ f: m2[1], limit: null })
    }

    const paths = new Set(reads.map(r => r.f))
    const offenders = []
    for (const r of reads) {
      // an explicit limit IS the read size
      if (r.limit !== null) {
        if (r.limit > BIG) offenders.push(`${r.f.split(/[\\/]/).pop()}:${r.limit} (windowed)`)
        continue
      }
      try {
        // Line count is the file's CURRENT state, not its length at read-time; a
        // since-trimmed file could shift this. Acceptable: I3 flags egregious
        // whole-file reads, where a few lines of drift never changes the verdict.
        const lines = readFileSync(r.f, 'utf-8').split('\n').length
        if (lines > BIG) offenders.push(`${r.f.split(/[\\/]/).pop()}:${lines} (whole file)`)
      } catch { /* gone or binary */ }
    }
    if (!paths.size) {
      rec('I3', 'bulk reading is delegated', 'unverified', 'no Read calls found in transcript tail')
    } else if (offenders.length) {
      rec('I3', 'bulk reading is delegated', 'fail',
          `${offenders.length} main-thread read(s) over ${BIG} lines: ${offenders.slice(0, 3).join(', ')}${tailNote}`)
    } else {
      rec('I3', 'bulk reading is delegated', 'pass', `${paths.size} main-thread read(s), all under ${BIG} lines${tailNote}`)
    }
  }
}

// ── I4 · a completion claim carries fresh evidence ─────────────────────────
{
  const a = read(join(ROOT, '.prism', 'local', 'assertions', 'assertions.jsonl'))
  if (!a) {
    rec('I4', 'completion claims carry fresh evidence', 'unverified', 'no assertion record')
  } else {
    const lines = a.trim().split('\n').filter(Boolean)
    const bad = lines.filter(l => { try { const r = JSON.parse(l); return r.verdict === 'pass' && r.rung === 'none' } catch { return false } })
    rec('I4', 'completion claims carry fresh evidence', bad.length ? 'fail' : 'pass',
        bad.length ? `${bad.length} pass(es) recorded with no execution rung` : `${lines.length} verdict(s) recorded`)
  }
}

// ── I5 · a multi-step run leaves a heartbeat ───────────────────────────────
{
  const local = join(ROOT, '.prism', 'local')
  let beats = []
  try { beats = readdirSync(local).filter(f => f.endsWith('-progress.txt')) } catch { /* none */ }
  rec('I5', 'multi-step runs leave a heartbeat', beats.length ? 'pass' : 'unverified',
      beats.length ? `${beats.length} heartbeat file(s)` : 'no heartbeat files in .prism/local')
}

// ── I6 · proper names still resolve ────────────────────────────────────────
{
  // identifiers that must never be renamed into descriptors
  const PROPER = [
    { name: 'dgs-plan-update skill', path: join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'skills', 'dgs-plan-update', 'SKILL.md') },
    { name: 'digital-griot-mcp', path: join(ROOT, 'scripts', 'digital-griot-mcp', 'digital-griot-mcp.ts') },
    // additive rename 2026-09-05: icm-architect -> spectrum-architect, prism-spectrum -> spectrum.
    // BOTH names must resolve for BOTH renames. minBytes on the canonicals: a hollowed-out
    // canonical is a silent kill (the alias would point at nothing). The aliases are thin by
    // design, so their floor only catches truncation.
    { name: 'spectrum-architect skill (canonical)', minBytes: 5000, path: join(ROOT, 'skills', 'spectrum-architect', 'SKILL.md') },
    { name: 'icm-architect skill (deprecation alias)', minBytes: 500, path: join(ROOT, 'skills', 'icm-architect', 'SKILL.md') },
    { name: 'spectrum skill (canonical)', minBytes: 10000, path: join(ROOT, 'skills', 'spectrum', 'SKILL.md') },
    { name: 'prism-spectrum skill (deprecation alias)', minBytes: 500, path: join(ROOT, 'skills', 'prism-spectrum', 'SKILL.md') },
    // the run-contract is reached by a DEEP path from 8 skills; the alias dir does not carry it.
    { name: 'spectrum-architect run-contract (deep path target)', minBytes: 1000, path: join(ROOT, 'skills', 'spectrum-architect', 'references', 'prism-run-contract.md') },
    { name: 'griot-agent-architect skill (canonical)', path: join(ROOT, 'skills', 'griot-agent-architect', 'SKILL.md') },
    // additive rename 2026-09-05: cl-plugin-structure MUST keep resolving as a deprecation alias.
    { name: 'cl-plugin-structure skill (deprecation alias)', path: join(ROOT, 'skills', 'cl-plugin-structure', 'SKILL.md') },
    // additive rename 2026-09-05: agent-ontology -> griot-ontology (the DOCTRINE SUBSTRATE).
    // ~15 repo roots + the CLI global reference the OLD absolute path; it MUST keep resolving
    // to the full doctrine, so the legacy path is kept as a generated byte-identical mirror.
    // minBytes: existence alone is not resolution -- a truncated/stub mirror is a silent kill.
    { name: 'griot-ontology doctrine (canonical)', minBytes: 20000, path: join(process.env.USERPROFILE || process.env.HOME || '', 'GriotMeta', 'griot-ontology', 'claude', 'CLAUDE.md') },
    { name: 'agent-ontology doctrine path (legacy compat surface)', minBytes: 20000, path: join(process.env.USERPROFILE || process.env.HOME || '', 'GriotMeta', 'agent-ontology', 'claude', 'CLAUDE.md') },
  ]
  const missing = PROPER.filter(p => p.path && !existsSync(p.path))
  // a proper name that resolves to an empty/truncated file has not actually resolved
  const hollow = PROPER.filter(p => p.path && p.minBytes && existsSync(p.path) && statSync(p.path).size < p.minBytes)
  const broken = [...missing.map(m => `${m.name} (missing)`), ...hollow.map(h => `${h.name} (hollow)`)]
  rec('I6', 'proper names still resolve', broken.length ? 'fail' : 'pass',
      broken.length ? `broken: ${broken.join(', ')}` : `${PROPER.length} checked`)
}

// ── I7 · a fix is preceded by an OBSERVATION, not an inference ─────────────
// The failure this catches: editing something to fix a reported symptom without
// ever observing the symptom -- reasoning about what a screen looks like instead
// of screenshotting it, or patching one state while the user is looking at
// another. Four separate occurrences in one session on 2026-09-05.
//
// Computable form: a session that produced edits must also have produced recorded
// verdicts. No verdicts + edits = a session that changed things without ever
// checking anything. This is also what finally gives griot_assert real consumers.
{
  const a = read(join(ROOT, '.prism', 'local', 'assertions', 'assertions.jsonl'))
  let recent = 0
  if (a) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const line of a.trim().split('\n')) {
      try {
        const r = JSON.parse(line)
        const t = Date.parse(r.when || r.at || r.t || r.time || '')
        if (!isNaN(t) && t >= cutoff) recent++
      } catch { /* skip */ }
    }
  }
  if (!a) {
    rec('I7', 'observation precedes the fix', 'unverified', 'no assertion record in this repo')
  } else if (recent === 0) {
    rec('I7', 'observation precedes the fix', 'unverified',
        'assertions exist but none in the last 24h -- cannot tie them to this session')
  } else {
    rec('I7', 'observation precedes the fix', 'pass', `${recent} verdict(s) recorded in the last 24h`)
  }
}

// ── I8 · no soft fixes: nothing documented has zero instances ──────────────
// "SOFT FIXES ROT" was written into the ontology and then nothing checked it --
// which made the anti-soft-fix principle itself a soft fix. This is the check.
// A helper nobody calls and a convention with no instances are the two shapes
// that were actually found by hand; both are computable.
{
  const problems = []
  const scriptsDir = join(ROOT, 'scripts')
  let scripts = []
  try {
    scripts = readdirSync(scriptsDir).filter(f => /\.(mjs|sh|js)$/.test(f))
  } catch { /* none */ }

  // A verify-*.mjs is CALLED BY DISCOVERY (pre-release-audit globs them), so it
  // is never "uncalled" -- exempt, or the audit reports its own runners as dead.
  // Search the WHOLE repo for callers, not just scripts/. A helper invoked from a
  // SKILL.md, a command, or a hook is not dead -- scoping the search to scripts/
  // reported two live worktree helpers as orphans on the first run.
  const haystack = []
  const walk = (dir, depth) => {
    if (depth > 3) return
    let ents = []
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else if (/\.(md|mjs|js|sh|json|ts)$/.test(e.name)) {
        const t = read(full)
        if (t) haystack.push({ file: full, t })
      }
    }
  }
  for (const d of ['scripts', 'skills', 'commands', 'hooks', '.claude-plugin']) {
    walk(join(ROOT, d), 0)
  }

  for (const f of scripts) {
    if (/^verify-.*\.mjs$/.test(f)) continue          // auto-discovered by the audit
    if (f === 'pre-release-audit.mjs') continue
    // a mention inside the file itself does not count as a caller
    // Match the full filename OR the bare basename: an installed helper is usually
    // referenced by the CLI name you type (spectrum-marathon-continue), not the file
    // (spectrum-marathon-continue.sh). Without the basename fallback, documenting it
    // correctly by bare name still reads as 'no caller' and false-FAILs the gate.
    const base = f.replace(/\.[^.]+$/, '')
    const referenced = haystack.some(x => !x.file.endsWith(f) && (x.t.includes(f) || (base.length > 6 && x.t.includes(base))))
    if (!referenced) problems.push(`${f}: no caller anywhere in the repo`)
  }

  rec('I8', 'no soft fixes (helpers have callers)',
      problems.length ? 'fail' : 'pass',
      problems.length ? problems.slice(0, 3).join(' · ') + (problems.length > 3 ? ` (+${problems.length - 3})` : '')
                      : `${scripts.length} script(s) checked`)
}

// ── I9 · a DECISION carries an execution commit or an explicit deferral ────
// The failure this catches: the decided-but-silently-unexecuted record. A choice
// gets LOCKED in the drawer, the session moves on, and nothing ever ships — but
// the record still reads "DECIDED", so the drift is invisible at the exact place
// you would look for it. Decided is not done, and deferred-on-purpose is fine;
// what is not fine is a locked decision that says NOTHING about either.
//
// Computable form, over the current session's decisions.json (same "newest
// session" rule as I1 — the current spine, not every stale snapshot):
//   executed = a git sha in the record that RESOLVES to a real commit in this
//              repo. Resolving through git, not regex alone, is what makes this
//              an observation: "defaced" and "acceded" are valid hex strings, so
//              pattern-matching alone would manufacture passes.
//   deferred = structural first — the decision is carried in parked[] via fromQ,
//              or the record carries an explicit deferred/revisit field — with a
//              deliberately TIGHT prose fallback. Loose markers ("park",
//              "later", "inbound") are domain vocabulary in these records and
//              matched decisions that were not deferred at all. A lenient
//              deferral test buys a green board by lying, which is the one thing
//              this file's honesty rule forbids.
// Undecided records (empty choice) are exempt — they are open, not silent.
{
  const base = join(ROOT, '.prism', 'local', 'brainstorm')
  const sessions = dirs(base)
  let gitOk = true
  try { execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'ignore' }) } catch { gitOk = false }

  if (!sessions.length) {
    rec('I9', 'decisions carry a commit or a deferral', 'unverified', 'no decision records in this repo')
  } else if (!gitOk) {
    rec('I9', 'decisions carry a commit or a deferral', 'unverified',
        'no git here — execution commits cannot be resolved, so nothing can be claimed')
  } else {
    const latest = sessions.map(s => ({ s, m: statSync(join(base, s)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0].s
    const state = read(join(base, latest, 'state', 'decisions.json'))
    let parsed = null
    try { parsed = state ? JSON.parse(state) : null } catch { /* malformed */ }
    const decisions = Array.isArray(parsed?.decisions) ? parsed.decisions : null

    if (!decisions) {
      rec('I9', 'decisions carry a commit or a deferral', 'unverified',
          state ? 'decision state is malformed or carries no decisions[]' : 'session has no decision state')
    } else {
      const parked = Array.isArray(parsed.parked) ? parsed.parked : []
      const parkedFrom = new Set(parked.map(p => p && p.fromQ).filter(Boolean))
      // tight on purpose — every phrase here is an explicit statement about
      // execution, not a word that happens to appear in these decisions.
      const DEFERRED = /\b(deferred|deferral|revisit|out of scope|not this session|own conversation|next cycle|backlog|not now|won't do|wont do)\b/i
      const resolved = new Map()
      const resolves = (sha) => {
        if (!resolved.has(sha)) {
          let ok = false
          try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); ok = true } catch { /* not a commit */ }
          resolved.set(sha, ok)
        }
        return resolved.get(sha)
      }

      const silent = []
      let executed = 0, deferred = 0, open = 0
      for (const d of decisions) {
        const id = d.q || d.label || '(unlabelled)'
        const choice = String(d.choice || '').trim()
        if (!choice) { open++; continue }
        const blob = [choice, d.summary, d.commit, d.executed, d.deferred, d.revisit].filter(Boolean).join(' ')
        const shas = [...new Set(blob.match(/\b[0-9a-f]{7,40}\b/g) || [])].filter(resolves)
        if (shas.length) executed++
        else if (parkedFrom.has(d.q) || d.deferred || d.revisit || DEFERRED.test(blob)) deferred++
        else silent.push(`${id} ("${choice.slice(0, 32)}")`)
      }

      const tally = `${executed} executed · ${deferred} deferred · ${open} open of ${decisions.length}`
      rec('I9', 'decisions carry a commit or a deferral', silent.length ? 'fail' : 'pass',
          silent.length
            ? `${silent.length} decided but silent (no commit, no deferral): ${silent.slice(0, 3).join(' · ')}${silent.length > 3 ? ` (+${silent.length - 3})` : ''}`
            : tally)
    }
  }
}

// ── I10 · the ontology EDITED is the canonical, never the generated mirror ──
// The failure this catches, observed 2026-09-06: the doctrine substrate lives at
// griot-ontology/claude/CLAUDE.md, and propagate.ps1 copies it to the legacy
// agent-ontology path as a generated compat mirror. Every repo root imported the
// MIRROR, so the string "griot-ontology" appeared ZERO times in the doctrine an
// agent actually reads — the canonical was unreachable from inside any session.
// An agent asked to amend the ontology therefore edits the mirror, and the next
// propagate run silently clobbers the edit. Nothing failed; the work just vanished.
//
// I6 already asserts both paths RESOLVE. That is not enough: two files can both
// exist while one silently holds an edit that is about to be destroyed. So:
//   parity  — mirror bytes == canonical bytes. A difference means either the
//             mirror was hand-edited (edit pending loss) or propagate was not
//             re-run after a canonical change (surfaces serving stale doctrine).
//             Either way it is a FAIL, and the detail says which direction.
//   reach   — this repo's own CLAUDE.md names the canonical path, so the canonical
//             is discoverable from inside the session that would edit it. This is
//             the half that actually prevents the mistake rather than detecting it.
{
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const canon = join(home, 'GriotMeta', 'griot-ontology', 'claude', 'CLAUDE.md')
  const mirror = join(home, 'GriotMeta', 'agent-ontology', 'claude', 'CLAUDE.md')
  const problems = []

  if (!existsSync(canon) || !existsSync(mirror)) {
    rec('I10', 'ontology: canonical edited, not the mirror', 'unverified',
        `not both present (canonical ${existsSync(canon) ? 'ok' : 'MISSING'}, mirror ${existsSync(mirror) ? 'ok' : 'MISSING'})`)
  } else {
    // Compare bytes, not text: an encoding/line-ending divergence is real drift
    // between what the canonical says and what the mirror serves.
    const a = readFileSync(canon), b = readFileSync(mirror)
    if (!a.equals(b)) {
      const newer = statSync(canon).mtimeMs >= statSync(mirror).mtimeMs
      problems.push(newer
        ? `mirror is STALE (${a.length}B canonical vs ${b.length}B mirror) — re-run propagate.ps1`
        : `mirror is NEWER than canonical (${b.length}B vs ${a.length}B) — it was hand-edited; that edit will be LOST on the next propagate. Move it into griot-ontology first.`)
    }

    const self = read(join(ROOT, 'CLAUDE.md'))
    if (self === null) {
      problems.push('this repo has no CLAUDE.md, so the canonical is not reachable from its sessions')
    } else if (self.includes('agent-ontology')) {
      problems.push('this repo imports the legacy agent-ontology path — the canonical is invisible from its sessions')
    } else if (!self.includes('griot-ontology')) {
      problems.push('this repo names neither ontology path')
    }

    rec('I10', 'ontology: canonical edited, not the mirror',
        problems.length ? 'fail' : 'pass',
        problems.length ? problems.join(' · ') : 'mirror byte-identical to canonical; repo imports the canonical path')
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n)
console.log('\ninvariants — from the agent ontology\n')
for (const r of results) {
  const mark = r.verdict === 'pass' ? 'PASS' : r.verdict === 'fail' ? 'FAIL' : 'UNVERIFIED'
  console.log(`  ${pad(r.id, 4)} ${pad(mark, 11)} ${pad(r.name, 42)} ${r.detail}`)
}
const fails = results.filter(r => r.verdict === 'fail')
const unver = results.filter(r => r.verdict === 'unverified')
console.log(`\n  ${results.filter(r => r.verdict === 'pass').length} pass · ${fails.length} fail · ${unver.length} unverified`)
if (unver.length) console.log('  unverified is not pass — it is the absence of evidence, stated.')
console.log('')
process.exit(fails.length ? 1 : 0)
