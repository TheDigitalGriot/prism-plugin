import { Hexagon } from 'lucide-react';
import type { WizardMode } from '../types';

type Props = {
  onSelectMode: (mode: WizardMode) => void;
};

const modes: { mode: WizardMode; label: string; description: string; color: string }[] = [
  { mode: 'install', label: 'Install', description: 'Set up Prism components on this machine', color: 'var(--prism-green)' },
  { mode: 'update', label: 'Update', description: 'Update existing Prism installations', color: 'var(--prism-blue)' },
  { mode: 'uninstall', label: 'Uninstall', description: 'Remove Prism components', color: 'var(--prism-error)' },
];

export function WelcomeScreen({ onSelectMode }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-8">
      {/* Logo & branding */}
      <div className="flex flex-col items-center gap-3">
        <Hexagon size={64} className="text-[var(--prism-blue)]" strokeWidth={1.5} />
        <h1 className="text-3xl font-bold text-[var(--prism-fg-active)]">Prism Setup</h1>
        <p className="text-sm text-[var(--prism-fg-muted)] max-w-md text-center">
          Install, update, or manage the Prism development ecosystem —
          CLI dashboard, VSCode extension, desktop app, and Claude Code plugin.
        </p>
      </div>

      {/* Mode selection */}
      <div className="flex gap-4">
        {modes.map(({ mode, label, description, color }) => (
          <button
            key={mode}
            onClick={() => onSelectMode(mode)}
            className="
              group flex flex-col items-center gap-2 p-5 rounded-lg
              bg-[var(--prism-bg-surface)] border border-[var(--prism-border)]
              hover:border-[var(--prism-border-active)] hover:bg-[var(--prism-bg-hover)]
              transition-all duration-200 w-48
            "
          >
            <span
              className="text-lg font-semibold group-hover:brightness-110 transition-colors"
              style={{ color }}
            >
              {label}
            </span>
            <span className="text-xs text-[var(--prism-fg-muted)] text-center">
              {description}
            </span>
          </button>
        ))}
      </div>

      {/* Version */}
      <p className="text-[10px] text-[var(--prism-fg-disabled)]">v2.4.5</p>
    </div>
  );
}
