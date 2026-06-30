<template>
  <div class="arch-explorer" ref="rootRef">
    <div class="arch-bar">
      <div class="tabs" id="tabs"></div>
      <div class="spacer"></div>
      <div class="ctrls">
        <button class="btn" id="expall">Expand all</button>
        <button class="btn" id="fit">Fit</button>
        <button class="btn" id="zout">–</button>
        <span class="zoom mono" id="zlbl">100%</span>
        <button class="btn" id="zin">+</button>
        <button class="btn" id="reset">Reset</button>
      </div>
    </div>

    <div id="viewport"><div id="canvas"><svg id="edges"></svg></div></div>

    <div class="legend">
      <div class="lt" id="legtitle">Legend</div>
      <div class="row"><span class="ln"></span> <span id="leg1">Main flow</span></div>
      <div class="row"><span class="ln err"></span> <span id="leg2">Error / edge-case</span></div>
      <div class="row"><span class="ln meta"></span> <span id="leg3">Supervision / branch</span></div>
    </div>

    <aside id="panel">
      <div class="ph">
        <button class="pclose" id="pclose">×</button>
        <div class="kicker" id="pk">—</div>
        <h2 id="pt">—</h2>
      </div>
      <div class="pb" id="pbody"></div>
    </aside>

    <div class="hint">drag to pan · scroll to zoom · click a node · ＋ to expand</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { VIEWS } from '../data/architecture-views'

const rootRef = ref<HTMLElement | null>(null)
let cleanup: (() => void) | null = null

onMounted(() => {
  const root = rootRef.value
  if (!root) return
  const gid = (id: string) => root.querySelector<HTMLElement>('#' + id)!

  const N = 158
  const NS = 'http://www.w3.org/2000/svg'
  const canvas = gid('canvas')
  const svg = gid('edges') as unknown as SVGSVGElement
  const vp = gid('viewport')

  let view = 'runtime'
  let expanded = new Set<string>()
  let tx = 40, ty = 20, scale = 1

  const TAB: [string, string][] = [['runtime', 'Runtime'], ['workflows', 'Workflows'], ['plugin', 'Plugin']]
  const tabsEl = gid('tabs')
  TAB.forEach(([k, lab]) => {
    const b = document.createElement('button')
    b.className = 'tab' + (k === view ? ' on' : '')
    b.textContent = lab
    b.onclick = () => switchView(k)
    b.dataset.k = k
    tabsEl.appendChild(b)
  })

  const topNodes = () => VIEWS[view].nodes as any[]
  const childNodes = () => {
    const out: any[] = []
    for (const n of topNodes()) {
      if (n.children && expanded.has(n.id))
        for (const c of n.children) out.push(Object.assign({}, c, { x: n.x + c.dx, y: n.y + c.dy, kind: 'child', parent: n.id }))
    }
    return out
  }
  const allNodes = () => [...topNodes(), ...childNodes()]
  const byId = (id: string) => allNodes().find((n) => n.id === id)

  function render() {
    canvas.querySelectorAll('.band,.node').forEach((e) => e.remove())
    const V = VIEWS[view]
    gid('leg1').textContent = V.legend[0]
    gid('leg2').textContent = V.legend[1]
    gid('leg3').textContent = V.legend[2]
    for (const b of V.bands) {
      const d = document.createElement('div')
      d.className = 'band'
      d.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`
      d.innerHTML = `<div class="blab">${b.lab}</div><div class="bname">${b.name}</div>`
      canvas.appendChild(d)
    }
    for (const n of allNodes()) {
      const el = document.createElement('div')
      el.className = 'node' + (n.kind === 'err' ? ' err' : '') + (n.kind === 'child' ? ' child' : '')
      el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.kind === 'child' ? 142 : N}px`
      el.dataset.id = n.id
      const tag = n.kind === 'child' ? '' : `<div class="ntag mono">${n.kind}</div>`
      el.innerHTML = `${tag}<div class="nl">${n.label}</div><div class="ns">${n.sub || ''}</div>`
      el.addEventListener('click', (e) => { e.stopPropagation(); select(n.id) })
      if (n.children && n.children.length) {
        const x = document.createElement('div')
        x.className = 'exp' + (expanded.has(n.id) ? ' open' : '')
        x.textContent = expanded.has(n.id) ? '– hide' : '＋ ' + n.children.length
        x.onclick = (ev) => { ev.stopPropagation(); expanded.has(n.id) ? expanded.delete(n.id) : expanded.add(n.id); render() }
        el.appendChild(x)
      }
      canvas.appendChild(el)
    }
    drawEdges()
  }

  function geom(id: string) {
    const n = byId(id)
    const w = n && n.kind === 'child' ? 142 : N
    const el = [...canvas.children].find((c: any) => c.dataset && c.dataset.id === id) as HTMLElement | undefined
    const h = el ? el.offsetHeight : 52
    return { x: n.x, y: n.y, w, h, cx: n.x + w / 2, top: n.y, bot: n.y + h }
  }

  function drawEdges() {
    svg.innerHTML = ''
    let mx = 0, my = 0
    for (const n of allNodes()) { mx = Math.max(mx, n.x + N); my = Math.max(my, n.y + 60) }
    for (const b of VIEWS[view].bands) { mx = Math.max(mx, b.x + b.w); my = Math.max(my, b.y + b.h) }
    svg.setAttribute('width', String(mx + 80)); svg.setAttribute('height', String(my + 80))
    const E = [...VIEWS[view].edges]
    for (const n of topNodes()) { if (n.children && expanded.has(n.id)) for (const c of n.children) E.push([n.id, c.id, 'meta']) }
    for (const [f, t, k] of E) {
      const a = geom(f), z = geom(t); if (!a || !z) continue
      let d
      if (z.top > a.bot + 4) { const m = (a.bot + z.top) / 2; d = `M ${a.cx} ${a.bot} L ${a.cx} ${m} L ${z.cx} ${m} L ${z.cx} ${z.top}` }
      else if (Math.abs(z.y - a.y) < 60) { const sx = a.x + a.w, ex = z.x; if (ex >= sx) { d = `M ${sx} ${a.y + a.h / 2} L ${ex} ${z.y + z.h / 2}` } else { d = `M ${a.x} ${a.y + a.h / 2} L ${z.x + z.w} ${z.y + z.h / 2}` } }
      else { const sx = a.x + a.w, sy = a.y + a.h / 2, ex = z.cx, ey = z.top, midX = (sx + ex) / 2; d = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey - 18} L ${ex} ${ey - 18} L ${ex} ${ey}` }
      const p = document.createElementNS(NS, 'path')
      p.setAttribute('d', d); p.setAttribute('fill', 'none')
      p.setAttribute('stroke', k === 'err' ? 'var(--edge-err)' : k === 'meta' ? 'var(--edge-meta)' : 'var(--edge)')
      p.setAttribute('stroke-width', k === 'main' ? '1.7' : '1.4')
      if (k !== 'main') p.setAttribute('stroke-dasharray', k === 'err' ? '5 4' : '4 5')
      svg.appendChild(p)
      const dot = document.createElementNS(NS, 'circle')
      dot.setAttribute('cx', String(z.cx)); dot.setAttribute('cy', String(z.top)); dot.setAttribute('r', '2.4')
      dot.setAttribute('fill', k === 'err' ? 'var(--edge-err)' : k === 'meta' ? 'var(--edge-meta)' : 'var(--edge)')
      svg.appendChild(dot)
    }
  }

  /* pan / zoom */
  function apply() { canvas.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; gid('zlbl').textContent = Math.round(scale * 100) + '%' }
  let drag = false, sx = 0, sy = 0
  const onVpDown = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.node')) return; drag = true; vp.classList.add('grabbing'); sx = e.clientX - tx; sy = e.clientY - ty }
  const onMove = (e: MouseEvent) => { if (!drag) return; tx = e.clientX - sx; ty = e.clientY - sy; apply() }
  const onUp = () => { drag = false; vp.classList.remove('grabbing') }
  const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = vp.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const ns = Math.min(2.4, Math.max(.2, scale * (e.deltaY < 0 ? 1.1 : .9))); tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale); scale = ns; apply() }
  vp.addEventListener('mousedown', onVpDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  vp.addEventListener('wheel', onWheel, { passive: false })

  function bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const b of VIEWS[view].bands) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h) }
    for (const n of childNodes()) { x1 = Math.max(x1, n.x + N); y1 = Math.max(y1, n.y + 60) }
    return { x0, y0, x1, y1 }
  }
  function fit() {
    const r = vp.getBoundingClientRect(), b = bounds(), pad = 46
    scale = Math.min(1.35, Math.min((r.width - pad * 2) / (b.x1 - b.x0), (r.height - pad * 2) / (b.y1 - b.y0)))
    tx = pad - b.x0 * scale + (r.width - pad * 2 - (b.x1 - b.x0) * scale) / 2
    ty = pad - b.y0 * scale; apply()
  }
  gid('fit').onclick = fit
  gid('zin').onclick = () => { scale = Math.min(2.4, scale * 1.15); apply() }
  gid('zout').onclick = () => { scale = Math.max(.2, scale * .87); apply() }
  gid('reset').onclick = () => { tx = 40; ty = 20; scale = 1; apply(); close() }
  gid('expall').onclick = () => { const all = topNodes().filter((n) => n.children); const open = all.every((n) => expanded.has(n.id)); all.forEach((n) => open ? expanded.delete(n.id) : expanded.add(n.id)); render(); setTimeout(fit, 30) }

  /* panel */
  const panel = gid('panel')
  function select(id: string) {
    const n = byId(id), d = n.detail || {}
    canvas.querySelectorAll('.node').forEach((el: any) => el.classList.toggle('sel', el.dataset.id === id))
    gid('pk').textContent = ({ main: 'Component', svc: 'Service', adapter: 'Adapter', surface: 'Surface', meta: 'Infrastructure', err: 'Error / edge-case', flow: 'Workflow step', child: 'Sub-component' } as any)[n.kind] || 'Node'
    gid('pt').textContent = n.label
    const c = n.kind === 'svc' ? 'svc' : n.kind === 'meta' ? 'meta' : n.kind === 'err' ? 'err' : n.kind === 'flow' ? 'flow' : 'main'
    let h = `<div style="margin-bottom:14px"><span class="chip ${c}">${n.kind}</span><span class="mono" style="font-size:11px;color:var(--mut)">${n.sub || ''}</span></div>`
    if (d.desc) h += `<div class="desc">${d.desc}</div>`
    if (d.files && d.files.length) { h += `<div class="sec"><h3>Where it lives</h3>` + d.files.map((f: string) => `<div class="file mono">${f}</div>`).join('') + `</div>` }
    if (d.docs && d.docs.length) { h += `<div class="sec"><h3>Read more</h3>` + d.docs.map((x: any) => `<a class="doc" href="${x.u}" ${x.u.startsWith('http') ? 'target="_blank"' : ''}>→ ${x.t}</a>`).join('') + `</div>` }
    gid('pbody').innerHTML = h; panel.classList.add('open')
  }
  function close() { panel.classList.remove('open'); canvas.querySelectorAll('.node').forEach((el) => el.classList.remove('sel')) }
  gid('pclose').onclick = close
  const onVpClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.node')) close() }
  vp.addEventListener('click', onVpClick)
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'f') fit() }
  window.addEventListener('keydown', onKey)

  function switchView(k: string) {
    view = k; expanded = new Set(); close()
    tabsEl.querySelectorAll('.tab').forEach((t: any) => t.classList.toggle('on', t.dataset.k === k))
    render(); setTimeout(fit, 30)
  }

  render(); setTimeout(fit, 60)

  cleanup = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => { cleanup?.() })
</script>

<style>
/* Namespaced (not scoped): the engine builds .band/.node nodes dynamically,
   which a scoped style's data-v attribute would never match. All rules are
   prefixed with .arch-explorer so nothing leaks into the rest of the docs. */
.arch-explorer {
  /* Light (keeps the original cream feel) */
  --bg: #f6f4ef; --band: #ece8df; --band-line: #ddd6c9;
  --card: #fffefb; --card-border: #d9d3c7; --card-hover: #bcae8f;
  --ink: #2b2823; --sub: #8a8377; --mut: #a59d8e;
  --err: #b4321f; --err-bg: #fdf3f1; --err-border: #e7bcb2;
  --edge: #bdb6a8; --edge-err: #d07a68; --edge-meta: #c7c0b2;
  --panel: #fffefb; --panel-border: #e4ded2; --bar-bg: rgba(255, 254, 251, .92);
  --accent1: #6366f1; --accent2: #14b8a6; --accent3: #f59e0b;
  --shadow: 0 1px 2px rgba(40, 36, 28, .06), 0 4px 14px rgba(40, 36, 28, .05);
  position: relative; width: 100%;
  height: calc(100vh - var(--vp-nav-height, 64px) - 3px);
  overflow: hidden; background: var(--bg); color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
}
.dark .arch-explorer {
  /* Dark — matches the VitePress "Spectral" shell (#0a0a0f substrate) */
  --bg: #0a0a0f; --band: #12121a; --band-line: rgba(99, 102, 241, .12);
  --card: #161622; --card-border: rgba(99, 102, 241, .18); --card-hover: rgba(129, 140, 248, .5);
  --ink: #e2e8f0; --sub: #94a3b8; --mut: #64748b;
  --err: #f87171; --err-bg: rgba(239, 68, 68, .12); --err-border: rgba(239, 68, 68, .4);
  --edge: rgba(148, 163, 184, .45); --edge-err: rgba(248, 113, 113, .65); --edge-meta: rgba(129, 140, 248, .5);
  --panel: #101019; --panel-border: rgba(99, 102, 241, .18); --bar-bg: rgba(10, 10, 15, .88);
  --accent1: #818cf8; --accent2: #2dd4bf; --accent3: #fbbf24;
  --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 6px 22px rgba(0, 0, 0, .55);
}
.arch-explorer * { box-sizing: border-box; }
.arch-explorer .mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

.arch-explorer .arch-bar { position: absolute; top: 0; left: 0; right: 0; height: 48px; z-index: 30; display: flex; align-items: center; gap: 14px; padding: 0 16px; background: var(--bar-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--panel-border); }
.arch-explorer .tabs { display: flex; gap: 4px; }
.arch-explorer .tab { font: inherit; font-size: 12.5px; color: var(--sub); background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 5px 12px; cursor: pointer; transition: .12s; }
.arch-explorer .tab:hover { color: var(--ink); background: var(--band); }
.arch-explorer .tab.on { color: var(--ink); background: var(--card); border-color: var(--card-border); font-weight: 600; box-shadow: var(--shadow); }
.arch-explorer .spacer { flex: 1; }
.arch-explorer .ctrls { display: flex; align-items: center; gap: 6px; }
.arch-explorer .btn { font: inherit; font-size: 12px; color: var(--ink); background: var(--card); border: 1px solid var(--card-border); border-radius: 7px; padding: 5px 10px; cursor: pointer; transition: .12s; }
.arch-explorer .btn:hover { border-color: var(--card-hover); }
.arch-explorer .zoom { font-size: 11px; color: var(--sub); min-width: 46px; text-align: center; }

.arch-explorer #viewport { position: absolute; inset: 48px 0 0 0; overflow: hidden; cursor: grab; }
.arch-explorer #viewport.grabbing { cursor: grabbing; }
.arch-explorer #canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; will-change: transform; }
.arch-explorer #edges { position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; }

.arch-explorer .band { position: absolute; border-radius: 14px; background: var(--band); border: 1px solid var(--band-line); }
.arch-explorer .band .blab { position: absolute; top: 9px; left: 16px; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--mut); font-weight: 600; }
.arch-explorer .band .bname { position: absolute; top: 21px; left: 16px; font-size: 13px; font-weight: 650; color: var(--sub); }

.arch-explorer .node { position: absolute; width: 158px; min-height: 50px; background: var(--card); border: 1px solid var(--card-border); border-radius: 8px; padding: 9px 11px; box-shadow: var(--shadow); cursor: pointer; transition: transform .12s, border-color .12s, box-shadow .12s; user-select: none; }
.arch-explorer .node:hover { border-color: var(--card-hover); transform: translateY(-1px); }
.arch-explorer .node .nl { font-size: 12px; font-weight: 600; line-height: 1.25; }
.arch-explorer .node .ns { font-size: 9.5px; color: var(--sub); margin-top: 3px; line-height: 1.3; }
.arch-explorer .node .ntag { position: absolute; top: 7px; right: 9px; font-size: 8px; color: var(--mut); letter-spacing: .05em; }
.arch-explorer .node.err { background: var(--err-bg); border-color: var(--err-border); }
.arch-explorer .node.err .nl { color: var(--err); }
.arch-explorer .node.sel { border-color: var(--accent2); box-shadow: 0 0 0 2px rgba(20, 184, 166, .25), var(--shadow); }
.arch-explorer .node.child { width: 142px; min-height: 42px; padding: 7px 9px; background: var(--band); }
.arch-explorer .node.child .nl { font-size: 11px; }
.arch-explorer .node.child .ns { font-size: 9px; }
.arch-explorer .exp { position: absolute; bottom: 6px; right: 8px; font-size: 9px; font-weight: 700; color: var(--accent2); background: rgba(20, 184, 166, .12); border: 1px solid rgba(20, 184, 166, .3); border-radius: 10px; padding: 1px 7px; cursor: pointer; }
.arch-explorer .exp:hover { background: rgba(20, 184, 166, .2); }
.arch-explorer .exp.open { color: var(--accent3); background: rgba(245, 158, 11, .12); border-color: rgba(245, 158, 11, .3); }

.arch-explorer .legend { position: absolute; left: 16px; bottom: 16px; z-index: 20; background: var(--bar-bg); backdrop-filter: blur(6px); border: 1px solid var(--panel-border); border-radius: 10px; padding: 11px 13px; font-size: 10.5px; color: var(--sub); }
.arch-explorer .legend .lt { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--mut); margin-bottom: 7px; font-weight: 600; }
.arch-explorer .legend .row { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
.arch-explorer .legend .ln { width: 26px; height: 0; border-top: 2px solid var(--edge); }
.arch-explorer .legend .ln.err { border-top: 2px solid var(--edge-err); }
.arch-explorer .legend .ln.meta { border-top: 2px dashed var(--edge-meta); }

.arch-explorer #panel { position: absolute; top: 48px; right: 0; bottom: 0; width: 380px; max-width: 92%; z-index: 25; background: var(--panel); border-left: 1px solid var(--panel-border); box-shadow: -8px 0 30px rgba(0, 0, 0, .18); transform: translateX(102%); transition: transform .26s cubic-bezier(.2, .8, .2, 1); overflow-y: auto; }
.arch-explorer #panel.open { transform: translateX(0); }
.arch-explorer #panel .ph { position: sticky; top: 0; background: var(--panel); padding: 18px 20px 14px; border-bottom: 1px solid var(--panel-border); }
.arch-explorer #panel .kicker { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); font-weight: 600; }
.arch-explorer #panel h2 { margin: 6px 0 0; padding: 0; border: 0; font-size: 18px; font-weight: 680; line-height: 1.2; letter-spacing: normal; }
.arch-explorer #panel .pclose { position: absolute; top: 14px; right: 14px; border: none; background: transparent; color: var(--mut); font-size: 20px; cursor: pointer; line-height: 1; padding: 4px; }
.arch-explorer #panel .pclose:hover { color: var(--ink); }
.arch-explorer #panel .pb { padding: 16px 20px 30px; }
.arch-explorer #panel .desc { font-size: 13.5px; line-height: 1.55; color: var(--ink); }
.arch-explorer #panel .sec { margin-top: 18px; }
.arch-explorer #panel .sec h3 { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); margin: 0 0 8px; font-weight: 600; }
.arch-explorer #panel .file { font-size: 11.5px; color: var(--sub); background: var(--band); border: 1px solid var(--band-line); border-radius: 6px; padding: 5px 8px; margin: 5px 0; word-break: break-all; }
.arch-explorer #panel .li { font-size: 12.5px; color: var(--ink); margin: 6px 0; padding-left: 14px; position: relative; line-height: 1.4; }
.arch-explorer #panel .li:before { content: '▸'; position: absolute; left: 0; color: var(--mut); }
.arch-explorer #panel a.doc { display: inline-flex; gap: 6px; font-size: 12.5px; color: var(--accent2); text-decoration: none; margin: 4px 10px 4px 0; }
.arch-explorer #panel a.doc:hover { text-decoration: underline; }
.arch-explorer .chip { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px; margin-right: 6px; }
.arch-explorer .chip.main { background: rgba(99, 102, 241, .15); color: var(--accent1); }
.arch-explorer .chip.svc { background: rgba(34, 197, 94, .15); color: #22c55e; }
.arch-explorer .chip.meta { background: rgba(245, 158, 11, .15); color: var(--accent3); }
.arch-explorer .chip.err { background: var(--err-bg); color: var(--err); }
.arch-explorer .chip.flow { background: rgba(139, 92, 246, .15); color: #a78bfa; }
.arch-explorer .hint { position: absolute; right: 16px; bottom: 16px; z-index: 20; font-size: 10.5px; color: var(--mut); }
</style>
