"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { relativeTime } from "./utils";

interface UseAutoRefreshOptions<T> {
  fetcher: () => Promise<T>;
  intervalMs?: number;
}

interface UseAutoRefreshResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: string | null;
  refresh: () => void;
}

export function useAutoRefresh<T>({
  fetcher,
  intervalMs = 30_000,
}: UseAutoRefreshOptions<T>): UseAutoRefreshResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async (isInitial = false) => {
    if (!isInitial) setIsRefreshing(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      const now = new Date();
      setLastFetchedAt(now);
      setLastUpdated(relativeTime(now.toISOString()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    doFetch(true);
  }, [doFetch]);

  // Auto-refresh interval
  useEffect(() => {
    const id = setInterval(() => doFetch(false), intervalMs);
    return () => clearInterval(id);
  }, [doFetch, intervalMs]);

  // Update relative timestamp every 10s
  useEffect(() => {
    if (!lastFetchedAt) return;
    const id = setInterval(() => {
      setLastUpdated(relativeTime(lastFetchedAt.toISOString()));
    }, 10_000);
    return () => clearInterval(id);
  }, [lastFetchedAt]);

  const refresh = useCallback(() => doFetch(false), [doFetch]);

  return { data, error, isLoading, isRefreshing, lastUpdated, refresh };
}
