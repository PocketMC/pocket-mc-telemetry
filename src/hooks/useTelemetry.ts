import { useState, useEffect, useCallback, useRef } from 'react';
import { TelemetryStats, TelemetryState } from '../types/telemetry';
import { fetchAggregatedStats, DISCORD_BOT_KEEP_ALIVE_URL } from '../services/telemetryApi';

export function useTelemetry(refreshIntervalSec = 30): TelemetryState {
  const [data, setData] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
      setLastUpdated(new Date());
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
