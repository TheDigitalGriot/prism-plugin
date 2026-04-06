import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import type { SystemInfo } from '../types';

type Props = {
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
};

type CheckItem = {
  label: string;
  available: boolean;
  detail: string | null;
  required: boolean;
};

function getChecks(info: SystemInfo): CheckItem[] {
  return [
    { label: 'Operating System', available: true, detail: `${info.platform} (${info.arch})`, required: true },
    { label: 'Node.js', available: info.nodeAvailable, detail: info.nodeAvailable ? 'Detected' : 'Not found', required: false },
    { label: 'VSCode / Cursor / Windsurf', available: info.vscodeAvailable || info.cursorAvailable || info.windsurfAvailable, detail: info.vscodePath ?? 'Not detected', required: false },
    { label: 'Claude CLI', available: info.claudeAvailable, detail: info.claudePath ?? 'Not detected', required: false },
    { label: 'Existing ~/.prism directory', available: info.existingPrismDir, detail: info.existingPrismDir ? 'Found' : 'Will be created', required: false },
  ];
}

export function SystemCheckScreen({ systemInfo, loading, error }: Props) {
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[var(--prism-blue)]" size={32} />
        <p className="text-sm text-[var(--prism-fg-muted)]">Scanning system...</p>
      </div>
    );
  }

  if (error || !systemInfo) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <XCircle className="text-[var(--prism-error)]" size={32} />
        <p className="text-sm text-[var(--prism-error)]">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  const checks = getChecks(systemInfo);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--prism-fg-active)]">System Check</h2>
        <p className="text-sm text-[var(--prism-fg-muted)] mt-1">
          Detecting installed tools and existing Prism components.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {checks.map(({ label, available, detail, required }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-md bg-[var(--prism-bg-surface)] border border-[var(--prism-border)]"
          >
            {available ? (
              <CheckCircle size={18} className="text-[var(--prism-success)] shrink-0" />
            ) : required ? (
              <XCircle size={18} className="text-[var(--prism-error)] shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-[var(--prism-warning)] shrink-0" />
            )}
            <div className="flex-1">
              <span className="text-sm text-[var(--prism-fg)]">{label}</span>
              {detail && (
                <span className="text-xs text-[var(--prism-fg-muted)] ml-2">{detail}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
