import { useState, useEffect, useRef } from "react";

const C = {
  bg: "rgba(28, 28, 30, 0.96)",
  panel: "rgba(44, 44, 46, 0.9)",
  surface: "rgba(58, 58, 60, 0.8)",
  border: "rgba(255,255,255,0.1)",
  borderLight: "rgba(255,255,255,0.06)",
  muted: "rgba(255,255,255,0.4)",
  light: "rgba(255,255,255,0.7)",
  white: "rgba(255,255,255,0.92)",
  blue: "#4A9EFF",
  teal: "#2DD4BF",
  green: "#32D74B",
  amber: "#FF9F0A",
  red: "#FF453A",
  yellow: "#FFD60A",
  sidebarBg: "rgba(36,36,38,0.98)",
};

const STEPS = [
  { id: "intro", label: "Introduction", icon: "👋" },
  { id: "license", label: "License", icon: "📄" },
  { id: "destination", label: "Destination", icon: "📁" },
  { id: "type", label: "Installation Type", icon: "⚙️" },
  { id: "install", label: "Installing", icon: "⬇️" },
  { id: "summary", label: "Summary", icon: "✅" },
];

const COMPONENTS = [
  { id: "cli", name: "Prism CLI", desc: "Core TUI and workflow engine", size: "2.1 MB", color: C.blue, icon: ">_" },
  { id: "vscode", name: "VS Code Extension", desc: "Pixel office monitor for VS Code / Cursor", size: "7.8 MB", color: C.teal, icon: "{}" },
  { id: "plugin", name: "Claude Code Plugin", desc: "25 slash commands + 10 agents", size: "1.2 MB", color: C.green, icon: "◈" },
  { id: "electron", name: "Prism Desktop App", desc: "Standalone visual workspace manager", size: "134 MB", color: C.amber, icon: "⬡" },
];

function TrafficLights({ onClose }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: "flex", gap: 8, alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {[
        [C.red, "✕", onClose],
        [C.yellow, "−", null],
        [C.green, "+", null],
      ].map(([color, sym, action], i) => (
        <button key={i} onClick={action || undefined} style={{
          width: 14, height: 14, borderRadius: "50%",
          background: color,
          border: `0.5px solid rgba(0,0,0,0.3)`,
          cursor: action ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, color: "rgba(0,0,0,0.7)", fontWeight: 700,
          transition: "filter 0.1s",
          outline: "none",
        }}>{hovered ? sym : ""}</button>
      ))}
    </div>
  );
}

function SpectralBar({ height = 3, style = {} }) {
  return (
    <div style={{
      height, borderRadius: height / 2,
      background: `linear-gradient(90deg, ${C.blue} 0%, ${C.teal} 33%, ${C.green} 66%, ${C.amber} 100%)`,
      ...style,
    }} />
  );
}

function MacWindow({ children, onClose }) {
  return (
    <div style={{
      width: 620,
      fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      background: C.bg,
      backdropFilter: "blur(40px) saturate(180%)",
      WebkitBackdropFilter: "blur(40px) saturate(180%)",
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.1)",
      userSelect: "none",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "12px 16px",
        background: "rgba(36,36,38,0.95)",
        borderBottom: `1px solid ${C.borderLight}`,
        position: "relative",
      }}>
        <TrafficLights onClose={onClose} />
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`,
          }} />
          <span style={{ color: C.light, fontSize: 12, fontWeight: 500 }}>Install Prism</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function Sidebar({ currentStep }) {
  return (
    <div style={{
      width: 160, flexShrink: 0,
      background: C.sidebarBg,
      borderRight: `1px solid ${C.borderLight}`,
      padding: "20px 0",
    }}>
      {STEPS.map((s, i) => {
        const idx = STEPS.findIndex(x => x.id === currentStep);
        const isDone = i < idx;
        const isCurrent = s.id === currentStep;
        return (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 16px", marginBottom: 2,
            background: isCurrent ? "rgba(74,158,255,0.12)" : "transparent",
            borderLeft: isCurrent ? `2px solid ${C.blue}` : "2px solid transparent",
            transition: "all 0.2s",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: isDone ? C.green : isCurrent ? C.blue : "rgba(255,255,255,0.08)",
              border: `1px solid ${isDone ? C.green : isCurrent ? C.blue : "rgba(255,255,255,0.12)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: isDone || isCurrent ? "white" : C.muted,
              fontWeight: 700,
              transition: "all 0.2s",
            }}>
              {isDone ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 11, fontWeight: isCurrent ? 500 : 400,
              color: isDone ? C.light : isCurrent ? C.white : C.muted,
              transition: "all 0.2s",
            }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel = "Continue", backDisabled = false, nextDisabled = false }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 20px",
      borderTop: `1px solid ${C.borderLight}`,
      background: "rgba(28,28,30,0.8)",
    }}>
      <button onClick={onBack} disabled={backDisabled} style={{
        padding: "6px 16px",
        background: backDisabled ? "transparent" : "rgba(255,255,255,0.07)",
        border: `1px solid ${backDisabled ? "transparent" : C.border}`,
        borderRadius: 6, color: backDisabled ? "transparent" : C.light,
        fontSize: 12, fontWeight: 500, cursor: backDisabled ? "default" : "pointer",
        fontFamily: "-apple-system, sans-serif",
        transition: "all 0.15s",
      }}>Go Back</button>
      <button onClick={onNext} disabled={nextDisabled} style={{
        padding: "6px 20px",
        background: nextDisabled
          ? "rgba(255,255,255,0.06)"
          : `linear-gradient(135deg, ${C.blue}, ${C.teal})`,
        border: "none", borderRadius: 6,
        color: nextDisabled ? C.muted : "white",
        fontSize: 12, fontWeight: 600, cursor: nextDisabled ? "default" : "pointer",
        fontFamily: "-apple-system, sans-serif",
        boxShadow: nextDisabled ? "none" : `0 0 20px ${C.blue}44`,
        transition: "all 0.15s",
      }}>{nextLabel}</button>
    </div>
  );
}

// ─── INTRO ────────────────────────────────────────────────────────────────────
function IntroStep({ onNext }) {
  return (
    <div style={{ flex: 1, padding: "28px 28px 0", overflowY: "auto" }}>
      <SpectralBar style={{ marginBottom: 22 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.blue}33, ${C.teal}33)`,
          border: `1px solid ${C.teal}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`,
          }} />
        </div>
        <div>
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: -0.5,
            background: `linear-gradient(90deg, ${C.blue}, ${C.teal}, ${C.green})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>PRISM 2.5.0</div>
          <div style={{ color: C.muted, fontSize: 12 }}>AI-powered development workflow system</div>
        </div>
      </div>

      <div style={{ color: C.light, fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
        This package will install the Prism development workflow ecosystem on your Mac. The installer will guide you through selecting components and configuring your environment.
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 10, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderLight}` }}>
          <span style={{ color: C.muted, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Package Contents</span>
        </div>
        {COMPONENTS.map((c, i) => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 14px",
            borderBottom: i < COMPONENTS.length - 1 ? `1px solid ${C.borderLight}` : "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: `${c.color}22`, border: `1px solid ${c.color}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: c.color, fontSize: 11, fontWeight: 700,
            }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.white, fontSize: 12, fontWeight: 500 }}>{c.name}</div>
              <div style={{ color: C.muted, fontSize: 10 }}>{c.desc}</div>
            </div>
            <span style={{ color: C.muted, fontSize: 10 }}>{c.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LICENSE ──────────────────────────────────────────────────────────────────
function LicenseStep() {
  const [agreed, setAgreed] = useState(false);
  return (
    <div style={{ flex: 1, padding: "20px 28px 0", display: "flex", flexDirection: "column" }}>
      <div style={{ color: C.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Software License Agreement</div>
      <div style={{
        flex: 1, maxHeight: 220, overflowY: "auto",
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "14px 16px",
        color: C.muted, fontSize: 11, lineHeight: 1.7,
        marginBottom: 14,
        fontFamily: "Monaco, Menlo, monospace",
      }}>
        {`MIT License\n\nCopyright (c) 2026 TheDigitalGriot\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}
      </div>
      <div style={{
        padding: "12px 14px", background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 8, marginBottom: 16,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
          To continue installing the software you must agree to the terms of the software license agreement. Click "Agree" to continue or "Disagree" to cancel the installation and quit the Installer.
        </span>
      </div>
    </div>
  );
}

// ─── DESTINATION ──────────────────────────────────────────────────────────────
function DestinationStep() {
  const [selected, setSelected] = useState("user");
  const opts = [
    { id: "user", label: "Install for me only", sub: "~/.prism/bin/ (recommended)", icon: "👤" },
    { id: "system", label: "Install for all users", sub: "/usr/local/bin/ (requires admin)", icon: "👥", disabled: true },
  ];
  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div style={{ color: C.white, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Select Destination</div>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Choose where to install Prism for this computer.</div>
      {opts.map(o => (
        <div key={o.id} onClick={() => !o.disabled && setSelected(o.id)} style={{
          display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
          marginBottom: 10,
          background: selected === o.id ? `${C.blue}15` : C.panel,
          border: `1.5px solid ${selected === o.id ? C.blue + "88" : C.border}`,
          borderRadius: 10, cursor: o.disabled ? "not-allowed" : "pointer",
          opacity: o.disabled ? 0.4 : 1, transition: "all 0.15s",
        }}>
          <span style={{ fontSize: 20 }}>{o.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontSize: 13, fontWeight: 500 }}>{o.label}</div>
            <div style={{ color: C.muted, fontSize: 11, fontFamily: "Monaco, monospace", marginTop: 2 }}>{o.sub}</div>
          </div>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: `2px solid ${selected === o.id ? C.blue : C.muted}`,
            background: selected === o.id ? C.blue : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {selected === o.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
          </div>
        </div>
      ))}
      <div style={{
        padding: "10px 14px", background: `${C.teal}11`, border: `1px solid ${C.teal}33`,
        borderRadius: 8, display: "flex", gap: 8, marginTop: 8,
      }}>
        <span style={{ color: C.teal, fontSize: 13 }}>ℹ</span>
        <span style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
          Shell PATH will be added to <code style={{ color: C.light, background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>~/.zshrc</code> and <code style={{ color: C.light, background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>~/.bash_profile</code>
        </span>
      </div>
    </div>
  );
}

// ─── INSTALLATION TYPE ────────────────────────────────────────────────────────
function TypeStep({ checked, setChecked }) {
  const [mode, setMode] = useState("standard");
  const total = COMPONENTS.reduce((acc, c) => {
    if (!checked[c.id]) return acc;
    const sizes = { cli: 2.1, vscode: 7.8, plugin: 1.2, electron: 134 };
    return acc + (sizes[c.id] || 0);
  }, 0);

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div style={{ color: C.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Installation Type</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          ["standard", "Standard Install", "Recommended components"],
          ["custom", "Custom Install", "Choose components"],
        ].map(([id, label, sub]) => (
          <div key={id} onClick={() => setMode(id)} style={{
            flex: 1, padding: "12px 14px", cursor: "pointer",
            background: mode === id ? `${C.blue}15` : C.panel,
            border: `1.5px solid ${mode === id ? C.blue + "88" : C.border}`,
            borderRadius: 10, transition: "all 0.15s", textAlign: "center",
          }}>
            <div style={{ color: mode === id ? C.white : C.light, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
            <div style={{ color: C.muted, fontSize: 10 }}>{sub}</div>
          </div>
        ))}
      </div>

      {mode === "custom" && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          {COMPONENTS.map((c, i) => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: i < COMPONENTS.length - 1 ? `1px solid ${C.borderLight}` : "none",
              cursor: c.id === "cli" ? "default" : "pointer",
              opacity: c.id === "cli" ? 0.7 : 1,
            }} onClick={() => c.id !== "cli" && setChecked(p => ({ ...p, [c.id]: !p[c.id] }))}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                background: checked[c.id] ? c.color : "transparent",
                border: `2px solid ${checked[c.id] ? c.color : C.muted}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {checked[c.id] && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: `${c.color}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: c.color, fontSize: 10, fontWeight: 700,
              }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.white, fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                <div style={{ color: C.muted, fontSize: 10 }}>{c.desc}</div>
              </div>
              <div style={{ color: C.muted, fontSize: 10 }}>{c.size}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "right", color: C.muted, fontSize: 11 }}>
        Total: <span style={{ color: C.light }}>{total.toFixed(1)} MB</span>
      </div>
    </div>
  );
}

// ─── INSTALLING ───────────────────────────────────────────────────────────────
function InstallingStep({ checked, onNext }) {
  const active = COMPONENTS.filter(c => checked[c.id]);
  const [states, setStates] = useState(active.map(c => ({ ...c, status: "pending", pct: 0 })));
  const [overall, setOverall] = useState(0);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const logRef = useRef();

  useEffect(() => {
    const addLog = (msg) => setLog(l => [...l, msg]);
    const delay = ms => new Promise(r => setTimeout(r, ms));

    const run = async () => {
      const perStep = 100 / active.length;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        setStates(s => s.map((x, j) => j === i ? { ...x, status: "installing", pct: 0 } : x));
        addLog(`Installing ${c.name}...`);

        for (let p = 0; p <= 100; p += 20) {
          await delay(150);
          setStates(s => s.map((x, j) => j === i ? { ...x, pct: p } : x));
        }

        if (c.id === "cli") addLog("  ✓ Copied to ~/.prism/bin/prism-cli");
        if (c.id === "vscode") { addLog("  ✓ VS Code extension installed"); addLog("  ✓ Cursor extension installed"); }
        if (c.id === "plugin") addLog("  ✓ Commands + agents copied to ~/.claude/");
        if (c.id === "electron") { addLog("  → Downloading Prism.app (134 MB)..."); await delay(400); addLog("  ✓ Prism.app moved to /Applications"); }

        setStates(s => s.map((x, j) => j === i ? { ...x, status: "done", pct: 100 } : x));
        setOverall(Math.round((i + 1) * perStep));
        await delay(250);
      }

      addLog("\n✓ Installation successful");
      setDone(true);
    };
    run();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div style={{ color: C.white, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {done ? "Installation Complete" : "Installing Prism..."}
      </div>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 16 }}>
        {done ? "All components installed successfully." : "Please wait while the installer sets up your components."}
      </div>

      {/* Overall */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: 11 }}>Overall</span>
          <span style={{ color: C.teal, fontSize: 11 }}>{overall}%</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            background: `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
            width: `${overall}%`, transition: "width 0.3s ease",
            borderRadius: 3,
            boxShadow: `0 0 8px ${C.teal}88`,
          }} />
        </div>
      </div>

      {/* Per-component */}
      <div style={{ marginBottom: 14 }}>
        {states.map(c => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", marginBottom: 6,
            background: c.status !== "pending" ? C.panel : "transparent",
            border: `1px solid ${c.status !== "pending" ? C.border : "transparent"}`,
            borderRadius: 8, transition: "all 0.2s",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 5, flexShrink: 0,
              background: `${c.color}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: c.color, fontSize: 9, fontWeight: 700,
            }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: c.status === "pending" ? C.muted : C.white, fontSize: 12 }}>{c.name}</div>
              {c.status === "installing" && (
                <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", background: c.color, borderRadius: 2,
                    width: `${c.pct}%`, transition: "width 0.2s ease",
                  }} />
                </div>
              )}
            </div>
            <span style={{
              fontSize: 12,
              color: c.status === "done" ? C.green : c.status === "installing" ? C.amber : C.muted,
            }}>
              {c.status === "done" ? "✓" : c.status === "installing" ? "..." : "○"}
            </span>
          </div>
        ))}
      </div>

      {/* Log */}
      <div ref={logRef} style={{
        height: 72, background: "rgba(0,0,0,0.4)",
        border: `1px solid ${C.borderLight}`, borderRadius: 6,
        padding: "8px 10px", overflowY: "auto",
        fontFamily: "Monaco, Menlo, monospace", fontSize: 9,
      }}>
        {log.map((l, i) => (
          <div key={i} style={{ color: l.startsWith("  ✓") ? C.green : l.startsWith("  →") ? C.amber : C.muted, lineHeight: 1.7 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function SummaryStep({ checked }) {
  const installed = COMPONENTS.filter(c => checked[c.id]);
  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 14, margin: "0 auto 12px",
          background: `linear-gradient(135deg, ${C.green}33, ${C.teal}33)`,
          border: `1.5px solid ${C.green}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
        }}>✓</div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: -0.5,
          background: `linear-gradient(90deg, ${C.green}, ${C.teal})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 4,
        }}>Prism Installed Successfully</div>
        <div style={{ color: C.muted, fontSize: 12 }}>v2.5.0 is ready to use on your Mac</div>
      </div>

      <SpectralBar style={{ marginBottom: 16 }} />

      <div style={{ marginBottom: 16 }}>
        {installed.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: C.green, fontSize: 12 }}>✓</span>
            <div style={{
              width: 22, height: 22, borderRadius: 5, background: `${c.color}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: c.color, fontSize: 9, fontWeight: 700,
            }}>{c.icon}</div>
            <span style={{ color: C.light, fontSize: 12, flex: 1 }}>{c.name}</span>
            <span style={{ color: C.muted, fontSize: 10 }}>Installed</span>
          </div>
        ))}
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Getting Started</div>
        <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.7 }}>
          Open a new terminal and run{" "}
          <code style={{ color: C.teal, background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>prism-cli --help</code>
          {" "}to get started.
        </div>
        {checked.electron && (
          <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
            <code style={{ color: C.amber, background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>Prism.app</code> is available in your Applications folder.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CLOSED ───────────────────────────────────────────────────────────────────
function ClosedState({ onReopen }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, gap: 16 }}>
      <div style={{ color: C.muted, fontSize: 13 }}>Installer closed</div>
      <button onClick={onReopen} style={{
        padding: "8px 20px",
        background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`,
        border: "none", borderRadius: 8, color: "white",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "-apple-system, sans-serif",
        boxShadow: `0 0 20px ${C.blue}44`,
      }}>Reopen Installer</button>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function PrismInstallerMac() {
  const [stepIdx, setStepIdx] = useState(0);
  const [checked, setChecked] = useState({ cli: true, vscode: true, plugin: true, electron: false });
  const [closed, setClosed] = useState(false);
  const step = STEPS[stepIdx].id;

  const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx(i => Math.max(i - 1, 0));

  const getNextLabel = () => {
    if (step === "license") return "Agree";
    if (step === "type") return "Install";
    if (step === "install") return "Continue";
    if (step === "summary") return "Close";
    return "Continue";
  };

  const isNextDisabled = () => step === "install" && stepIdx === STEPS.findIndex(s => s.id === "install");

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 30% 40%, #0A1628 0%, #060D1A 60%, #020810 100%)",
      fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      padding: 24,
    }}>
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>

      <MacWindow onClose={() => setClosed(true)}>
        {closed ? (
          <ClosedState onReopen={() => { setClosed(false); setStepIdx(0); }} />
        ) : (
          <>
            <div style={{ display: "flex", minHeight: 380 }}>
              <Sidebar currentStep={step} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {step === "intro" && <IntroStep onNext={next} />}
                {step === "license" && <LicenseStep />}
                {step === "destination" && <DestinationStep />}
                {step === "type" && <TypeStep checked={checked} setChecked={setChecked} />}
                {step === "install" && <InstallingStep checked={checked} onNext={next} />}
                {step === "summary" && <SummaryStep checked={checked} />}
              </div>
            </div>
            <NavRow
              onBack={back}
              onNext={step === "summary" ? () => setClosed(true) : next}
              nextLabel={getNextLabel()}
              backDisabled={stepIdx === 0 || step === "install" || step === "summary"}
            />
          </>
        )}
      </MacWindow>

      <div style={{ marginTop: 12, color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
        macOS Installer Simulation — Prism v2.5.0 · PKG Wizard
      </div>
    </div>
  );
}
