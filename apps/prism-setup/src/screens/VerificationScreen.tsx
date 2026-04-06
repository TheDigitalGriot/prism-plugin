import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { InstallProgress } from '../types';

type Props = {
  allProgress: InstallProgress[];
  hasErrors: boolean;
};

const COMPONENT_LABELS: Record<string, string> = {
  'prism-cli': 'Prism CLI',
  'prism-vscode': 'VSCode Extension',
  'prism-electron': 'Desktop App',
  'claude-plugin': 'Claude Plugin',
};

export function VerificationScreen({ allProgress, hasErrors }: Props) {
  const completed = allProgress.filter(p => p.status === 'complete');
  const errored = allProgress.filter(p => p.status === 'error');
  const skipped = allProgress.filter(p => p.status === 'skipped');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--prism-fg-active)]">Verification</h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-1">
          {hasErrors
            ? 'Some components encountered errors during installation.'
            : 'All selected components were installed successfully.'}
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)]">
          <CheckCircle size={14} className="text-[var(--prism-success)]" />
          <span className="text-sm text-[var(--prism-success)]">{completed.length} succeeded</span>
        </div>
        {errored.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)]">
            <XCircle size={14} className="text-[var(--prism-error)]" />
            <span className="text-sm text-[var(--prism-error)]">{errored.length} failed</span>
          </div>
        )}
        {skipped.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[rgba(251,191,36,0.1)] border border-[rgba(251,191,36,0.2)]">
            <AlertTriangle size={14} className="text-[var(--prism-warning)]" />
            <span className="text-sm text-[var(--prism-warning)]">{skipped.length} skipped</span>
          </div>
        )}
      </div>

      {/* Per-component results */}
      <div className="flex flex-col gap-2">
        {allProgress.map((p) => (
          <div
            key={p.componentId}
            className="flex items-center gap-3 p-3 rounded-md bg-[var(--prism-bg-surface)] border border-[var(--prism-border)]"
          >
            {p.status === 'complete' ? (
              <CheckCircle size={18} className="text-[var(--prism-success)] shrink-0" />
            ) : p.status === 'error' ? (
              <XCircle size={18} className="text-[var(--prism-error)] shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-[var(--prism-warning)] shrink-0" />
            )}
            <div className="flex-1">
              <span className="text-sm text-[var(--prism-fg)]">
                {COMPONENT_LABELS[p.componentId] ?? p.componentId}
              </span>
              <p className="text-xs text-[var(--prism-fg-muted)]">{p.message}</p>
              {p.error && <p className="text-xs text-[var(--prism-error)] mt-0.5">{p.error}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
