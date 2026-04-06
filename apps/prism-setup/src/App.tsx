import { useState } from 'react';
import { useWizard } from './hooks/useWizard';
import { useSystemInfo } from './hooks/useSystemInfo';
import { useInstaller } from './hooks/useInstaller';
import { WizardLayout } from './components/WizardLayout';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SystemCheckScreen } from './screens/SystemCheckScreen';
import { ComponentSelectScreen } from './screens/ComponentSelectScreen';
import { InstallLocationScreen } from './screens/InstallLocationScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { VerificationScreen } from './screens/VerificationScreen';
import { DoneScreen } from './screens/DoneScreen';
import type { ComponentId } from './types';

export default function App() {
  const wizard = useWizard();
  const { systemInfo, loading, error } = useSystemInfo();
  const installer = useInstaller();

  const [selectedComponents, setSelectedComponents] = useState<ComponentId[]>([
    'prism-cli', 'prism-vscode', 'claude-plugin',
  ]);
  const [installDir, setInstallDir] = useState(() => {
    const home = systemInfo?.homedir ?? '~';
    return `${home}/.prism/bin`;
  });
  const [addToPath, setAddToPath] = useState(true);

  const handleNext = () => {
    // Start install/uninstall when leaving the last config screen
    if (wizard.currentStep === 'install-location' || (wizard.currentStep === 'component-select' && wizard.mode !== 'install')) {
      wizard.goNext();
      if (wizard.mode === 'uninstall') {
        installer.startUninstall(selectedComponents);
      } else {
        installer.startInstall({
          components: selectedComponents,
          installDir,
          addToPath,
          editor: systemInfo?.vscodeAvailable ? 'vscode' : systemInfo?.cursorAvailable ? 'cursor' : null,
        });
      }
      return;
    }

    // Auto-advance from progress when done
    if (wizard.currentStep === 'progress' && installer.done) {
      wizard.goNext();
      return;
    }

    wizard.goNext();
  };

  function renderScreen() {
    switch (wizard.currentStep) {
      case 'welcome':
        return <WelcomeScreen onSelectMode={wizard.selectMode} />;
      case 'system-check':
        return <SystemCheckScreen systemInfo={systemInfo} loading={loading} error={error} />;
      case 'component-select':
        return (
          <ComponentSelectScreen
            components={systemInfo?.components ?? []}
            mode={wizard.mode}
            selected={selectedComponents}
            onSelectionChange={setSelectedComponents}
          />
        );
      case 'install-location':
        return (
          <InstallLocationScreen
            installDir={installDir}
            addToPath={addToPath}
            onDirChange={setInstallDir}
            onAddToPathChange={setAddToPath}
          />
        );
      case 'progress':
        return <ProgressScreen allProgress={installer.allProgress} mode={wizard.mode} />;
      case 'verification':
        return <VerificationScreen allProgress={installer.allProgress} hasErrors={installer.hasErrors} />;
      case 'done':
        return <DoneScreen mode={wizard.mode} hasErrors={installer.hasErrors} onRestart={wizard.restart} />;
    }
  }

  return (
    <WizardLayout
      steps={wizard.steps}
      stepIndex={wizard.stepIndex}
      canGoBack={wizard.canGoBack}
      canGoNext={wizard.canGoNext}
      isFirst={wizard.isFirst}
      isLast={wizard.isLast}
      onBack={wizard.goBack}
      onNext={handleNext}
    >
      {renderScreen()}
    </WizardLayout>
  );
}
