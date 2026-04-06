import { useState } from "react";
import { MAC } from "../../theme/colors";
import { COMPONENTS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";

interface TypeStepProps {
  checked: ComponentSelection;
  setChecked: React.Dispatch<React.SetStateAction<ComponentSelection>>;
}

export function TypeStep({ checked, setChecked }: TypeStepProps) {
  const [mode, setMode] = useState<"standard" | "custom">("standard");

  const total = COMPONENTS.reduce((acc, c) => {
    if (!checked[c.id]) return acc;
    return acc + c.sizeMb;
  }, 0);

  return (
    <div style={{ flex: 1, padding: "20px 28px 0" }}>
      <div
        style={{
          color: MAC.white,
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Installation Type
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {(
          [
            ["standard", "Standard Install", "Recommended components"],
            ["custom", "Custom Install", "Choose components"],
          ] as [string, string, string][]
        ).map(([id, label, sub]) => (
          <div
            key={id}
            onClick={() => setMode(id as "standard" | "custom")}
            style={{
              flex: 1,
              padding: "12px 14px",
              cursor: "pointer",
              background: mode === id ? `${MAC.blue}15` : MAC.panel,
              border: `1.5px solid ${
                mode === id ? MAC.blue + "88" : MAC.border
              }`,
              borderRadius: 10,
              transition: "all 0.15s",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: mode === id ? MAC.white : MAC.light,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div style={{ color: MAC.muted, fontSize: 10 }}>{sub}</div>
          </div>
        ))}
      </div>

      {mode === "custom" && (
        <div
          style={{
            background: MAC.panel,
            border: `1px solid ${MAC.border}`,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {COMPONENTS.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom:
                  i < COMPONENTS.length - 1
                    ? `1px solid ${MAC.borderLight}`
                    : "none",
                cursor: c.id === "cli" ? "default" : "pointer",
                opacity: c.id === "cli" ? 0.7 : 1,
              }}
              onClick={() =>
                c.id !== "cli" &&
                setChecked((p) => ({ ...p, [c.id]: !p[c.id] }))
              }
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: checked[c.id] ? c.color : "transparent",
                  border: `2px solid ${
                    checked[c.id] ? c.color : MAC.muted
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {checked[c.id] && (
                  <span
                    style={{
                      color: "white",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: `${c.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: c.color,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {c.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: MAC.white,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {c.name}
                </div>
                <div style={{ color: MAC.muted, fontSize: 10 }}>
                  {c.desc}
                </div>
              </div>
              <div style={{ color: MAC.muted, fontSize: 10 }}>{c.size}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "right", color: MAC.muted, fontSize: 11 }}>
        Total:{" "}
        <span style={{ color: MAC.light }}>{total.toFixed(1)} MB</span>
      </div>
    </div>
  );
}
