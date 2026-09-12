#!/usr/bin/env node
/**
 * verify-code-intel.mjs — the code-intelligence invariants, as checks.
 *
 * WHY THIS EXISTS
 * ---------------
 * 2026-09-11. Three code-intelligence systems were correctly built and all
 * three sat idle, because each was aimed at an address that no longer existed:
 *
 *   codebase-memory-mcp  indexed at C:/Users/digit/Developer/prism-plugin — the
 *                        PRE-MOVE path — 32,748 nodes at HEAD 5c52c6a (June 14)
 *                        while the live repo was GriotApps/Prism at dd6ff68.
 *                        Three months of silent misses; every graph query fell
 *                        through to grep without saying so.
 *   .gitnexus/lbug       39,798 nodes, last written Jul 12 23:06 — the hour it
 *                        was indexed. Never queried since.
 *   code-review-graph    on the Potluck shelf by full name. Never installed.
 *
 * None of that is a documentation gap. The folder move WAS documented, in the
 * ontology and in griot-suite-context, in multiple places. What was missing was
 * anything that FAILED when the documentation was ignored.
 *
 * That is the ontology's own rule, learned the hard way:
 *   "an instruction to an agent is not a control"
 *   "before calling something fixed, ask: what fails if this is ignored?
 *    If the answer is nothing, it is paint, not a repair."
 *
 * In ten hours of that session, exactly ONE thing altered agent behaviour: a
 * PreToolUse hook, which blocked an action outright with no negotiation. Prose
 * changed nothing. So these are checks, not guidance.
 *
 * Auto-discovered by pre-release-audit.mjs (globs scripts/verify-*.mjs), so it
 * runs at the ceremony gate — a path already travelled.
 *
 * HONESTY RULE (mirrors verify-invariants.mjs and griot_assert): a check that
 * cannot execute reports UNVERIFIED. Never a pass it cannot stand behind.
 *
 * Exit 0 = no invariant violated.  Exit 1 = at least one FAIL.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'

const ROOT = process.cwd()
const results = []
const rec = (id, name, verdict, detail) => results.push({ id, name, verdict, detail })
const read = (p) => { try { return readFileSync(p, 'utf-8') } catch { return null } }
const git = (...args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).trim() }
  catch { return null }
}

/** The cache names a project by its absolute path with separators flattened. */
const slugOf = (abs) => abs.replace(/^([A-Za-z]):/, '$1').replace(/[\\/:]+/g, '-')

const CACHE = join(homedir(), '.cache', 'codebase-memory-mcp')

// ── I11 · the code graph is indexed at THIS repo, not a previous address ────
// The failure this catches is silent by construction: a graph indexed at an old
// path answers every query with nothing, and the agent falls back to grep
// without ever reporting that the graph was empty for this tree.
{
  if (!existsSync(CACHE)) {
    rec('I11', 'code graph indexed at THIS repo', 'unverified',
        `no codebase-memory cache at ${CACHE} — the MCP may never have run here`)
  } else {
    const dbs = readdirSync(CACHE).filter((f) => f.endsWith('.db')).map((f) => f.slice(0, -3))
    const want = slugOf(ROOT)
    const hit = dbs.find((d) => d.toLowerCase() === want.toLowerCase())
    if (hit) {
      rec('I11', 'code graph indexed at THIS repo', 'pass', `${hit}.db`)
    } else {
      // Name the near-misses — an old path for the same project is the whole point.
      const tail = ROOT.split(/[\\/]/).filter(Boolean).pop().toLowerCase()
      const near = dbs.filter((d) => d.toLowerCase().includes(tail)).slice(0, 4)
      rec('I11', 'code graph indexed at THIS repo', 'fail',
          `no index for ${want}. ` +
          (near.length ? `Other indexes mention "${tail}": ${near.join(', ')} — a stale address. ` : '') +
          `Re-index: index_repository(repo_path="${ROOT}")`)
    }
  }
}

// ── I12 · every index is at HEAD, not at a commit from months ago ───────────
{
  const head = git('rev-parse', 'HEAD')
  const problems = []
  let checked = 0

  // GitNexus records its own indexed commit, so this is exact rather than inferred.
  const gx = read(join(ROOT, '.gitnexus', 'gitnexus.json'))
  if (gx) {
    checked++
    try {
      const j = JSON.parse(gx)
      // TOLERANCE, added 2026-09-12. Strict equality fails on EVERY commit —
      // including the release commit that runs this very gate — and a check that
      // is permanently red is a check nobody reads. Exactly the failure that made
      // "7 of 11 layers" survive for months as an honest-looking number.
      // The failure this exists to catch was 228 commits / 3 months, not one
      // commit thirty seconds ago. So: drift is fine, STALENESS is not.
      const MAX_COMMITS_BEHIND = 25
      const MAX_DAYS_BEHIND = 14
      if (!head) problems.push('gitnexus: cannot read git HEAD to compare')
      else if (j.lastCommit !== head) {
        const when = String(j.indexedAt ?? '').slice(0, 10)
        const behind = Number(git('rev-list', '--count', `${j.lastCommit}..HEAD`) ?? 0)
        const days = j.indexedAt ? (Date.now() - Date.parse(j.indexedAt)) / 86400000 : 0
        if (behind > MAX_COMMITS_BEHIND || days > MAX_DAYS_BEHIND) {
          problems.push(
            `gitnexus indexed at ${String(j.lastCommit).slice(0, 7)} (${when}), ` +
            `${behind} commits / ${Math.floor(days)} days behind HEAD ${head.slice(0, 7)} ` +
            `— past the ${MAX_COMMITS_BEHIND}-commit / ${MAX_DAYS_BEHIND}-day tolerance. ` +
            `Re-index: node .gitnexus/run.cjs analyze`)
        }
      }
      // Capability health is I15, NOT here. Bundling it with freshness meant a
      // fixed index still read FAIL because a degraded capability was riding the
      // same verdict — one fix invisible behind the other. Split 2026-09-12 so
      // each verdict answers exactly one question.
    } catch { problems.push('gitnexus.json is present but unparseable') }
  }

  // codebase-memory has no commit stamp on disk; mtime against the HEAD date is
  // the honest proxy, and it is labelled as a proxy rather than sold as exact.
  const db = existsSync(CACHE)
    ? readdirSync(CACHE).find((f) => f.toLowerCase() === (slugOf(ROOT) + '.db').toLowerCase())
    : null
  if (db) {
    checked++
    const idx = statSync(join(CACHE, db)).mtimeMs
    const headIso = git('log', '-1', '--format=%cI')
    if (headIso) {
      const days = (Date.parse(headIso) - idx) / 86400000
      if (days > 1) problems.push(`codebase-memory index is ~${Math.floor(days)} days older than HEAD (mtime proxy)`)
    }
  }

  if (!checked) rec('I12', 'indexes are at HEAD', 'unverified', 'no code-intel index found in this repo')
  else rec('I12', 'indexes are at HEAD', problems.length ? 'fail' : 'pass',
           problems.length ? problems.join(' · ') : `all ${checked} index(es) current at ${String(head).slice(0, 7)}`)
}

// ── I13 · a vendored tree is the WHOLE tree, not a subset ──────────────────
// 2026-09-11: vendor/archify held 68 files. Upstream had 542, including the
// entire authored viewer/ runtime and 143 docs. A harvest then concluded "there
// is no viewer/ directory" — true of the copy, false of the project — and every
// pass afterwards reasoned about a partial tree.
{
  const vend = join(ROOT, 'apps', 'prism-viz-engine', 'vendor')
  if (!existsSync(vend)) {
    rec('I13', 'vendored trees are complete', 'unverified', 'no vendor/ directory in this repo')
  } else {
    const count = (d) => {
      let n = 0
      const walk = (p, depth) => {
        if (depth < 0) return
        let ents; try { ents = readdirSync(p, { withFileTypes: true }) } catch { return }
        for (const e of ents) {
          if (e.isDirectory()) { if (e.name === '.git' || e.name === 'node_modules') continue; walk(join(p, e.name), depth - 1) }
          else n++
        }
      }
      walk(d, 12); return n
    }
    const trees = readdirSync(vend, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    // A recorded baseline is what makes this checkable offline. Absent one, say so.
    const manifestPath = join(vend, 'VENDOR-MANIFEST.json')
    const man = read(manifestPath)
    if (!man) {
      rec('I13', 'vendored trees are complete', 'unverified',
          `no ${manifestPath} — record {tree: expectedFileCount} at vendor time so a subset is detectable offline. ` +
          `Present: ${trees.map((t) => `${t}(${count(join(vend, t))})`).join(', ')}`)
    } else {
      try {
        const exp = JSON.parse(man)
        const bad = []
        for (const [t, n] of Object.entries(exp)) {
          if (!trees.includes(t)) { bad.push(`${t} MISSING`); continue }
          const got = count(join(vend, t))
          if (got < n * 0.9) bad.push(`${t}: ${got} files vs ${n} expected — a SUBSET`)
        }
        rec('I13', 'vendored trees are complete', bad.length ? 'fail' : 'pass',
            bad.length ? bad.join(' · ') : `${Object.keys(exp).length} tree(s) at expected size`)
      } catch { rec('I13', 'vendored trees are complete', 'unverified', 'VENDOR-MANIFEST.json unparseable') }
    }
  }
}

// ── I14 · a tool decided ADOPT on the shelf is actually installed ───────────
// code-review-graph sat on the Potluck under its exact name while the agent
// grepped the local disk and reported it missing. A shelf entry that never
// becomes an install is indistinguishable from never having found the tool.
{
  const PLAN = join(homedir(), 'GriotMeta', 'griot-live-artifacts', 'live', 'dgs-definitive-plan.html')
  const html = read(PLAN)
  if (!html) {
    rec('I14', 'adopted shelf tools are installed', 'unverified', `plan not readable at ${PLAN}`)
  } else {
    // Known installation witnesses. Extend as tools are adopted — the point is
    // that "adopted" has to be falsifiable, not a label.
    const witnesses = {
      'code-review-graph': [join(ROOT, '.code-review-graph'), join(homedir(), 'GriotMeta', 'code-intel-harvest', 'code-review-graph')],
      archify: [join(ROOT, 'apps', 'prism-viz-engine', 'vendor', 'archify')],
      ladybug: [join(ROOT, '.gitnexus', 'lbug'), join(homedir(), 'GriotMeta', 'kuzu-archive')],
    }
    const missing = []
    for (const [tool, paths] of Object.entries(witnesses)) {
      const onShelf = html.toLowerCase().includes(tool.toLowerCase())
      const installed = paths.some((p) => existsSync(p))
      if (onShelf && !installed) missing.push(`${tool}: on the shelf, no install witness`)
    }
    rec('I14', 'adopted shelf tools are installed', missing.length ? 'fail' : 'pass',
        missing.length ? missing.join(' · ') : `${Object.keys(witnesses).length} tracked tool(s) have install witnesses`)
  }
}

// ── I15 · a declared capability is actually available ──────────────────────
// A capability that degrades silently is worse than one that is absent: the tool
// still answers, just worse, and nobody is told. gitnexus.json records status and
// a reason per capability, so this is a read, not a guess. Separate from I12 —
// "stale" and "degraded" are different failures and must not mask each other.
{
  const gx = read(join(ROOT, '.gitnexus', 'gitnexus.json'))
  if (!gx) {
    rec('I15', 'declared capabilities are available', 'unverified', 'no .gitnexus/gitnexus.json in this repo')
  } else {
    try {
      const caps = JSON.parse(gx)?.capabilities ?? {}
      const bad = Object.entries(caps)
        .filter(([, c]) => c?.status && c.status !== 'available')
        .map(([k, c]) => `${k}=${c.status}${c.reason ? ` (${String(c.reason).slice(0, 70)})` : ''}`)

      // A capability is only MISSING if no provider supplies it. gitnexus's own
      // vectorSearch is disabled on this platform (LadybugDB VECTOR), but
      // code-review-graph carries a local embedding index over the same repo, so
      // concept-level search IS available — just not from that provider.
      // Checking one provider and declaring the capability dead is how a check
      // goes permanently red and stops being read.
      const crgDb = join(ROOT, '.code-review-graph')
      let semanticElsewhere = null
      if (existsSync(crgDb)) {
        try {
          const hit = readdirSync(crgDb).find((f) => /embed/i.test(f)) ||
            (existsSync(join(crgDb, 'graph.db')) ? 'graph.db' : null)
          if (hit) semanticElsewhere = `code-review-graph (${hit})`
        } catch { /* fall through */ }
      }

      const onlySemanticDown = bad.length > 0 && bad.every((b) => b.startsWith('vectorSearch'))
      if (bad.length && onlySemanticDown && semanticElsewhere) {
        rec('I15', 'declared capabilities are available', 'pass',
            `${bad.join(' · ')} — BUT semantic search is covered by ${semanticElsewhere}, so concept-level queries work`)
      } else {
        rec('I15', 'declared capabilities are available', bad.length ? 'fail' : 'pass',
            bad.length
              ? `${bad.join(' · ')} — and no other provider supplies it`
              : `${Object.keys(caps).length} capabilities available`)
      }
    } catch { rec('I15', 'declared capabilities are available', 'unverified', 'gitnexus.json unparseable') }
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n)
console.log('\ncode-intelligence invariants — aimed at the right address?\n')
for (const r of results) {
  const mark = r.verdict === 'pass' ? 'PASS' : r.verdict === 'fail' ? 'FAIL' : 'UNVERIFIED'
  console.log(`  ${pad(r.id, 4)} ${pad(mark, 11)} ${pad(r.name, 40)} ${r.detail}`)
}
const fails = results.filter((r) => r.verdict === 'fail')
const unver = results.filter((r) => r.verdict === 'unverified')
console.log(`\n  ${results.filter((r) => r.verdict === 'pass').length} pass · ${fails.length} fail · ${unver.length} unverified`)
if (unver.length) console.log('  unverified is not pass — it is the absence of evidence, stated.')
console.log('')
process.exit(fails.length ? 1 : 0)
