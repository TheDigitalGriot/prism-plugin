import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { MAC } from "../../theme/colors";
import { SpectralBar } from "../../components/SpectralBar";
import { COMPONENTS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";

interface SummaryStepProps {
  checked: ComponentSelection;
}

export function SummaryStep({ checked }: SummaryStepProps) {
  const [version, setVersion] = useState("");
  useEffect(() => { getVersion().then(setVersion); }, []);
  const installed = COMPONENTS.filter((c) => checked[c.id]);

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            margin: "0 auto 12px",
            background: `linear-gradient(135deg, ${MAC.green}33, ${MAC.teal}33)`,
            border: `1.5px solid ${MAC.green}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          ✓
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: -0.5,
            background: `linear-gradient(90deg, ${MAC.green}, ${MAC.teal})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}
        >
          Prism Installed Successfully
        </div>
        <div style={{ color: MAC.muted, fontSize: 12 }}>
          {version ? `v${version}` : "Prism"} is ready to use on your Mac
        </div>
      </div>

      <SpectralBar style={{ marginBottom: 16 }} />

      <div style={{ marginBottom: 16 }}>
        {installed.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{ color: MAC.green, fontSize: 12 }}>✓</span>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
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
            <span style={{ color: MAC.light, fontSize: 12, flex: 1 }}>
              {c.name}
            </span>
            <span style={{ color: MAC.muted, fontSize: 10 }}>Installed</span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: MAC.panel,
          border: `1px solid ${MAC.border}`,
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            color: MAC.muted,
            fontSize: 11,
            marginBottom: 8,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Getting Started
        </div>
        <div style={{ color: MAC.muted, fontSize: 11, lineHeight: 1.7 }}>
          Open a new terminal and run{" "}
          <code
            style={{
              color: MAC.teal,
              background: "rgba(255,255,255,0.08)",
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
            }}
          >
            prism-cli --help
          </code>{" "}
          to get started.
        </div>
        {checked.electron && (
          <div style={{ color: MAC.muted, fontSize: 11, marginTop: 6 }}>
            <code
              style={{
                color: MAC.amber,
                background: "rgba(255,255,255,0.08)",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              Prism.app
            </code>{" "}
            is available in your Applications folder.
          </div>
        )}
      </div>
    </div>
  );
}
