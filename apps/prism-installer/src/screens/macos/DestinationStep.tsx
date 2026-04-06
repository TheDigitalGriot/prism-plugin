import { useState } from "react";
import { MAC } from "../../theme/colors";

interface DestinationStepProps {
  installDir: string;
  setInstallDir: (dir: string) => void;
}

const OPTS = [
  {
    id: "user",
    label: "Install for me only",
    sub: "~/.prism/bin/ (recommended)",
    icon: "👤",
    disabled: false,
    dir: "~/.prism",
  },
  {
    id: "system",
    label: "Install for all users",
    sub: "/usr/local/bin/ (requires admin)",
    icon: "👥",
    disabled: true,
    dir: "/usr/local",
  },
] as const;

export function DestinationStep({ setInstallDir }: DestinationStepProps) {
  const [selected, setSelected] = useState<"user" | "system">("user");

  const handleSelect = (id: "user" | "system") => {
    const opt = OPTS.find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    setSelected(id);
    setInstallDir(opt.dir);
  };

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div
        style={{
          color: MAC.white,
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Select Destination
      </div>
      <div
        style={{ color: MAC.muted, fontSize: 12, marginBottom: 16 }}
      >
        Choose where to install Prism for this computer.
      </div>

      {OPTS.map((o) => (
        <div
          key={o.id}
          onClick={() => handleSelect(o.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            marginBottom: 10,
            background: selected === o.id ? `${MAC.blue}15` : MAC.panel,
            border: `1.5px solid ${
              selected === o.id ? MAC.blue + "88" : MAC.border
            }`,
            borderRadius: 10,
            cursor: o.disabled ? "not-allowed" : "pointer",
            opacity: o.disabled ? 0.4 : 1,
            transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 20 }}>{o.icon}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{ color: MAC.white, fontSize: 13, fontWeight: 500 }}
            >
              {o.label}
            </div>
            <div
              style={{
                color: MAC.muted,
                fontSize: 11,
                fontFamily: "Monaco, monospace",
                marginTop: 2,
              }}
            >
              {o.sub}
            </div>
          </div>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: `2px solid ${
                selected === o.id ? MAC.blue : MAC.muted
              }`,
              background:
                selected === o.id ? MAC.blue : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            {selected === o.id && (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "white",
                }}
              />
            )}
          </div>
        </div>
      ))}

      <div
        style={{
          padding: "10px 14px",
          background: `${MAC.teal}11`,
          border: `1px solid ${MAC.teal}33`,
          borderRadius: 8,
          display: "flex",
          gap: 8,
          marginTop: 8,
        }}
      >
        <span style={{ color: MAC.teal, fontSize: 13 }}>ℹ</span>
        <span style={{ color: MAC.muted, fontSize: 11, lineHeight: 1.5 }}>
          Shell PATH will be added to{" "}
          <code
            style={{
              color: MAC.light,
              background: "rgba(255,255,255,0.08)",
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
            }}
          >
            ~/.zshrc
          </code>{" "}
          and{" "}
          <code
            style={{
              color: MAC.light,
              background: "rgba(255,255,255,0.08)",
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 10,
            }}
          >
            ~/.bash_profile
          </code>
        </span>
      </div>
    </div>
  );
}
