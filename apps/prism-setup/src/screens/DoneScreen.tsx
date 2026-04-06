import { CheckCircle, ExternalLink, RotateCcw } from 'lucide-react';
import type { WizardMode } from '../types';

type Props = {
  mode: WizardMode;
  hasErrors: boolean;
  onRestart: () => void;
};

export function DoneScreen({ mode, hasErrors, onRestart }: Props) {
  const openDocs = () => {
    window.setupAPI.openExternal('https://github.com/TheDigitalGriot/prism-plugin');
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <CheckCircle
        size={56}
        className={hasErrors ? 'text-[var(--prism-warning)]' : 'text-[var(--prism-success)]'}
      />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--prism-fg-active)]">
          {mode === 'uninstall'
            ? 'Uninstall Complete'
            : hasErrors
              ? 'Setup Complete (with issues)'
              : 'Setup Complete!'}
        </h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-2 max-w-md">
          {mode === 'uninstall'
            ? 'Selected Prism components have been removed from your system.'
            : hasErrors
              ? 'Some components could not be installed. You can re-run the installer to try again.'
              : 'All Prism components have been installed successfully. You\'re ready to go!'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="
            flex items-center gap-2 px-4 py-2 rounded text-sm
            bg-[var(--prism-bg-button-secondary)] text-[var(--prism-fg)]
            hover:bg-[var(--prism-bg-active)] transition-colors
          "
        >
          <RotateCcw size={14} />
          {mode === 'uninstall' ? 'Install More' : 'Run Again'}
        </button>

        <button
          onClick={openDocs}
          className="
            flex items-center gap-2 px-4 py-2 rounded text-sm
            bg-[var(--prism-bg-button)] text-[var(--prism-fg-button)]
            hover:bg-[var(--prism-bg-button-hover)] transition-colors
          "
        >
          <ExternalLink size={14} />
          Open Documentation
        </button>
      </div>
    </div>
  );
}
