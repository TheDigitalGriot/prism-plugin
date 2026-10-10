#!/usr/bin/env node
// pre-release-audit.mjs — the deterministic half of the closing-ceremony Review & Audit gate.
// Run from the repo root:  node scripts/pre-release-audit.mjs
// Runs `claude plugin validate .`, discovers + runs every scripts/verify-*.mjs, checks a few
// griot-agent-architect best practices, and verifies both marketplace mirrors are at VERSION.
// Exits non-zero on any failure so the ceremony can gate on it.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { structuralVerdict, SCANNABLE } from './audit-structural-verdict.mjs';

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

// 3. Lockfile sync — the gate this audit shipped v4.16.0 without.
// `npm install` RECONCILES package-lock.json; `npm ci` ASSERTS the two already agree and fails
// otherwise. That asymmetry is why adding packages/prism-workgraph-mcp without regenerating the
// lock was invisible locally (a populated node_modules means the lock is never consulted) yet
// fatal on BOTH CI runners — the v4.16.0 installer workflow died with
//     npm error Missing: @prism/workgraph-mcp@4.16.0 from lock file
// the release job was skipped, and the release published with 5 of 10 assets while this very
// audit reported AUDIT CLEAN. No gate ran `npm ci`, so 8/8 clean and a broken release were
// entirely compatible states. (Ledger M13.)
if (existsSync('package.json') && existsSync('package-lock.json')) {
  // 3a. Deterministic and OFFLINE: every workspace member must appear in the lock's `packages`
  // map. This is precisely the M13 defect and touches no registry, so it can never flake — which
  // matters, because a gate that flakes is a gate people learn to ignore.
  let lock = null;
  try { lock = JSON.parse(readFileSync('package-lock.json', 'utf8')); } catch { /* handled below */ }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? []);

  // Resolve a workspace glob segment-by-segment so `apps/*/server` works, not only a trailing
  // `/*`. An UNSUPPORTED shape (`**`, or a partial wildcard like `pre*`) is reported LOUDLY
  // rather than resolving to nothing: the first cut silently dropped any glob that did not end
  // in `/*`, which meant a member declared that way could be missing from the lock and this
  // check would still print PASS — the exact M13 defect, reintroduced for a different glob shape.
  const unsupported = [];
  const resolveGlob = (g) => {
    if (g.includes('**')) { unsupported.push(g); return []; }
    let paths = [''];
    for (const seg of g.split('/')) {
      if (seg === '*') {
        paths = paths.flatMap(p => {
          const dir = p || '.';
          return existsSync(dir) ? readdirSync(dir, { withFileTypes: true })
            .filter(e => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
            .map(e => (p ? `${p}/${e.name}` : e.name)) : [];
        });
      } else if (seg.includes('*')) { unsupported.push(g); return []; }
      else paths = paths.map(p => (p ? `${p}/${seg}` : seg)).filter(existsSync);
    }
    return paths.filter(p => existsSync(`${p}/package.json`));
  };
  const members = globs.flatMap(resolveGlob);
  if (unsupported.length) {
    failed++;
    line('FAIL', `unsupported workspace glob shape(s): ${unsupported.join(', ')} — this check cannot resolve them, so it would silently pass. Extend resolveGlob() in scripts/pre-release-audit.mjs`);
  }
  if (!lock?.packages) {
    failed++;
    line('FAIL', 'package-lock.json is unreadable or has no `packages` map (lockfileVersion < 2?)');
  } else {
    const missing = members.filter(m => !(m in lock.packages));
    if (missing.length) {
      failed++;
      line('FAIL', `package-lock.json is missing workspace member(s): ${missing.join(', ')} — run \`npm install --package-lock-only\` (npm ci WILL refuse this)`);
    } else {
      line('PASS', `package-lock.json registers all ${members.length} workspace members`);
    }
  }

  // 3b. Authoritative: exactly what CI runs, so it also catches drift 3a cannot see (a member
  // present in the lock but resolving the wrong dependency versions).
  //
  // FAIL-CLOSED. Any non-zero exit is a failure unless it is RECOGNISABLY environmental.
  // The first cut of this check had it backwards: it FAILed only on an allow-list of npm
  // phrasings and WARNed on everything else. npm's version-drift wording —
  //     npm error Invalid: lock file's foo@1.0.0 does not satisfy foo@2.0.0
  // — matches none of those, so genuine lock drift would have shipped as a warning. A release
  // gate that defaults to "probably fine" on wording it does not recognise is not a gate, and
  // npm is free to reword its errors in any release. Verified non-mutating on npm 10.9.3:
  // lock hash and node_modules entry count are identical before and after.
  const r = run('npm', ['ci', '--dry-run', '--ignore-scripts']);
  const out = (r.stdout || '') + (r.stderr || '');
  const ENVIRONMENTAL = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ERR_SOCKET|network|registry.*(unreachable|timed out)|not recognized as an internal|command not found/i;
  if (r.status === 0) line('PASS', 'npm ci --dry-run (the lock resolves as CI would resolve it)');
  else if (r.error || ENVIRONMENTAL.test(out)) line('WARN', 'npm ci --dry-run could not reach npm/the registry (environmental); the offline workspace check above still applied');
  else {
    failed++;
    const why = out.split('\n').map(l => l.trim()).find(l => /^npm (error|ERR!)\s+\S/.test(l)) || `exit ${r.status}`;
    line('FAIL', `npm ci --dry-run — the lock does not resolve as CI would resolve it: ${why.slice(0, 140)}`);
  }
}

// 4. Structural best practices (griot-agent-architect) — SCOPED to this release's changed files.
// A release gate blocks on what THIS release introduces, not the repo's whole backlog. Plugin-validate
// and the verify-*.mjs scripts above already cover whole-plugin correctness.
const walk = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = `${dir}/${e.name}`;
  return e.isDirectory() ? walk(p) : [p];
}) : [];
const base = (run('git', ['describe', '--tags', '--abbrev=0']).stdout || '').trim()
  || (run('git', ['rev-parse', '--verify', 'main']).status === 0 ? 'main' : '');
const diffSet = (b) => {
  const r = run('git', ['diff', '--name-only', `${b}..HEAD`]);
  return r.status === 0 ? new Set(r.stdout.split('\n').map(s => s.trim()).filter(Boolean)) : null;
};
let changed = null;
let scanBase = base;
if (base) {
  changed = diffSet(base);
  // Run at a freshly TAGGED HEAD, nothing scannable has changed since the tag, so the diff is empty by
  // construction (AUDIT_STRUCTURAL_ZERO_SCAN). The release under audit is then the one the tag IS: diff
  // against the previous tag instead of reporting a false FAIL. A genuinely empty release still fails.
  if (changed !== null && ![...changed].some(f => SCANNABLE.test(f)) && /^v\d/.test(base)) {
    const prev = (run('git', ['describe', '--tags', '--abbrev=0', `${base}~1`]).stdout || '').trim();
    const prevSet = prev ? diffSet(prev) : null;
    if (prevSet && prevSet.size > 0) { changed = prevSet; scanBase = prev; line('INFO', `HEAD is at/after ${base} with nothing scannable since; structural scope = ${prev}..HEAD (the release ${base} shipped)`); }
  }
}
if (changed === null) line('WARN', 'no base tag/branch to diff against — structural checks skipped (run in a repo with history)');
else if (changed.size === 0) line('WARN', `no files changed vs ${base} — structural checks scanned 0 files (bootstrap / first release?)`);
const inScope = (p) => changed !== null && changed.has(p);
// Structural checks report on THEIR OWN result. Sharing the global `failed` counter made an
// earlier verify-*.mjs failure stamp [FAIL] on this line too, misattributing which gate broke.
const failedBeforeStructural = failed;
// N91: a loop that examines nothing leaves `failed` unchanged, which used to read as a silent
// PASS — indistinguishable from "examined every file and found no problems". That happened for
// two independent reasons at once on a real run: HEAD diffed against itself (base resolved to
// `main` while already on `main`, so `changed.size === 0`) AND this repo's skills live directly
// at the repo root rather than under a top-level `skills/` directory, so `walk('skills')` finds
// nothing regardless of what changed. Track how many files were actually opened and read below;
// zero of them is reported as its own loud FAIL, never folded into the ordinary PASS/FAIL line.
let scanned = 0;

// 4a. SKILL.md size — progressive disclosure (< 500 lines)
for (const p of walk('skills').filter(p => p.endsWith('SKILL.md') && inScope(p))) {
  scanned++;
  const n = readFileSync(p, 'utf8').split('\n').length;
  if (n > 500) { failed++; line('FAIL', `${p} is ${n} lines (>500 — push detail to references/)`); }
}
// 4b. Frontmatter present on changed skills/commands/agents
for (const p of [...walk('skills').filter(p => p.endsWith('SKILL.md')), ...walk('commands'), ...walk('agents')].filter(p => p.endsWith('.md') && inScope(p))) {
  scanned++;
  if (!readFileSync(p, 'utf8').startsWith('---')) { failed++; line('FAIL', `${p} missing YAML frontmatter`); }
}
// 4c. No hardcoded absolute plugin paths in changed skills/commands/hooks
const HARDCODED = /[A-Za-z]:\\Users\\|\/(?:Users|home)\/[^\/\s"']+\//;
for (const p of [...walk('skills'), ...walk('commands'), ...walk('hooks')].filter(p => /\.(md|json|sh|js)$/.test(p) && inScope(p))) {
  scanned++;
  if (HARDCODED.test(readFileSync(p, 'utf8'))) { failed++; line('FAIL', `${p} contains a hardcoded absolute path (use \${CLAUDE_PLUGIN_ROOT} / project-relative)`); }
}

// F-A (lifted from Cinopsis 0f1f5f8, drift 253): a range that touches no skills/commands/agents/hooks
// PASSES with an explicit "0 in-scope files" line; only in-scope-but-unexamined stays AUDIT_STRUCTURAL_ZERO_SCAN.
{
  const v = structuralVerdict({ changed, scanned, failedDuring: failed !== failedBeforeStructural });
  if (v.countsAsFailure) failed++;
  line(v.mark, v.message);
}

// 5. Marketplace mirror freshness — a TABLE-DRIVEN CHANNELS gate. Two independent mirrors once
// drifted silently and nothing failed: TheDigitalGriot/prism-plugin froze at 4.15.2 (4.16.0-4.16.2
// never ran Step 6.5) and digital-griot-marketplace froze at 4.12.1 (last sync eb23337,
// 2026-08-24) — same class of bug as the M13 lockfile gap above, same fix: gate it, fail closed.
// A channel is ONE ROW in the CHANNELS array below, never a new code path — that is the whole
// point of making this table-driven.
//
// TWO AXES PER CHANNEL, not one. VERSION alone is not enough: measured live 2026-09-29 during a
// Griot re-baseline, digital-griot-marketplace's cinopsis-plugin read version 2.8.0 — an exact
// match with source — while sitting 11 real commits behind, missing three whole skills and a
// viewer/ directory that had shipped without a version bump. `claude plugin update` made the
// identical mistake at the plugin-cache layer the same session ("already at the latest version").
// So every channel is checked on CONTENT too: the git tree sha of each top-level mirrored
// directory (skills, agents, scripts, ...) is compared directly against the LOCAL tree sha for
// the same path — `git rev-parse HEAD:<dir>` for local, the GitHub Contents API's own `sha` field
// on a directory listing for remote. Git tree hashing is content-addressable and repo-independent,
// so equal shas are proof of byte-identical content with no clone, no download, and no diff.
//
// FAIL CLOSED throughout: unlike the npm-registry check above (§3b), a network/parse error here is
// a FAIL, never a WARN — "can't tell if the mirror is current" is precisely the blind spot this
// gate exists to close, so treating it as environmental noise would recreate the defect it fixes.
// The one exception is a channel marked `optional` (a mirror repo that may not exist yet for this
// plugin) — a 404 there is a WARN + skip, not a FAIL, and only on the very first (version) probe.
if (existsSync('.claude-plugin/plugin.json') && existsSync('VERSION')) {
  const localVersion = readFileSync('VERSION', 'utf8').trim();
  const pluginName = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8')).name;

  // Unauthenticated GitHub API calls are capped at 60/hr; `gh` (already required by Step 6 of this
  // release pipeline for `gh release create`) raises that to 5000/hr when logged in. Best-effort —
  // an unauthenticated 403 still surfaces as a clear FAIL below, never a silent pass.
  const ghAuth = run('gh', ['auth', 'token']);
  const ghToken = ghAuth.status === 0 ? (ghAuth.stdout || '').trim() : '';
  const authHeaders = (accept) => {
    const h = { Accept: accept };
    if (ghToken) h.Authorization = `Bearer ${ghToken}`;
    return h;
  };
  const fetchWith = async (url, accept, parse) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: authHeaders(accept) });
      if (res.status === 404) return { notFound: true };
      if (!res.ok) return { error: `HTTP ${res.status} fetching ${url}` };
      return { body: await parse(res) };
    } catch (e) {
      return { error: `${e.name === 'AbortError' ? 'timed out after 10s' : (e.message || String(e))} fetching ${url}` };
    } finally {
      clearTimeout(timer);
    }
  };
  // GitHub's raw.githubusercontent.com is CDN-fronted and observably lags a real push by minutes
  // (verified during this gate's original build: a push that landed cleanly, confirmed by fresh
  // clone, still read the PRE-push version from raw.* for several minutes after, cache-busting
  // query strings and no-cache headers included). The Contents API with the raw media type returns
  // the same bytes without that CDN lag, which is why version reads go through it rather than the
  // CDN host.
  const fetchRawFile = (url) => fetchWith(url, 'application/vnd.github.raw+json', (res) => res.text());
  const fetchDirListing = (url) => fetchWith(url, 'application/vnd.github+json', (res) => res.json());
  const fetchTreeRecursive = (repo, treeSha) => fetchWith(
    `https://api.github.com/repos/TheDigitalGriot/${repo}/git/trees/${treeSha}?recursive=1`,
    'application/vnd.github+json',
    (res) => res.json()
  );
  const contentsUrl = (repo, path) => `https://api.github.com/repos/TheDigitalGriot/${repo}/contents/${path}?ref=main`;

  // The set of top-level dirs a thin mirror can carry — mirrors sync-to-marketplace.sh's own
  // MIRROR_DIRS allow-list. Only dirs that actually exist locally are checked, so a plugin with no
  // agents/ is never penalised for lacking one.
  // .claude-plugin is deliberately EXCLUDED: sync-prism-plugin.sh rewrites plugins[].source inside
  // marketplace.json to a github object pointing at the mirror itself (so Cowork's backend can
  // crawl a small repo instead of the multi-GB monorepo) — a real, permanent, by-design divergence,
  // not drift. plugin.json's version is already covered by the version check above.
  const MIRROR_DIR_CANDIDATES = ['skills', 'agents', 'commands', 'hooks', 'scripts', 'viewer'];
  const localTreeSha = (dir) => {
    const r = run('git', ['rev-parse', `HEAD:${dir}`]);
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const localDirs = MIRROR_DIR_CANDIDATES.filter((d) => localTreeSha(d) !== null);

  // BLOB shas, not tree shas — measured live 2026-09-29: a whole-directory tree sha mismatched
  // between local and both mirrors even though every file's CONTENT was byte-identical, because
  // `scripts/sync-prism-plugin.sh` carries mode 100755 locally and 100644 in the mirrors (a known
  // git-archive-then-tar-extract quirk on this Windows/git-bash toolchain — NTFS has no native
  // POSIX executable bit for tar to restore). A tree sha folds MODE into its hash alongside
  // content, so a benign platform quirk in the sync tooling reads as content drift. Comparing
  // per-file blob shas (path -> content hash, mode ignored) is the correct instrument: it still
  // catches every real content change and stops flagging a permissions artifact of the sync step
  // itself as if the mirror were stale.
  // Paths come back relative to <dir> on BOTH sides: `git ls-tree` reports `dir/sub/file`, so the
  // `dir/` prefix is stripped to match the remote recursive-tree listing, which is rooted at that
  // dir's own tree sha and therefore already reports paths as `sub/file`.
  const localBlobsFor = (dir) => {
    const map = new Map();
    const r = run('git', ['ls-tree', '-r', 'HEAD', '--', dir]);
    if (r.status !== 0) return map;
    const strip = new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`);
    for (const l of r.stdout.split('\n')) {
      const m = l.match(/^\d+\s+blob\s+([0-9a-f]{40})\t(.+)$/);
      if (m) map.set(m[2].replace(strip, ''), m[1]);
    }
    return map;
  };

  const checkContent = async (ch, f) => {
    const listPath = ch.contentPrefix ? ch.contentPrefix.replace(/\/$/, '') : '';
    const r = await fetchDirListing(contentsUrl(ch.contentRepo, listPath));
    if (r.error) { f.n++; line('FAIL', `${ch.label} content — could not list remote tree (${r.error}) — fail-closed`); return; }
    if (r.notFound) { f.n++; line('FAIL', `${ch.label} content — remote path not found — fail-closed`); return; }
    const remoteTreeShaByName = new Map((Array.isArray(r.body) ? r.body : []).filter((e) => e.type === 'dir').map((e) => [e.name, e.sha]));
    let filesChecked = 0;
    const mismatches = [];
    for (const dir of localDirs) {
      const treeSha = remoteTreeShaByName.get(dir);
      if (!treeSha) { mismatches.push(`${dir}/ (missing on remote)`); continue; }
      const rt = await fetchTreeRecursive(ch.contentRepo, treeSha);
      if (rt.error) { mismatches.push(`${dir}/ (could not read remote tree: ${rt.error})`); continue; }
      const remoteBlobs = new Map((rt.body?.tree || []).filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
      const localBlobs = localBlobsFor(dir);
      filesChecked += localBlobs.size;
      const bad = [];
      const prefixed = (p) => `${dir}/${p}`;
      for (const [path, sha] of localBlobs) { if (remoteBlobs.get(path) !== sha) bad.push(prefixed(path)); }
      for (const path of remoteBlobs.keys()) { if (!localBlobs.has(path)) bad.push(`${prefixed(path)} (extra on remote)`); }
      if (bad.length) mismatches.push(bad.length <= 4 ? bad.join(', ') : `${bad.slice(0, 4).join(', ')} +${bad.length - 4} more`);
    }
    if (mismatches.length) {
      f.n++;
      line('FAIL', `${ch.label} content — diverges from local HEAD: ${mismatches.join('; ')} — run its sync (version string alone did not catch this)`);
    } else {
      line('PASS', `${ch.label} content matches local HEAD (${filesChecked} file${filesChecked === 1 ? '' : 's'} across ${localDirs.length} dir${localDirs.length === 1 ? '' : 's'}, per-file content compared)`);
    }
  };

  const checkChannel = async (ch, f) => {
    const vr = await fetchRawFile(ch.versionUrl);
    if (vr.notFound) {
      if (ch.optional) { line('WARN', `${ch.label} — no such mirror exists for this plugin yet, skipping (optional channel)`); return; }
      f.n++; line('FAIL', `${ch.label} version — remote path not found — fail-closed`); return;
    }
    if (vr.error) {
      f.n++; line('FAIL', `${ch.label} version — could not read remote version (${vr.error}) — fail-closed`);
    } else {
      let version;
      try { version = ch.versionExtract(vr.body); } catch { /* falls through to the undefined check below */ }
      if (!version) { f.n++; line('FAIL', `${ch.label} version — remote response had no readable version field — fail-closed`); }
      else if (version !== localVersion) { f.n++; line('FAIL', `${ch.label} version is v${version}, local VERSION is v${localVersion} — mirror is behind, run its sync`); }
      else line('PASS', `${ch.label} version matches local v${localVersion}`);
    }
    if (ch.contentRepo !== undefined) await checkContent(ch, f);
  };

  // THE TABLE. Adding a fifth channel is one entry here — never a new code path.
  const CHANNELS = [
    {
      label: `TheDigitalGriot/${pluginName}-plugin (single-tool mirror, scripts/sync-prism-plugin.sh)`,
      versionUrl: contentsUrl(`${pluginName}-plugin`, '.claude-plugin/plugin.json'),
      versionExtract: (body) => JSON.parse(body).version,
      contentRepo: `${pluginName}-plugin`,
      contentPrefix: '',
      // Not every Griot tool has its own single-tool mirror repo (Cinopsis does not, as of
      // 2026-09-29) — a missing repo here is a routing fact, not a freshness failure.
      optional: true,
    },
    {
      label: `digital-griot-marketplace root manifest '${pluginName}' entry`,
      versionUrl: contentsUrl('digital-griot-marketplace', '.claude-plugin/marketplace.json'),
      versionExtract: (body) => (JSON.parse(body).plugins || []).find((p) => p.name === pluginName)?.version,
      // No independent content check: this file is a one-line manifest entry, not a mirrored tree.
    },
    {
      label: `digital-griot-marketplace ${pluginName}-plugin/`,
      versionUrl: contentsUrl('digital-griot-marketplace', `${pluginName}-plugin/.claude-plugin/plugin.json`),
      versionExtract: (body) => JSON.parse(body).version,
      contentRepo: 'digital-griot-marketplace',
      contentPrefix: `${pluginName}-plugin`,
    },
  ];

  for (const ch of CHANNELS) {
    const f = { n: 0 };
    await checkChannel(ch, f);
    failed += f.n;
  }
} else {
  failed++;
  line('FAIL', 'no ./.claude-plugin/plugin.json or ./VERSION — cannot determine mirror-freshness target, fail-closed');
}

console.log(`\n${failed === 0 ? 'AUDIT CLEAN' : failed + ' AUDIT FAILURE(S)'}`);
process.exit(failed === 0 ? 0 : 1);
