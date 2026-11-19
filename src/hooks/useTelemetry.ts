import { useState, useEffect, useCallback, useRef } from 'react';
import { TelemetryStats, TelemetryState } from '../types/telemetry';
import { fetchAggregatedStats, DISCORD_BOT_KEEP_ALIVE_URL } from '../services/telemetryApi';

export function useTelemetry(refreshIntervalSec = 30): TelemetryState {
  // Initialize with persisted cache for instantaneous zero-latency cold start
  const [data, setData] = useState<TelemetryStats | null>(() => {
    try {
      const cached = localStorage.getItem('pmc-cached-telemetry');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // If we have cached data, don't show full-screen blocking loading on cold start
    return !localStorage.getItem('pmc-cached-telemetry');
  });

  const [error, setError] = useState<Error | null>(null);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const cachedDate = localStorage.getItem('pmc-last-updated');
      return cachedDate ? new Date(cachedDate) : null;
    } catch {
      return null;
    }
  });

  const [autoRefresh, setAutoRefreshState] = useState<boolean>(() => {
    return localStorage.getItem('pmc-autorefresh') !== 'false';
  });

  const timerRef = useRef<number | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const refresh = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const [stats] = await Promise.all([
        fetchAggregatedStats(),
        fetch(DISCORD_BOT_KEEP_ALIVE_URL, { cache: 'no-store' }).catch(() => null),
      ]);
      setData(stats);
      setError(null);
      const now = new Date();
      setLastUpdated(now);

      // Persist to localStorage for instant offline/cold launch
      try {
        localStorage.setItem('pmc-cached-telemetry', JSON.stringify(stats));
        localStorage.setItem('pmc-last-updated', now.toISOString());
      } catch (e) {
        console.warn('[useTelemetry] Failed to cache stats in localStorage:', e);
      }
    } catch (err) {
      console.error('[useTelemetry] Error fetching stats:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const setAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefreshState(enabled);
    localStorage.setItem('pmc-autorefresh', String(enabled));
  }, []);

  // Polling loop
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoRefresh) {
      timerRef.current = window.setInterval(refresh, refreshIntervalSec * 1000);
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [autoRefresh, refresh, refreshIntervalSec]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    autoRefresh,
    setAutoRefresh,
    refresh,
  };
}
