import { useState } from "react";
import { usePlatform } from "./usePlatform";

export interface ComponentSelection {
  cli: boolean;
  vscode: boolean;
  plugin: boolean;
  electron: boolean;
}

export function useInstaller() {
  const platform = usePlatform();

  const defaultInstallDir =
    platform === "windows"
      ? "%LOCALAPPDATA%\\Prism"
      : "~/.prism";

  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<ComponentSelection>({
    cli: true,
    vscode: true,
    plugin: true,
    electron: false,
  });
  const [installDir, setInstallDir] = useState(defaultInstallDir);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  return {
    step,
    next,
    back,
    checked,
    setChecked,
    installDir,
    setInstallDir,
    platform,
  };
}
