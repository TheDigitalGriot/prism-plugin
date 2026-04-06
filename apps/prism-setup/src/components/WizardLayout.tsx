import type { ReactNode } from 'react';
import { StepIndicator } from './StepIndicator';
import type { WizardStep } from '../hooks/useWizard';

type Props = {
  steps: WizardStep[];
  stepIndex: number;
  canGoBack: boolean;
  canGoNext: boolean;
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
};

export function WizardLayout({
  steps,
  stepIndex,
  canGoBack,
  canGoNext,
  isFirst,
  isLast,
  onBack,
  onNext,
  children,
}: Props) {
  return (
    <div className="h-full flex flex-col bg-[var(--prism-bg)]">
      {/* Spectral accent bar */}
      <div className="prism-gradient-bar" />

      {/* Step indicator (hidden on welcome) */}
      {!isFirst && (
        <div className="border-b border-[var(--prism-border)]">
          <StepIndicator steps={steps} currentIndex={stepIndex} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 prism-fade-in" key={steps[stepIndex]}>
        {children}
      </div>

      {/* Navigation footer */}
      {!isFirst && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-[var(--prism-border)]">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`
              px-5 py-2 rounded text-sm font-medium transition-colors
              ${canGoBack
                ? 'bg-[var(--prism-bg-button-secondary)] text-[var(--prism-fg)] hover:bg-[var(--prism-bg-active)]'
                : 'text-[var(--prism-fg-disabled)] cursor-not-allowed'
              }
            `}
          >
            Back
          </button>

          {!isLast && (
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className={`
                px-5 py-2 rounded text-sm font-medium transition-colors
                ${canGoNext
                  ? 'bg-[var(--prism-bg-button)] text-[var(--prism-fg-button)] hover:bg-[var(--prism-bg-button-hover)]'
                  : 'bg-[var(--prism-bg-button-secondary)] text-[var(--prism-fg-disabled)] cursor-not-allowed'
                }
              `}
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
}
