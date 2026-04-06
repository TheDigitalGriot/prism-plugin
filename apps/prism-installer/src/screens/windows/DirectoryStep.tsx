import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";
import { SpectralBar } from "../../components/SpectralBar";
import { open } from "@tauri-apps/plugin-dialog";

interface DirectoryStepProps {
  installDir: string;
  setInstallDir: (dir: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DirectoryStep({
  installDir,
  setInstallDir,
  onBack,
  onNext,
}: DirectoryStepProps) {
  const handleBrowse = async () => {
    const selected = await open({ directory: true, title: "Choose Install Directory" });
    if (typeof selected === "string") setInstallDir(selected);
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
              Install Location
            </div>
            <div style={{ color: WIN.muted, fontSize: 11, marginTop: 2 }}>
              Choose where Prism CLI will be installed
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 24px" }}>
        <div style={{ color: WIN.light, fontSize: 12, marginBottom: 10 }}>
          Destination folder:
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={installDir}
            onChange={(e) => setInstallDir(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: WIN.mid,
              border: `1px solid ${WIN.border}`,
              borderRadius: 4,
              color: WIN.white,
              fontSize: 12,
              fontFamily: "'Consolas', monospace",
              outline: "none",
            }}
          />
          <button
            onClick={handleBrowse}
            style={{
              padding: "8px 14px",
              background: WIN.surface,
              border: `1px solid ${WIN.border}`,
              borderRadius: 4,
              color: WIN.light,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            Browse...
          </button>
        </div>

        <div
          style={{
            background: WIN.mid,
            border: `1px solid ${WIN.border}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${WIN.border}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: WIN.muted, fontSize: 11 }}>
              Files will be placed in:
            </span>
          </div>
          {(
            [
              [installDir + "\\bin\\prism-cli.exe", "CLI binary"],
              [installDir + "\\extensions\\prism.vsix", "Extension archive"],
              [installDir + "\\plugin\\", "Claude plugin files"],
            ] as [string, string][]
          ).map(([p, desc]) => (
            <div
              key={p}
              style={{
                padding: "7px 14px",
                display: "flex",
                justifyContent: "space-between",
                borderBottom: `1px solid ${WIN.border}22`,
              }}
            >
              <span
                style={{
                  color: WIN.light,
                  fontSize: 10,
                  fontFamily: "Consolas, monospace",
                }}
              >
                {p}
              </span>
              <span style={{ color: WIN.muted, fontSize: 10 }}>{desc}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: `${WIN.green}0D`,
            border: `1px solid ${WIN.green}33`,
            borderRadius: 4,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ color: WIN.green }}>✓</span>
          <span style={{ color: WIN.muted, fontSize: 11 }}>
            <code
              style={{
                color: WIN.light,
                background: WIN.surface,
                padding: "1px 5px",
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              {installDir}\bin
            </code>{" "}
            will be added to your user PATH via registry (no admin required)
          </span>
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
