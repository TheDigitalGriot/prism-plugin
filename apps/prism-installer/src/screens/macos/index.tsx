import { useState } from "react";
import { MAC_STEPS } from "../../constants";
import { ComponentSelection } from "../../hooks/useInstaller";
import { MacWindow } from "../../layouts/MacWindow";
import { Sidebar } from "../../layouts/Sidebar";
import { NavButtons } from "../../components/NavButtons";
import { IntroStep } from "./IntroStep";
import { LicenseStep } from "./LicenseStep";
import { DestinationStep } from "./DestinationStep";
import { TypeStep } from "./TypeStep";
import { InstallingStep } from "./InstallingStep";
import { SummaryStep } from "./SummaryStep";

const STEPS = [...MAC_STEPS] as { id: string; label: string }[];

export function MacInstaller() {
  const [stepIdx, setStepIdx] = useState(0);
  const [checked, setChecked] = useState<ComponentSelection>({
    cli: true,
    vscode: true,
    plugin: true,
    electron: false,
  });
  const [installDir, setInstallDir] = useState("~/.prism");
  const [installDone, setInstallDone] = useState(false);

  const step = STEPS[stepIdx].id;
  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const getNextLabel = () => {
    if (step === "license") return "Agree";
    if (step === "type") return "Install";
    if (step === "install") return "Continue";
    if (step === "summary") return "Close";
    return "Continue";
  };

  const isNextDisabled = () => step === "install" && !installDone;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 30% 40%, #0A1628 0%, #060D1A 60%, #020810 100%)",
        fontFamily:
          "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        padding: 24,
      }}
    >
      <MacWindow>
        <div style={{ display: "flex", minHeight: 380 }}>
          <Sidebar steps={STEPS} currentStep={step} />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {step === "intro" && <IntroStep />}
            {step === "license" && <LicenseStep />}
            {step === "destination" && (
              <DestinationStep
                installDir={installDir}
                setInstallDir={setInstallDir}
              />
            )}
            {step === "type" && (
              <TypeStep checked={checked} setChecked={setChecked} />
            )}
            {step === "install" && (
              <InstallingStep
                checked={checked}
                installDir={installDir}
                onDone={() => setInstallDone(true)}
              />
            )}
            {step === "summary" && <SummaryStep checked={checked} />}

            <NavButtons
              onBack={back}
              onNext={next}
              nextLabel={getNextLabel()}
              backDisabled={stepIdx === 0 || step === "install" || step === "summary"}
              nextDisabled={isNextDisabled()}
              platform="macos"
            />
          </div>
        </div>
      </MacWindow>
    </div>
  );
}
