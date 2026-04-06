import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Channel } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { MAC } from "../../theme/colors";
import { COMPONENTS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";

interface DetectedTool {
  name: string;
  version: string | null;
  executable: string | null;
  install_location: string | null;
  install_method: string;
  cli_available: boolean;
  metadata: Record<string, string>;
}

interface ComponentState {
  id: string;
  name: string;
  color: string;
  icon: string;
  status: "pending" | "installing" | "done" | "failed";
  pct: number;
}

interface InstallingStepProps {
  checked: ComponentSelection;
  installDir: string;
  onDone: () => void;
}

export function InstallingStep({ checked, installDir, onDone }: InstallingStepProps) {
  const active = COMPONENTS.filter((c) => checked[c.id]);
  const [states, setStates] = useState<ComponentState[]>(
    active.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      status: "pending",
      pct: 0,
    }))
  );
  const [overall, setOverall] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLog((l) => [...l, msg]);

  useEffect(() => {
    const run = async () => {
      const appVersion = await getVersion();
      const perStep = 100 / active.length;

      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        setStates((s) =>
          s.map((x, j) => (j === i ? { ...x, status: "installing", pct: 0 } : x))
        );
        addLog(`Installing ${c.name}...`);

        try {
          if (c.id === "cli") {
            const sourcePath = `${installDir}/binaries/prism-cli-darwin-arm64`;
            await invoke("install_cli", { sourcePath, installDir });
            addLog("  ✓ Copied to ~/.prism/bin/prism-cli");
          } else if (c.id === "vscode") {
            const editors = await invoke<DetectedTool[]>("detect_editors");
            const vsixPath = `${installDir}/extensions/prism.vsix`;
            await invoke("install_all_extensions", { editors, vsixPath });
            for (const e of editors) {
              const ver = e.version ? ` v${e.version}` : "";
              addLog(`  ✓ ${e.name}${ver} extension installed`);
            }
          } else if (c.id === "plugin") {
            const claudeTool = await invoke<DetectedTool | null>("detect_claude_code");
            const sourceDir = `${installDir}/plugin`;
            await invoke("install_plugin", {
              claudeTool: claudeTool ?? null,
              claudePath: null,
              sourceDir,
            });
            addLog("  ✓ Commands + agents copied to ~/.claude/");
          } else if (c.id === "electron") {
            addLog("  → Downloading Prism.app (134 MB)...");
            const onProgress = new Channel<{
              event: string;
              data: { percent?: number };
            }>();
            onProgress.onmessage = (msg) => {
              if (msg.event === "Progress" && msg.data.percent !== undefined) {
                setStates((s) =>
                  s.map((x, j) =>
                    j === i ? { ...x, pct: msg.data.percent! } : x
                  )
                );
              }
            };
            await invoke("download_desktop_app", {
              version: appVersion,
              onProgress,
            });
            addLog("  ✓ Prism.app moved to /Applications");
          }

          setStates((s) =>
            s.map((x, j) => (j === i ? { ...x, status: "done", pct: 100 } : x))
          );
        } catch (err) {
          setStates((s) =>
            s.map((x, j) => (j === i ? { ...x, status: "failed", pct: 0 } : x))
          );
          addLog(`  ✕ Failed: ${String(err)}`);
        }

        setOverall(Math.round((i + 1) * perStep));
      }

      addLog("\n✓ Installation successful");
      setDone(true);
      onDone();
    };

    run();
  }, []);

  useEffect(() => {
    if (logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div
        style={{ color: MAC.white, fontSize: 14, fontWeight: 600, marginBottom: 4 }}
      >
        {done ? "Installation Complete" : "Installing Prism..."}
      </div>
      <div style={{ color: MAC.muted, fontSize: 11, marginBottom: 16 }}>
        {done
          ? "All components installed successfully."
          : "Please wait while the installer sets up your components."}
      </div>

      {/* Overall progress */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ color: MAC.muted, fontSize: 11 }}>Overall</span>
          <span style={{ color: MAC.teal, fontSize: 11 }}>{overall}%</span>
        </div>
        <div
          style={{
            height: 5,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: `linear-gradient(90deg, ${MAC.blue}, ${MAC.teal})`,
              width: `${overall}%`,
              transition: "width 0.3s ease",
              borderRadius: 3,
              boxShadow: `0 0 8px ${MAC.teal}88`,
            }}
          />
        </div>
      </div>

      {/* Per-component */}
      <div style={{ marginBottom: 14 }}>
        {states.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              marginBottom: 6,
              background: c.status !== "pending" ? MAC.panel : "transparent",
              border: `1px solid ${
                c.status !== "pending" ? MAC.border : "transparent"
              }`,
              borderRadius: 8,
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 5,
                flexShrink: 0,
                background: `${c.color}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: c.color,
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {c.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  color:
                    c.status === "pending" ? MAC.muted : MAC.white,
                  fontSize: 12,
                }}
              >
                {c.name}
              </div>
              {c.status === "installing" && (
                <div
                  style={{
                    height: 3,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    marginTop: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: c.color,
                      borderRadius: 2,
                      width: `${c.pct}%`,
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                color:
                  c.status === "done"
                    ? MAC.green
                    : c.status === "installing"
                    ? MAC.amber
                    : c.status === "failed"
                    ? MAC.red
                    : MAC.muted,
              }}
            >
              {c.status === "done"
                ? "✓"
                : c.status === "installing"
                ? "..."
                : c.status === "failed"
                ? "✕"
                : "○"}
            </span>
          </div>
        ))}
      </div>

      {/* Log */}
      <div
        ref={logRef}
        style={{
          height: 72,
          background: "rgba(0,0,0,0.4)",
          border: `1px solid ${MAC.borderLight}`,
          borderRadius: 6,
          padding: "8px 10px",
          overflowY: "auto",
          fontFamily: "Monaco, Menlo, monospace",
          fontSize: 9,
        }}
      >
        {log.map((l, i) => (
          <div
            key={i}
            style={{
              color: l.startsWith("  ✓")
                ? MAC.green
                : l.startsWith("  →")
                ? MAC.amber
                : l.startsWith("  ✕")
                ? MAC.red
                : MAC.muted,
              lineHeight: 1.7,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
