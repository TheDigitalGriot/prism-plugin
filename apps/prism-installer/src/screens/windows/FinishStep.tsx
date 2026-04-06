import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";
import { SpectralBar } from "../../components/SpectralBar";
import { COMPONENTS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface FinishStepProps {
  checked: ComponentSelection;
}

export function FinishStep({ checked }: FinishStepProps) {
  const [openTerminal, setOpenTerminal] = useState(true);
  const [version, setVersion] = useState("");
  useEffect(() => { getVersion().then(setVersion); }, []);
  const installed = COMPONENTS.filter((c) => checked[c.id]);

  const handleClose = async () => {
    if (openTerminal) {
      try {
        await invoke("open_terminal");
      } catch {
        // best effort
      }
    }
    await getCurrentWindow().close();
  };

  return (
    <div>
      <div style={{ padding: "24px 24px 16px" }}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              margin: "0 auto 14px",
              background: `linear-gradient(135deg, ${WIN.green}22, ${WIN.teal}22)`,
              border: `2px solid ${WIN.green}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: -0.5,
              background: `linear-gradient(90deg, ${WIN.green}, ${WIN.teal})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 6,
            }}
          >
            Installation Complete
          </div>
          <div style={{ color: WIN.muted, fontSize: 12 }}>
            Prism{version ? ` v${version}` : ""} is ready to use
          </div>
        </div>

        <SpectralBar height={2} />
        <div style={{ paddingTop: 14, marginBottom: 14 }}>
          {installed.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 7,
              }}
            >
              <span style={{ color: WIN.green, fontSize: 12 }}>✓</span>
              <span style={{ color: WIN.light, fontSize: 12 }}>{c.name}</span>
              <span
                style={{
                  color: WIN.muted,
                  fontSize: 10,
                  marginLeft: "auto",
                }}
              >
                Installed
              </span>
            </div>
          ))}
        </div>
        <SpectralBar height={2} />

        <div style={{ marginTop: 14 }}>
          <div
            onClick={() => setOpenTerminal(!openTerminal)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: openTerminal ? WIN.teal : "transparent",
                border: `2px solid ${openTerminal ? WIN.teal : WIN.muted}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {openTerminal && (
                <span
                  style={{ color: "white", fontSize: 9, fontWeight: 700 }}
                >
                  ✓
                </span>
              )}
            </div>
            <span style={{ color: WIN.light, fontSize: 12 }}>
              Open a new terminal window now
            </span>
          </div>
          <div style={{ color: WIN.muted, fontSize: 11 }}>
            Run{" "}
            <code
              style={{
                color: WIN.teal,
                background: WIN.surface,
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              prism-cli --help
            </code>{" "}
            to get started, or visit{" "}
            <span
              style={{
                color: WIN.blue,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              github.com/TheDigitalGriot/prism-plugin
            </span>
          </div>
        </div>
      </div>
      <NavButtons
        onBack={() => {}}
        backDisabled
        onNext={handleClose}
        nextLabel="Close"
      />
    </div>
  );
}
