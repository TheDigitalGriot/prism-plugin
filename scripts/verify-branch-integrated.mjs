#!/usr/bin/env node
// verify-branch-integrated.mjs — release-gate guard: a release must be cut FROM main, from a tagged
// base, with no finalized release left untagged. Prevents the "released off an unmerged branch,
// never tagged, main left stale" drift.
//
// Provenance: v4.5.7 + v4.5.8 were bookended on a feature branch, never merged to main and never
// tagged; main sat two releases behind. This guard makes that state unshippable. It does NOT try to
// detect an arbitrary cherry-pick (infeasible from main alone) — it removes the REASON to cherry-pick
// by requiring the whole branch be integrated to main and the release cut from there.
//
// Auto-discovered + run by scripts/pre-release-audit.mjs at closing-ceremony Step 0 (BEFORE the
// version bump — so at check time VERSION equals the already-tagged previous release).
// Run standalone:  node scripts/verify-branch-integrated.mjs
// Exit 0 = OK (warnings allowed) · Exit 1 = a release-blocking failure.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });
const gitOk = (args) => git(args).status === 0;
const gitOut = (args) => (git(args).stdout || '').trim();
const refExists = (r) => gitOk(['rev-parse', '--verify', '--quiet', r]);

let failed = 0, warned = 0;
const pass = (m) => console.log(`[PASS] ${m}`);
const warn = (m) => { warned++; console.log(`[WARN] ${m}`); };
const fail = (m) => { failed++; console.log(`[FAIL] ${m}`); };

// --- refs & inventory --------------------------------------------------------
const LOCAL_MAIN = ['main', 'master'].find(refExists);
const ORIGIN_MAIN = ['origin/main', 'origin/master'].find(refExists);
const MAIN_NAME = LOCAL_MAIN || (ORIGIN_MAIN ? ORIGIN_MAIN.replace(/^origin\//, '') : 'main');
const MAIN_REFS = [LOCAL_MAIN, ORIGIN_MAIN].filter(Boolean); // check integration against either
const tags = new Set(gitOut(['tag']).split('\n').map((s) => s.trim()).filter(Boolean));
const latestTag = gitOut(['describe', '--tags', '--abbrev=0']); // nearest tag in HEAD ancestry ('' if none)
const VERSION = existsSync('VERSION') ? readFileSync('VERSION', 'utf8').trim() : '';
const branch = gitOut(['symbolic-ref', '--short', '-q', 'HEAD']); // '' when detached
const headC = gitOut(['rev-parse', 'HEAD']);

// Untagged finalized-release commits since the newest tag — the PROVENANCE signal. A version is only
// treated as "in-flight" (tag legitimately pending mid-release) if a real release commit for it exists;
// a bare VERSION bump with no release commit is drift, not in-flight.
const RELEASE_RE = /^(?:release:\s*bookend\s+|chore\(release\):\s*)?v(\d+\.\d+\.\d+)\b/i;
const untagged = [];
if (latestTag) {
  for (const subj of gitOut(['log', '--format=%s', `${latestTag}..HEAD`]).split('\n').filter(Boolean)) {
    const m = subj.match(RELEASE_RE);
    if (m && !tags.has(`v${m[1]}`)) untagged.push(m[1]);
  }
}
const uniqUntagged = [...new Set(untagged)];
// The single legitimate in-flight window: exactly one untagged release commit, and it is THIS VERSION.
const inFlight = uniqUntagged.length === 1 && uniqUntagged[0] === VERSION;

// --- Check 1 — release from mainline (HEAD is main, not merely ahead of it) --
if (MAIN_REFS.length === 0) {
  warn('no main/master ref (local or origin) — release-from-mainline check skipped');
} else if (branch === MAIN_NAME) {
  pass(`releasing from ${MAIN_NAME} (HEAD is on the mainline branch)`);
} else if (MAIN_REFS.some((r) => gitOk(['merge-base', '--is-ancestor', 'HEAD', r]))) {
  pass(`HEAD is already contained in ${MAIN_NAME} — release cannot strand work`);
} else {
  fail(`not on ${MAIN_NAME} (current: ${branch || 'detached@' + headC.slice(0, 7)}). Cut releases from `
    + `${MAIN_NAME}: integrate the WHOLE branch first — git checkout ${MAIN_NAME} && git merge --ff-only <branch> `
    + `(or a real merge) — then run the ceremony on ${MAIN_NAME}. Never cherry-pick to extract a change; it `
    + `strands the rest of the branch and drifts ${MAIN_NAME} out of sync with what shipped.`);
}
// Staleness note: a local main behind origin/main can distort the ancestry fallback above.
if (LOCAL_MAIN && ORIGIN_MAIN && !gitOk(['merge-base', '--is-ancestor', ORIGIN_MAIN, LOCAL_MAIN])) {
  warn(`local ${LOCAL_MAIN} is behind ${ORIGIN_MAIN} — run "git fetch" so integration is judged against the real mainline`);
}

// --- Check 2 — base VERSION is tagged (or a provenance-backed in-flight release) --
if (!VERSION) {
  warn('no VERSION file — base-tag check skipped');
} else if (tags.size === 0) {
  warn(`repo has no tags yet — bootstrap; cannot verify a v${VERSION} base tag`);
} else if (tags.has(`v${VERSION}`) && gitOk(['merge-base', '--is-ancestor', `v${VERSION}`, 'HEAD'])) {
  pass(`base version v${VERSION} is tagged and reachable from HEAD`);
} else if (inFlight) {
  warn(`v${VERSION} has a matching release commit but no tag yet — in-flight release (tag created at release time)`);
} else {
  fail(`base version v${VERSION} has no reachable tag and no matching in-flight release commit — tag/main drift. `
    + `Backfill it (git tag v${VERSION} <release-commit> && git push origin v${VERSION}) or integrate the release that carries it.`);
}

// --- Check 3 — no untagged finalized releases (except the single in-flight one) --
if (!latestTag) {
  warn('no reachable tag — untagged-release-commit scan skipped (bootstrap)');
} else if (uniqUntagged.length === 0) {
  pass(`no untagged release commits since ${latestTag}`);
} else if (inFlight) {
  pass(`only the in-flight v${VERSION} release commit is untagged (tag created at release time)`);
} else {
  fail(`untagged release commits since ${latestTag}: ${uniqUntagged.map((v) => 'v' + v).join(', ')} — finalized `
    + `but never tagged. Tag each so history matches what shipped.`);
}

console.log(`\n${failed === 0
  ? (warned ? `INTEGRATION OK (${warned} warning${warned > 1 ? 's' : ''})` : 'INTEGRATION OK')
  : `${failed} INTEGRATION FAILURE(S)`}`);
process.exit(failed === 0 ? 0 : 1);
