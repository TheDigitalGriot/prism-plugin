import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────
// Prism Hybrid v3
//
// LEFT: Straight white beam particles converge toward
// a 3D wireframe icosahedron at center.
//
// CENTER: Slowly rotating icosahedron rendered as
// ASCII wireframe with depth-based brightness.
//
// RIGHT: Spectral ASCII wave field fans outward from
// the icosahedron, colored by exit angle.
// ─────────────────────────────────────────────────────

const CHARS = [" ", ".", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r=c;g=x;b=0; } else if (h < 120) { r=x;g=c;b=0; }
  else if (h < 180) { r=0;g=c;b=x; } else if (h < 240) { r=0;g=x;b=c; }
  else if (h < 300) { r=x;g=0;b=c; } else { r=c;g=0;b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

// ─── Icosahedron geometry ───
// 12 vertices defined using golden ratio
function makeIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
    [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
    [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
  ];
  // Normalize to unit sphere
  const len = Math.sqrt(1 + phi * phi);
  const normalized = verts.map(v => [v[0]/len, v[1]/len, v[2]/len]);

  // 30 edges
  const edges = [
    [0,1],[0,5],[0,7],[0,10],[0,11],
    [1,5],[1,7],[1,8],[1,9],
    [2,3],[2,4],[2,6],[2,10],[2,11],
    [3,4],[3,6],[3,8],[3,9],
    [4,5],[4,9],[4,11],
    [5,9],[5,11],
    [6,7],[6,8],[6,10],
    [7,8],[7,10],
    [8,9],
    [10,11],
  ];
  return { verts: normalized, edges };
}

// ─── 3D rotation matrices ───
function rotateY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c*v[0] + s*v[2], v[1], -s*v[0] + c*v[2]];
}
function rotateX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c*v[1] - s*v[2], s*v[1] + c*v[2]];
}
function rotateZ(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c*v[0] - s*v[1], s*v[0] + c*v[1], v[2]];
}

// ─── Beam particle ───
class BeamParticle {
  constructor(x, y, vx, vy, brightness, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.brightness = brightness;
    this.life = life; this.maxLife = life;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
  alive() { return this.life > 0 && this.x < 1.1; }
}

const ICO = makeIcosahedron();

const DEFAULT_PARAMS = {
  // Icosahedron
  icoX: 0.36,
  icoY: 0.50,
  icoScale: 0.11,
  icoRotSpeedY: 0.15,
  icoRotSpeedX: 0.08,
  icoRotSpeedZ: 0.05,
  icoBrightness: 0.7,
  icoBloom: 0.25,

  // Beam
  beamWidth: 0.055,
  beamRays: 6,
  beamSpeed: 0.010,
  beamGlow: 3,
  beamBrightness: 0.45,

  // Wave field
  waveFreq1: 34.0,
  waveFreq2: 26.0,
  waveSpeed: 1.0,
  waveSecondary: 0.30,
  ySquash: 0.45,

  // Spectral
  spectralSpread: 1.0,
  hueStart: 275,
  hueEnd: 0,
  colorIntensity: 0.35,
  peakBoost: 0.15,

  // Global
  phaseStep: 0.08,
  speed: 1.0,
  falloff: 0.50,
  greyMin: 0.05,
  greyMax: 0.32,
  particleCount: 200,
  fontSize: 11,
  transitionWidth: 0.08,

  // Halo
  showHalo: true,
  haloPadX: 3,
  haloPadY: 1,
  haloFadeX: 10,
  haloFadeY: 4,

  titleText: "P R I S M",
  subText: "─── spectrum cli ───",
};

export default function PrismHybrid() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);
  const particlesRef = useRef([]);
  const spawnAccRef = useRef(0);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showControls, setShowControls] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  const updateParam = (key, value) => setParams(p => ({ ...p, [key]: value }));
  const bg = [10, 9, 16];

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const size = params.fontSize;
    const [bgR, bgG, bgB] = bg;

    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, w, h);

    const fontFamily = '"Cascadia Code","JetBrains Mono","Fira Code","SF Mono",monospace';
    ctx.font = `${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    const charW = size * 0.6;
    const charH = size * 1.2;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);
    const aspect = (charW / charH); // char aspect for Y correction

    phaseRef.current += params.phaseStep * params.speed;
    const phase = phaseRef.current;
    const numChars = CHARS.length;

    // ── Project icosahedron ──
    const icoX = params.icoX, icoY = params.icoY;
    const scale = params.icoScale;

    // Rotate all vertices
    const projected = ICO.verts.map(v => {
      let r = v;
      r = rotateY(r, phase * params.icoRotSpeedY);
      r = rotateX(r, phase * params.icoRotSpeedX + 0.3); // slight tilt
      r = rotateZ(r, phase * params.icoRotSpeedZ);

      // Perspective projection (weak perspective)
      const perspDist = 3.5;
      const pFactor = perspDist / (perspDist + r[2]);

      // Project to normalized screen coords, correct for character aspect ratio
      const sx = icoX + r[0] * scale * pFactor;
      const sy = icoY + r[1] * scale * pFactor / aspect;

      return { x: sx, y: sy, z: r[2], pf: pFactor };
    });

    // Entry and exit points for beam/wave
    const entryX = icoX - scale * 0.9;
    const entryY = icoY;
    const exitX = icoX + scale * 0.9;
    const exitY = icoY;

    // ── Build icosahedron edge segments for distance testing ──
    // Each edge: two projected endpoints + average depth for brightness
    const icoEdges = ICO.edges.map(([i, j]) => ({
      ax: projected[i].x, ay: projected[i].y,
      bx: projected[j].x, by: projected[j].y,
      depth: (projected[i].z + projected[j].z) / 2,
      frontFactor: (projected[i].pf + projected[j].pf) / 2,
    }));

    // ── Update beam particles ──
    const particles = particlesRef.current;
    const dt = params.speed;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(dt);
      if (!particles[i].alive()) particles.splice(i, 1);
    }

    // ── Spawn beam particles (straight, no sweep) ──
    spawnAccRef.current += params.particleCount * 0.12 * dt;
    while (spawnAccRef.current >= 1 && particles.length < params.particleCount * 2) {
      spawnAccRef.current -= 1;

      for (let r = 0; r < params.beamRays; r++) {
        const rayOff = (r / Math.max(1, params.beamRays - 1) - 0.5) * params.beamWidth;
        const sx = -0.03 + Math.random() * 0.02;
        const sy = entryY + rayOff + (Math.random() - 0.5) * 0.008;

        const dx = entryX - sx;
        const dy = (entryY + rayOff * 0.15) - sy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const spd = params.beamSpeed * (0.8 + Math.random() * 0.4);

        particles.push(new BeamParticle(
          sx, sy,
          (dx / len) * spd, (dy / len) * spd,
          0.3 + Math.random() * 0.7,
          len / spd * 1.2,
        ));
      }
    }

    // ── Build beam light grid ──
    const beamGrid = new Float32Array(rows * cols);
    const glowR = params.beamGlow;

    for (const p of particles) {
      const lifeRatio = p.life / p.maxLife;
      const fade = Math.min(1, (1 - lifeRatio) * 5) * Math.min(1, lifeRatio * 4) * p.brightness * params.beamBrightness;
      const cx = Math.floor(p.x * cols);
      const cy = Math.floor(p.y * rows);

      for (let dy = -glowR; dy <= glowR; dy++) {
        const gy = cy + dy;
        if (gy < 0 || gy >= rows) continue;
        for (let dx = -glowR; dx <= glowR; dx++) {
          const gx = cx + dx;
          if (gx < 0 || gx >= cols) continue;
          const dist = Math.sqrt(dx * dx + (dy * 1.6) * (dy * 1.6) / 3);
          if (dist > glowR) continue;
          beamGrid[gy * cols + gx] += fade * Math.pow(Math.max(0, 1 - dist / glowR), 1.4);
        }
      }
    }

    // ── Distance to line segment ──
    function distToSeg(px, py, ax, ay, bx, by) {
      const ddx = bx - ax, ddy = by - ay;
      const lenSq = ddx * ddx + ddy * ddy;
      if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
      const t = Math.max(0, Math.min(1, ((px - ax) * ddx + (py - ay) * ddy) / lenSq));
      return Math.sqrt((px - (ax + t * ddx)) ** 2 + (py - (ay + t * ddy)) ** 2);
    }

    // ── Title halo ──
    const titleText = params.titleText;
    const subText = params.subText;
    const centerRow = Math.floor(rows / 2);
    const titleRow = centerRow - 1;
    const subRow = centerRow + 1;
    const titleColStart = Math.floor((cols - titleText.length) / 2);
    const subColStart = Math.floor((cols - subText.length) / 2);

    let hR0 = 0, hR1 = 0, hC0 = 0, hC1 = 0;
    if (params.showHalo) {
      hR0 = Infinity; hR1 = -Infinity; hC0 = Infinity; hC1 = -Infinity;
      for (const o of [
        { row: titleRow, cs: titleColStart, len: titleText.length },
        { row: subRow, cs: subColStart, len: subText.length },
      ]) {
        hR0 = Math.min(hR0, o.row); hR1 = Math.max(hR1, o.row);
        hC0 = Math.min(hC0, o.cs); hC1 = Math.max(hC1, o.cs + o.len - 1);
      }
    }

    // ── Render every cell ──
    for (let row = 0; row < rows; row++) {
      const ny = row / rows;
      for (let col = 0; col < cols; col++) {
        const nx = col / cols;

        // ── Icosahedron wireframe glow ──
        let icoGlow = 0;
        let icoBloom = 0;
        for (const edge of icoEdges) {
          const d = distToSeg(nx, ny, edge.ax, edge.ay, edge.bx, edge.by);
          // Brightness based on depth: front edges brighter, back dimmer
          const depthBright = 0.3 + 0.7 * edge.frontFactor;
          const bright = depthBright * params.icoBrightness;
          icoGlow = Math.max(icoGlow, Math.max(0, 1.0 - d * 180) * bright * 0.5);
          icoBloom = Math.max(icoBloom, Math.max(0, 1.0 - d * 40) * bright * params.icoBloom * 0.3);
        }
        const totalIco = icoGlow + icoBloom;

        // Transition blend
        const transNorm = (nx - exitX) / Math.max(0.001, params.transitionWidth);
        const waveMix = Math.max(0, Math.min(1, transNorm));
        const beamMix = 1.0 - waveMix;

        // ── Wave field (right side) ──
        let waveR = 0, waveG = 0, waveB = 0, waveDensity = 0;

        if (waveMix > 0) {
          const wdx = nx - exitX;
          const wdy = (ny - exitY) * params.ySquash;
          const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
          const wave1 = Math.sin(wDist * params.waveFreq1 - phase * params.waveSpeed) * 0.5 + 0.5;

          const wdx2 = nx - (exitX + 0.15);
          const wdy2 = (ny - exitY) * params.ySquash;
          const wDist2 = Math.sqrt(wdx2 * wdx2 + wdy2 * wdy2);
          const wave2 = Math.sin(wDist2 * params.waveFreq2 - phase * params.waveSpeed * 0.7) * 0.5 + 0.5;

          const combined = wave1 * (1.0 - params.waveSecondary) + wave2 * params.waveSecondary;
          const falloff = Math.max(0.10, 1.0 - wDist * params.falloff);
          waveDensity = combined * falloff;

          const angle = Math.atan2(ny - exitY, nx - exitX);
          const normalizedAngle = (angle / Math.PI) * params.spectralSpread;
          const hueT = normalizedAngle * 0.5 + 0.5;
          const hue = params.hueStart + hueT * (params.hueEnd - params.hueStart);
          const [sr, sg, sb] = hslToRgb(hue, 55, 50);

          const grey = params.greyMin + waveDensity * (params.greyMax - params.greyMin);
          const colorAmt = waveDensity * params.colorIntensity + Math.pow(waveDensity, 3) * params.peakBoost;

          waveR = bgR + grey * 255 + (sr - 128) * colorAmt;
          waveG = bgG + grey * 255 + (sg - 128) * colorAmt;
          waveB = bgB + grey * 255 + (sb - 128) * colorAmt;
        }

        // ── Beam (left side) ──
        let beamLR = bgR, beamLG = bgG, beamLB = bgB;
        let beamDensity = 0;

        if (beamMix > 0) {
          const bVal = beamGrid[row * cols + col];
          if (bVal > 0.01) {
            beamDensity = Math.min(1.0, bVal);
            const grey = params.greyMin + beamDensity * (params.greyMax - params.greyMin);
            beamLR = bgR + grey * 255 + (175 - 128) * beamDensity * 0.3;
            beamLG = bgG + grey * 255 + (172 - 128) * beamDensity * 0.3;
            beamLB = bgB + grey * 255 + (195 - 128) * beamDensity * 0.3;
          } else {
            const adx = nx - entryX;
            const ady = (ny - icoY) * params.ySquash;
            const aDist = Math.sqrt(adx * adx + ady * ady);
            const ambientWave = (Math.sin(aDist * 20 - phase * 0.4) * 0.5 + 0.5);
            const ambientDensity = ambientWave * 0.25 * Math.max(0.1, 1.0 - aDist * 0.8);
            beamDensity = ambientDensity;
            const grey = params.greyMin + ambientDensity * (params.greyMax - params.greyMin) * 0.5;
            beamLR = bgR + grey * 160;
            beamLG = bgG + grey * 160;
            beamLB = bgB + grey * 170;
          }
        }

        // ── Blend ──
        const density = beamDensity * beamMix + waveDensity * waveMix;
        let finalR = beamLR * beamMix + waveR * waveMix;
        let finalG = beamLG * beamMix + waveG * waveMix;
        let finalB = beamLB * beamMix + waveB * waveMix;

        // Add icosahedron glow (purple-tinted glass)
        finalR += totalIco * 95;
        finalG += totalIco * 85;
        finalB += totalIco * 165;

        // ── Halo ──
        let haloMask = 1.0;
        if (params.showHalo) {
          const { haloPadX: px, haloPadY: py, haloFadeX: fx, haloFadeY: fy } = params;
          let ddx = 0, ddy = 0;
          if (col < hC0 - px) ddx = (hC0 - px - col) / fx;
          else if (col > hC1 + px) ddx = (col - hC1 - px) / fx;
          if (row < hR0 - py) ddy = (hR0 - py - row) / fy;
          else if (row > hR1 + py) ddy = (row - hR1 - py) / fy;
          const hd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (hd < 1.0) haloMask = hd;
        }

        let charIdx = Math.floor(density * numChars);
        charIdx = Math.max(0, Math.min(numChars - 1, charIdx));
        if (haloMask < 1.0) charIdx = Math.max(0, Math.round(charIdx * haloMask));

        const oR = Math.round(Math.min(255, Math.max(0, finalR * haloMask + bgR * (1 - haloMask))));
        const oG = Math.round(Math.min(255, Math.max(0, finalG * haloMask + bgG * (1 - haloMask))));
        const oB = Math.round(Math.min(255, Math.max(0, finalB * haloMask + bgB * (1 - haloMask))));

        ctx.fillStyle = `rgb(${oR},${oG},${oB})`;
        ctx.fillText(CHARS[charIdx], col * charW, row * charH);
      }
    }

    // ── Icosahedron wireframe characters (overdraw) ──
    // Draw edges as ASCII line characters, depth-sorted
    ctx.font = `${size}px ${fontFamily}`;

    // Sort edges back-to-front so front edges draw on top
    const sortedEdges = [...icoEdges].sort((a, b) => a.depth - b.depth);

    for (const edge of sortedEdges) {
      const depthBright = 0.3 + 0.7 * edge.frontFactor;
      const bright = Math.round(depthBright * params.icoBrightness * 85);

      const edgeDx = edge.bx - edge.ax;
      const edgeDy = edge.by - edge.ay;
      const angle = Math.atan2(edgeDy, edgeDx);
      const a = ((angle % Math.PI) + Math.PI) % Math.PI;
      let ch;
      if (a < 0.35 || a > 2.79) ch = "─";
      else if (a > 1.2 && a < 1.95) ch = "│";
      else if (a >= 0.35 && a <= 1.2) ch = "╲";
      else ch = "╱";

      const steps = Math.ceil(Math.max(Math.abs(edgeDx) * cols, Math.abs(edgeDy) * rows) * 2);
      ctx.fillStyle = `rgb(${bgR + bright},${bgG + Math.round(bright * 0.9)},${bgB + Math.round(bright * 1.5)})`;

      for (let i = 0; i <= steps; i++) {
        const t = i / Math.max(1, steps);
        const ec = Math.floor((edge.ax + edgeDx * t) * cols);
        const er = Math.floor((edge.ay + edgeDy * t) * rows);
        if (ec >= 0 && ec < cols && er >= 0 && er < rows) {
          ctx.fillText(ch, ec * charW, er * charH);
        }
      }
    }

    // Vertex dots — front ones brighter
    for (const v of projected) {
      const depthBright = 0.3 + 0.7 * v.pf;
      const bright = Math.round(depthBright * params.icoBrightness * 100);
      ctx.fillStyle = `rgb(${bgR + bright},${bgG + Math.round(bright * 0.9)},${bgB + Math.round(bright * 1.6)})`;
      const vc = Math.floor(v.x * cols);
      const vr = Math.floor(v.y * rows);
      if (vc >= 0 && vc < cols && vr >= 0 && vr < rows) {
        ctx.fillText("◆", vc * charW, vr * charH);
      }
    }

    // ── Title ──
    ctx.font = `bold ${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    for (let i = 0; i < titleText.length; i++) {
      const col = titleColStart + i;
      if (col < 0 || col >= cols) continue;
      const t = i / Math.max(1, titleText.length - 1);
      const hue = params.hueStart + t * (params.hueEnd - params.hueStart);
      const [sr, sg, sb] = hslToRgb(hue, 18, 80);
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      ctx.fillText(titleText[i], col * charW, titleRow * charH);
    }

    ctx.fillStyle = `rgb(${bgR + 42},${bgG + 40},${bgB + 50})`;
    for (let i = 0; i < subText.length; i++) {
      const col = subColStart + i;
      if (col >= 0 && col < cols) ctx.fillText(subText[i], col * charW, subRow * charH);
    }

    // FPS
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastTimeRef.current > 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    animRef.current = requestAnimationFrame(renderFrame);
  }, [params]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [renderFrame]);

  const Slider = ({ label, param, min, max, step }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-right opacity-60 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step}
        value={params[param]} onChange={e => updateParam(param, parseFloat(e.target.value))}
        className="flex-1 h-1" style={{ accentColor: "#6a5a8a" }} />
      <span className="w-12 text-right font-mono opacity-40">{Number(params[param]).toFixed(2)}</span>
    </div>
  );

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: "#030308" }}>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: "rgba(0,0,0,0.6)", color: "#3a3a50" }}>{fps} fps</div>
        <button onClick={() => setShowControls(!showControls)}
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs cursor-pointer"
          style={{ background: "rgba(0,0,0,0.6)", color: "#666", border: "1px solid #1a1a28" }}>
          {showControls ? "▼ Hide" : "▶ Tune"}
        </button>
      </div>

      {showControls && (
        <div className="shrink-0 p-3 space-y-3 overflow-y-auto"
          style={{ background: "#08080f", color: "#888", maxHeight: "55vh", borderTop: "1px solid #1a1a28" }}>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Icosahedron</div>
              <Slider label="X" param="icoX" min={0.2} max={0.5} step={0.01} />
              <Slider label="Y" param="icoY" min={0.3} max={0.7} step={0.01} />
              <Slider label="scale" param="icoScale" min={0.04} max={0.25} step={0.005} />
              <Slider label="rot Y spd" param="icoRotSpeedY" min={0} max={0.5} step={0.01} />
              <Slider label="rot X spd" param="icoRotSpeedX" min={0} max={0.5} step={0.01} />
              <Slider label="rot Z spd" param="icoRotSpeedZ" min={0} max={0.5} step={0.01} />
              <Slider label="brightness" param="icoBrightness" min={0.1} max={1.5} step={0.05} />
              <Slider label="bloom" param="icoBloom" min={0} max={1} step={0.05} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">White Beam</div>
              <Slider label="width" param="beamWidth" min={0.01} max={0.12} step={0.005} />
              <Slider label="rays" param="beamRays" min={1} max={12} step={1} />
              <Slider label="speed" param="beamSpeed" min={0.003} max={0.02} step={0.001} />
              <Slider label="glow" param="beamGlow" min={1} max={6} step={1} />
              <Slider label="brightness" param="beamBrightness" min={0.1} max={0.8} step={0.05} />
              <Slider label="particles" param="particleCount" min={50} max={500} step={10} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Wave Field</div>
              <Slider label="freq 1" param="waveFreq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="waveFreq2" min={10} max={60} step={0.5} />
              <Slider label="wave speed" param="waveSpeed" min={0.3} max={2.5} step={0.05} />
              <Slider label="secondary" param="waveSecondary" min={0} max={0.6} step={0.05} />
              <Slider label="falloff" param="falloff" min={0} max={1.5} step={0.05} />
              <Slider label="transition" param="transitionWidth" min={0.02} max={0.2} step={0.01} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Spectral Color</div>
              <Slider label="spread" param="spectralSpread" min={0.3} max={2.0} step={0.05} />
              <Slider label="hue top" param="hueStart" min={200} max={320} step={5} />
              <Slider label="hue bottom" param="hueEnd" min={-20} max={60} step={5} />
              <Slider label="intensity" param="colorIntensity" min={0.05} max={0.7} step={0.05} />
              <Slider label="peak boost" param="peakBoost" min={0} max={0.4} step={0.02} />
              <Slider label="grey min" param="greyMin" min={0.02} max={0.15} step={0.005} />
              <Slider label="grey max" param="greyMax" min={0.15} max={0.5} step={0.01} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Global</div>
              <Slider label="anim speed" param="phaseStep" min={0.02} max={0.2} step={0.005} />
              <Slider label="speed mult" param="speed" min={0.3} max={3} step={0.1} />
              <Slider label="y squash" param="ySquash" min={0.1} max={1} step={0.01} />
              <Slider label="font size" param="fontSize" min={6} max={16} step={1} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold opacity-35">Halo</div>
                <button onClick={() => updateParam("showHalo", !params.showHalo)}
                  className="px-2 py-0.5 rounded text-xs cursor-pointer"
                  style={{
                    background: params.showHalo ? "#18162a" : "#0a0a12",
                    color: params.showHalo ? "#7868a0" : "#444",
                    border: `1px solid ${params.showHalo ? "#2e2848" : "#151520"}`,
                  }}>{params.showHalo ? "ON" : "OFF"}</button>
              </div>
              <Slider label="pad X" param="haloPadX" min={0} max={15} step={1} />
              <Slider label="pad Y" param="haloPadY" min={0} max={8} step={1} />
              <Slider label="fade X" param="haloFadeX" min={1} max={30} step={1} />
              <Slider label="fade Y" param="haloFadeY" min={1} max={15} step={1} />
            </div>
          </div>

          {/* Spectrum preview */}
          <div className="p-2.5 rounded" style={{ background: "#0c0c15" }}>
            <div className="text-xs font-semibold opacity-35 mb-2">Spectral Fan</div>
            <div className="h-3 rounded overflow-hidden flex">
              {Array.from({ length: 40 }, (_, i) => {
                const t = i / 39;
                const hue = params.hueStart + t * (params.hueEnd - params.hueStart);
                const [r, g, b] = hslToRgb(hue, 55, 50);
                return <div key={i} className="flex-1" style={{ background: `rgb(${r},${g},${b})` }} />;
              })}
            </div>
          </div>

          <button onClick={() => setParams(DEFAULT_PARAMS)}
            className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
            style={{ background: "#0e0e18", color: "#444", border: "1px solid #1a1a28" }}>
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  );
}
