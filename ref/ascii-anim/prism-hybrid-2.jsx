import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────
// Prism Hybrid
//
// LEFT: White light particles stream in, converging
// toward a triangular prism at center.
//
// RIGHT: Low-contrast ASCII wave field fans outward
// from the prism exit face, colored with spectral
// hues — violet at steep up-angles, green at center,
// red at steep down-angles. Same density ramp and
// ultra-low contrast as the original wave field.
//
// The prism is the boundary between two rendering
// systems that blend together at the transition zone.
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

// ─── Beam particle ───
class BeamParticle {
  constructor(x, y, vx, vy, brightness, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.brightness = brightness;
    this.life = life;
    this.maxLife = life;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  alive() { return this.life > 0 && this.x < 1.1; }
}

const DEFAULT_PARAMS = {
  // Prism position
  prismX: 0.36,
  prismY: 0.50,
  prismSize: 0.13,

  // Beam (left side)
  beamWidth: 0.055,
  beamRays: 6,
  beamSpeed: 0.010,
  beamGlow: 3,
  beamBrightness: 0.45,
  beamColor: [175, 172, 195], // slightly cool white
  beamSweepSpeed: 0.12,       // how fast the beam angle oscillates
  beamSweepAngle: 0.75,       // max sweep angle in radians (~43°)

  // Wave field (right side)
  waveFreq1: 34.0,
  waveFreq2: 26.0,
  waveSpeed: 1.0,
  waveSecondary: 0.30,
  ySquash: 0.45,

  // Spectral
  spectralSpread: 1.0,   // how wide the color fan is
  hueStart: 275,         // violet at top
  hueEnd: 0,             // red at bottom
  colorIntensity: 0.35,  // how much color tints the grey
  peakBoost: 0.15,       // extra color at wave crests

  // Global
  phaseStep: 0.08,
  speed: 1.0,
  falloff: 0.50,
  greyMin: 0.05,
  greyMax: 0.32,
  particleCount: 200,
  fontSize: 11,

  // Transition zone — how the beam and wave blend near the prism
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

  // Background color
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

    phaseRef.current += params.phaseStep * params.speed;
    const phase = phaseRef.current;
    const numChars = CHARS.length;

    // ── Prism geometry ──
    const pcx = params.prismX, pcy = params.prismY, ps = params.prismSize;
    const prismVerts = [
      { x: pcx - ps * 0.65, y: pcy },            // left vertex (entry face)
      { x: pcx + ps * 0.35, y: pcy - ps * 0.9 }, // top-right
      { x: pcx + ps * 0.35, y: pcy + ps * 0.9 }, // bottom-right
    ];
    // Right face midpoint (exit)
    const exitX = pcx + ps * 0.35;
    const exitY = pcy;
    // Left vertex (entry)
    const entryX = pcx - ps * 0.65;
    const entryY = pcy;

    // ── Update beam particles ──
    const particles = particlesRef.current;
    const dt = params.speed;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(dt);
      if (!particles[i].alive()) particles.splice(i, 1);
    }

    // ── Spawn beam particles ──
    // Beam sweeps: source position oscillates vertically,
    // always aimed at the fixed prism entry point
    const sweepAngle = Math.sin(phase * params.beamSweepSpeed) * params.beamSweepAngle
      + Math.sin(phase * params.beamSweepSpeed * 0.37) * params.beamSweepAngle * 0.2;

    // Source Y moves based on sweep — anchored at prism entry, sweeping the far left end
    const beamLength = entryX + 0.03; // distance from left edge to prism
    const sourceY = entryY - Math.sin(sweepAngle) * beamLength;

    spawnAccRef.current += params.particleCount * 0.12 * dt;
    while (spawnAccRef.current >= 1 && particles.length < params.particleCount * 2) {
      spawnAccRef.current -= 1;

      for (let r = 0; r < params.beamRays; r++) {
        const rayOff = (r / Math.max(1, params.beamRays - 1) - 0.5) * params.beamWidth;

        // Spawn at left edge, Y position determined by sweep
        const sx = -0.03 + Math.random() * 0.02;
        const sy = sourceY + rayOff + (Math.random() - 0.5) * 0.008;

        // Always aim at the fixed prism entry point
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

    // ── Build beam light grid (left side only) ──
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
          const falloff = Math.pow(Math.max(0, 1 - dist / glowR), 1.4);
          beamGrid[gy * cols + gx] += fade * falloff;
        }
      }
    }

    // ── Prism edge distances (for ghostly outline) ──
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

        // How far right of the prism exit face is this cell? (0 = at prism, 1 = right edge)
        const rightOfPrism = (nx - exitX) / (1.0 - exitX);
        // How far left of the prism entry is this cell? (0 = at prism, 1 = left edge)
        const leftOfPrism = (entryX - nx) / entryX;

        // Transition blend factor: 0 = full beam, 1 = full wave field
        const transNorm = (nx - exitX) / Math.max(0.001, params.transitionWidth);
        const waveMix = Math.max(0, Math.min(1, transNorm));
        const beamMix = 1.0 - waveMix;

        // ────── WAVE FIELD (right side) ──────
        let waveR = 0, waveG = 0, waveB = 0, waveDensity = 0;

        if (waveMix > 0) {
          // Wave emanates from the prism exit point
          const wdx = nx - exitX;
          const wdy = (ny - exitY) * params.ySquash;
          const wDist = Math.sqrt(wdx * wdx + wdy * wdy);

          // Primary wave
          const wave1 = Math.sin(wDist * params.waveFreq1 - phase * params.waveSpeed) * 0.5 + 0.5;

          // Secondary wave from a slightly offset point
          const wdx2 = nx - (exitX + 0.15);
          const wdy2 = (ny - exitY) * params.ySquash;
          const wDist2 = Math.sqrt(wdx2 * wdx2 + wdy2 * wdy2);
          const wave2 = Math.sin(wDist2 * params.waveFreq2 - phase * params.waveSpeed * 0.7) * 0.5 + 0.5;

          const combined = wave1 * (1.0 - params.waveSecondary) + wave2 * params.waveSecondary;

          // Falloff from exit point
          const falloff = Math.max(0.10, 1.0 - wDist * params.falloff);

          waveDensity = combined * falloff;

          // ── Spectral hue from angle ──
          // Angle from the exit point determines color
          const angle = Math.atan2(ny - exitY, nx - exitX); // -π to π
          // Map angle to spectrum: top = violet, center = green, bottom = red
          const normalizedAngle = (angle / Math.PI) * params.spectralSpread; // -1 to 1
          const hueT = normalizedAngle * 0.5 + 0.5; // 0 to 1
          const hue = params.hueStart + hueT * (params.hueEnd - params.hueStart);
          const [sr, sg, sb] = hslToRgb(hue, 55, 50);

          // Base grey
          const grey = params.greyMin + waveDensity * (params.greyMax - params.greyMin);

          // Tint amount scales with density — color only visible at crests
          const colorAmt = waveDensity * params.colorIntensity + Math.pow(waveDensity, 3) * params.peakBoost;

          waveR = bgR + grey * 255 + (sr - 128) * colorAmt;
          waveG = bgG + grey * 255 + (sg - 128) * colorAmt;
          waveB = bgB + grey * 255 + (sb - 128) * colorAmt;
        }

        // ────── BEAM (left side) ──────
        let beamR = bgR, beamG = bgG, beamB = bgB;
        let beamDensity = 0;

        if (beamMix > 0) {
          const bVal = beamGrid[row * cols + col];

          if (bVal > 0.01) {
            beamDensity = Math.min(1.0, bVal);
            // Beam is cool-white with very subtle warmth in the core
            const [bcR, bcG, bcB] = params.beamColor;
            const grey = params.greyMin + beamDensity * (params.greyMax - params.greyMin);
            beamR = bgR + grey * 255 + (bcR - 128) * beamDensity * 0.3;
            beamG = bgG + grey * 255 + (bcG - 128) * beamDensity * 0.3;
            beamB = bgB + grey * 255 + (bcB - 128) * beamDensity * 0.3;
          } else {
            // Empty beam area — faint ambient wave tracks the beam sweep
            const adx = nx - entryX;
            const ady = (ny - sourceY) * params.ySquash; // track sweep source
            const aDist = Math.sqrt(adx * adx + ady * ady);
            const ambientWave = (Math.sin(aDist * 20 - phase * 0.4) * 0.5 + 0.5);
            const ambientDensity = ambientWave * 0.25 * Math.max(0.1, 1.0 - aDist * 0.8);
            beamDensity = ambientDensity;
            const grey = params.greyMin + ambientDensity * (params.greyMax - params.greyMin) * 0.5;
            beamR = bgR + grey * 160;
            beamG = bgG + grey * 160;
            beamB = bgB + grey * 170;
          }
        }

        // ────── BLEND beam and wave ──────
        const density = beamDensity * beamMix + waveDensity * waveMix;
        let finalR = beamR * beamMix + waveR * waveMix;
        let finalG = beamG * beamMix + waveG * waveMix;
        let finalB = beamB * beamMix + waveB * waveMix;

        // Default for cells with no contribution
        if (beamMix > 0 && waveMix <= 0 && beamDensity < 0.01) {
          // Left-side ambient area
        }
        if (waveMix > 0 && beamMix <= 0 && waveDensity < 0.01) {
          finalR = bgR; finalG = bgG; finalB = bgB;
        }

        // ── Prism ghost edge glow ──
        let prismGlow = 0;
        for (let e = 0; e < 3; e++) {
          const a = prismVerts[e];
          const bv = prismVerts[(e + 1) % 3];
          const d = distToSeg(nx, ny, a.x, a.y, bv.x, bv.y);
          prismGlow = Math.max(prismGlow, Math.max(0, 1.0 - d * 70) * 0.08);
        }
        finalR += prismGlow * 100;
        finalG += prismGlow * 80;
        finalB += prismGlow * 130;

        // ── Halo mask ──
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

        // ── Character ──
        let charIdx = Math.floor(density * numChars);
        charIdx = Math.max(0, Math.min(numChars - 1, charIdx));
        if (haloMask < 1.0) charIdx = Math.max(0, Math.round(charIdx * haloMask));

        // ── Final output ──
        const oR = Math.round(Math.min(255, Math.max(0, finalR * haloMask + bgR * (1 - haloMask))));
        const oG = Math.round(Math.min(255, Math.max(0, finalG * haloMask + bgG * (1 - haloMask))));
        const oB = Math.round(Math.min(255, Math.max(0, finalB * haloMask + bgB * (1 - haloMask))));

        ctx.fillStyle = `rgb(${oR},${oG},${oB})`;
        ctx.fillText(CHARS[charIdx], col * charW, row * charH);
      }
    }

    // ── Title ──
    ctx.font = `bold ${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    // Title letters pick up a spectral gradient
    for (let i = 0; i < titleText.length; i++) {
      const col = titleColStart + i;
      if (col < 0 || col >= cols) continue;
      const t = i / Math.max(1, titleText.length - 1);
      // Gentle spectral tint across title: violet → white → red
      const hue = params.hueStart + t * (params.hueEnd - params.hueStart);
      const [sr, sg, sb] = hslToRgb(hue, 18, 80);
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      ctx.fillText(titleText[i], col * charW, titleRow * charH);
    }

    // Subtitle
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
            {/* Prism */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Prism</div>
              <Slider label="X" param="prismX" min={0.2} max={0.5} step={0.01} />
              <Slider label="Y" param="prismY" min={0.3} max={0.7} step={0.01} />
              <Slider label="size" param="prismSize" min={0.06} max={0.25} step={0.01} />
              <Slider label="transition" param="transitionWidth" min={0.02} max={0.2} step={0.01} />
            </div>

            {/* Beam */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">White Beam (Left)</div>
              <Slider label="width" param="beamWidth" min={0.01} max={0.12} step={0.005} />
              <Slider label="rays" param="beamRays" min={1} max={12} step={1} />
              <Slider label="speed" param="beamSpeed" min={0.003} max={0.02} step={0.001} />
              <Slider label="glow" param="beamGlow" min={1} max={6} step={1} />
              <Slider label="brightness" param="beamBrightness" min={0.1} max={0.8} step={0.05} />
              <Slider label="particles" param="particleCount" min={50} max={500} step={10} />
              <Slider label="sweep speed" param="beamSweepSpeed" min={0.02} max={0.35} step={0.01} />
              <Slider label="sweep angle" param="beamSweepAngle" min={0.1} max={1.3} step={0.05} />
            </div>

            {/* Wave field */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Wave Field (Right)</div>
              <Slider label="freq 1" param="waveFreq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="waveFreq2" min={10} max={60} step={0.5} />
              <Slider label="wave speed" param="waveSpeed" min={0.3} max={2.5} step={0.05} />
              <Slider label="secondary" param="waveSecondary" min={0} max={0.6} step={0.05} />
              <Slider label="falloff" param="falloff" min={0} max={1.5} step={0.05} />
            </div>

            {/* Color */}
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

            {/* Global */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Global</div>
              <Slider label="anim speed" param="phaseStep" min={0.02} max={0.2} step={0.005} />
              <Slider label="speed mult" param="speed" min={0.3} max={3} step={0.1} />
              <Slider label="y squash" param="ySquash" min={0.1} max={1} step={0.01} />
              <Slider label="font size" param="fontSize" min={6} max={16} step={1} />
            </div>

            {/* Halo */}
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
            <div className="flex justify-between text-xs opacity-25 mt-1 font-mono">
              <span>↑ {params.hueStart}° (top)</span>
              <span>↓ {params.hueEnd}° (bottom)</span>
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
