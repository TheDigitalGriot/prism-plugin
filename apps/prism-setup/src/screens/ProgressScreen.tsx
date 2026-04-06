import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { InstallProgress, WizardMode } from '../types';

type Props = {
  allProgress: InstallProgress[];
  mode: WizardMode;
};

function StatusIcon({ status }: { status: InstallProgress['status'] }) {
  switch (status) {
    case 'complete':
      return <CheckCircle size={18} className="text-[var(--prism-success)]" />;
    case 'error':
      return <XCircle size={18} className="text-[var(--prism-error)]" />;
    case 'pending':
    case 'skipped':
      return <Clock size={18} className="text-[var(--prism-fg-muted)]" />;
    default:
      return <Loader2 size={18} className="animate-spin text-[var(--prism-blue)]" />;
  }
}

const COMPONENT_LABELS: Record<string, string> = {
  'prism-cli': 'Prism CLI',
  'prism-vscode': 'VSCode Extension',
  'prism-electron': 'Desktop App',
  'claude-plugin': 'Claude Plugin',
};

export function ProgressScreen({ allProgress, mode }: Props) {
  const action = mode === 'uninstall' ? 'Removing' : 'Installing';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--prism-fg-active)]">
          {action} Components
        </h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-1">
          Please wait while components are being {mode === 'uninstall' ? 'removed' : 'installed'}...
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {allProgress.map((progress) => (
          <div
            key={progress.componentId}
            className="p-4 rounded-lg bg-[var(--prism-bg-surface)] border border-[var(--prism-border)]"
          >
            <div className="flex items-center gap-3 mb-2">
              <StatusIcon status={progress.status} />
              <span className="text-sm font-medium text-[var(--prism-fg)]">
                {COMPONENT_LABELS[progress.componentId] ?? progress.componentId}
              </span>
              <span className="text-xs text-[var(--prism-fg-muted)] ml-auto capitalize">
                {progress.status}
              </span>
            </div>

            {/* Progress bar */}
            {progress.percent >= 0 && progress.status !== 'complete' && progress.status !== 'error' && progress.status !== 'pending' && (
              <div className="h-1.5 rounded-full bg-[var(--prism-bg-input)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--prism-blue)] transition-all duration-300 prism-shimmer"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}

            {/* Message */}
            <p className="text-xs text-[var(--prism-fg-muted)] mt-1">{progress.message}</p>

            {/* Error */}
            {progress.error && (
              <p className="text-xs text-[var(--prism-error)] mt-1">{progress.error}</p>
            )}
          </div>
        ))}

        {allProgress.length === 0 && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="animate-spin text-[var(--prism-blue)]" size={24} />
            <span className="text-sm text-[var(--prism-fg-muted)]">Preparing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
