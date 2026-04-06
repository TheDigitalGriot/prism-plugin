import { useState, useEffect } from 'react';
import type { SystemInfo } from '../types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const info = await window.setupAPI.getSystemInfo();
        if (!cancelled) {
          setSystemInfo(info);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to detect system info');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const info = await window.setupAPI.getSystemInfo();
      setSystemInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect system info');
    } finally {
      setLoading(false);
    }
  };

  return { systemInfo, loading, error, refresh };
}
