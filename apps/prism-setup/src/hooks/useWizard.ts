import { useState, useCallback } from 'react';
import type { WizardMode } from '../types';

export type WizardStep =
  | 'welcome'
  | 'system-check'
  | 'component-select'
  | 'install-location'
  | 'progress'
  | 'verification'
  | 'done';

const INSTALL_STEPS: WizardStep[] = [
  'welcome',
  'system-check',
  'component-select',
  'install-location',
  'progress',
  'verification',
  'done',
];

const UPDATE_STEPS: WizardStep[] = [
  'welcome',
  'system-check',
  'component-select',
  'progress',
  'verification',
  'done',
];

const UNINSTALL_STEPS: WizardStep[] = [
  'welcome',
  'system-check',
  'component-select',
  'progress',
  'verification',
  'done',
];

function getSteps(mode: WizardMode): WizardStep[] {
  switch (mode) {
    case 'install': return INSTALL_STEPS;
    case 'update': return UPDATE_STEPS;
    case 'uninstall': return UNINSTALL_STEPS;
  }
}

export function useWizard() {
  const [mode, setMode] = useState<WizardMode>('install');
  const [stepIndex, setStepIndex] = useState(0);

  const steps = getSteps(mode);
  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const isProgress = currentStep === 'progress';

  const goNext = useCallback(() => {
    setStepIndex(i => Math.min(i + 1, totalSteps - 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setStepIndex(i => Math.max(i - 1, 0));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    const idx = steps.indexOf(step);
    if (idx >= 0) setStepIndex(idx);
  }, [steps]);

  const restart = useCallback(() => {
    setStepIndex(0);
  }, []);

  const selectMode = useCallback((newMode: WizardMode) => {
    setMode(newMode);
    setStepIndex(1); // advance past welcome
  }, []);

  return {
    mode,
    currentStep,
    stepIndex,
    totalSteps,
    steps,
    isFirst,
    isLast,
    isProgress,
    canGoBack: !isFirst && !isProgress,
    canGoNext: !isLast,
    goNext,
    goBack,
    goToStep,
    restart,
    selectMode,
  };
}
