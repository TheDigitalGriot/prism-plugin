import { ReactNode, useState } from "react";
import { MAC } from "../theme/colors";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface TrafficLightsProps {
  onClose: () => void;
}

function TrafficLights({ onClose }: TrafficLightsProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ display: "flex", gap: 8, alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(
        [
          [MAC.red, "✕", onClose],
          [MAC.yellow, "−", null],
          [MAC.green, "+", null],
        ] as [string, string, (() => void) | null][]
      ).map(([color, sym, action], i) => (
        <button
          key={i}
          onClick={action ?? undefined}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: color,
            border: "0.5px solid rgba(0,0,0,0.3)",
            cursor: action ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "rgba(0,0,0,0.7)",
            fontWeight: 700,
            transition: "filter 0.1s",
            outline: "none",
          }}
        >
          {hovered ? sym : ""}
        </button>
      ))}
    </div>
  );
}

interface MacWindowProps {
  children: ReactNode;
}

export function MacWindow({ children }: MacWindowProps) {
  const appWindow = getCurrentWindow();

  return (
    <div
      style={{
        width: 620,
        fontFamily:
          "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        background: MAC.bg,
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: `1px solid ${MAC.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow:
          "0 40px 120px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.1)",
        userSelect: "none",
      }}
    >
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          background: "rgba(36,36,38,0.95)",
          borderBottom: `1px solid ${MAC.borderLight}`,
          position: "relative",
        }}
      >
        <TrafficLights onClose={() => appWindow.close()} />
        <div
          data-tauri-drag-region
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${MAC.blue}, ${MAC.teal})`,
            }}
          />
          <span style={{ color: MAC.light, fontSize: 12, fontWeight: 500 }}>
            Install Prism
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
