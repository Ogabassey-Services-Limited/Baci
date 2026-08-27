'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AnalyticsData } from '@/components/analytics/draggable-analytics-grid';
import { fetchBaseAnalytics } from './fetch-base-analytics';

interface UseMerchantBoundBaseAnalyticsOptions {
  from: Date | undefined;
  merchantId: string | undefined;
  to: Date | undefined;
}

interface BaseAnalyticsSnapshot {
  data: AnalyticsData;
  requestKey: string;
}

function buildRequestKey(
  merchantId: string | undefined,
  from: Date | undefined,
  to: Date | undefined
): string | null {
  if (!merchantId || !from || !to) return null;
  return `${merchantId}:${from.toISOString()}:${to.toISOString()}`;
}

export function useMerchantBoundBaseAnalytics({
  from,
  merchantId,
  to,
}: UseMerchantBoundBaseAnalyticsOptions) {
  const requestKey = buildRequestKey(merchantId, from, to);
  const requestKeyRef = useRef<string | null>(requestKey);
  requestKeyRef.current = requestKey;
  const [snapshot, setSnapshot] = useState<BaseAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSnapshot(null);
    if (!merchantId || !from || !to || !requestKey) return;

    const controller = new AbortController();
    const requestKeyAtStart = requestKey;
    const setBoundAnalytics: Dispatch<SetStateAction<AnalyticsData | null>> = (
      next
    ) => {
      setSnapshot((current) => {
        if (requestKeyRef.current !== requestKeyAtStart) return current;
        const currentData =
          current?.requestKey === requestKeyAtStart ? current.data : null;
        const analytics = typeof next === 'function' ? next(currentData) : next;
        return analytics
          ? { data: analytics, requestKey: requestKeyAtStart }
          : null;
      });
    };
    const setBoundLoading: Dispatch<SetStateAction<boolean>> = (next) => {
      if (requestKeyRef.current !== requestKeyAtStart) return;
      setLoading(next);
    };

    fetchBaseAnalytics({
      from,
      merchantId,
      signal: controller.signal,
      to,
      setBaseAnalytics: setBoundAnalytics,
      setLoadingAnalytics: setBoundLoading,
    });

    return () => controller.abort();
  }, [from, merchantId, requestKey, to]);

  return {
    data: snapshot?.requestKey === requestKey ? snapshot.data : null,
    loading,
  };
}
