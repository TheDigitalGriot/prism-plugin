import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const [version, setVersion] = useState("");
  useEffect(() => { getVersion().then(setVersion); }, []);
  return (
    <div>
      <div style={{ padding: "28px 24px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: -1,
                background: `linear-gradient(90deg, ${WIN.blue}, ${WIN.teal}, ${WIN.green})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              PRISM
            </span>
            <span style={{ color: WIN.muted, fontSize: 12 }}>{version ? `v${version}` : ""}</span>
          </div>
          <div
            style={{
              color: WIN.light,
              fontSize: 13,
              lineHeight: 1.6,
              maxWidth: 400,
            }}
          >
            AI-powered development workflow system for the spectrum of your
            stack.
          </div>
        </div>

        <div
          style={{
            background: WIN.mid,
            border: `1px solid ${WIN.border}`,
            borderRadius: 6,
            padding: "14px 16px",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              color: WIN.teal,
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 8,
              letterSpacing: 0.5,
            }}
          >
            THIS INSTALLER WILL SET UP
          </div>
          {(
            [
              ["Prism CLI", WIN.blue, ">_"],
              ["VS Code / Cursor Extension", WIN.teal, "{}"],
              ["Claude Code Plugin", WIN.green, "◈"],
              ["Desktop App (optional)", WIN.amber, "⬡"],
            ] as [string, string, string][]
          ).map(([label, color, icon]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{ color, fontSize: 12, width: 16, textAlign: "center" }}
              >
                {icon}
              </span>
              <span style={{ color: WIN.light, fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            background: `${WIN.blue}11`,
            border: `1px solid ${WIN.blue}33`,
            borderRadius: 4,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: WIN.blue, fontSize: 14, flexShrink: 0 }}>
            ℹ
          </span>
          <span
            style={{ color: WIN.muted, fontSize: 11, lineHeight: 1.5 }}
          >
            Installs to{" "}
            <code
              style={{
                color: WIN.light,
                background: WIN.surface,
                padding: "1px 5px",
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              %LOCALAPPDATA%\Prism
            </code>
            . No admin rights required. PATH is set for current user only.
          </span>
        </div>
      </div>
      <NavButtons
        onBack={() => {}}
        backDisabled
        onNext={onNext}
        nextLabel="Next →"
      />
    </div>
  );
}
