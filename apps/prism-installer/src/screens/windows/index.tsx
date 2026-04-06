import { useState } from "react";
import { WIN } from "../../theme/colors";
import { WindowsChrome } from "../../layouts/WindowsChrome";
import { WelcomeStep } from "./WelcomeStep";
import { ComponentsStep } from "./ComponentsStep";
import { DirectoryStep } from "./DirectoryStep";
import { PreflightStep } from "./PreflightStep";
import { ProgressStep } from "./ProgressStep";
import { FinishStep } from "./FinishStep";
import { ComponentSelection } from "../../hooks/useInstaller";

const STEPS = ["welcome", "components", "directory", "preflight", "progress", "finish"] as const;
type Step = (typeof STEPS)[number];

export function WindowsInstaller() {
  const [stepIdx, setStepIdx] = useState(0);
  const [checked, setChecked] = useState<ComponentSelection>({
    cli: true,
    vscode: true,
    plugin: true,
    electron: false,
  });
  const [installDir, setInstallDir] = useState("%LOCALAPPDATA%\\Prism");

  const step = STEPS[stepIdx] as Step;
  const next = () => setStepIdx((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStepIdx((s) => Math.max(0, s - 1));

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: WIN.logBg,
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        padding: 24,
      }}
    >
      <WindowsChrome>
        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 0",
            alignItems: "center",
            justifyContent: "center",
            background: WIN.dark,
            borderBottom: `1px solid ${WIN.border}`,
          }}
        >
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: i === stepIdx ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    i < stepIdx
                      ? WIN.teal
                      : i === stepIdx
                      ? WIN.blue
                      : WIN.surface,
                  transition: "all 0.3s",
                }}
              />
            </div>
          ))}
        </div>

        {step === "welcome" && <WelcomeStep onNext={next} />}
        {step === "components" && (
          <ComponentsStep
            checked={checked}
            setChecked={setChecked}
            onBack={back}
            onNext={next}
          />
        )}
        {step === "directory" && (
          <DirectoryStep
            installDir={installDir}
            setInstallDir={setInstallDir}
            onBack={back}
            onNext={next}
          />
        )}
        {step === "preflight" && (
          <PreflightStep onBack={back} onNext={next} />
        )}
        {step === "progress" && (
          <ProgressStep checked={checked} installDir={installDir} onNext={next} />
        )}
        {step === "finish" && <FinishStep checked={checked} />}
      </WindowsChrome>
    </div>
  );
}
