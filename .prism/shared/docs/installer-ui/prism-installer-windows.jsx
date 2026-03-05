import { useState, useEffect, useRef } from "react";

const COLORS = {
  dark: "#0F172A",
  mid: "#1E293B",
  surface: "#263348",
  border: "#334155",
  muted: "#64748B",
  light: "#94A3B8",
  white: "#F1F5F9",
  blue: "#4A9EFF",
  teal: "#2DD4BF",
  green: "#4ADE80",
  amber: "#FBB040",
  red: "#F87171",
};

const STEPS = ["welcome", "components", "directory", "preflight", "progress", "finish"];

const COMPONENTS = [
  {
    id: "cli",
    name: "Prism CLI",
    desc: "Core terminal interface and workflow engine",
    size: "~2 MB",
    required: true,
    defaultChecked: true,
    icon: ">_",
    color: COLORS.blue,
  },
  {
    id: "vscode",
    name: "VS Code Extension",
    desc: "Pixel office monitor and story integration for VS Code, Cursor, Windsurf",
    size: "~8 MB",
    required: false,
    defaultChecked: true,
    icon: "{}",
    color: COLORS.teal,
  },
  {
    id: "plugin",
    name: "Claude Code Plugin",
    desc: "Slash commands, agents, and skills for Claude Code",
    size: "~1 MB",
    required: false,
    defaultChecked: true,
    icon: "◈",
    color: COLORS.green,
  },
  {
    id: "electron",
    name: "Prism Desktop App",
    desc: "Standalone visual workspace manager (downloads from GitHub)",
    size: "~130 MB",
    required: false,
    defaultChecked: false,
    icon: "⬡",
    color: COLORS.amber,
  },
];

const PREFLIGHT = [
  { id: "os", label: "Windows 10 / 11", status: "pass", detail: "Windows 11 Pro (23H2)" },
  { id: "disk", label: "Disk space (200 MB free)", status: "pass", detail: "47.2 GB available" },
  { id: "vscode_detect", label: "VS Code detected", status: "pass", detail: "v1.87.0 @ %LOCALAPPDATA%\\Programs\\Microsoft VS Code" },
  { id: "cursor_detect", label: "Cursor detected", status: "pass", detail: "v0.43.2 @ %LOCALAPPDATA%\\Programs\\cursor" },
  { id: "claude_detect", label: "Claude CLI detected", status: "warn", detail: "Not found — Claude plugin will use file-copy fallback" },
  { id: "prism_existing", label: "Existing Prism install", status: "info", detail: "v2.4.3 found — will be upgraded to v2.5.0" },
];

function SpectralBar({ width = "100%", height = 8 }) {
  return (
    <div style={{
      width,
      height,
      background: `linear-gradient(90deg, ${COLORS.blue} 0%, ${COLORS.teal} 33%, ${COLORS.green} 66%, ${COLORS.amber} 100%)`,
      borderRadius: 2,
    }} />
  );
}

function WindowChrome({ children, onClose }) {
  return (
    <div style={{
      width: 520,
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
      background: COLORS.dark,
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
      borderRadius: 6,
      overflow: "hidden",
      userSelect: "none",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "#0A1120",
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 2,
            background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "white", fontWeight: "bold",
          }}>P</div>
          <span style={{ color: COLORS.light, fontSize: 11 }}>Prism Setup — v2.5.0</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["─", "□", "✕"].map((icon, i) => (
            <button key={i} onClick={i === 2 ? onClose : undefined} style={{
              width: 20, height: 20, background: i === 2 ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === 2 ? "rgba(248,113,113,0.3)" : COLORS.border}`,
              borderRadius: 3, color: i === 2 ? COLORS.red : COLORS.muted,
              fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>{icon}</button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function Header({ title, subtitle }) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <SpectralBar height={4} />
      <div style={{
        padding: "18px 24px 16px",
        background: "linear-gradient(180deg, #0D1829 0%, #0F172A 100%)",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: `linear-gradient(135deg, ${COLORS.blue}22, ${COLORS.teal}22)`,
          border: `1px solid ${COLORS.teal}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <div style={{
            width: 20, height: 20,
            background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`,
            borderRadius: 4,
          }} />
        </div>
        <div>
          <div style={{ color: COLORS.white, fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>{title}</div>
          <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = "Next →", backDisabled = false, nextDisabled = false }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 24px",
      borderTop: `1px solid ${COLORS.border}`,
      background: "#0A1120",
    }}>
      <button
        onClick={onBack}
        disabled={backDisabled}
        style={{
          padding: "6px 18px", background: "transparent",
          border: `1px solid ${backDisabled ? COLORS.border : COLORS.muted}`,
          borderRadius: 3, color: backDisabled ? COLORS.border : COLORS.light,
          fontSize: 12, cursor: backDisabled ? "default" : "pointer",
          fontFamily: "'Segoe UI', sans-serif",
          transition: "all 0.15s",
        }}
      >← Back</button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          padding: "6px 22px",
          background: nextDisabled ? COLORS.surface : `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`,
          border: "none", borderRadius: 3,
          color: nextDisabled ? COLORS.muted : "white",
          fontSize: 12, fontWeight: 600, cursor: nextDisabled ? "default" : "pointer",
          fontFamily: "'Segoe UI', sans-serif",
          boxShadow: nextDisabled ? "none" : `0 0 16px ${COLORS.teal}44`,
          transition: "all 0.15s",
        }}
      >{nextLabel}</button>
    </div>
  );
}

// ─── STEP: WELCOME ────────────────────────────────────────────────────────────
function WelcomeStep({ onNext }) {
  return (
    <div>
      <div style={{ padding: "28px 24px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 28, fontWeight: 700, letterSpacing: -1,
              background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.teal}, ${COLORS.green})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>PRISM</span>
            <span style={{ color: COLORS.muted, fontSize: 12 }}>v2.5.0</span>
          </div>
          <div style={{ color: COLORS.light, fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}>
            AI-powered development workflow system for the spectrum of your stack.
          </div>
        </div>

        <div style={{
          background: COLORS.mid, border: `1px solid ${COLORS.border}`,
          borderRadius: 6, padding: "14px 16px", marginBottom: 18,
        }}>
          <div style={{ color: COLORS.teal, fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>
            THIS INSTALLER WILL SET UP
          </div>
          {[
            ["Prism CLI", COLORS.blue, ">_"],
            ["VS Code / Cursor Extension", COLORS.teal, "{}"],
            ["Claude Code Plugin", COLORS.green, "◈"],
            ["Desktop App (optional)", COLORS.amber, "⬡"],
          ].map(([label, color, icon]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ color, fontSize: 12, width: 16, textAlign: "center" }}>{icon}</span>
              <span style={{ color: COLORS.light, fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: `${COLORS.blue}11`, border: `1px solid ${COLORS.blue}33`,
          borderRadius: 4, padding: "10px 14px",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ color: COLORS.blue, fontSize: 14, flexShrink: 0 }}>ℹ</span>
          <span style={{ color: COLORS.muted, fontSize: 11, lineHeight: 1.5 }}>
            Installs to <code style={{ color: COLORS.light, background: COLORS.surface, padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>%LOCALAPPDATA%\Prism</code>. No admin rights required. PATH is set for current user only.
          </span>
        </div>
      </div>
      <NavButtons onBack={() => {}} backDisabled onNext={onNext} nextLabel="Next →" />
    </div>
  );
}

// ─── STEP: COMPONENTS ─────────────────────────────────────────────────────────
function ComponentsStep({ checked, setChecked, onBack, onNext }) {
  const total = COMPONENTS.reduce((acc, c) => {
    if (!checked[c.id]) return acc;
    if (c.id === "electron") return acc + 130;
    if (c.id === "vscode") return acc + 8;
    if (c.id === "plugin") return acc + 1;
    return acc + 2;
  }, 0);

  return (
    <div>
      <Header title="Choose Components" subtitle="Select which Prism components to install" />
      <div style={{ padding: "16px 24px" }}>
        <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 12 }}>
          Components marked <span style={{ color: COLORS.amber }}>Required</span> cannot be deselected.
        </div>
        {COMPONENTS.map((c) => (
          <div
            key={c.id}
            onClick={() => !c.required && setChecked(p => ({ ...p, [c.id]: !p[c.id] }))}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 14px", marginBottom: 8,
              background: checked[c.id] ? `${c.color}0D` : COLORS.mid,
              border: `1px solid ${checked[c.id] ? c.color + "44" : COLORS.border}`,
              borderRadius: 6, cursor: c.required ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1,
              background: checked[c.id] ? c.color : "transparent",
              border: `2px solid ${checked[c.id] ? c.color : COLORS.muted}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {checked[c.id] && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
            </div>
            {/* Icon */}
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: `${c.color}22`, border: `1px solid ${c.color}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: c.color, fontSize: 13, fontWeight: 700,
            }}>{c.icon}</div>
            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ color: COLORS.white, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                {c.required ? (
                  <span style={{ background: `${COLORS.amber}22`, color: COLORS.amber, fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>REQUIRED</span>
                ) : (
                  <span style={{ background: `${COLORS.muted}22`, color: COLORS.muted, fontSize: 9, padding: "1px 6px", borderRadius: 3 }}>OPTIONAL</span>
                )}
                {c.id === "electron" && (
                  <span style={{ background: `${COLORS.blue}22`, color: COLORS.blue, fontSize: 9, padding: "1px 6px", borderRadius: 3 }}>⬇ DOWNLOAD</span>
                )}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>{c.desc}</div>
            </div>
            <div style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0, paddingTop: 2 }}>{c.size}</div>
          </div>
        ))}
        <div style={{ textAlign: "right", color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
          Space required: <span style={{ color: COLORS.light }}>{total} MB</span>
          {checked.electron && <span style={{ color: COLORS.amber }}> (includes download)</span>}
        </div>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ─── STEP: DIRECTORY ──────────────────────────────────────────────────────────
function DirectoryStep({ onBack, onNext }) {
  const [path, setPath] = useState("%LOCALAPPDATA%\\Prism");
  return (
    <div>
      <Header title="Install Location" subtitle="Choose where Prism CLI will be installed" />
      <div style={{ padding: "24px 24px" }}>
        <div style={{ color: COLORS.light, fontSize: 12, marginBottom: 10 }}>Destination folder:</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            style={{
              flex: 1, padding: "8px 12px",
              background: COLORS.mid, border: `1px solid ${COLORS.border}`,
              borderRadius: 4, color: COLORS.white, fontSize: 12,
              fontFamily: "'Consolas', monospace", outline: "none",
            }}
          />
          <button style={{
            padding: "8px 14px", background: COLORS.surface,
            border: `1px solid ${COLORS.border}`, borderRadius: 4,
            color: COLORS.light, fontSize: 12, cursor: "pointer",
            fontFamily: "'Segoe UI', sans-serif",
          }}>Browse...</button>
        </div>

        <div style={{ background: COLORS.mid, border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: COLORS.muted, fontSize: 11 }}>Files will be placed in:</span>
          </div>
          {[
            [path + "\\bin\\prism-cli.exe", "CLI binary"],
            [path + "\\extensions\\prism-2.5.0.vsix", "Extension archive"],
            [path + "\\plugin\\", "Claude plugin files"],
          ].map(([p, desc]) => (
            <div key={p} style={{ padding: "7px 14px", display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}22` }}>
              <span style={{ color: COLORS.light, fontSize: 10, fontFamily: "Consolas, monospace" }}>{p}</span>
              <span style={{ color: COLORS.muted, fontSize: 10 }}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: "10px 14px", background: `${COLORS.green}0D`, border: `1px solid ${COLORS.green}33`, borderRadius: 4, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: COLORS.green }}>✓</span>
          <span style={{ color: COLORS.muted, fontSize: 11 }}>
            <code style={{ color: COLORS.light, background: COLORS.surface, padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{path}\\bin</code> will be added to your user PATH via registry (no admin required)
          </span>
        </div>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ─── STEP: PREFLIGHT ──────────────────────────────────────────────────────────
function PreflightStep({ onBack, onNext }) {
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setVisible(v => [...v, i]);
      i++;
      if (i >= PREFLIGHT.length) {
        clearInterval(t);
        setTimeout(() => setDone(true), 300);
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  const icons = { pass: ["✓", COLORS.green], warn: ["⚠", COLORS.amber], info: ["ℹ", COLORS.blue] };

  return (
    <div>
      <Header title="System Check" subtitle="Verifying prerequisites before installation" />
      <div style={{ padding: "16px 24px" }}>
        {PREFLIGHT.map((item, i) => {
          const [icon, color] = icons[item.status];
          const show = visible.includes(i);
          return (
            <div key={item.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "9px 12px", marginBottom: 6,
              background: show ? COLORS.mid : "transparent",
              border: `1px solid ${show ? COLORS.border : "transparent"}`,
              borderRadius: 5, opacity: show ? 1 : 0,
              transition: "all 0.2s",
            }}>
              <span style={{ color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{show ? icon : "·"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: COLORS.white, fontSize: 12 }}>{item.label}</div>
                {show && <div style={{ color: COLORS.muted, fontSize: 10, marginTop: 2 }}>{item.detail}</div>}
              </div>
            </div>
          );
        })}
        {done && (
          <div style={{
            marginTop: 10, padding: "10px 14px",
            background: `${COLORS.amber}0D`, border: `1px solid ${COLORS.amber}33`,
            borderRadius: 4, display: "flex", gap: 8,
          }}>
            <span style={{ color: COLORS.amber }}>⚠</span>
            <span style={{ color: COLORS.muted, fontSize: 11 }}>
              1 warning — Claude CLI not found. Plugin files will be copied to <code style={{ color: COLORS.light, background: COLORS.surface, padding: "1px 4px", borderRadius: 2, fontSize: 10 }}>~/.claude/commands</code> as fallback.
            </span>
          </div>
        )}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextLabel="Install →" nextDisabled={!done} />
    </div>
  );
}

// ─── STEP: PROGRESS ───────────────────────────────────────────────────────────
function ProgressStep({ checked, onNext }) {
  const steps = COMPONENTS.filter(c => checked[c.id]).map(c => ({ ...c, status: "pending" }));
  const [states, setStates] = useState(steps.map(s => ({ ...s, status: "pending", detail: "" })));
  const [overallProgress, setOverallProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const logRef = useRef();

  const addLog = (msg) => setLog(l => [...l, msg]);

  useEffect(() => {
    const run = async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      let totalProgress = 0;
      const perStep = 100 / steps.length;

      for (let i = 0; i < steps.length; i++) {
        const c = steps[i];
        setStates(s => s.map((x, j) => j === i ? { ...x, status: "installing", detail: "Preparing..." } : x));
        addLog(`[${c.name}] Starting installation...`);
        await delay(400);

        if (c.id === "cli") {
          addLog(`[CLI] Copying prism-cli-windows-amd64.exe → %LOCALAPPDATA%\\Prism\\bin\\prism-cli.exe`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Copying binary..." } : x));
          await delay(500);
          addLog(`[CLI] Creating %USERPROFILE%\\.prism\\workspaces.json`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Adding to PATH (EnVar)..." } : x));
          await delay(400);
          addLog(`[CLI] PATH updated in HKCU\\Environment`);
        } else if (c.id === "vscode") {
          addLog(`[VSCode] Detected: %LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code.cmd`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Installing VSIX into VS Code..." } : x));
          await delay(600);
          addLog(`[VSCode] cmd.exe /c code.cmd --install-extension prism-2.5.0.vsix --force`);
          await delay(400);
          addLog(`[Cursor] Detected: %LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Installing VSIX into Cursor..." } : x));
          await delay(500);
          addLog(`[Cursor] VSIX installed (exit 0)`);
        } else if (c.id === "plugin") {
          addLog(`[Plugin] Claude CLI not found — using file-copy fallback`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Copying commands and agents..." } : x));
          await delay(500);
          addLog(`[Plugin] Copied 25 commands → %USERPROFILE%\\.claude\\commands\\`);
          addLog(`[Plugin] Copied 10 agents → %USERPROFILE%\\.claude\\agents\\`);
        } else if (c.id === "electron") {
          addLog(`[Desktop] Downloading from GitHub releases...`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Downloading Prism-2.5.0.Setup.exe..." } : x));
          await delay(900);
          addLog(`[Desktop] Running installer silently...`);
          setStates(s => s.map((x, j) => j === i ? { ...x, detail: "Running Squirrel installer..." } : x));
          await delay(600);
        }

        totalProgress += perStep;
        setOverallProgress(Math.min(totalProgress, 100));
        setStates(s => s.map((x, j) => j === i ? { ...x, status: "done", detail: "Installed successfully" } : x));
        addLog(`[${c.name}] ✓ Complete`);
        await delay(200);
      }

      setDone(true);
    };
    run();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const statusIcon = { pending: ["○", COLORS.muted], installing: ["◌", COLORS.amber], done: ["●", COLORS.green], failed: ["✕", COLORS.red] };

  return (
    <div>
      <Header title="Installing Prism" subtitle="Please wait while components are installed" />
      <div style={{ padding: "16px 24px" }}>
        {/* Overall progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: COLORS.light, fontSize: 11 }}>Overall progress</span>
            <span style={{ color: COLORS.teal, fontSize: 11 }}>{Math.round(overallProgress)}%</span>
          </div>
          <div style={{ height: 6, background: COLORS.mid, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.teal})`,
              width: `${overallProgress}%`, transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* Per-component */}
        {states.map((c) => {
          const [icon, color] = statusIcon[c.status];
          return (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", marginBottom: 6,
              background: c.status !== "pending" ? COLORS.mid : "transparent",
              border: `1px solid ${c.status !== "pending" ? COLORS.border : "transparent"}`,
              borderRadius: 5, transition: "all 0.2s",
            }}>
              <span style={{ color, fontSize: 14 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: c.status === "pending" ? COLORS.muted : COLORS.white, fontSize: 12 }}>{c.name}</div>
                {c.detail && <div style={{ color: COLORS.muted, fontSize: 10 }}>{c.detail}</div>}
              </div>
              {c.status === "installing" && (
                <div style={{
                  width: 60, height: 3, background: COLORS.surface, borderRadius: 2, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", background: COLORS.amber,
                    borderRadius: 2, width: "40%",
                    animation: "pulse 1s infinite",
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Log */}
        <div ref={logRef} style={{
          marginTop: 10, height: 80,
          background: "#060D1A", border: `1px solid ${COLORS.border}`,
          borderRadius: 4, padding: "8px 10px", overflowY: "auto",
          fontFamily: "Consolas, monospace", fontSize: 9,
        }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: COLORS.muted, lineHeight: 1.7 }}>{l}</div>
          ))}
        </div>
      </div>
      <NavButtons onBack={() => {}} backDisabled onNext={onNext} nextLabel="Finish →" nextDisabled={!done} />
    </div>
  );
}

// ─── STEP: FINISH ─────────────────────────────────────────────────────────────
function FinishStep({ checked }) {
  const installed = COMPONENTS.filter(c => checked[c.id]);
  const [openTerminal, setOpenTerminal] = useState(true);

  return (
    <div>
      <div style={{ padding: "24px 24px 16px" }}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, margin: "0 auto 14px",
            background: `linear-gradient(135deg, ${COLORS.green}22, ${COLORS.teal}22)`,
            border: `2px solid ${COLORS.green}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>✓</div>
          <div style={{
            fontSize: 18, fontWeight: 700, letterSpacing: -0.5,
            background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.teal})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 6,
          }}>Installation Complete</div>
          <div style={{ color: COLORS.muted, fontSize: 12 }}>Prism v2.5.0 is ready to use</div>
        </div>

        <SpectralBar height={2} />
        <div style={{ paddingTop: 14, marginBottom: 14 }}>
          {installed.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span style={{ color: COLORS.green, fontSize: 12 }}>✓</span>
              <span style={{ color: COLORS.light, fontSize: 12 }}>{c.name}</span>
              <span style={{ color: COLORS.muted, fontSize: 10, marginLeft: "auto" }}>Installed</span>
            </div>
          ))}
        </div>
        <SpectralBar height={2} />

        <div style={{ marginTop: 14 }}>
          <div
            onClick={() => setOpenTerminal(!openTerminal)}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 3,
              background: openTerminal ? COLORS.teal : "transparent",
              border: `2px solid ${openTerminal ? COLORS.teal : COLORS.muted}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {openTerminal && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ color: COLORS.light, fontSize: 12 }}>Open a new terminal window now</span>
          </div>
          <div style={{ color: COLORS.muted, fontSize: 11 }}>
            Run <code style={{ color: COLORS.teal, background: COLORS.surface, padding: "1px 6px", borderRadius: 3, fontSize: 10 }}>prism-cli --help</code> to get started, or visit{" "}
            <span style={{ color: COLORS.blue, textDecoration: "underline", cursor: "pointer" }}>github.com/TheDigitalGriot/prism-plugin</span>
          </div>
        </div>
      </div>
      <NavButtons onBack={() => {}} backDisabled onNext={() => {}} nextLabel="Close" />
    </div>
  );
}

// ─── CLOSED STATE ─────────────────────────────────────────────────────────────
function ClosedState({ onReopen }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 40, gap: 16,
    }}>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>Installer closed</div>
      <button onClick={onReopen} style={{
        padding: "8px 20px",
        background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.teal})`,
        border: "none", borderRadius: 4, color: "white",
        fontSize: 12, cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
      }}>Reopen Installer</button>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function PrismInstallerWindows() {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(
    Object.fromEntries(COMPONENTS.map(c => [c.id, c.defaultChecked]))
  );
  const [closed, setClosed] = useState(false);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#060D1A",
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
      padding: 24,
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i < step ? COLORS.teal : i === step ? COLORS.blue : COLORS.surface,
              transition: "all 0.3s",
            }} />
          </div>
        ))}
      </div>

      <WindowChrome onClose={() => setClosed(true)}>
        {closed ? (
          <ClosedState onReopen={() => { setClosed(false); setStep(0); }} />
        ) : step === 0 ? (
          <WelcomeStep onNext={next} />
        ) : step === 1 ? (
          <ComponentsStep checked={checked} setChecked={setChecked} onBack={back} onNext={next} />
        ) : step === 2 ? (
          <DirectoryStep onBack={back} onNext={next} />
        ) : step === 3 ? (
          <PreflightStep onBack={back} onNext={next} />
        ) : step === 4 ? (
          <ProgressStep checked={checked} onNext={next} />
        ) : (
          <FinishStep checked={checked} />
        )}
      </WindowChrome>

      <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 10 }}>
        Windows Installer Simulation — Prism v2.5.0 · NsDialogs + MUI2
      </div>
    </div>
  );
}
