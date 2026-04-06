import { WIN } from "../../theme/colors";
import { NavButtons } from "../../components/NavButtons";
import { SpectralBar } from "../../components/SpectralBar";
import { COMPONENTS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";

interface ComponentsStepProps {
  checked: ComponentSelection;
  setChecked: React.Dispatch<React.SetStateAction<ComponentSelection>>;
  onBack: () => void;
  onNext: () => void;
}

export function ComponentsStep({
  checked,
  setChecked,
  onBack,
  onNext,
}: ComponentsStepProps) {
  const total = COMPONENTS.reduce((acc, c) => {
    if (!checked[c.id]) return acc;
    return acc + c.sizeMb;
  }, 0);

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
              Choose Components
            </div>
            <div style={{ color: WIN.muted, fontSize: 11, marginTop: 2 }}>
              Select which Prism components to install
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        <div style={{ color: WIN.muted, fontSize: 11, marginBottom: 12 }}>
          Components marked{" "}
          <span style={{ color: WIN.amber }}>Required</span> cannot be
          deselected.
        </div>

        {COMPONENTS.map((c) => (
          <div
            key={c.id}
            onClick={() =>
              !c.required &&
              setChecked((p) => ({ ...p, [c.id]: !p[c.id] }))
            }
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              background: checked[c.id] ? `${c.color}0D` : WIN.mid,
              border: `1px solid ${
                checked[c.id] ? c.color + "44" : WIN.border
              }`,
              borderRadius: 6,
              cursor: c.required ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {/* Checkbox */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                flexShrink: 0,
                marginTop: 1,
                background: checked[c.id] ? c.color : "transparent",
                border: `2px solid ${checked[c.id] ? c.color : WIN.muted}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {checked[c.id] && (
                <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>
                  ✓
                </span>
              )}
            </div>

            {/* Icon */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                flexShrink: 0,
                background: `${c.color}22`,
                border: `1px solid ${c.color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: c.color,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {c.icon}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    color: WIN.white,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {c.name}
                </span>
                {c.required ? (
                  <span
                    style={{
                      background: `${WIN.amber}22`,
                      color: WIN.amber,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontWeight: 700,
                    }}
                  >
                    REQUIRED
                  </span>
                ) : (
                  <span
                    style={{
                      background: `${WIN.muted}22`,
                      color: WIN.muted,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                    }}
                  >
                    OPTIONAL
                  </span>
                )}
                {c.id === "electron" && (
                  <span
                    style={{
                      background: `${WIN.blue}22`,
                      color: WIN.blue,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 3,
                    }}
                  >
                    ⬇ DOWNLOAD
                  </span>
                )}
              </div>
              <div style={{ color: WIN.muted, fontSize: 11 }}>{c.desc}</div>
            </div>

            <div
              style={{
                color: WIN.muted,
                fontSize: 10,
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              {c.size}
            </div>
          </div>
        ))}

        <div
          style={{ textAlign: "right", color: WIN.muted, fontSize: 11, marginTop: 4 }}
        >
          Space required:{" "}
          <span style={{ color: WIN.light }}>{total} MB</span>
          {checked.electron && (
            <span style={{ color: WIN.amber }}> (includes download)</span>
          )}
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}
