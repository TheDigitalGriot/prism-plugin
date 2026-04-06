import { useState, useEffect, useCallback } from 'react';
import type { ComponentId, InstallProgress, InstallOptions } from '../types';

export function useInstaller() {
  const [progressMap, setProgressMap] = useState<Record<string, InstallProgress>>({});
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const unsubscribe = window.setupAPI.onProgress((progress: InstallProgress) => {
      setProgressMap(prev => ({
        ...prev,
        [progress.componentId]: progress,
      }));

      // Check if all components are complete or errored
      setProgressMap(prev => {
        const all = Object.values(prev);
        const allDone = all.length > 0 && all.every(
          p => p.status === 'complete' || p.status === 'error' || p.status === 'skipped'
        );
        if (allDone) {
          setDone(true);
          setInstalling(false);
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  const startInstall = useCallback(async (options: InstallOptions) => {
    setInstalling(true);
    setDone(false);
    setProgressMap({});

    // Initialize pending state for each component
    for (const id of options.components) {
      setProgressMap(prev => ({
        ...prev,
        [id]: { componentId: id, status: 'pending', percent: 0, message: 'Waiting...' },
      }));
    }

    await window.setupAPI.startInstall(options);
  }, []);

  const startUninstall = useCallback(async (components: ComponentId[]) => {
    setInstalling(true);
    setDone(false);
    setProgressMap({});

    for (const id of components) {
      setProgressMap(prev => ({
        ...prev,
        [id]: { componentId: id, status: 'pending', percent: 0, message: 'Waiting...' },
      }));
    }

    await window.setupAPI.startUninstall(components);
  }, []);

  const cancel = useCallback(() => {
    window.setupAPI.cancelInstall();
    setInstalling(false);
  }, []);

  const allProgress = Object.values(progressMap);
  const hasErrors = allProgress.some(p => p.status === 'error');

  return {
    progressMap,
    allProgress,
    installing,
    done,
    hasErrors,
    startInstall,
    startUninstall,
    cancel,
  };
}
