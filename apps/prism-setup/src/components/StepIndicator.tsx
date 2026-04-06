import type { WizardStep } from '../hooks/useWizard';

const STEP_LABELS: Record<WizardStep, string> = {
  'welcome': 'Welcome',
  'system-check': 'System',
  'component-select': 'Components',
  'install-location': 'Location',
  'progress': 'Install',
  'verification': 'Verify',
  'done': 'Done',
};

type Props = {
  steps: WizardStep[];
  currentIndex: number;
};

export function StepIndicator({ steps, currentIndex }: Props) {
  return (
    <div className="flex items-center gap-1 px-6 py-3">
      {steps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            {/* Dot */}
            <div className="flex flex-col items-center gap-1 min-w-[48px]">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                  ${isComplete
                    ? 'bg-[var(--prism-green)] text-white'
                    : isCurrent
                      ? 'bg-[var(--prism-blue)] text-white ring-2 ring-[var(--prism-blue)] ring-offset-2 ring-offset-[var(--prism-bg)]'
                      : 'bg-[var(--prism-bg-input)] text-[var(--prism-fg-muted)]'
                  }
                `}
              >
                {isComplete ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isCurrent ? 'text-[var(--prism-fg)]' : 'text-[var(--prism-fg-muted)]'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-[2px] rounded transition-colors duration-300 mb-5 ${
                  i < currentIndex
                    ? 'bg-[var(--prism-green)]'
                    : 'bg-[var(--prism-border)]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
