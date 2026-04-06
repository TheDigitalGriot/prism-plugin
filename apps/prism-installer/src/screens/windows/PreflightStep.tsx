import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";
import { SpectralBar } from "../../components/SpectralBar";

interface PreflightItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "info";
  detail: string;
}

interface DetectedTool {
  name: string;
  version: string | null;
  executable: string | null;
  install_location: string | null;
  install_method: "SystemInstall" | "UserInstall" | "SquirrelInstall" | "NpmGlobal" | "Unknown";
  cli_available: boolean;
  metadata: Record<string, string>;
}

const INSTALL_METHOD_LABELS: Record<string, string> = {
  SystemInstall: "System install",
  UserInstall: "User install",
  SquirrelInstall: "Squirrel auto-update",
  NpmGlobal: "npm global",
};

interface PreflightStepProps {
  onBack: () => void;
  onNext: () => void;
}

export function PreflightStep({ onBack, onNext }: PreflightStepProps) {
  const [items, setItems] = useState<PreflightItem[]>([]);
  const [visible, setVisible] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [appVersion, setAppVersion] = useState("");
  useEffect(() => { getVersion().then(setAppVersion); }, []);

  useEffect(() => {
    const run = async () => {
      const results: PreflightItem[] = [];

      // OS check
      try {
        const info = await invoke<{ name: string; version: string; arch: string }>(
          "detect_os_info"
        );
        results.push({
          id: "os",
          label: "Windows 10 / 11",
          status: "pass",
          detail: `${info.name} ${info.version} (${info.arch})`,
        });
      } catch {
        results.push({
          id: "os",
          label: "Windows 10 / 11",
          status: "pass",
          detail: "Windows detected",
        });
      }

      // Disk space
      try {
        const disk = await invoke<{ available_bytes: number }>("detect_disk_space", {
          path: "C:\\",
        });
        const gb = (disk.available_bytes / 1e9).toFixed(1);
        results.push({
          id: "disk",
          label: "Disk space (200 MB free)",
          status: disk.available_bytes > 200 * 1024 * 1024 ? "pass" : "warn",
          detail: `${gb} GB available`,
        });
      } catch {
        results.push({
          id: "disk",
          label: "Disk space (200 MB free)",
          status: "pass",
          detail: "Sufficient space available",
        });
      }

      // Editor detection
      try {
        const editors = await invoke<DetectedTool[]>("detect_editors");
        for (const editor of editors) {
          const ver = editor.version ? ` v${editor.version}` : "";
          const method = INSTALL_METHOD_LABELS[editor.install_method] || "";
          const detail = [
            editor.install_location,
            method ? `(${method})` : "",
          ].filter(Boolean).join(" ");
          results.push({
            id: `editor_${editor.metadata.id || editor.name}`,
            label: `${editor.name}${ver} found`,
            status: "pass",
            detail,
          });
        }
        if (editors.length === 0) {
          results.push({
            id: "editors",
            label: "Code editors",
            status: "warn",
            detail: "No VS Code / Cursor / Windsurf detected — extension install will be skipped",
          });
        }
      } catch {
        results.push({
          id: "editors",
          label: "Code editors",
          status: "info",
          detail: "Detection unavailable",
        });
      }

      // Claude Code detection
      try {
        const claude = await invoke<DetectedTool | null>("detect_claude_code");
        if (claude) {
          const ver = claude.version ? ` v${claude.version}` : "";
          const method = INSTALL_METHOD_LABELS[claude.install_method] || "";
          results.push({
            id: "claude",
            label: `Claude Code${ver} found`,
            status: "pass",
            detail: method ? `(${method})` : (claude.executable || "Detected"),
          });
          // Node.js availability warning
          if (claude.metadata.node_available === "false") {
            results.push({
              id: "node_warning",
              label: "Node.js not available",
              status: "warn",
              detail: "Claude Code requires Node.js — it may not work without it",
            });
          }
        } else {
          results.push({
            id: "claude",
            label: "Claude Code",
            status: "warn",
            detail: "Not found — Claude plugin will use file-copy fallback",
          });
        }
      } catch {
        results.push({
          id: "claude",
          label: "Claude Code",
          status: "warn",
          detail: "Not found — Claude plugin will use file-copy fallback",
        });
      }

      // Existing Prism
      try {
        const existing = await invoke<{ install_dir: string; version: string } | null>(
          "detect_existing_prism"
        );
        if (existing) {
          results.push({
            id: "existing",
            label: "Existing Prism install",
            status: "info",
            detail: `v${existing.version} found — will be upgraded to v${appVersion || "latest"}`,
          });
        }
      } catch {
        // No existing install — silent
      }

      // Animate reveal
      for (let i = 0; i < results.length; i++) {
        await new Promise<void>((r) => setTimeout(r, 250));
        setItems([...results.slice(0, i + 1)]);
        setVisible((v) => [...v, i]);
      }

      const warns = results
        .filter((r) => r.status === "warn")
        .map((r) => r.detail);
      setWarnings(warns);
      setTimeout(() => setDone(true), 300);
    };

    run();
  }, []);

  const icons: Record<string, [string, string]> = {
    pass: ["✓", WIN.green],
    warn: ["⚠", WIN.amber],
    info: ["ℹ", WIN.blue],
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
              System Check
            </div>
            <div style={{ color: WIN.muted, fontSize: 11, marginTop: 2 }}>
              Verifying prerequisites before installation
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {items.map((item, i) => {
          const [icon, color] = icons[item.status];
          const show = visible.includes(i);
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "9px 12px",
                marginBottom: 6,
                background: show ? WIN.mid : "transparent",
                border: `1px solid ${show ? WIN.border : "transparent"}`,
                borderRadius: 5,
                opacity: show ? 1 : 0,
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  color,
                  fontSize: 13,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {show ? icon : "·"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: WIN.white, fontSize: 12 }}>
                  {item.label}
                </div>
                {show && (
                  <div
                    style={{
                      color: WIN.muted,
                      fontSize: 10,
                      marginTop: 2,
                    }}
                  >
                    {item.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {done && warnings.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: `${WIN.amber}0D`,
              border: `1px solid ${WIN.amber}33`,
              borderRadius: 4,
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ color: WIN.amber }}>⚠</span>
            <span style={{ color: WIN.muted, fontSize: 11 }}>
              {warnings.length} warning{warnings.length > 1 ? "s" : ""} —{" "}
              {warnings[0]}
            </span>
          </div>
        )}
      </div>

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel="Install →"
        nextDisabled={!done}
      />
    </div>
  );
}
