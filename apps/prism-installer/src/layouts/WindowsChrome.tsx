import { ReactNode, useEffect, useState } from "react";
import { WIN } from "../theme/colors";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

interface WindowsChromeProps {
  children: ReactNode;
}

export function WindowsChrome({ children }: WindowsChromeProps) {
  const appWindow = getCurrentWindow();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  return (
    <div
      style={{
        width: 520,
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        background: WIN.dark,
        border: `1px solid ${WIN.border}`,
        boxShadow:
          "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
        borderRadius: 6,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: WIN.titleBg,
          borderBottom: `1px solid ${WIN.border}`,
        }}
      >
        <div
          data-tauri-drag-region
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${WIN.blue}, ${WIN.teal})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "white",
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            P
          </div>
          <span style={{ color: WIN.light, fontSize: 11 }}>
            Prism Setup{version ? ` — v${version}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(
            [
              ["─", false, () => appWindow.minimize()],
              ["□", false, () => appWindow.toggleMaximize()],
              ["✕", true, () => appWindow.close()],
            ] as [string, boolean, () => void][]
          ).map(([icon, isClose, action], i) => (
            <button
              key={i}
              onClick={action}
              style={{
                width: 20,
                height: 20,
                background: isClose
                  ? "rgba(248,113,113,0.15)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  isClose ? "rgba(248,113,113,0.3)" : WIN.border
                }`,
                borderRadius: 3,
                color: isClose ? WIN.red : WIN.muted,
                fontSize: 9,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
