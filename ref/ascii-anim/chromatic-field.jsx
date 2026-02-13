import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────
// Chromatic Separation Field
//
// Three independent sine wave fields — Red, Green, Blue
// — each with slightly different frequencies, focal
// points, and phase speeds. Where they converge the
// characters appear near-white (coherent light). Where
// they drift apart, spectral colors separate like
// chromatic aberration through a prism.
//
// Ultra-low contrast. Every cell filled. Full viewport.
// A ghostly triangular prism outline floats at center.
// ─────────────────────────────────────────────────────

const CHARS = [" ", ".", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

const PRESETS = {
  subtle: {
    name: "Subtle",
    bg: [12, 10, 18],
    // How much color tints above the base grey (lower = more subtle)
    colorIntensity: 0.35,
    // Base grey brightness range [min, max] mapped to density
    greyMin: 0.06,
    greyMax: 0.38,
    prismOpacity: 0.08,
  },
  warm: {
    name: "Warm Drift",
    bg: [14, 10, 12],
    colorIntensity: 0.40,
    greyMin: 0.07,
    greyMax: 0.40,
    prismOpacity: 0.07,
  },
  cool: {
    name: "Cool Glass",
    bg: [8, 10, 16],
    colorIntensity: 0.38,
    greyMin: 0.05,
    greyMax: 0.36,
    prismOpacity: 0.09,
  },
  vivid: {
    name: "Vivid Split",
    bg: [8, 7, 14],
    colorIntensity: 0.55,
    greyMin: 0.06,
    greyMax: 0.42,
    prismOpacity: 0.06,
  },
};

// ─── Default parameters ───

const DEFAULT_PARAMS = {
  // Red channel wave field
  r_cx: 0.42, r_cy: 0.38,
  r_freq1: 36.0, r_freq2: 24.0,
  r_speed: 1.00,

  // Green channel wave field
  g_cx: 0.48, g_cy: 0.52,
  g_freq1: 34.0, g_freq2: 26.0,
  g_speed: 1.15,

  // Blue channel wave field
  b_cx: 0.38, b_cy: 0.48,
  b_freq1: 38.0, b_freq2: 22.0,
  b_speed: 0.85,

  // Chromatic separation — how far apart the channels drift
  separation: 0.06,       // spatial offset between channels
  separationSpeed: 0.08,  // how fast the separation oscillates
  breathe: 0.5,           // 0 = always separated, 1 = oscillates between coherent and split

  // Global wave
  phaseStep: 0.08,
  ySquash: 0.45,
  falloff: 0.55,

  // Secondary wave per channel (adds complexity)
  secondary: 0.35,

  // Prism ghost
  prismX: 0.50,
  prismY: 0.50,
  prismSize: 0.14,
  prismRotation: 0.0,
  showPrism: true,

  // Halo
  showHalo: true,
  haloPadX: 3,
  haloPadY: 1,
  haloFadeX: 10,
  haloFadeY: 4,

  // Display
  fontSize: 11,
  speed: 1.0,

  titleText: "P R I S M",
  subText: "─── spectrum cli ───",
};

export default function ChromaticField() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);
  const [preset, setPreset] = useState("subtle");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showControls, setShowControls] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  const pst = PRESETS[preset];
  const updateParam = (key, value) => setParams(p => ({ ...p, [key]: value }));

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
    const [bgR, bgG, bgB] = pst.bg;

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

    // ── Chromatic separation offset ──
    // The three channels drift apart and back together over time
    const breathe = params.breathe;
    const sepBase = params.separation;
    const sepOsc = Math.sin(phase * params.separationSpeed) * breathe;
    const currentSep = sepBase * (1.0 + sepOsc);

    // Each channel gets a time-varying spatial offset
    // This creates the "drift" — channels slide relative to each other
    const sepAngle = phase * params.separationSpeed * 0.3;
    const rOffset = { x: Math.cos(sepAngle) * currentSep, y: Math.sin(sepAngle) * currentSep * 0.5 };
    const gOffset = { x: Math.cos(sepAngle + 2.09) * currentSep, y: Math.sin(sepAngle + 2.09) * currentSep * 0.5 };
    const bOffset = { x: Math.cos(sepAngle + 4.19) * currentSep, y: Math.sin(sepAngle + 4.19) * currentSep * 0.5 };

    // ── Compute per-cell RGB wave values ──
    const numChars = CHARS.length;
    const greyMin = pst.greyMin;
    const greyMax = pst.greyMax;
    const colorInt = pst.colorIntensity;

    // Pre-compute channel configs
    const channels = [
      { cx: params.r_cx, cy: params.r_cy, f1: params.r_freq1, f2: params.r_freq2, spd: params.r_speed, off: rOffset },
      { cx: params.g_cx, cy: params.g_cy, f1: params.g_freq1, f2: params.g_freq2, spd: params.g_speed, off: gOffset },
      { cx: params.b_cx, cy: params.b_cy, f1: params.b_freq1, f2: params.b_freq2, spd: params.b_speed, off: bOffset },
    ];

    // Prism ghost geometry
    const prismVerts = [];
    if (params.showPrism) {
      const pcx = params.prismX, pcy = params.prismY, ps = params.prismSize;
      const rot = params.prismRotation;
      const angles = [-Math.PI/2, Math.PI/6, 5*Math.PI/6]; // equilateral triangle
      for (const a of angles) {
        prismVerts.push({
          x: pcx + Math.cos(a + rot) * ps * 0.7,
          y: pcy + Math.sin(a + rot) * ps,
        });
      }
    }

    // ── Title halo ──
    const titleText = params.titleText;
    const subText = params.subText;
    const centerRow = Math.floor(rows / 2);
    const titleRow = centerRow - 1;
    const subRow = centerRow + 1;
    const titleColStart = Math.floor((cols - titleText.length) / 2);
    const subColStart = Math.floor((cols - subText.length) / 2);

    // Pre-compute halo
    let haloR0 = 0, haloR1 = 0, haloC0 = 0, haloC1 = 0;
    if (params.showHalo) {
      const overlays = [
        { row: titleRow, cs: titleColStart, len: titleText.length },
        { row: subRow, cs: subColStart, len: subText.length },
      ];
      haloR0 = Infinity; haloR1 = -Infinity; haloC0 = Infinity; haloC1 = -Infinity;
      for (const o of overlays) {
        haloR0 = Math.min(haloR0, o.row); haloR1 = Math.max(haloR1, o.row);
        haloC0 = Math.min(haloC0, o.cs); haloC1 = Math.max(haloC1, o.cs + o.len - 1);
      }
    }

    // ── Distance from point to line segment (for prism edges) ──
    function distToSegment(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((px-ax)**2 + (py-ay)**2);
      let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = ax + t * dx, projY = ay + t * dy;
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    // ── Render every cell ──
    for (let row = 0; row < rows; row++) {
      const ny = row / rows;
      for (let col = 0; col < cols; col++) {
        const nx = col / cols;

        // Compute each channel's wave value independently
        const vals = [0, 0, 0]; // R, G, B wave values (0-1)

        for (let c = 0; c < 3; c++) {
          const ch = channels[c];
          // Apply chromatic offset — this is where the separation happens
          const cx = nx - ch.off.x;
          const cy = ny - ch.off.y;

          // Primary wave: radial from this channel's focal point
          const dx1 = cx - ch.cx;
          const dy1 = (cy - ch.cy) * params.ySquash;
          const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          const wave1 = Math.sin(dist1 * ch.f1 - phase * ch.spd);

          // Secondary wave: different frequency for complexity
          const dx2 = cx - (1.0 - ch.cx); // mirrored focal point
          const dy2 = (cy - (1.0 - ch.cy)) * params.ySquash;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const wave2 = Math.sin(dist2 * ch.f2 - phase * ch.spd * 0.7);

          const combined = wave1 * (1.0 - params.secondary) + wave2 * params.secondary;

          // Normalize to 0-1
          const normalized = combined * 0.5 + 0.5;

          // Radial falloff from center
          const dcx = nx - 0.5, dcy = (ny - 0.5) * params.ySquash;
          const centerDist = Math.sqrt(dcx * dcx + dcy * dcy);
          const falloff = Math.max(0.15, 1.0 - centerDist * params.falloff);

          vals[c] = normalized * falloff;
        }

        // ── Character density from max channel ──
        const maxVal = Math.max(vals[0], vals[1], vals[2]);
        const avgVal = (vals[0] + vals[1] + vals[2]) / 3;
        // Use a blend of max and avg for density — max keeps peaks visible,
        // avg keeps the field smooth
        const density = maxVal * 0.6 + avgVal * 0.4;

        let charIdx = Math.floor(density * numChars);
        charIdx = Math.max(0, Math.min(numChars - 1, charIdx));

        // ── Color: base grey + subtle RGB tinting ──
        // The base grey comes from density
        const grey = greyMin + density * (greyMax - greyMin);

        // The color tint comes from how DIFFERENT the channels are
        // When all equal → pure grey. When unequal → color emerges.
        const r = grey + (vals[0] - avgVal) * colorInt;
        const g = grey + (vals[1] - avgVal) * colorInt;
        const b = grey + (vals[2] - avgVal) * colorInt;

        // ── Prism ghost: distance to triangle edges ──
        let prismGlow = 0;
        if (params.showPrism && prismVerts.length === 3) {
          for (let e = 0; e < 3; e++) {
            const a = prismVerts[e];
            const bv = prismVerts[(e + 1) % 3];
            const d = distToSegment(nx, ny, a.x, a.y, bv.x, bv.y);
            // Thin glow falloff
            const edgeGlow = Math.max(0, 1.0 - d * 60) * pst.prismOpacity;
            prismGlow = Math.max(prismGlow, edgeGlow);
          }
        }

        // ── Halo dimming ──
        let haloMask = 1.0;
        if (params.showHalo) {
          const { haloPadX: px, haloPadY: py, haloFadeX: fx, haloFadeY: fy } = params;
          let ddx = 0, ddy = 0;
          if (col < haloC0 - px) ddx = (haloC0 - px - col) / fx;
          else if (col > haloC1 + px) ddx = (col - haloC1 - px) / fx;
          if (row < haloR0 - py) ddy = (haloR0 - py - row) / fy;
          else if (row > haloR1 + py) ddy = (row - haloR1 - py) / fy;
          const haloDist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (haloDist < 1.0) haloMask = haloDist;
        }

        // ── Final color ──
        const finalR = Math.round(Math.min(255, Math.max(0, (bgR + (r + prismGlow * 0.5) * 255 * haloMask))));
        const finalG = Math.round(Math.min(255, Math.max(0, (bgG + (g + prismGlow * 0.3) * 255 * haloMask))));
        const finalB = Math.round(Math.min(255, Math.max(0, (bgB + (b + prismGlow * 0.6) * 255 * haloMask))));

        // Reduce density in halo zone
        if (haloMask < 1.0) {
          charIdx = Math.max(0, Math.round(charIdx * haloMask));
        }

        ctx.fillStyle = `rgb(${finalR},${finalG},${finalB})`;
        ctx.fillText(CHARS[charIdx], col * charW, row * charH);
      }
    }

    // ── Title text ──
    ctx.font = `bold ${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    // Title with very subtle chromatic split on each letter
    for (let i = 0; i < titleText.length; i++) {
      const col = titleColStart + i;
      if (col < 0 || col >= cols) continue;

      // Slight spectral shift across the title
      const t = i / Math.max(1, titleText.length - 1);
      // Near-white with tiny color bias
      const rBias = 0.5 + Math.sin(t * Math.PI + phase * 0.3) * 0.08;
      const gBias = 0.5 + Math.sin(t * Math.PI * 1.3 + phase * 0.3 + 1) * 0.06;
      const bBias = 0.5 + Math.sin(t * Math.PI * 0.8 + phase * 0.3 + 2) * 0.08;
      const lr = Math.round(160 + rBias * 50);
      const lg = Math.round(160 + gBias * 45);
      const lb = Math.round(165 + bBias * 55);
      ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
      ctx.fillText(titleText[i], col * charW, titleRow * charH);
    }

    // Subtitle — very dim
    ctx.fillStyle = `rgb(${bgR + 50},${bgG + 48},${bgB + 58})`;
    for (let i = 0; i < subText.length; i++) {
      const col = subColStart + i;
      if (col >= 0 && col < cols) ctx.fillText(subText[i], col * charW, subRow * charH);
    }

    // ── Prism ghost overlay (vertices marked) ──
    if (params.showPrism && prismVerts.length === 3) {
      ctx.fillStyle = `rgba(${bgR + 30},${bgG + 28},${bgB + 40}, 0.3)`;
      for (const v of prismVerts) {
        const px = Math.floor(v.x * cols) * charW;
        const py = Math.floor(v.y * rows) * charH;
        ctx.fillText("◊", px, py);
      }
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
  }, [pst, params, preset]);

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

  const copyGoConstants = () => {
    const code = `// ── Chromatic Separation Field ──
// Three independent RGB wave fields with aberration offset

type channelConfig struct {
\tcx, cy   float64
\tfreq1    float64
\tfreq2    float64
\tspeed    float64
}

var rgbChannels = [3]channelConfig{
\t{cx: ${params.r_cx}, cy: ${params.r_cy}, freq1: ${params.r_freq1}, freq2: ${params.r_freq2}, speed: ${params.r_speed}}, // Red
\t{cx: ${params.g_cx}, cy: ${params.g_cy}, freq1: ${params.g_freq1}, freq2: ${params.g_freq2}, speed: ${params.g_speed}}, // Green
\t{cx: ${params.b_cx}, cy: ${params.b_cy}, freq1: ${params.b_freq1}, freq2: ${params.b_freq2}, speed: ${params.b_speed}}, // Blue
}

const (
\tphaseStep       = ${params.phaseStep.toFixed(3)}
\tySquash         = ${params.ySquash.toFixed(2)}
\tfalloffPower    = ${params.falloff.toFixed(2)}
\tseparation      = ${params.separation.toFixed(3)}
\tseparationSpeed = ${params.separationSpeed.toFixed(3)}
\tbreathe         = ${params.breathe.toFixed(2)}
\tsecondaryMix    = ${params.secondary.toFixed(2)}
)`;
    navigator.clipboard.writeText(code);
  };

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

          {/* Presets */}
          <div>
            <div className="text-xs font-semibold mb-2 opacity-35 uppercase tracking-widest">Preset</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button key={key} onClick={() => setPreset(key)}
                  className="px-3 py-1.5 rounded text-xs cursor-pointer"
                  style={{
                    background: preset === key ? "#18162a" : "#0a0a12",
                    color: preset === key ? "#8878a8" : "#444",
                    border: `1px solid ${preset === key ? "#2e2848" : "#151520"}`,
                  }}>{p.name}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {/* Chromatic separation */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Chromatic Separation</div>
              <Slider label="separation" param="separation" min={0} max={0.2} step={0.005} />
              <Slider label="sep speed" param="separationSpeed" min={0.01} max={0.3} step={0.005} />
              <Slider label="breathe" param="breathe" min={0} max={1} step={0.05} />
              <Slider label="secondary" param="secondary" min={0} max={0.8} step={0.05} />
            </div>

            {/* Red channel */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0e0a0a" }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: "#6a3030", opacity: 0.6 }}>Red Channel</div>
              <Slider label="center X" param="r_cx" min={0} max={1} step={0.01} />
              <Slider label="center Y" param="r_cy" min={0} max={1} step={0.01} />
              <Slider label="freq 1" param="r_freq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="r_freq2" min={10} max={60} step={0.5} />
              <Slider label="speed" param="r_speed" min={0.3} max={2} step={0.05} />
            </div>

            {/* Green channel */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0a0e0a" }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: "#306a30", opacity: 0.6 }}>Green Channel</div>
              <Slider label="center X" param="g_cx" min={0} max={1} step={0.01} />
              <Slider label="center Y" param="g_cy" min={0} max={1} step={0.01} />
              <Slider label="freq 1" param="g_freq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="g_freq2" min={10} max={60} step={0.5} />
              <Slider label="speed" param="g_speed" min={0.3} max={2} step={0.05} />
            </div>

            {/* Blue channel */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0a0a0e" }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: "#30306a", opacity: 0.6 }}>Blue Channel</div>
              <Slider label="center X" param="b_cx" min={0} max={1} step={0.01} />
              <Slider label="center Y" param="b_cy" min={0} max={1} step={0.01} />
              <Slider label="freq 1" param="b_freq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="b_freq2" min={10} max={60} step={0.5} />
              <Slider label="speed" param="b_speed" min={0.3} max={2} step={0.05} />
            </div>

            {/* Global */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Global</div>
              <Slider label="anim speed" param="phaseStep" min={0.02} max={0.2} step={0.005} />
              <Slider label="y squash" param="ySquash" min={0.1} max={1} step={0.01} />
              <Slider label="falloff" param="falloff" min={0} max={1.5} step={0.05} />
              <Slider label="font size" param="fontSize" min={6} max={16} step={1} />
              <Slider label="speed mult" param="speed" min={0.3} max={3} step={0.1} />
            </div>

            {/* Prism ghost */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold opacity-35">Prism Ghost</div>
                <button onClick={() => updateParam("showPrism", !params.showPrism)}
                  className="px-2 py-0.5 rounded text-xs cursor-pointer"
                  style={{
                    background: params.showPrism ? "#18162a" : "#0a0a12",
                    color: params.showPrism ? "#7868a0" : "#444",
                    border: `1px solid ${params.showPrism ? "#2e2848" : "#151520"}`,
                  }}>{params.showPrism ? "ON" : "OFF"}</button>
              </div>
              <Slider label="X" param="prismX" min={0.2} max={0.8} step={0.01} />
              <Slider label="Y" param="prismY" min={0.2} max={0.8} step={0.01} />
              <Slider label="size" param="prismSize" min={0.05} max={0.3} step={0.01} />
              <Slider label="rotation" param="prismRotation" min={-1.57} max={1.57} step={0.05} />
            </div>

            {/* Halo */}
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold opacity-35">Title Halo</div>
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

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={copyGoConstants}
              className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
              style={{ background: "#12121e", color: "#6a5a8a", border: "1px solid #252040" }}>
              📋 Copy as Go Constants
            </button>
            <button onClick={() => setParams(DEFAULT_PARAMS)}
              className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
              style={{ background: "#0e0e18", color: "#444", border: "1px solid #1a1a28" }}>
              ↺ Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
