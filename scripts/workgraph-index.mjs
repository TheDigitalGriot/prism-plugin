#!/usr/bin/env node
/**
 * workgraph-index.mjs — the Griot-Wide Workgraph index GENERATOR.
 *
 * The read side has shipped since Prism v4.16.0 (prism-workgraph-mcp: workgraph_status,
 * _awaits, _edges, _resolve). Nothing ever produced the {nodes, edges, generated} index
 * those four tools read, so every call returned degraded-empty. This is that producer.
 *
 * DOCTRINE (from .prism/shared/designs/2026-09-05-workgraph-icm-grounding.md):
 *   - GENERATE, never maintain. "An index you generate cannot drift from what it indexes;
 *     one you maintain by hand eventually will." This script is safe to re-run at any time
 *     and writes nothing back into the sources it reads.
 *   - ONE RECORD, TWO VIEWS. outbound here is inbound there. We emit each relationship ONCE
 *     as a directed edge; the consumer/producer split is a read, not a second record.
 *   - STATE AND DIRECTION ARE ORTHOGONAL. state -> the lane; direction -> the badge. Bucketing
 *     on direction first is the documented bug that displayed "Parked 0" while five parked
 *     items existed. We carry both on every node and never derive one from the other.
 *
 * THREE SHIPPED INCONSISTENCIES THIS GENERATOR ABSORBS (so nothing downstream has to):
 *   (a) id mismatch — workgraph_awaits compares `e.to` to `node.id`, workgraph_edges compares
 *       it to a `wg:<origin>:` prefix. We set node.id === node.envelopeId so BOTH tools work
 *       against an unmodified worker. The human-readable id survives as `localId`.
 *   (b) two stories.json dialects — scalar `files`/`steps` vs object form, `epic` as slug vs
 *       object, top-level `plan` in Synaptiq, and Dialect B's `STORY-001` ids that the contract
 *       forbids. normalizeStory() flattens all of them.
 *   (c) status drift — the contract's terminal value is `done`, the frontier walker tests
 *       `!= "complete"`. We normalize to the contract vocabulary and emit `statusRaw` so the
 *       drift stays visible instead of silently reclassifying 15 finished stories as pending.
 *
 * Envelope ids deviate from the design on ONE point, deliberately: the design says UUIDv7/ULID
 * for sortability, but a regenerated index MUST be idempotent or every run churns every id.
 * We mint `wg:<origin>:<sha1-12 of a stable natural key>`. Sortability is recovered from
 * `lastTouched`, which is what the aging policy actually reads.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOTS = [
  'C:\\Users\\digit\\GriotApps',
  'C:\\Users\\digit\\GriotProducts',
  'C:\\Users\\digit\\GriotMeta',
  'C:\\Users\\digit\\GriotClients',
  'C:\\Users\\digit\\Developer',
];
const PLAN = 'C:\\Users\\digit\\GriotMeta\\griot-live-artifacts\\live\\dgs-definitive-plan.html';
const OUT = process.argv[2] || 'workgraph-index.json';

const nodes = [];
const edges = [];
const warnings = [];
const seen = new Set();

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const wg = (origin, key) => `wg:${origin}:${sha(origin + '|' + key)}`;

function addNode(n) {
  if (seen.has(n.id)) return n.id;
  seen.add(n.id);
  nodes.push(n);
  return n.id;
}
function addEdge(from, to, kind, label) {
  if (!from || !to || from === to) return;
  edges.push({ from, to, kind, label: label || kind });
}

// ---- status: contract vocabulary is pending | in_progress | done ----
const STATUS = {
  done: 'done', complete: 'done', completed: 'done', passed: 'done',
  pending: 'pending', todo: 'pending', open: 'pending', '': 'pending',
  in_progress: 'in_progress', 'in-progress': 'in_progress', active: 'in_progress',
};
const normStatus = (s) => STATUS[String(s ?? '').toLowerCase().trim()] ?? 'pending';

// ---- direction: the badge axis. NEVER used to pick a lane. ----
const many = (v) => (v == null ? [] : Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean));
function dirOf(o) {
  if (!o) return 'local';
  if (many(o.destination).length) return 'outbound';
  if (many(o.source).length) return 'inbound';
  if ((o.maps ?? 0) > 1) return 'adjacent';
  return 'local';
}

function walk(dir, depth, hit) {
  if (depth < 0) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
      walk(p, depth - 1, hit);
    } else hit(p, e.name);
  }
}
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtime.toISOString(); } catch { return null; } };
const originOf = (p) => {
  for (const r of ROOTS) if (p.startsWith(r)) {
    const rest = p.slice(r.length + 1).split(path.sep);
    return (rest[0] || 'unknown').toLowerCase();
  }
  return 'unknown';
};

// ============ 1. stories.json — the execution DAG ============
function normalizeStory(s) {
  return {
    localId: String(s.id ?? ''),
    title: s.title ?? '',
    description: s.description ?? '',
    priority: s.priority ?? 99,
    status: normStatus(s.status),
    statusRaw: String(s.status ?? ''),
    blockedBy: many(s.blockedBy),
    files: many(s.files).map((f) => (typeof f === 'string' ? f : f?.path ?? '')).filter(Boolean),
    steps: many(s.steps).map((t) => (typeof t === 'string' ? t : t?.description ?? '')).filter(Boolean),
    dialect: many(s.files).some((f) => typeof f === 'object') || many(s.steps).some((t) => typeof t === 'object') ? 'B' : 'A',
  };
}

const storyFiles = [];
for (const r of ROOTS) walk(r, 6, (p, name) => { if (/stories\.json$/i.test(name)) storyFiles.push(p); });

for (const p of storyFiles) {
  const raw = readJSON(p);
  if (!raw || !Array.isArray(raw.stories)) continue;
  const origin = originOf(p);
  const epicRaw = raw.epic ?? raw.plan;
  const epic = typeof epicRaw === 'string' ? epicRaw : (epicRaw?.name ?? path.basename(path.dirname(p)));
  const touched = mtime(p);

  const epicId = addNode({
    id: wg(origin, 'epic:' + epic), envelopeId: wg(origin, 'epic:' + epic),
    localId: epic, kind: 'epic', origin, title: epic,
    state: 'open', direction: 'local', lastTouched: touched, path: p,
    contentHash: sha(JSON.stringify(raw).slice(0, 20000)),
  });

  const byLocal = new Map();
  for (const s0 of raw.stories) {
    const s = normalizeStory(s0);
    if (!s.localId) { warnings.push(`story with no id in ${p}`); continue; }
    if (s.dialect === 'B' && /^STORY-\d+$/i.test(s.localId))
      warnings.push(`dialect-B sequential id "${s.localId}" in ${p} — the stories contract forbids this form (ids must be content-hashed)`);
    const id = wg(origin, 'story:' + epic + ':' + s.localId);
    byLocal.set(s.localId, id);
    addNode({
      id, envelopeId: id, localId: s.localId, kind: 'story', origin, epic,
      title: s.title, description: s.description, priority: s.priority,
      state: s.status === 'done' ? 'resolved' : (s.blockedBy.length ? 'parked' : 'open'),
      status: s.status, statusRaw: s.statusRaw, direction: 'local',
      files: s.files, steps: s.steps, dialect: s.dialect,
      lastTouched: touched, path: p, contentHash: sha(s.title + '|' + s.description),
    });
    addEdge(id, epicId, 'in-epic', 'belongs to ' + epic);
  }
  // blockedBy -> an awaits edge. Consumer waits on producer: one record, two views.
  for (const s0 of raw.stories) {
    const s = normalizeStory(s0);
    const me = byLocal.get(s.localId);
    for (const b of s.blockedBy) {
      const dep = byLocal.get(String(b));
      if (dep) addEdge(dep, me, 'awaits', 'blocks');
      else warnings.push(`story ${s.localId} in ${p} is blockedBy "${b}" which is not in the same file`);
    }
  }
}

// ============ 2. decisions.json — the live worklane records ============
/** Project slugs named by a decision's destination/source. Their nodes are
 *  created after §4 so the plan's own project records always win. */
const referencedProjects = new Set();
const decFiles = [];
for (const r of ROOTS) walk(r, 7, (p, name) => { if (name === 'decisions.json' && p.includes('brainstorm')) decFiles.push(p); });

for (const p of decFiles) {
  const raw = readJSON(p);
  if (!raw) continue;
  const origin = originOf(p);
  const session = path.basename(path.dirname(path.dirname(p)));
  const touched = mtime(p);

  const push = (o, state) => {
    const key = state + ':' + session + ':' + (o.q ?? o.fromQ ?? o.label ?? '');
    const id = wg(origin, key);
    addNode({
      id, envelopeId: id, localId: String(o.q ?? o.fromQ ?? ''), kind: 'worklane',
      origin, session, title: o.label ?? '', summary: o.summary ?? o.concern ?? '',
      choice: o.choice ?? null, revisit: o.revisit ?? null,
      // STATE decides the lane...
      state: o.supersededBy ? 'superseded' : o.resolvedAt ? 'resolved' : state,
      // ...DIRECTION is a separate axis, carried as a badge. Never conflated.
      direction: dirOf(o),
      destination: many(o.destination), source: many(o.source), maps: o.maps ?? 0,
      screen: o.screen ?? null, lastTouched: touched, path: p,
      contentHash: sha(String(o.label ?? '') + String(o.summary ?? o.concern ?? '')),
    });
    // DANGLING-EDGE FIX (2026-09-11). These two lines emitted an edge to
    // wg('dgs','project:<slug>') but never created that node. Only the plan's
    // EDGES[] (§4) calls addNode for project ids, so any destination/source
    // that is not literally a plan edge endpoint pointed at nothing: 114 of 775
    // edges — 15% — had an unresolved endpoint, which is exactly why
    // project-to-project was never visible. An edge to a node that does not
    // exist is a broken graph, not a sparse one.
    //
    // Recorded here rather than creating the node inline, because addNode is
    // first-writer-wins and §2 runs BEFORE §4 — stubbing now would shadow the
    // plan's richer project records. Missing ones are created after §4 instead.
    for (const d of many(o.destination)) { referencedProjects.add(d); addEdge(id, wg('dgs', 'project:' + d), 'outbound', 'owed to ' + d); }
    for (const s of many(o.source)) { referencedProjects.add(s); addEdge(wg('dgs', 'project:' + s), id, 'inbound', 'came from ' + s); }
    return id;
  };

  const ids = new Map();
  for (const d of many(raw.decisions)) ids.set(d.q, push(d, 'decided'));
  for (const k of many(raw.parked)) {
    const id = push(k, 'parked');
    if (k.fromQ && ids.has(k.fromQ)) addEdge(ids.get(k.fromQ), id, 'splinter', 'branched from ' + k.fromQ);
  }
}

// ============ 3. Inbound (awaits): — stage contracts ============
let awaitLines = 0;
for (const r of ROOTS) walk(r, 6, (p, name) => {
  if (!/CONTEXT\.md$/i.test(name)) return;
  let c; try { c = fs.readFileSync(p, 'utf8'); } catch { return; }
  const m = c.match(/^[ \t]*Inbound[ \t]*\(awaits\)[ \t]*:(.*)$/im);
  if (!m) return;
  awaitLines++;
  const origin = originOf(p);
  const stage = path.basename(path.dirname(p));
  const id = wg(origin, 'stage:' + stage);
  addNode({
    id, envelopeId: id, localId: stage, kind: 'stage', origin, title: stage,
    state: 'open', direction: 'inbound', lastTouched: mtime(p), path: p,
    awaits: m[1].split(',').map((s) => s.trim()).filter(Boolean),
    contentHash: sha(c.slice(0, 20000)),
  });
  // Same dangling-edge class as the destination/source fix above: this emitted
  // an edge FROM wg(origin,'path:<dep>') without ever creating that node, so 11
  // awaits edges had an unresolved producer. The declared dependency is a real
  // thing the stage is blocked on — a file, a sandbox checkout, an artifact —
  // so it becomes a node of kind 'artifact'. `open` is the honest state: nothing
  // here asserts the dependency is satisfied, only that it was declared.
  for (const dep of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    const depId = wg(origin, 'path:' + dep);
    addNode({
      id: depId, envelopeId: depId, localId: dep, kind: 'artifact', origin,
      title: dep, state: 'open', direction: 'local', declaredBy: stage,
      lastTouched: mtime(p), path: null,
    });
    addEdge(depId, id, 'awaits', 'awaits ' + dep);
  }
});

// ============ 4. DGS plan EDGES[] — the ontology spine ============
try {
  const html = fs.readFileSync(PLAN, 'utf8');
  const i = html.indexOf('const EDGES = [');
  if (i >= 0) {
    let d = 0, j = html.indexOf('[', i), end = j;
    for (let k = j; k < html.length; k++) {
      if (html[k] === '[') d++;
      else if (html[k] === ']') { d--; if (!d) { end = k + 1; break; } }
    }
    const arr = eval(html.slice(j, end));
    for (const e of arr) {
      const a = addNode({ id: wg('dgs', 'project:' + e.a), envelopeId: wg('dgs', 'project:' + e.a), localId: e.a, kind: 'project', origin: 'dgs', title: e.a, state: 'open', direction: 'local', lastTouched: mtime(PLAN), path: PLAN });
      const b = addNode({ id: wg('dgs', 'project:' + e.b), envelopeId: wg('dgs', 'project:' + e.b), localId: e.b, kind: 'project', origin: 'dgs', title: e.b, state: 'open', direction: 'local', lastTouched: mtime(PLAN), path: PLAN });
      addEdge(a, b, 'ontology', e.t);
    }
  }
} catch (e) { warnings.push('plan EDGES: ' + e.message); }

// ============ 4b. land the dangling project references ============
// Runs AFTER the plan so a slug the plan knows keeps the plan's record. What is
// left is a project named by a decision but absent from the plan's EDGES[] —
// real work owed to something the ontology spine does not yet name. It is
// marked `inferred: true` so the two are never confused, and warned about,
// because a destination the plan has never heard of is a finding in itself.
{
  let landed = 0;
  for (const slug of referencedProjects) {
    const id = wg('dgs', 'project:' + slug);
    if (seen.has(id)) continue;
    addNode({
      id, envelopeId: id, localId: slug, kind: 'project', origin: 'dgs', title: slug,
      state: 'open', direction: 'local', inferred: true,
      lastTouched: new Date().toISOString(), path: null,
    });
    landed++;
  }
  if (landed) warnings.push(
    `${landed} project node(s) referenced by a decision but absent from the plan's EDGES[]: ` +
    [...referencedProjects].filter((s) => { const n = nodes.find((x) => x.localId === s && x.kind === 'project'); return n && n.inferred; }).join(', '));
}

// ============ 5. acyclicity — the DFS the design asks for (§3C) ============
const adj = new Map();
for (const e of edges) { if (e.kind !== 'awaits') continue; (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)).push(e.to); }
const cycles = [];
const WHITE = 0, GREY = 1, BLACK = 2; const mark = new Map();
function dfs(n, stack) {
  mark.set(n, GREY); stack.push(n);
  for (const m of adj.get(n) ?? []) {
    if (mark.get(m) === GREY) cycles.push([...stack.slice(stack.indexOf(m)), m].join(' -> '));
    else if ((mark.get(m) ?? WHITE) === WHITE) dfs(m, stack);
  }
  stack.pop(); mark.set(n, BLACK);
}
for (const n of adj.keys()) if ((mark.get(n) ?? WHITE) === WHITE) dfs(n, []);

// ============ emit ============
const now = new Date().toISOString();
const byKind = {};
for (const n of nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
const byState = {};
for (const n of nodes) byState[n.state] = (byState[n.state] ?? 0) + 1;
const byDir = {};
for (const n of nodes) byDir[n.direction] = (byDir[n.direction] ?? 0) + 1;
const byEdge = {};
for (const e of edges) byEdge[e.kind] = (byEdge[e.kind] ?? 0) + 1;

const index = {
  nodes, edges, generated: now,
  stats: {
    nodes: nodes.length, edges: edges.length,
    byKind, byState, byDirection: byDir, byEdgeKind: byEdge,
    sources: { storiesFiles: storyFiles.length, decisionFiles: decFiles.length, awaitsDeclarations: awaitLines },
    cycles, warnings: warnings.slice(0, 40), warningCount: warnings.length,
  },
};
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index, null, 1), 'utf8');
console.log(JSON.stringify(index.stats, null, 1));

// ── the two downstream consumers of this index ────────────────────────────────
// 1. scripts/workgraph-screen.mjs  — the global/session VIEW. Chained below, so
//    regenerating the index always regenerates what displays it.
// 2. scripts/workgraph-distil.mjs  — index -> one Meridian channel entry. NOT
//    chained: its caller is the `griot-meridian-reflect` skill, which lives in the
//    digital-griot-skills repo and runs on its own daily cadence. Naming it here
//    because I8 searches only this repo and would otherwise read a live
//    cross-repo helper as an orphan. Run standalone with `npm run workgraph:distil`.
//
// ── render the view, on the same travelled path ───────────────────────────────
// The index was generated and nothing ever displayed it: the brainstorm rail reads
// ONE session's decisions.json and cannot see the other ~770 nodes, so "this session
// or everything?" had no answer on screen. workgraph-screen.mjs is that view, and a
// helper nobody calls is a soft fix by the ontology's own definition — so it is
// chained here rather than left to be remembered. Generate the index, get the view.
// Non-fatal by design: a rendering problem must never fail the index itself.
try {
  const screen = path.join(import.meta.dirname, 'workgraph-screen.mjs');
  if (fs.existsSync(screen)) {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [screen], { stdio: 'inherit', cwd: process.cwd() });
  }
} catch (e) {
  console.warn('workgraph-screen: view not rendered — ' + (e?.message ?? e));
}
