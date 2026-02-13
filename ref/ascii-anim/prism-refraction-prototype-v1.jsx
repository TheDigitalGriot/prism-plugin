import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────
// Prism Light Refraction — a structurally different
// animation from the wave effect. Light particles flow
// from left → hit a triangular prism → split into
// diverging spectral bands that fan out to the right.
// ─────────────────────────────────────────────────────

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
  return `rgb(${Math.round((r+m)*255)},${Math.round((g+m)*255)},${Math.round((b+m)*255)})`;
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

// Spectral bands — each is a separate ray that refracts at a different angle
const SPECTRUM = [
  { hue: 275, name: "violet",  angle:  0.38 },
  { hue: 240, name: "blue",    angle:  0.25 },
  { hue: 195, name: "cyan",    angle:  0.13 },
  { hue: 130, name: "green",   angle:  0.00 },
  { hue:  55, name: "yellow",  angle: -0.12 },
  { hue:  30, name: "orange",  angle: -0.24 },
  { hue:   5, name: "red",     angle: -0.36 },
];

// Density characters for particle brightness
const BRIGHT_CHARS = ["·", ":", "+", "*", "#", "%", "@", "█"];
const DIM_CHARS = [" ", ".", "·", ":", "-"];

const PRESETS = {
  classic: {
    name: "Classic Prism",
    bg: [10, 8, 16],
    beamColor: [200, 195, 210],     // slightly warm white
    prismColor: [35, 30, 50],       // dim crystal outline
    prismFill: [18, 15, 28],        // inside the prism
    saturation: 70,
    lightness: 52,
    particleCount: 280,
    beamWidth: 0.06,
    spectralSpread: 1.0,
    glowStrength: 0.6,
  },
  crystal: {
    name: "Dark Crystal",
    bg: [6, 6, 12],
    beamColor: [170, 170, 200],
    prismColor: [25, 25, 45],
    prismFill: [12, 12, 22],
    saturation: 55,
    lightness: 45,
    particleCount: 200,
    beamWidth: 0.04,
    spectralSpread: 0.8,
    glowStrength: 0.4,
  },
  neon: {
    name: "Neon Glass",
    bg: [4, 4, 8],
    beamColor: [220, 220, 240],
    prismColor: [40, 35, 60],
    prismFill: [15, 12, 25],
    saturation: 85,
    lightness: 58,
    particleCount: 350,
    beamWidth: 0.07,
    spectralSpread: 1.3,
    glowStrength: 0.8,
  },
  subtle: {
    name: "Whisper",
    bg: [12, 11, 18],
    beamColor: [140, 135, 155],
    prismColor: [30, 28, 42],
    prismFill: [18, 16, 26],
    saturation: 40,
    lightness: 40,
    particleCount: 160,
    beamWidth: 0.05,
    spectralSpread: 0.7,
    glowStrength: 0.3,
  },
};

const DEFAULT_PARAMS = {
  speed: 1.0,
  prismX: 0.38,
  prismY: 0.50,
  prismSize: 0.18,
  beamWidth: 0.06,
  spectralSpread: 1.0,
  bandWidth: 0.025,
  particleCount: 280,
  particleSpeed: 0.008,
  trailLength: 0.12,
  glowStrength: 0.6,
  shimmer: 0.3,
  fontSize: 11,
  showPrism: true,
  showHalo: true,
  haloPadX: 3,
  haloPadY: 1,
  haloFadeX: 10,
  haloFadeY: 4,
  titleText: "P R I S M",
  subText: "─── spectrum cli ───",
};

// ─────────────────────────────────────────────────────
// Particle system
// ─────────────────────────────────────────────────────

class Particle {
  constructor(type, x, y, vx, vy, hue, life, brightness) {
    this.type = type;       // "beam" | "spectral"
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.hue = hue;
    this.life = life;
    this.maxLife = life;
    this.brightness = brightness;
    this.trail = [];
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  alive() { return this.life > 0 && this.x >= -0.1 && this.x <= 1.1 && this.y >= -0.1 && this.y <= 1.1; }
}

export default function PrismRefraction() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);
  const [preset, setPreset] = useState("classic");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showControls, setShowControls] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const lastSpawnRef = useRef(0);

  const pst = PRESETS[preset];
  const updateParam = (key, value) => setParams(p => ({ ...p, [key]: value }));

  // Sync preset changes to params
  useEffect(() => {
    setParams(p => ({
      ...p,
      beamWidth: pst.beamWidth,
      spectralSpread: pst.spectralSpread,
      glowStrength: pst.glowStrength,
      particleCount: pst.particleCount,
    }));
  }, [preset]);

  // Prism triangle vertices (normalized coordinates)
  const getPrismVerts = useCallback(() => {
    const cx = params.prismX;
    const cy = params.prismY;
    const s = params.prismSize;
    // Equilateral-ish triangle, pointing right
    return {
      top:    { x: cx + s * 0.15, y: cy - s },
      bottom: { x: cx + s * 0.15, y: cy + s },
      left:   { x: cx - s * 0.85, y: cy },
      // Right face midpoint (where light exits)
      rightMid: { x: cx + s * 0.15, y: cy },
    };
  }, [params.prismX, params.prismY, params.prismSize]);

  // Check if point is inside the prism triangle
  const isInsidePrism = useCallback((px, py) => {
    const v = getPrismVerts();
    const { top, bottom, left } = v;
    // Barycentric method
    const d1 = (px - bottom.x) * (left.y - bottom.y) - (left.x - bottom.x) * (py - bottom.y);
    const d2 = (px - left.x) * (top.y - left.y) - (top.x - left.x) * (py - left.y);
    const d3 = (px - top.x) * (bottom.y - top.y) - (bottom.x - top.x) * (py - top.y);
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  }, [getPrismVerts]);

  // Spawn particles
  const spawnParticles = useCallback(() => {
    const particles = particlesRef.current;
    const v = getPrismVerts();
    const now = timeRef.current;

    // Don't spawn too many
    if (particles.length > params.particleCount * 1.5) return;

    const spawnRate = params.particleCount * 0.15;
    if (now - lastSpawnRef.current < 1 / spawnRate) return;
    lastSpawnRef.current = now;

    // ── Incoming beam particles ──
    // Spawn from left edge, converging toward prism left vertex
    const beamTargetX = v.left.x;
    const beamTargetY = v.left.y;
    const spawnX = -0.02 + Math.random() * 0.01;
    const spreadY = params.beamWidth * (Math.random() - 0.5);
    const spawnY = beamTargetY + spreadY + (Math.random() - 0.5) * 0.02;

    // Direction toward prism entry point
    const dx = beamTargetX - spawnX;
    const dy = (beamTargetY + spreadY * 0.3) - spawnY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const speed = params.particleSpeed * (0.8 + Math.random() * 0.4);

    particles.push(new Particle(
      "beam", spawnX, spawnY,
      (dx / len) * speed, (dy / len) * speed,
      0, // white
      len / speed * 1.1, // life = enough to reach prism
      0.5 + Math.random() * 0.5,
    ));

    // ── Spectral particles ──
    // Spawn from the right face of the prism, each band at a different angle
    for (const band of SPECTRUM) {
      if (Math.random() > 0.4) continue; // stagger spawning

      const exitX = v.rightMid.x + (Math.random() - 0.5) * 0.01;
      const exitY = v.rightMid.y + (Math.random() - 0.5) * params.prismSize * 0.3;
      const angle = band.angle * params.spectralSpread;
      const sSpeed = speed * (0.7 + Math.random() * 0.5);
      const bandSpread = (Math.random() - 0.5) * params.bandWidth;

      particles.push(new Particle(
        "spectral", exitX, exitY,
        sSpeed * Math.cos(angle),
        sSpeed * Math.sin(angle) + bandSpread * sSpeed,
        band.hue,
        (1.0 - exitX) / sSpeed * 1.3,
        0.4 + Math.random() * 0.6,
      ));
    }
  }, [params, getPrismVerts]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const size = params.fontSize;
    const [bgR, bgG, bgB] = pst.bg;

    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, w, h);

    const fontFamily = '"Cascadia Code","JetBrains Mono","Fira Code","SF Mono","Consolas",monospace';
    ctx.font = `${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    const charW = size * 0.6;
    const charH = size * 1.2;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);

    const dt = params.speed;
    timeRef.current += dt * 0.016;

    // ── Update particles ──
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(dt);
      if (!particles[i].alive()) {
        particles.splice(i, 1);
      }
    }

    // ── Spawn new particles ──
    for (let s = 0; s < 3; s++) spawnParticles();

    // ── Build brightness + color grid ──
    // Each cell accumulates light from nearby particles
    const gridR = new Float32Array(rows * cols);
    const gridG = new Float32Array(rows * cols);
    const gridB = new Float32Array(rows * cols);
    const gridBright = new Float32Array(rows * cols);

    for (const p of particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      const fadeIn = Math.min(1, (1 - lifeRatio) * 5);   // quick fade-in at birth
      const fadeOut = Math.min(1, lifeRatio * 4);          // fade-out near death
      const fade = fadeIn * fadeOut * p.brightness;

      // Current position
      const points = [{ x: p.x, y: p.y, strength: 1.0 }];
      // Trail points with decreasing strength
      for (let t = 0; t < p.trail.length; t++) {
        const trailStrength = (t / p.trail.length) * params.trailLength;
        points.push({ x: p.trail[t].x, y: p.trail[t].y, strength: trailStrength });
      }

      for (const pt of points) {
        const cellX = Math.floor(pt.x * cols);
        const cellY = Math.floor(pt.y * rows);
        const radius = p.type === "beam" ? 2 : 2;
        const glow = params.glowStrength;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const gy = cellY + dy;
            const gx = cellX + dx;
            if (gy < 0 || gy >= rows || gx < 0 || gx >= cols) continue;

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius + 0.5) continue;
            const falloff = Math.max(0, 1 - dist / (radius + 0.5));
            const intensity = fade * pt.strength * falloff * glow;

            const idx = gy * cols + gx;
            gridBright[idx] += intensity;

            if (p.type === "beam") {
              const [br, bg2, bb] = pst.beamColor;
              gridR[idx] += (br / 255) * intensity;
              gridG[idx] += (bg2 / 255) * intensity;
              gridB[idx] += (bb / 255) * intensity;
            } else {
              // Spectral color
              const rgb = hslToRgb(p.hue, pst.saturation, pst.lightness);
              const match = rgb.match(/\d+/g).map(Number);
              gridR[idx] += (match[0] / 255) * intensity;
              gridG[idx] += (match[1] / 255) * intensity;
              gridB[idx] += (match[2] / 255) * intensity;
            }
          }
        }
      }
    }

    // ── Draw prism outline ──
    const v = getPrismVerts();
    if (params.showPrism) {
      // Rasterize triangle edges into the grid as dim characters
      const prismEdges = [
        [v.top, v.bottom],
        [v.bottom, v.left],
        [v.left, v.top],
      ];

      for (const [a, b] of prismEdges) {
        const steps = Math.max(Math.abs((b.x - a.x) * cols), Math.abs((b.y - a.y) * rows)) * 2;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = lerp(a.x, b.x, t);
          const py = lerp(a.y, b.y, t);
          const cx = Math.floor(px * cols);
          const cy = Math.floor(py * rows);
          if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
            const idx = cy * cols + cx;
            // Subtle prism edge glow
            const [pr, pg, pb] = pst.prismColor;
            gridR[idx] = Math.max(gridR[idx], pr / 255 * 0.5);
            gridG[idx] = Math.max(gridG[idx], pg / 255 * 0.5);
            gridB[idx] = Math.max(gridB[idx], pb / 255 * 0.5);
            gridBright[idx] = Math.max(gridBright[idx], 0.15);
          }
        }
      }
    }

    // ── Title overlay: compute halo mask ──
    const titleText = params.titleText;
    const subText = params.subText;
    const centerRow = Math.floor(rows / 2);
    const titleRow = centerRow - 1;
    const subRow = centerRow + 1;
    const titleColStart = Math.floor((cols - titleText.length) / 2);
    const subColStart = Math.floor((cols - subText.length) / 2);

    const haloMask = new Float32Array(rows * cols).fill(1.0);

    if (params.showHalo) {
      const overlays = [
        { row: titleRow, colStart: titleColStart, len: titleText.length },
        { row: subRow, colStart: subColStart, len: subText.length },
      ];
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      for (const od of overlays) {
        minR = Math.min(minR, od.row); maxR = Math.max(maxR, od.row);
        minC = Math.min(minC, od.colStart); maxC = Math.max(maxC, od.colStart + od.len - 1);
      }
      const { haloPadX: padX, haloPadY: padY, haloFadeX: fadeX, haloFadeY: fadeY } = params;

      for (let y = Math.max(0, minR - padY - fadeY); y <= Math.min(rows - 1, maxR + padY + fadeY); y++) {
        for (let x = Math.max(0, minC - padX - fadeX); x <= Math.min(cols - 1, maxC + padX + fadeX); x++) {
          let dx = 0, dy = 0;
          if (x < minC - padX) dx = (minC - padX - x) / fadeX;
          else if (x > maxC + padX) dx = (x - maxC - padX) / fadeX;
          if (y < minR - padY) dy = (minR - padY - y) / fadeY;
          else if (y > maxR + padY) dy = (y - maxR - padY) / fadeY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1.0) haloMask[y * cols + x] = dist;
        }
      }
    }

    // ── Render grid ──
    // Add subtle ambient shimmer
    const shimmerTime = timeRef.current * 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        let brightness = gridBright[idx] * haloMask[idx];

        // Tiny shimmer noise
        const shimmerVal = Math.sin(col * 3.7 + row * 2.3 + shimmerTime) * 0.5 + 0.5;
        brightness += shimmerVal * params.shimmer * 0.015 * haloMask[idx];

        // Is this inside the prism?
        const nx = col / cols;
        const ny = row / rows;
        const inPrism = params.showPrism && isInsidePrism(nx, ny);

        let ch, color;

        if (brightness < 0.02) {
          // Empty — background
          ch = " ";
          color = `rgb(${bgR},${bgG},${bgB})`;
        } else if (inPrism && brightness < 0.2) {
          // Prism interior — dim fill
          const [fr, fg, fb] = pst.prismFill;
          const dimBright = 0.3 + brightness;
          ch = DIM_CHARS[Math.min(DIM_CHARS.length - 1, Math.floor(brightness * DIM_CHARS.length * 3))];
          color = `rgb(${Math.round(fr * dimBright)},${Math.round(fg * dimBright)},${Math.round(fb * dimBright)})`;
        } else {
          // Light — map brightness to character density and accumulated color
          const charIdx = Math.min(BRIGHT_CHARS.length - 1, Math.floor(brightness * BRIGHT_CHARS.length));
          ch = BRIGHT_CHARS[charIdx];

          // Normalize accumulated color
          const totalLight = gridR[idx] + gridG[idx] + gridB[idx];
          if (totalLight > 0.001) {
            const scale = Math.min(1.0, brightness);
            const r = Math.min(255, Math.round(lerp(bgR, gridR[idx] / totalLight * 255, scale)));
            const g = Math.min(255, Math.round(lerp(bgG, gridG[idx] / totalLight * 255, scale)));
            const b = Math.min(255, Math.round(lerp(bgB, gridB[idx] / totalLight * 255, scale)));
            color = `rgb(${r},${g},${b})`;
          } else {
            const grey = Math.round(bgR + brightness * 40);
            color = `rgb(${grey},${grey},${Math.round(grey * 1.1)})`;
          }
        }

        ctx.fillStyle = color;
        ctx.fillText(ch, col * charW, row * charH);
      }
    }

    // ── Stamp title ──
    ctx.font = `bold ${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    // Title with subtle spectral gradient across letters
    for (let i = 0; i < titleText.length; i++) {
      const col = titleColStart + i;
      if (col < 0 || col >= cols) continue;
      const t = i / Math.max(1, titleText.length - 1);
      const hue = 275 - t * 270; // violet → red across the title
      const shimmer2 = Math.sin(i * 0.8 + timeRef.current * 1.5) * 5;
      ctx.fillStyle = hslToRgb(hue + shimmer2, 20, 80);
      ctx.fillText(titleText[i], col * charW, titleRow * charH);
    }

    // Subtitle
    ctx.fillStyle = hslToRgb(260, 10, 32);
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
  }, [pst, params, preset, getPrismVerts, isInsidePrism, spawnParticles]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [renderFrame]);

  const Slider = ({ label, param, min, max, step }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-right opacity-60 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step}
        value={params[param]} onChange={e => updateParam(param, parseFloat(e.target.value))}
        className="flex-1 h-1" style={{ accentColor: "#7a6aaa" }} />
      <span className="w-12 text-right font-mono opacity-40">{Number(params[param]).toFixed(2)}</span>
    </div>
  );

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: "#04030a" }}>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: "rgba(0,0,0,0.7)", color: "#444" }}>{fps} fps</div>
        <button onClick={() => setShowControls(!showControls)}
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs cursor-pointer"
          style={{ background: "rgba(0,0,0,0.7)", color: "#777", border: "1px solid #222" }}>
          {showControls ? "▼ Hide Controls" : "▶ Tune Parameters"}
        </button>
      </div>

      {showControls && (
        <div className="shrink-0 p-3 space-y-3 overflow-y-auto"
          style={{ background: "#080810", color: "#999", maxHeight: "55vh", borderTop: "1px solid #1a1a28" }}>

          {/* Presets */}
          <div>
            <div className="text-xs font-semibold mb-2 opacity-40 uppercase tracking-widest">Preset</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button key={key} onClick={() => setPreset(key)}
                  className="px-3 py-1.5 rounded text-xs cursor-pointer"
                  style={{
                    background: preset === key ? "#1e1a30" : "#0c0c14",
                    color: preset === key ? "#a090c0" : "#555",
                    border: `1px solid ${preset === key ? "#3a3060" : "#181828"}`,
                  }}>{p.name}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {/* Prism geometry */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c16" }}>
              <div className="text-xs font-semibold opacity-40 mb-1.5">Prism</div>
              <Slider label="position X" param="prismX" min={0.15} max={0.6} step={0.01} />
              <Slider label="position Y" param="prismY" min={0.2} max={0.8} step={0.01} />
              <Slider label="size" param="prismSize" min={0.06} max={0.35} step={0.01} />
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="w-24 text-right opacity-60">show prism</span>
                <button onClick={() => updateParam("showPrism", !params.showPrism)}
                  className="px-2 py-0.5 rounded text-xs cursor-pointer"
                  style={{
                    background: params.showPrism ? "#1e1a30" : "#0c0c14",
                    color: params.showPrism ? "#a090c0" : "#555",
                    border: `1px solid ${params.showPrism ? "#3a3060" : "#181828"}`,
                  }}>{params.showPrism ? "ON" : "OFF"}</button>
              </div>
            </div>

            {/* Light */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c16" }}>
              <div className="text-xs font-semibold opacity-40 mb-1.5">Light</div>
              <Slider label="beam width" param="beamWidth" min={0.01} max={0.15} step={0.005} />
              <Slider label="spread" param="spectralSpread" min={0.2} max={2.5} step={0.05} />
              <Slider label="band width" param="bandWidth" min={0.005} max={0.08} step={0.005} />
              <Slider label="glow" param="glowStrength" min={0.1} max={1.5} step={0.05} />
              <Slider label="shimmer" param="shimmer" min={0} max={1} step={0.05} />
            </div>

            {/* Particles */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c16" }}>
              <div className="text-xs font-semibold opacity-40 mb-1.5">Particles</div>
              <Slider label="count" param="particleCount" min={50} max={500} step={10} />
              <Slider label="speed" param="particleSpeed" min={0.002} max={0.02} step={0.001} />
              <Slider label="trail" param="trailLength" min={0} max={0.4} step={0.02} />
              <Slider label="anim speed" param="speed" min={0.2} max={3} step={0.1} />
              <Slider label="font size" param="fontSize" min={6} max={18} step={1} />
            </div>
          </div>

          {/* Halo */}
          <div className="p-2.5 rounded" style={{ background: "#0c0c16" }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold opacity-40">Title Halo</div>
              <button onClick={() => updateParam("showHalo", !params.showHalo)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{
                  background: params.showHalo ? "#1e1a30" : "#0c0c14",
                  color: params.showHalo ? "#a090c0" : "#555",
                  border: `1px solid ${params.showHalo ? "#3a3060" : "#181828"}`,
                }}>{params.showHalo ? "ON" : "OFF"}</button>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Slider label="pad X" param="haloPadX" min={0} max={15} step={1} />
              <Slider label="pad Y" param="haloPadY" min={0} max={8} step={1} />
              <Slider label="fade X" param="haloFadeX" min={1} max={30} step={1} />
              <Slider label="fade Y" param="haloFadeY" min={1} max={15} step={1} />
            </div>
          </div>

          {/* Spectrum preview */}
          <div className="p-2.5 rounded" style={{ background: "#0c0c16" }}>
            <div className="text-xs font-semibold opacity-40 mb-2">Spectral Bands</div>
            <div className="flex gap-1">
              {SPECTRUM.map((band, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="h-3 rounded-sm mb-1"
                    style={{ background: hslToRgb(band.hue, pst.saturation, pst.lightness) }} />
                  <div className="text-xs opacity-30" style={{ fontSize: 9 }}>{band.name}</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setParams(DEFAULT_PARAMS)}
            className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
            style={{ background: "#0e0e18", color: "#555", border: "1px solid #1a1a28" }}>
            ↺ Reset Defaults
          </button>
        </div>
      )}
    </div>
  );
}
