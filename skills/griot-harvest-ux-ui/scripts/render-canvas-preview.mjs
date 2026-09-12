#!/usr/bin/env node
/**
 * render-canvas-preview.mjs — the VIEW half of a griot-harvest-ux-ui walk.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-AUTHORED PAGE
 * -------------------------------------------------
 * The stage contract's success criteria say it outright: "The canvas renders from
 * harvested data, not from a hand-authored node list." A page drawn by hand is a
 * picture OF the harvest; a page generated from the node array IS the harvest. The
 * difference shows the moment a node changes — hand-drawn drifts silently, this
 * re-renders. Same reason emit-canvas-nodes.mjs exists on the write side.
 *
 * This is a PREVIEW, deliberately not Stage 3. Stage 3 composes the real xyflow
 * canvas with mount points and is Gavin's call to be present for. This only lays
 * the already-validated nodes into their nine layer lanes so the shape is visible.
 *
 * Layout carries meaning, and only meaning that is actually in the data:
 *   - lane (y)      = the node's layer role, in LAYER_ROLES order. Nothing else.
 *   - column (x)    = repo, so a lane sourced by one repo reads as one repo.
 *   - edges         = data.parentId only. No inferred relationships, ever.
 * Position is NOT read from data.position — the emitter stores placeholders there
 * and explicitly "never invents meaning."
 *
 * Usage:
 *   node render-canvas-preview.mjs --in <nodes.json> --out <preview.html>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const argv = process.argv.slice(2)
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null }
const inPath = opt("--in"), outPath = opt("--out")
if (!inPath || !outPath) {
  console.error("Usage: node render-canvas-preview.mjs --in <nodes.json> --out <preview.html>")
  process.exit(1)
}

// Verbatim from the stage contract (decision 2) — same list the emitter gates on.
const LAYER_ROLES = [
  "Djeli · container", "Collaboration · GenTeam", "Creation · build/content/3D",
  "Capture", "Intelligence · Super Agent", "Governance · Governor",
  "Model-making / data science", "Memory · foundation", "Deployment",
]

const nodes = JSON.parse(readFileSync(inPath, "utf-8"))
if (!Array.isArray(nodes)) { console.error("--in must be a JSON array"); process.exit(1) }

const repos = [...new Set(nodes.map((n) => n.data?.provenance?.repo || "?"))].sort()
const lanes = [...LAYER_ROLES, "unplaceable"]
  .map((role) => ({ role, nodes: nodes.filter((n) => n.layer === role) }))
  .filter((l) => l.nodes.length > 0 || LAYER_ROLES.includes(l.role))

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))

// ── layout ────────────────────────────────────────────────────────────────
const CARD_W = 212, CARD_H = 62, GAP_X = 16, GAP_Y = 12, LANE_PAD = 18, LABEL_W = 210
const placed = []
let y = 0
const laneBoxes = []
for (const lane of lanes) {
  const byRepo = new Map()
  for (const n of lane.nodes) {
    const r = n.data?.provenance?.repo || "?"
    if (!byRepo.has(r)) byRepo.set(r, [])
    byRepo.get(r).push(n)
  }
  const rows = Math.max(1, ...[...byRepo.values()].map((a) => a.length))
  const laneH = lane.nodes.length ? rows * CARD_H + (rows - 1) * GAP_Y + LANE_PAD * 2 : 64
  laneBoxes.push({ role: lane.role, y, h: laneH, count: lane.nodes.length })
  for (const [repo, arr] of byRepo) {
    const col = repos.indexOf(repo)
    arr.forEach((n, i) => {
      placed.push({
        n, repo,
        x: LABEL_W + LANE_PAD + col * (CARD_W + GAP_X),
        y: y + LANE_PAD + i * (CARD_H + GAP_Y),
      })
    })
  }
  y += laneH + 2
}
const W = LABEL_W + LANE_PAD * 2 + repos.length * (CARD_W + GAP_X), H = y

// edges: data.parentId ONLY — never inferred
const pos = new Map(placed.map((p) => [p.n.id, p]))
const edges = placed
  .filter((p) => p.n.data?.parentId && pos.has(p.n.data.parentId))
  .map((p) => ({ from: pos.get(p.n.data.parentId), to: p }))

const laneHTML = laneBoxes.map((l, i) => `
  <div class="lane ${l.count ? "" : "empty"}" style="top:${l.y}px;height:${l.h}px;width:${W}px">
    <div class="lane-label" style="width:${LABEL_W}px">
      <span class="ln">${esc(l.role)}</span>
      <span class="lc">${l.count ? l.count + (l.count === 1 ? " node" : " nodes") : "unfilled"}</span>
    </div>
  </div>`).join("")

const edgeHTML = edges.map((e) => {
  const x1 = e.from.x + CARD_W / 2, y1 = e.from.y + CARD_H
  const x2 = e.to.x + CARD_W / 2, y2 = e.to.y
  return `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" />`
}).join("")

const cardHTML = placed.map((p) => {
  const o = p.n.data?.origin || {}
  const nc = (p.n.data?.notCopy || []).length
  return `
  <div class="card l${lanes.findIndex((l) => l.role === p.n.layer)}" style="left:${p.x}px;top:${p.y}px;width:${CARD_W}px;height:${CARD_H}px"
       title="${esc(p.n.data?.mountPoint || "")}">
    <div class="ctop"><span class="repo">${esc(p.repo)}</span><span class="ty">${esc(p.n.type)}</span>${nc ? `<span class="nc">${nc}</span>` : ""}</div>
    <div class="clabel">${esc(p.n.label)}</div>
    <div class="csrc">${esc(o.file || "")}:${esc(o.line ?? "")}</div>
  </div>`
}).join("")

const filled = laneBoxes.filter((l) => l.count).length
const html = `<title>Djeli UX/UI Harvest — Canvas</title>
<style>
:root{
  --bg:#f4f6f8;--grid:#e2e6eb;--pane:#fff;--pane2:#f7f9fa;--line:#d8dde3;--soft:#e9edf1;
  --tx:#14171a;--tx2:#5c6672;--tx3:#8b95a1;--ok:#059669;--gap:#b45309;
  --mono:ui-monospace,"Cascadia Mono","SFMono-Regular",Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,"Segoe UI",Inter,Roboto,sans-serif;
  --c0:#2563eb;--c1:#0891b2;--c2:#7c3aed;--c3:#c2410c;--c4:#4f46e5;--c5:#b45309;--c6:#be123c;--c7:#0d9488;--c8:#65a30d;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#030303;--grid:#141619;--pane:#0E0F11;--pane2:#141619;--line:#24282e;--soft:#1a1d21;
  --tx:#e9edf2;--tx2:#98a2ae;--tx3:#6b7480;--ok:#10B981;--gap:#F59E0B;
  --c0:#3B82F6;--c1:#22D3EE;--c2:#A855F7;--c3:#FB923C;--c4:#818CF8;--c5:#F59E0B;--c6:#FB7185;--c7:#2DD4BF;--c8:#A3E635;}}
:root[data-theme="dark"]{--bg:#030303;--grid:#141619;--pane:#0E0F11;--pane2:#141619;--line:#24282e;--soft:#1a1d21;
  --tx:#e9edf2;--tx2:#98a2ae;--tx3:#6b7480;--ok:#10B981;--gap:#F59E0B;
  --c0:#3B82F6;--c1:#22D3EE;--c2:#A855F7;--c3:#FB923C;--c4:#818CF8;--c5:#F59E0B;--c6:#FB7185;--c7:#2DD4BF;--c8:#A3E635;}
:root[data-theme="light"]{--bg:#f4f6f8;--grid:#e2e6eb;--pane:#fff;--pane2:#f7f9fa;--line:#d8dde3;--soft:#e9edf1;
  --tx:#14171a;--tx2:#5c6672;--tx3:#8b95a1;--ok:#059669;--gap:#b45309;
  --c0:#2563eb;--c1:#0891b2;--c2:#7c3aed;--c3:#c2410c;--c4:#4f46e5;--c5:#b45309;--c6:#be123c;--c7:#0d9488;--c8:#65a30d;}

body{background:var(--bg);color:var(--tx);font-family:var(--sans);margin:0}
.bar{position:sticky;top:0;z-index:20;background:var(--pane);border-bottom:1px solid var(--line);
     padding:11px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:9px 18px}
.bar h1{font-size:14px;font-weight:650;margin:0;letter-spacing:-.01em}
.bar .m{font-size:11.5px;color:var(--tx2);font-family:var(--mono)}
.bar .sp{flex:1}
button{font:inherit;font-size:11.5px;padding:4px 10px;border-radius:6px;border:1px solid var(--line);
       background:var(--pane2);color:var(--tx);cursor:pointer}
button:hover{border-color:var(--tx3)} button:focus-visible{outline:2px solid var(--c0);outline-offset:1px}
.legend{display:flex;flex-wrap:wrap;gap:5px 12px;padding:9px 16px;border-bottom:1px solid var(--line);background:var(--pane)}
.lg{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--tx2)}
.sw{width:9px;height:9px;border-radius:2px;flex:none}
.viewport{position:relative;overflow:auto;height:calc(100vh - 104px);cursor:grab;
  background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:22px 22px}
.viewport.drag{cursor:grabbing}
.stage{position:relative;transform-origin:0 0;width:${W}px;height:${H}px}
.lane{position:absolute;left:0;border-bottom:1px solid var(--soft);background:linear-gradient(90deg,var(--pane) 0,var(--pane) ${LABEL_W}px,transparent ${LABEL_W}px)}
.lane.empty{background:linear-gradient(90deg,var(--pane) 0,var(--pane) ${LABEL_W}px,transparent ${LABEL_W}px);opacity:.85}
.lane-label{position:absolute;left:0;top:0;bottom:0;padding:12px 14px;display:flex;flex-direction:column;
  justify-content:center;gap:4px;border-right:1px solid var(--line)}
.lane .ln{font-size:12.5px;font-weight:600;line-height:1.25}
.lane .lc{font-family:var(--mono);font-size:10px;color:var(--tx3)}
.lane.empty .lc{color:var(--gap);font-weight:600}
svg.edges{position:absolute;inset:0;width:${W}px;height:${H}px;pointer-events:none;z-index:1}
svg.edges path{fill:none;stroke:var(--tx3);stroke-width:1.4;opacity:.55}
.card{position:absolute;z-index:2;border:1px solid var(--line);border-left:3px solid var(--c0);
  background:var(--pane);border-radius:7px;padding:7px 9px;display:flex;flex-direction:column;gap:2px;
  box-shadow:0 1px 2px rgba(0,0,0,.05);overflow:hidden}
.card:hover{border-color:var(--tx3)}
.ctop{display:flex;align-items:center;gap:6px}
.repo{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx2);font-weight:600}
.ty{font-family:var(--mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3)}
.nc{margin-left:auto;font-family:var(--mono);font-size:8.5px;color:var(--gap);font-weight:700}
.clabel{font-size:11.5px;font-weight:560;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.csrc{font-family:var(--mono);font-size:9px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${lanes.map((l, i) => `.card.l${i}{border-left-color:var(--c${i % 9})}`).join("")}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="bar">
  <h1>Djeli UX/UI Harvest — canvas</h1>
  <span class="m">${nodes.length} nodes · ${filled}/9 layers filled · ${repos.length} repos</span>
  <span class="sp"></span>
  <button id="zo">−</button><button id="zi">+</button><button id="zr">reset</button>
  <span class="m">generated from uxui-canvas-nodes.json</span>
</div>
<div class="legend">${lanes.map((l, i) => `<span class="lg"><span class="sw" style="background:var(--c${i % 9})"></span>${esc(l.role)}</span>`).join("")}</div>
<div class="viewport" id="vp"><div class="stage" id="stage">
  ${laneHTML}
  <svg class="edges" viewBox="0 0 ${W} ${H}">${edgeHTML}</svg>
  ${cardHTML}
</div></div>

<script>
(function(){
  var stage=document.getElementById('stage'),vp=document.getElementById('vp'),z=1;
  function ap(){stage.style.transform='scale('+z+')';}
  document.getElementById('zi').onclick=function(){z=Math.min(2,z+.12);ap()};
  document.getElementById('zo').onclick=function(){z=Math.max(.34,z-.12);ap()};
  document.getElementById('zr').onclick=function(){z=1;ap();vp.scrollTo(0,0)};
  var d=false,sx=0,sy=0,l=0,t=0;
  vp.addEventListener('pointerdown',function(e){if(e.target.closest('button'))return;
    d=true;sx=e.clientX;sy=e.clientY;l=vp.scrollLeft;t=vp.scrollTop;vp.classList.add('drag');vp.setPointerCapture(e.pointerId)});
  vp.addEventListener('pointermove',function(e){if(!d)return;vp.scrollLeft=l-(e.clientX-sx);vp.scrollTop=t-(e.clientY-sy)});
  vp.addEventListener('pointerup',function(){d=false;vp.classList.remove('drag')});
  vp.addEventListener('pointercancel',function(){d=false;vp.classList.remove('drag')});
})();
</script>`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, html, "utf-8")
console.log(`render-canvas-preview: ${nodes.length} nodes, ${filled}/9 lanes filled, ${repos.length} repos (${repos.join(", ")}), ${edges.length} parentId edge(s) -> ${outPath}`)
