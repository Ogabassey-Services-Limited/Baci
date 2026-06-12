import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  TRACK_ORDER_API_BASE_URL,
  TRACK_ORDER_MERCHANT_SLUG,
} from './track-order.config';
import type { TrackOrderData } from './TrackOrderScreen.types';

type TrackOrderState = {
  data: TrackOrderData | null;
  error: string | null;
  isLoading: boolean;
};

function createInitialTrackOrderState(
  trackingToken: string | undefined
): TrackOrderState {
  return trackingToken
    ? { data: null, error: null, isLoading: true }
    : { data: null, error: 'No tracking token provided', isLoading: false };
}

// Hoisted: `throw` inside try/catch in a hook body blocks React Compiler.
async function fetchTrackedOrder(
  trackingToken: string,
  signal: AbortSignal
): Promise<TrackOrderData> {
  const res = await fetch(
    `${TRACK_ORDER_API_BASE_URL}/api/storefront/orders/track-order?token=${encodeURIComponent(trackingToken)}&merchant_slug=${encodeURIComponent(TRACK_ORDER_MERCHANT_SLUG)}`,
    { signal }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || 'Order not found');
  }

  return (await res.json()) as TrackOrderData;
}

export function useTrackOrderController() {
  const { trackingToken } = useLocalSearchParams<Record<string, string>>();
  const [state, setState] = useState<TrackOrderState>(() =>
    createInitialTrackOrderState(trackingToken)
  );

  // Reset during render (instead of in the effect) so consumers never see a
  // stale frame while the token changes.
  const [prevTrackingToken, setPrevTrackingToken] = useState(trackingToken);
  if (prevTrackingToken !== trackingToken) {
    setPrevTrackingToken(trackingToken);
    setState(createInitialTrackOrderState(trackingToken));
  }

  useEffect(() => {
    if (!trackingToken) return;

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);

    fetchTrackedOrder(trackingToken, controller.signal)
      .then((nextData) => {
        if (cancelled) return;
        setState({ data: nextData, error: null, isLoading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          error: timedOut
            ? 'Request timed out. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Failed to load order',
          isLoading: false,
        });
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trackingToken]);

  return state;
}
