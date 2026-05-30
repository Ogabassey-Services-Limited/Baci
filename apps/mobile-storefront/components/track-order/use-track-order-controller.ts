import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  TRACK_ORDER_API_BASE_URL,
  TRACK_ORDER_MERCHANT_SLUG,
} from './track-order.config';
import type { TrackOrderData } from './TrackOrderScreen.types';

export function useTrackOrderController() {
  const { trackingToken } = useLocalSearchParams<Record<string, string>>();
  const [data, setData] = useState<TrackOrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingToken) {
      setData(null);
      setError('No tracking token provided');
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);

    const fetchOrder = async () => {
      setIsLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(
          `${TRACK_ORDER_API_BASE_URL}/api/storefront/orders/track-order?token=${encodeURIComponent(trackingToken)}&merchant_slug=${encodeURIComponent(TRACK_ORDER_MERCHANT_SLUG)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { error?: string }).error || 'Order not found'
          );
        }

        const nextData = (await res.json()) as TrackOrderData;
        if (cancelled) return;
        setData(nextData);
      } catch (err) {
        if (cancelled) return;
        setError(
          timedOut
            ? 'Request timed out. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Failed to load order'
        );
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOrder();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trackingToken]);

  return { data, error, isLoading };
}
