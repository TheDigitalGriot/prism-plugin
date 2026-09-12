#!/usr/bin/env node
/**
 * build-canvas.mjs — Stage 3. The real canvas, generated from the harvested node array.
 *
 * Replaces render-canvas-preview.mjs, which drew a STATIC picture of the harvest and was
 * correctly rejected: a canvas you cannot manipulate is a screenshot with extra steps.
 *
 * WHAT MAKES THIS THE CANVAS AND NOT A DIAGRAM
 * --------------------------------------------
 * Decision 4 in the stage contract picks xyflow "because nodes are a plain JSON array an
 * agent reads and writes directly, with no canvas-widget indirection." The load-bearing word
 * is WRITES. So this canvas closes the loop:
 *
 *     nodes.json -> canvas -> you drag -> Export -> nodes.json
 *
 * Dragging a node into a different lane REASSIGNS data.layer. Dragging handle-to-handle
 * writes data.parentId. Export emits the same schema emit-canvas-nodes.mjs validates, so the
 * round trip is closed and gated: re-run the emitter on the export and bad routing is rejected.
 * That is the difference between composing the canvas and illustrating it.
 *
 * The artifact CSP blocks external hosts, so React + @xyflow/react cannot be loaded from a CDN.
 * The interaction layer is therefore hand-written against pointer events — same model xyflow
 * uses (stage transform, screen->stage coordinate conversion, SVG edge layer beneath nodes).
 * The DATA stays xyflow-shaped, so a real @xyflow/react mount consumes this export unchanged.
 *
 * Usage:
 *   node build-canvas.mjs --in <nodes.json> --out <canvas.html>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const argv = process.argv.slice(2)
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null }
const inPath = opt("--in"), outPath = opt("--out")
if (!inPath || !outPath) { console.error("Usage: node build-canvas.mjs --in <nodes.json> --out <canvas.html>"); process.exit(1) }

// Verbatim from the stage contract (decision 2) — the same nine the emitter gates on.
const LAYER_ROLES = [
  "Djeli · container", "Collaboration · GenTeam", "Creation · build/content/3D",
  "Capture", "Intelligence · Super Agent", "Governance · Governor",
  "Model-making / data science", "Memory · foundation", "Deployment",
]

const nodes = JSON.parse(readFileSync(inPath, "utf-8"))
if (!Array.isArray(nodes)) { console.error("--in must be a JSON array"); process.exit(1) }

// Seed positions by lane + repo. data.position holds emitter placeholders the schema says
// "never invent meaning" in, so we compute a sane start and let the user's drags own it after.
const LANE_H = 150, CARD_W = 208, GAP = 18, LABEL_W = 196, TOP = 14
const repos = [...new Set(nodes.map(n => n.data?.provenance?.repo || "?"))].sort()
const seen = new Map()
for (const n of nodes) {
  const li = LAYER_ROLES.indexOf(n.layer)
  const lane = li < 0 ? LAYER_ROLES.length : li
  const repo = n.data?.provenance?.repo || "?"
  const key = lane + "|" + repo
  const i = seen.get(key) || 0
  seen.set(key, i + 1)
  n.position = {
    x: LABEL_W + GAP + repos.indexOf(repo) * (CARD_W + GAP) + i * 26,
    y: lane * LANE_H + TOP + 20 + i * 14,
  }
}

const DATA = JSON.stringify({ nodes, layers: LAYER_ROLES, repos, laneH: LANE_H, labelW: LABEL_W, cardW: CARD_W })
  .replace(/</g, "\\u003c")

const html = `<title>Djeli Layer Canvas — Stage 3</title>
<style>
:root{
 --bg:#eef1f4;--grid:#dde2e8;--pane:#fff;--pane2:#f6f8fa;--line:#d6dce3;--soft:#e8ecf1;
 --tx:#13161a;--tx2:#5a646f;--tx3:#8a949f;--gapc:#b45309;--okc:#059669;
 --c0:#2563eb;--c1:#0891b2;--c2:#7c3aed;--c3:#c2410c;--c4:#4f46e5;--c5:#b45309;--c6:#be123c;--c7:#0d9488;--c8:#65a30d;--c9:#6b7280;
 --mono:ui-monospace,"Cascadia Mono","SFMono-Regular",Menlo,Consolas,monospace;
 --sans:ui-sans-serif,system-ui,"Segoe UI",Inter,Roboto,sans-serif;}
@media(prefers-color-scheme:dark){:root{
 --bg:#020203;--grid:#121417;--pane:#0E0F11;--pane2:#15181c;--line:#252a31;--soft:#1a1e23;
 --tx:#e9edf2;--tx2:#98a2ae;--tx3:#6b7480;--gapc:#F59E0B;--okc:#10B981;
 --c0:#3B82F6;--c1:#22D3EE;--c2:#A855F7;--c3:#FB923C;--c4:#818CF8;--c5:#F59E0B;--c6:#FB7185;--c7:#2DD4BF;--c8:#A3E635;--c9:#94A3B8;}}
:root[data-theme="dark"]{--bg:#020203;--grid:#121417;--pane:#0E0F11;--pane2:#15181c;--line:#252a31;--soft:#1a1e23;
 --tx:#e9edf2;--tx2:#98a2ae;--tx3:#6b7480;--gapc:#F59E0B;--okc:#10B981;
 --c0:#3B82F6;--c1:#22D3EE;--c2:#A855F7;--c3:#FB923C;--c4:#818CF8;--c5:#F59E0B;--c6:#FB7185;--c7:#2DD4BF;--c8:#A3E635;--c9:#94A3B8;}
:root[data-theme="light"]{--bg:#eef1f4;--grid:#dde2e8;--pane:#fff;--pane2:#f6f8fa;--line:#d6dce3;--soft:#e8ecf1;
 --tx:#13161a;--tx2:#5a646f;--tx3:#8a949f;--gapc:#b45309;--okc:#059669;
 --c0:#2563eb;--c1:#0891b2;--c2:#7c3aed;--c3:#c2410c;--c4:#4f46e5;--c5:#b45309;--c6:#be123c;--c7:#0d9488;--c8:#65a30d;--c9:#6b7280;}

*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font-family:var(--sans);overflow:hidden;height:100vh}
.app{display:flex;flex-direction:column;height:100vh}
.bar{background:var(--pane);border-bottom:1px solid var(--line);padding:9px 14px;display:flex;
 align-items:center;gap:8px 14px;flex-wrap:wrap;z-index:30}
.bar h1{font-size:13px;font-weight:650;margin:0;letter-spacing:-.01em}
.m{font-family:var(--mono);font-size:11px;color:var(--tx2)}
.sp{flex:1}
button{font:inherit;font-size:11.5px;padding:4.5px 10px;border-radius:6px;border:1px solid var(--line);
 background:var(--pane2);color:var(--tx);cursor:pointer}
button:hover{border-color:var(--tx3)}
button:focus-visible{outline:2px solid var(--c0);outline-offset:1px}
button.pri{background:var(--c0);border-color:var(--c0);color:#fff;font-weight:600}
button.on{background:var(--c0);border-color:var(--c0);color:#fff}
.body{flex:1;display:flex;min-height:0}
.vp{flex:1;position:relative;overflow:hidden;cursor:grab;touch-action:none;
 background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:24px 24px}
.vp.pan{cursor:grabbing}
.stage{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.lane{position:absolute;left:0;border-bottom:1px dashed var(--soft)}
.lane .hd{position:absolute;left:0;top:0;bottom:0;padding:10px 12px;display:flex;flex-direction:column;
 justify-content:center;gap:3px;border-right:1px solid var(--line);background:var(--pane)}
.lane .ln{font-size:12px;font-weight:600;line-height:1.25}
.lane .lc{font-family:var(--mono);font-size:9.5px;color:var(--tx3)}
.lane.hot{background:rgba(59,130,246,.07)}
.lane.hot .hd{background:var(--pane2)}
.lane.empty .lc{color:var(--gapc);font-weight:700}
svg.ed{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:2}
svg.ed path.e{fill:none;stroke:var(--tx3);stroke-width:1.6;opacity:.6;pointer-events:stroke;cursor:pointer}
svg.ed path.e:hover{stroke:var(--c6);opacity:1;stroke-width:2.4}
svg.ed path.tmp{fill:none;stroke:var(--c0);stroke-width:2;stroke-dasharray:5 4}
.nd{position:absolute;z-index:3;width:${CARD_W}px;border:1px solid var(--line);border-left-width:3px;
 background:var(--pane);border-radius:8px;padding:7px 9px 8px;cursor:grab;user-select:none;
 box-shadow:0 1px 3px rgba(0,0,0,.09);display:flex;flex-direction:column;gap:2px}
.nd:active{cursor:grabbing}
.nd.sel{border-color:var(--c0);box-shadow:0 0 0 2px var(--c0),0 4px 10px rgba(0,0,0,.16)}
.nd.drg{opacity:.92;box-shadow:0 8px 20px rgba(0,0,0,.3);z-index:9}
.nd .tp{display:flex;align-items:center;gap:5px}
.rp{font-family:var(--mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx2);font-weight:700}
.ty{font-family:var(--mono);font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);
 border:1px solid var(--soft);border-radius:3px;padding:0 3px}
.nc{margin-left:auto;font-family:var(--mono);font-size:8.5px;color:var(--gapc);font-weight:700}
.lb{font-size:11.5px;font-weight:560;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr{font-family:var(--mono);font-size:9px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h{position:absolute;width:11px;height:11px;border-radius:50%;background:var(--pane);border:2px solid var(--c0);
 left:50%;margin-left:-5.5px;opacity:0;transition:opacity .12s;cursor:crosshair;z-index:4}
.h.t{top:-6px} .h.b{bottom:-6px}
.nd:hover .h,.nd.sel .h{opacity:1}
.h:hover{background:var(--c0);transform:scale(1.25)}

.insp{width:296px;flex:none;border-left:1px solid var(--line);background:var(--pane);overflow-y:auto;
 padding:15px;display:flex;flex-direction:column;gap:13px}
.insp h2{font-size:13px;margin:0;font-weight:650;line-height:1.3}
.fld{display:flex;flex-direction:column;gap:3px}
.fk{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--tx3);font-weight:700}
.fv{font-size:12px;line-height:1.45;word-break:break-word}
.fv.mono{font-family:var(--mono);font-size:10.5px;color:var(--tx2)}
select{font:inherit;font-size:11.5px;padding:5px 7px;border-radius:6px;border:1px solid var(--line);
 background:var(--pane2);color:var(--tx);width:100%}
.hint{font-size:11px;color:var(--tx3);line-height:1.5}
.kbd{font-family:var(--mono);font-size:10px;border:1px solid var(--line);border-radius:3px;padding:0 3px;background:var(--pane2)}
.warn{font-size:11px;color:var(--gapc);font-weight:600}
textarea{width:100%;height:150px;font-family:var(--mono);font-size:9.5px;border:1px solid var(--line);
 border-radius:6px;background:var(--pane2);color:var(--tx);padding:7px;resize:vertical}
.legend{display:flex;flex-wrap:wrap;gap:3px 10px}
.lg{display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--tx2);cursor:pointer}
.lg .sw{width:8px;height:8px;border-radius:2px}
.lg.off{opacity:.35}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="app">
 <div class="bar">
  <h1>Djeli Layer Canvas</h1>
  <span class="m" id="stats"></span>
  <span class="sp"></span>
  <button id="connect">Connect mode</button>
  <button id="relayout">Re-lane</button>
  <button id="zo">−</button><button id="zi">+</button><button id="zf">fit</button>
  <button class="pri" id="exp">Export nodes.json</button>
 </div>
 <div class="body">
  <div class="vp" id="vp"><div class="stage" id="stage"></div></div>
  <aside class="insp" id="insp"></aside>
 </div>
</div>

<script>
(function(){
var D = ${DATA};
var LAYERS = D.layers.slice(), UNP = "unplaceable";
var ALL = LAYERS.concat([UNP]);
var N = D.nodes, LANE_H = D.laneH, LABEL_W = D.labelW, CARD_W = D.cardW;
var stage = document.getElementById("stage"), vp = document.getElementById("vp"), insp = document.getElementById("insp");
var tx = 0, ty = 0, z = 1, sel = null, connectMode = false, hidden = {};
var STAGE_W = LABEL_W + 80 + D.repos.length * (CARD_W + 18) + 420;
var STAGE_H = ALL.length * LANE_H + 40;

// ── stage scaffolding ──────────────────────────────────────────────────────
var svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
svg.setAttribute("class","ed"); svg.setAttribute("width",STAGE_W); svg.setAttribute("height",STAGE_H);
var laneEls = {};
ALL.forEach(function(role,i){
  var d = document.createElement("div");
  d.className = "lane"; d.dataset.layer = role;
  d.style.top = (i*LANE_H)+"px"; d.style.height = LANE_H+"px"; d.style.width = STAGE_W+"px";
  var hd = document.createElement("div"); hd.className="hd"; hd.style.width = LABEL_W+"px";
  hd.innerHTML = '<span class="ln"></span><span class="lc"></span>';
  hd.querySelector(".ln").textContent = role;
  d.appendChild(hd); stage.appendChild(d); laneEls[role] = d;
});
stage.appendChild(svg);

function applyT(){ stage.style.transform = "translate("+tx+"px,"+ty+"px) scale("+z+")"; }
function laneIdx(role){ var i = ALL.indexOf(role); return i<0 ? ALL.length-1 : i; }
function laneOf(y){ return ALL[Math.max(0,Math.min(ALL.length-1,Math.floor(y/LANE_H)))]; }
function colorOf(role){ var i=ALL.indexOf(role); return "var(--c"+(i<0?9:i%10)+")"; }

// ── nodes ──────────────────────────────────────────────────────────────────
var els = {};
function makeNode(n){
  var e = document.createElement("div");
  e.className = "nd"; e.dataset.id = n.id;
  e.style.borderLeftColor = colorOf(n.layer);
  var o = n.data.origin || {}, nc = (n.data.notCopy||[]).length;
  var tp = document.createElement("div"); tp.className="tp";
  var rp = document.createElement("span"); rp.className="rp"; rp.textContent = (n.data.provenance&&n.data.provenance.repo)||"?";
  var ty = document.createElement("span"); ty.className="ty"; ty.textContent = n.type;
  tp.appendChild(rp); tp.appendChild(ty);
  if(nc){ var w=document.createElement("span"); w.className="nc"; w.textContent = nc+"\\u26a0"; tp.appendChild(w); }
  var lb = document.createElement("div"); lb.className="lb"; lb.textContent = n.label;
  var sr = document.createElement("div"); sr.className="sr"; sr.textContent = (o.file||"")+":"+(o.line==null?"":o.line);
  sr.title = (o.file||"")+":"+(o.line==null?"":o.line);
  var ht = document.createElement("div"); ht.className="h t"; ht.dataset.h="t";
  var hb = document.createElement("div"); hb.className="h b"; hb.dataset.h="b";
  e.appendChild(tp); e.appendChild(lb); e.appendChild(sr); e.appendChild(ht); e.appendChild(hb);
  e.style.left = n.position.x+"px"; e.style.top = n.position.y+"px";
  stage.appendChild(e); els[n.id] = e;
  return e;
}
N.forEach(makeNode);

// ── edges (data.parentId is the ONLY source; nothing inferred) ─────────────
function center(n){ var e=els[n.id]; return { x:n.position.x+CARD_W/2, y:n.position.y+(e?e.offsetHeight:60) }; }
function drawEdges(){
  var keep = svg.querySelector("path.tmp");
  svg.innerHTML = ""; if(keep) svg.appendChild(keep);
  N.forEach(function(n){
    if(!n.data.parentId) return;
    var p = N.find(function(m){ return m.id===n.data.parentId; });
    if(!p || hidden[p.layer] || hidden[n.layer]) return;
    var pe = els[p.id], ne = els[n.id];
    var x1 = p.position.x+CARD_W/2, y1 = p.position.y+(pe?pe.offsetHeight:60);
    var x2 = n.position.x+CARD_W/2, y2 = n.position.y;
    var mid = (y1+y2)/2;
    var path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("class","e");
    path.setAttribute("d","M"+x1+","+y1+" C"+x1+","+mid+" "+x2+","+mid+" "+x2+","+y2);
    path.addEventListener("click",function(ev){ ev.stopPropagation(); n.data.parentId=null; drawEdges(); stats(); });
    path.appendChild(mk("title","click to remove: "+p.label+" \\u2192 "+n.label));
    svg.appendChild(path);
  });
}
function mk(t,txt){ var e=document.createElementNS("http://www.w3.org/2000/svg",t); e.textContent=txt; return e; }

// ── drag a node: moving it across a lane RE-ROUTES its layer ───────────────
var drag = null;
stage.addEventListener("pointerdown", function(ev){
  var h = ev.target.closest(".h");
  var nd = ev.target.closest(".nd");
  if(h && nd){ startLink(ev, nd.dataset.id); return; }
  if(!nd) return;
  ev.stopPropagation();
  var n = byId(nd.dataset.id);
  select(n.id);
  drag = { n:n, el:nd, dx: ev.clientX/1 - n.position.x*z - tx, dy: ev.clientY - n.position.y*z - ty };
  nd.classList.add("drg"); nd.setPointerCapture(ev.pointerId);
});
stage.addEventListener("pointermove", function(ev){
  if(link){ moveLink(ev); return; }
  if(!drag) return;
  drag.n.position.x = (ev.clientX - tx - drag.dx)/z;
  drag.n.position.y = (ev.clientY - ty - drag.dy)/z;
  drag.el.style.left = drag.n.position.x+"px";
  drag.el.style.top  = drag.n.position.y+"px";
  var hot = laneOf(drag.n.position.y + drag.el.offsetHeight/2);
  Object.keys(laneEls).forEach(function(r){ laneEls[r].classList.toggle("hot", r===hot && r!==drag.n.layer); });
  drawEdges();
});
stage.addEventListener("pointerup", function(ev){
  if(link){ endLink(ev); return; }
  if(!drag) return;
  var el = drag.el, n = drag.n;
  var target = laneOf(n.position.y + el.offsetHeight/2);
  if(target !== n.layer){ n.layer = target; n._rerouted = true; el.style.borderLeftColor = colorOf(target); }
  el.classList.remove("drg");
  Object.keys(laneEls).forEach(function(r){ laneEls[r].classList.remove("hot"); });
  drag = null; drawEdges(); stats(); if(sel===n.id) select(n.id);
});

// ── connect: handle -> handle writes data.parentId ─────────────────────────
var link = null, tmpPath = null;
function startLink(ev, id){
  ev.stopPropagation();
  var n = byId(id), el = els[id];
  link = { from:n, fx:n.position.x+CARD_W/2, fy:n.position.y+el.offsetHeight };
  tmpPath = document.createElementNS("http://www.w3.org/2000/svg","path");
  tmpPath.setAttribute("class","tmp"); svg.appendChild(tmpPath);
  stage.setPointerCapture(ev.pointerId);
}
function moveLink(ev){
  var x = (ev.clientX - tx)/z, y = (ev.clientY - ty)/z, m=(link.fy+y)/2;
  tmpPath.setAttribute("d","M"+link.fx+","+link.fy+" C"+link.fx+","+m+" "+x+","+m+" "+x+","+y);
}
function endLink(ev){
  var t = document.elementFromPoint(ev.clientX, ev.clientY);
  var nd = t && t.closest ? t.closest(".nd") : null;
  if(nd && nd.dataset.id !== link.from.id){
    var child = byId(nd.dataset.id);
    if(!wouldCycle(child, link.from)) child.data.parentId = link.from.id;
  }
  if(tmpPath && tmpPath.parentNode) tmpPath.parentNode.removeChild(tmpPath);
  link=null; tmpPath=null; drawEdges(); stats();
}
function wouldCycle(child, parent){
  var seen={}, cur=parent;
  while(cur){ if(cur.id===child.id) return true; if(seen[cur.id]) return true; seen[cur.id]=1;
    cur = cur.data.parentId ? byId(cur.data.parentId) : null; }
  return false;
}

// ── pan / zoom ─────────────────────────────────────────────────────────────
var pan=null;
vp.addEventListener("pointerdown", function(ev){
  if(ev.target.closest(".nd")) return;
  pan={x:ev.clientX,y:ev.clientY,tx:tx,ty:ty}; vp.classList.add("pan"); vp.setPointerCapture(ev.pointerId);
  select(null);
});
vp.addEventListener("pointermove", function(ev){
  if(!pan) return; tx=pan.tx+(ev.clientX-pan.x); ty=pan.ty+(ev.clientY-pan.y); applyT();
});
vp.addEventListener("pointerup", function(){ pan=null; vp.classList.remove("pan"); });
vp.addEventListener("wheel", function(ev){
  ev.preventDefault();
  var r=vp.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  var nz=Math.max(.25,Math.min(2.2, z*(ev.deltaY<0?1.1:1/1.1)));
  tx = mx-(mx-tx)*(nz/z); ty = my-(my-ty)*(nz/z); z=nz; applyT();
},{passive:false});
document.getElementById("zi").onclick=function(){ z=Math.min(2.2,z*1.15); applyT(); };
document.getElementById("zo").onclick=function(){ z=Math.max(.25,z/1.15); applyT(); };
document.getElementById("zf").onclick=fit;
function fit(){
  var r=vp.getBoundingClientRect();
  z = Math.min(1, Math.min(r.width/STAGE_W, r.height/STAGE_H)*.97);
  tx=8; ty=8; applyT();
}

// ── re-lane: snap everything back to its layer band ────────────────────────
document.getElementById("relayout").onclick=function(){
  var cnt={};
  N.forEach(function(n){
    var repo=(n.data.provenance&&n.data.provenance.repo)||"?";
    var k=n.layer+"|"+repo, i=cnt[k]||0; cnt[k]=i+1;
    n.position.x = LABEL_W+18+D.repos.indexOf(repo)*(CARD_W+18)+i*26;
    n.position.y = laneIdx(n.layer)*LANE_H+34+i*14;
    els[n.id].style.left=n.position.x+"px"; els[n.id].style.top=n.position.y+"px";
  });
  drawEdges();
};

// ── connect mode toggle (touch-friendly: click source then target) ─────────
var cm=document.getElementById("connect"), cmFrom=null;
cm.onclick=function(){ connectMode=!connectMode; cm.classList.toggle("on",connectMode); cmFrom=null; render(); };

// ── selection + inspector ──────────────────────────────────────────────────
function byId(id){ for(var i=0;i<N.length;i++) if(N[i].id===id) return N[i]; return null; }
function select(id){
  if(connectMode && id){
    if(!cmFrom){ cmFrom=id; }
    else if(cmFrom!==id){ var c=byId(id); if(!wouldCycle(c,byId(cmFrom))) c.data.parentId=cmFrom; cmFrom=null; drawEdges(); stats(); }
  }
  sel=id;
  Object.keys(els).forEach(function(k){ els[k].classList.toggle("sel", k===id || k===cmFrom); });
  paint();
}
function paint(){
  if(!sel){
    insp.innerHTML =
      '<h2>Layer canvas</h2>'+
      '<p class="hint"><b>Drag a node into another lane</b> and its <b>layer role is reassigned</b> \\u2014 the canvas is the routing tool, not a picture of it.</p>'+
      '<p class="hint">Drag a handle (hover a node) to another node to set <span class="kbd">data.parentId</span> \\u2014 that is how a component becomes part of a flow, and a flow part of a workflow. Click an edge to remove it.</p>'+
      '<p class="hint">Scroll to zoom, drag empty space to pan. <b>Export</b> writes the same schema <span class="kbd">emit-canvas-nodes.mjs</span> validates \\u2014 re-run the emitter on it and bad routing is rejected.</p>'+
      '<div class="fld"><span class="fk">layers</span><div class="legend" id="lgd"></div></div>';
    var lgd=document.getElementById("lgd");
    ALL.forEach(function(r,i){
      var c=N.filter(function(n){return n.layer===r;}).length;
      var s=document.createElement("span"); s.className="lg"+(hidden[r]?" off":"");
      s.innerHTML='<span class="sw" style="background:'+colorOf(r)+'"></span>';
      s.appendChild(document.createTextNode(r+" ("+c+")"));
      s.onclick=function(){ hidden[r]=!hidden[r]; render(); };
      lgd.appendChild(s);
    });
    return;
  }
  var n=byId(sel), o=n.data.origin||{}, p=n.data.provenance||{};
  var h='<h2>'+esc(n.label)+'</h2>';
  h+=fld("layer role", esc(n.layer)+(n._rerouted?' <span class="warn">\\u00b7 re-routed</span>':""));
  h+='<div class="fld"><span class="fk">move to layer</span><select id="ls"></select></div>';
  h+=fld("type", esc(n.type));
  h+=fld("file:line", esc(o.file||"")+":"+esc(o.line==null?"":o.line), true);
  h+=fld("mount point", esc(n.data.mountPoint||""), true);
  h+=fld("repo \\u00b7 commit", esc(p.repo||"?")+" \\u00b7 "+esc(p.sourceCommit||"(none)"), true);
  h+=fld("licence (a fact, never a verdict)", esc(n.data.licence||""), true);
  h+=fld("harvested by", esc(p.harvestedBy||"")+" \\u00b7 "+esc(p.harvestedAt||""), true);
  if(n.data.parentId) h+=fld("parent", esc(n.data.parentId), true);
  var ncs=n.data.notCopy||[];
  h+=fld("what NOT to copy", ncs.length? ncs.map(esc).join("<br>") : "\\u2014 none recorded \\u2014");
  h+=fld("id", esc(n.id), true);
  insp.innerHTML=h;
  var ls=document.getElementById("ls");
  ALL.forEach(function(r){ var op=document.createElement("option"); op.value=r; op.textContent=r; if(r===n.layer) op.selected=true; ls.appendChild(op); });
  ls.onchange=function(){ n.layer=ls.value; n._rerouted=true; els[n.id].style.borderLeftColor=colorOf(n.layer); render(); };
}
function fld(k,v,mono){ return '<div class="fld"><span class="fk">'+k+'</span><span class="fv'+(mono?" mono":"")+'">'+v+'</span></div>'; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

// ── counts + visibility ────────────────────────────────────────────────────
function stats(){
  var filled=ALL.filter(function(r){ return r!==UNP && N.some(function(n){return n.layer===r;}); }).length;
  var re=N.filter(function(n){return n._rerouted;}).length;
  var ed=N.filter(function(n){return n.data.parentId;}).length;
  document.getElementById("stats").textContent =
    N.length+" nodes \\u00b7 "+filled+"/9 layers \\u00b7 "+ed+" edges"+(re?" \\u00b7 "+re+" re-routed":"");
  ALL.forEach(function(r){
    var c=N.filter(function(n){return n.layer===r;}).length;
    var el=laneEls[r]; el.classList.toggle("empty", c===0);
    el.querySelector(".lc").textContent = c? (c+(c===1?" node":" nodes")) : (r===UNP?"none":"unfilled");
  });
}
function render(){
  N.forEach(function(n){ els[n.id].style.display = hidden[n.layer] ? "none" : ""; });
  drawEdges(); stats(); paint();
}

// ── export: closes the loop back to the node array ────────────────────────
document.getElementById("exp").onclick=function(){
  var out = N.map(function(n){
    var c = JSON.parse(JSON.stringify(n)); delete c._rerouted;
    c.position = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    return c;
  });
  var txt = JSON.stringify(out,null,2)+"\\n";
  try{
    var b=new Blob([txt],{type:"application/json"}), u=URL.createObjectURL(b);
    var a=document.createElement("a"); a.href=u; a.download="uxui-canvas-nodes.json"; a.click();
    setTimeout(function(){URL.revokeObjectURL(u);},1500);
  }catch(e){}
  sel=null;
  insp.innerHTML='<h2>Export</h2><p class="hint">Download started. If the browser blocked it, copy from here and overwrite <span class="kbd">.prism/shared/workgraph/uxui-canvas-nodes.json</span>, then re-run <span class="kbd">emit-canvas-nodes.mjs</span> to gate it.</p>';
  var ta=document.createElement("textarea"); ta.value=txt; insp.appendChild(ta); ta.select();
};

applyT(); fit(); render();
})();
</script>`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, html, "utf-8")
const filled = LAYER_ROLES.filter(r => nodes.some(n => n.layer === r)).length
console.log(`build-canvas: ${nodes.length} nodes, ${filled}/9 layers, ${repos.length} repos -> ${outPath}`)
