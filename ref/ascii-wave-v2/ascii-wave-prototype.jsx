import { useState, useEffect, useRef, useCallback } from "react";

const CHARS = [" ", ".", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

const PALETTES = {
  teal: {
    name: "Codex Teal",
    bg: "#1e1e2e",
    ramp: ["#1e1e2e","#22223a","#2a2a44","#35354f","#42425e","#50506e","#60607e","#707090","#7aa8be","#88c0d0","#96d4e4"],
    title: "#cdd6f4",
    sub: "#585878",
  },
  purple: {
    name: "Prism Purple",
    bg: "#1a1a2e",
    ramp: ["#1a1a2e","#222238","#2a2a45","#353552","#424260","#50506e","#5f5f80","#707094","#9078b8","#a888d0","#b898e0"],
    title: "#e0d0f0",
    sub: "#5a5878",
  },
  green: {
    name: "Terminal Green",
    bg: "#0c140c",
    ramp: ["#0c140c","#142014","#1e2e1e","#283c28","#344a34","#405840","#4e6a4e","#5e7e5e","#70a870","#80c880","#90e090"],
    title: "#c0e8c0",
    sub: "#3a5a3a",
  },
  spectrum: {
    name: "Spectrum",
    bg: "#121220",
    ramp: ["#121220","#1a1a30","#242444","#303058","#3e3e6c","#4e4e80","#606096","#7272ac","#6ea8cc","#5ec0e0","#50d8f0"],
    title: "#d0dff0",
    sub: "#4a4a70",
  },
};

const DEFAULT_PARAMS = {
  cx1: 0.40, cy1: 0.30, freq1: 38.0, speed1: 1.0, amp1: 1.0,
  cx2: 0.70, cy2: 0.60, freq2: 26.0, speed2: 1.3, amp2: 0.45,
  cx3: 0.20, cy3: 0.75, freq3: 32.0, speed3: 0.7, amp3: 0.30,
  phaseStep: 0.10,
  ySquash: 0.45,
  falloff: 0.70,
  fontSize: 11,
  haloPadX: 3,
  haloPadY: 1,
  haloFadeX: 8,
  haloFadeY: 3,
  showHalo: true,
  titleText: "P R I S M",
  subText: "─── spectrum cli ───",
};

export default function AsciiWave() {
  const canvasRef = useRef(null);
  const phaseRef = useRef(0);
  const animRef = useRef(null);
  const [palette, setPalette] = useState("teal");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showControls, setShowControls] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  const pal = PALETTES[palette];
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

    const w = rect.width;
    const h = rect.height;
    const size = params.fontSize;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${size}px "Cascadia Code","JetBrains Mono","Fira Code","SF Mono","Consolas",monospace`;
    ctx.textBaseline = "top";

    const charW = size * 0.6;
    const charH = size * 1.2;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);

    const sources = [
      { cx: params.cx1, cy: params.cy1, freq: params.freq1, speed: params.speed1, amp: params.amp1 },
      { cx: params.cx2, cy: params.cy2, freq: params.freq2, speed: params.speed2, amp: params.amp2 },
      { cx: params.cx3, cy: params.cy3, freq: params.freq3, speed: params.speed3, amp: params.amp3 },
    ];
    const totalAmp = sources.reduce((s, src) => s + src.amp, 0);
    const invTotalAmp = 1.0 / (2.0 * totalAmp);
    const phase = phaseRef.current;
    const numChars = CHARS.length;

    // Phase 1: compute wave grid (index per cell)
    const grid = new Int8Array(rows * cols);
    for (let row = 0; row < rows; row++) {
      const ny = row / rows;
      for (let col = 0; col < cols; col++) {
        const nx = col / cols;
        let combined = 0, primaryDist = 0;
        for (let i = 0; i < sources.length; i++) {
          const dx = nx - sources[i].cx;
          const dy = (ny - sources[i].cy) * params.ySquash;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (i === 0) primaryDist = dist;
          combined += Math.sin(dist * sources[i].freq - phase * sources[i].speed) * sources[i].amp;
        }
        const normalized = (combined + totalAmp) * invTotalAmp;
        const falloff = Math.max(0.08, 1.0 - primaryDist * params.falloff);
        const value = normalized * falloff;
        let idx = Math.floor(value * numChars);
        idx = Math.max(0, Math.min(numChars - 1, idx));
        grid[row * cols + col] = idx;
      }
    }

    // Phase 2: overlay layout
    const titleText = params.titleText;
    const subText = params.subText;
    const centerRow = Math.floor(rows / 2);
    const titleRow = centerRow - 1;
    const subRow = centerRow + 1;
    const titleColStart = Math.floor((cols - titleText.length) / 2);
    const subColStart = Math.floor((cols - subText.length) / 2);

    // Phase 3: halo dimming
    if (params.showHalo) {
      const overlayDefs = [
        { row: titleRow, colStart: titleColStart, len: titleText.length },
        { row: subRow, colStart: subColStart, len: subText.length },
      ];

      let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
      for (const od of overlayDefs) {
        minRow = Math.min(minRow, od.row);
        maxRow = Math.max(maxRow, od.row);
        minCol = Math.min(minCol, od.colStart);
        maxCol = Math.max(maxCol, od.colStart + od.len - 1);
      }

      const padX = params.haloPadX, padY = params.haloPadY;
      const fadeX = params.haloFadeX, fadeY = params.haloFadeY;
      const y0 = Math.max(0, minRow - padY - fadeY);
      const y1 = Math.min(rows - 1, maxRow + padY + fadeY);
      const x0 = Math.max(0, minCol - padX - fadeX);
      const x1 = Math.min(cols - 1, maxCol + padX + fadeX);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          let dx = 0, dy = 0;
          if (x < minCol - padX) dx = (minCol - padX - x) / fadeX;
          else if (x > maxCol + padX) dx = (x - maxCol - padX) / fadeX;
          if (y < minRow - padY) dy = (minRow - padY - y) / fadeY;
          else if (y > maxRow + padY) dy = (y - maxRow - padY) / fadeY;

          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 1.0) continue;

          const currentIdx = grid[y * cols + x];
          const newIdx = Math.round(currentIdx * dist);
          grid[y * cols + x] = Math.max(0, newIdx);
        }
      }
    }

    // Phase 4: render wave cells
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = grid[row * cols + col];
        ctx.fillStyle = pal.ramp[idx];
        ctx.fillText(CHARS[idx], col * charW, row * charH);
      }
    }

    // Phase 5: stamp title text over grid
    const titleFontSize = Math.max(16, Math.min(32, w * 0.025));
    ctx.font = `bold ${size}px "Cascadia Code","JetBrains Mono","Fira Code",monospace`;
    ctx.textBaseline = "top";

    // Title characters
    ctx.fillStyle = pal.title;
    for (let i = 0; i < titleText.length; i++) {
      const col = titleColStart + i;
      if (col >= 0 && col < cols) {
        ctx.fillText(titleText[i], col * charW, titleRow * charH);
      }
    }

    // Subtitle characters
    ctx.fillStyle = pal.sub;
    for (let i = 0; i < subText.length; i++) {
      const col = subColStart + i;
      if (col >= 0 && col < cols) {
        ctx.fillText(subText[i], col * charW, subRow * charH);
      }
    }

    phaseRef.current += params.phaseStep;

    frameCountRef.current++;
    const now = performance.now();
    if (now - lastTimeRef.current > 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    animRef.current = requestAnimationFrame(renderFrame);
  }, [pal, params]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [renderFrame]);

  const Slider = ({ label, param, min, max, step }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-right opacity-60 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step}
        value={params[param]}
        onChange={e => updateParam(param, parseFloat(e.target.value))}
        className="flex-1 h-1" style={{ accentColor: pal.ramp[8] }} />
      <span className="w-12 text-right font-mono opacity-40">{Number(params[param]).toFixed(2)}</span>
    </div>
  );

  const copyGoConstants = () => {
    const code = `// ── Wave sources ──
var waveSources = []waveSource{
\t{cx: ${params.cx1.toFixed(2)}, cy: ${params.cy1.toFixed(2)}, freq: ${params.freq1.toFixed(1)}, speed: ${params.speed1.toFixed(2)}, amp: ${params.amp1.toFixed(2)}},
\t{cx: ${params.cx2.toFixed(2)}, cy: ${params.cy2.toFixed(2)}, freq: ${params.freq2.toFixed(1)}, speed: ${params.speed2.toFixed(2)}, amp: ${params.amp2.toFixed(2)}},
\t{cx: ${params.cx3.toFixed(2)}, cy: ${params.cy3.toFixed(2)}, freq: ${params.freq3.toFixed(1)}, speed: ${params.speed3.toFixed(2)}, amp: ${params.amp3.toFixed(2)}},
}

// ── Global constants ──
const (
\tphaseStep    = ${params.phaseStep.toFixed(3)}
\tfalloffPower = ${params.falloff.toFixed(2)}
\tySquash      = ${params.ySquash.toFixed(2)}
\thaloPadX     = ${params.haloPadX}
\thaloPadY     = ${params.haloPadY}
\thaloFadeX    = ${params.haloFadeX}
\thaloFadeY    = ${params.haloFadeY}
)`;
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: "#0a0a14" }}>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: "rgba(0,0,0,0.6)", color: "#555575" }}>
          {fps} fps
        </div>

        <button onClick={() => setShowControls(!showControls)}
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs cursor-pointer"
          style={{ background: "rgba(0,0,0,0.6)", color: "#888", border: "1px solid #333" }}>
          {showControls ? "▼ Hide Controls" : "▶ Tune Parameters"}
        </button>
      </div>

      {showControls && (
        <div className="shrink-0 p-3 space-y-3 overflow-y-auto"
          style={{ background: "#10101c", color: "#aaa", maxHeight: "55vh", borderTop: `1px solid ${pal.ramp[3]}` }}>

          {/* Palette selector */}
          <div>
            <div className="text-xs font-semibold mb-2 opacity-40 uppercase tracking-widest">Palette</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(PALETTES).map(([key, p]) => (
                <button key={key} onClick={() => setPalette(key)}
                  className="px-3 py-1 rounded text-xs transition-all cursor-pointer"
                  style={{
                    background: palette === key ? p.ramp[8] + "30" : "#1a1a28",
                    color: palette === key ? p.ramp[9] : "#555",
                    border: `1px solid ${palette === key ? p.ramp[7] : "#252535"}`,
                  }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ background: p.ramp[8], verticalAlign: "middle" }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Wave sources grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1 p-2.5 rounded" style={{ background: "#14141f" }}>
                <div className="text-xs font-semibold opacity-40 mb-1.5">
                  Wave {i} {i === 1 ? "· primary" : i === 2 ? "· secondary" : "· tertiary"}
                </div>
                <Slider label="center X" param={`cx${i}`} min={0} max={1} step={0.01} />
                <Slider label="center Y" param={`cy${i}`} min={0} max={1} step={0.01} />
                <Slider label="frequency" param={`freq${i}`} min={5} max={80} step={0.5} />
                <Slider label="speed" param={`speed${i}`} min={0.1} max={3} step={0.05} />
                <Slider label="amplitude" param={`amp${i}`} min={0} max={1.5} step={0.05} />
              </div>
            ))}
          </div>

          {/* Global + Halo */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#14141f" }}>
              <div className="text-xs font-semibold opacity-40 mb-1.5">Global</div>
              <Slider label="anim speed" param="phaseStep" min={0.01} max={0.3} step={0.005} />
              <Slider label="y squash" param="ySquash" min={0.1} max={1} step={0.01} />
              <Slider label="edge falloff" param="falloff" min={0} max={2} step={0.05} />
              <Slider label="font size" param="fontSize" min={6} max={18} step={1} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#14141f" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold opacity-40">Halo Dimming</div>
                <button onClick={() => updateParam("showHalo", !params.showHalo)}
                  className="text-xs px-2 py-0.5 rounded cursor-pointer"
                  style={{
                    background: params.showHalo ? pal.ramp[8] + "25" : "#1a1a28",
                    color: params.showHalo ? pal.ramp[9] : "#555",
                    border: `1px solid ${params.showHalo ? pal.ramp[6] : "#252535"}`,
                  }}>
                  {params.showHalo ? "ON" : "OFF"}
                </button>
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
              className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer transition-all"
              style={{ background: "#1e1e30", color: pal.ramp[8], border: `1px solid ${pal.ramp[5]}` }}>
              📋 Copy as Go Constants
            </button>
            <button onClick={() => setParams(DEFAULT_PARAMS)}
              className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
              style={{ background: "#1e1e30", color: "#666", border: "1px solid #2a2a3a" }}>
              ↺ Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
