import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Channel } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";
import { SpectralBar } from "../../components/SpectralBar";
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
  status: "pending" | "installing" | "done" | "failed";
  detail: string;
}

interface ProgressStepProps {
  checked: ComponentSelection;
  installDir: string;
  onNext: () => void;
}

export function ProgressStep({ checked, installDir, onNext }: ProgressStepProps) {
  const activeComponents = COMPONENTS.filter((c) => checked[c.id]);
  const [states, setStates] = useState<ComponentState[]>(
    activeComponents.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      status: "pending",
      detail: "",
    }))
  );
  const [overallProgress, setOverallProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLog((l) => [...l, msg]);
  const setStatus = (
    idx: number,
    status: ComponentState["status"],
    detail: string
  ) => {
    setStates((s) =>
      s.map((x, j) => (j === idx ? { ...x, status, detail } : x))
    );
  };

  useEffect(() => {
    const run = async () => {
      const appVersion = await getVersion();
      const perStep = 100 / activeComponents.length;

      for (let i = 0; i < activeComponents.length; i++) {
        const c = activeComponents[i];
        setStatus(i, "installing", "Preparing...");
        addLog(`[${c.name}] Starting installation...`);

        try {
          if (c.id === "cli") {
            setStatus(i, "installing", "Copying binary...");
            const sourcePath = `${installDir}\\binaries\\prism-cli-windows-amd64.exe`;
            addLog(`[CLI] Copying prism-cli to ${installDir}\\bin\\prism-cli.exe`);
            await invoke("install_cli", { sourcePath, installDir });
            addLog(`[CLI] PATH updated in HKCU\\Environment`);
          } else if (c.id === "vscode") {
            setStatus(i, "installing", "Installing VSIX into editors...");
            const editors = await invoke<DetectedTool[]>("detect_editors");
            const vsixPath = `${installDir}\\extensions\\prism.vsix`;
            for (const editor of editors) {
              const ver = editor.version ? ` v${editor.version}` : "";
              addLog(`[${editor.name}${ver}] Installing extension...`);
            }
            await invoke("install_all_extensions", { editors, vsixPath });
            addLog(`[Extension] VSIX installed into ${editors.length} editor(s)`);
          } else if (c.id === "plugin") {
            setStatus(i, "installing", "Installing Claude plugin...");
            const claudeTool = await invoke<DetectedTool | null>("detect_claude_code");
            const sourceDir = `${installDir}\\plugin`;
            addLog(
              claudeTool?.cli_available
                ? `[Plugin] Installing via Claude CLI${claudeTool.version ? ` v${claudeTool.version}` : ""}...`
                : `[Plugin] Claude CLI not found — using file-copy fallback`
            );
            await invoke("install_plugin", {
              claudeTool: claudeTool ?? null,
              claudePath: null,
              sourceDir,
            });
            addLog(`[Plugin] Plugin files installed to ~/.claude/`);
          } else if (c.id === "electron") {
            setStatus(i, "installing", "Downloading Prism Desktop App...");
            addLog(`[Desktop] Downloading from GitHub releases...`);
            const onProgress = new Channel<{
              event: string;
              data: { downloaded?: number; total?: number; percent?: number };
            }>();
            onProgress.onmessage = (msg) => {
              if (msg.event === "Progress" && msg.data.percent !== undefined) {
                setStatus(
                  i,
                  "installing",
                  `Downloading... ${msg.data.percent.toFixed(0)}%`
                );
              }
            };
            await invoke("download_desktop_app", {
              version: appVersion,
              onProgress,
            });
            addLog(`[Desktop] Running installer silently...`);
          }

          setStatus(i, "done", "Installed successfully");
          addLog(`[${c.name}] ✓ Complete`);
        } catch (err) {
          setStatus(i, "failed", String(err));
          addLog(`[${c.name}] ✕ Failed: ${String(err)}`);
        }

        setOverallProgress(Math.min(Math.round((i + 1) * perStep), 100));
      }

      setDone(true);
    };

    run();
  }, []);

  useEffect(() => {
    if (logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const statusIcon: Record<string, [string, string]> = {
    pending: ["○", WIN.muted],
    installing: ["◌", WIN.amber],
    done: ["●", WIN.green],
    failed: ["✕", WIN.red],
  };

  return (
    <div>
      {/* Header */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <SpectralBar height={4} />
        <div
          style={{
            padding: "18px 24px 16px",
            background: "linear-gradient(180deg, #0D1829 0%, #0F172A 100%)",
            borderBottom: `1px solid ${WIN.border}`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${WIN.blue}22, ${WIN.teal}22)`,
              border: `1px solid ${WIN.teal}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                background: `linear-gradient(135deg, ${WIN.blue}, ${WIN.teal})`,
                borderRadius: 4,
              }}
            />
          </div>
          <div>
            <div
              style={{
                color: WIN.white,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              Installing Prism
            </div>
            <div style={{ color: WIN.muted, fontSize: 11, marginTop: 2 }}>
              Please wait while components are installed
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {/* Overall progress */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ color: WIN.light, fontSize: 11 }}>
              Overall progress
            </span>
            <span style={{ color: WIN.teal, fontSize: 11 }}>
              {overallProgress}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: WIN.mid,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                background: `linear-gradient(90deg, ${WIN.blue}, ${WIN.teal})`,
                width: `${overallProgress}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Per-component */}
        {states.map((c) => {
          const [icon, color] = statusIcon[c.status];
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                marginBottom: 6,
                background: c.status !== "pending" ? WIN.mid : "transparent",
                border: `1px solid ${
                  c.status !== "pending" ? WIN.border : "transparent"
                }`,
                borderRadius: 5,
                transition: "all 0.2s",
              }}
            >
              <span style={{ color, fontSize: 14 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color:
                      c.status === "pending" ? WIN.muted : WIN.white,
                    fontSize: 12,
                  }}
                >
                  {c.name}
                </div>
                {c.detail && (
                  <div style={{ color: WIN.muted, fontSize: 10 }}>
                    {c.detail}
                  </div>
                )}
              </div>
              {c.status === "installing" && (
                <div
                  style={{
                    width: 60,
                    height: 3,
                    background: WIN.surface,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: WIN.amber,
                      borderRadius: 2,
                      width: "40%",
                      animation: "pulse 1s infinite",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Log */}
        <div
          ref={logRef}
          style={{
            marginTop: 10,
            height: 80,
            background: WIN.logBg,
            border: `1px solid ${WIN.border}`,
            borderRadius: 4,
            padding: "8px 10px",
            overflowY: "auto",
            fontFamily: "Consolas, monospace",
            fontSize: 9,
          }}
        >
          {log.map((l, i) => (
            <div key={i} style={{ color: WIN.muted, lineHeight: 1.7 }}>
              {l}
            </div>
          ))}
        </div>
      </div>

      <NavButtons
        onBack={() => {}}
        backDisabled
        onNext={onNext}
        nextLabel="Finish →"
        nextDisabled={!done}
      />
    </div>
  );
}
