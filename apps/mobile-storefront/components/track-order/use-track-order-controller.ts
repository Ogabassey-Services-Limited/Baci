import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TrackOrderData } from './TrackOrderScreen.types';
import {
  TRACK_ORDER_API_BASE_URL,
  TRACK_ORDER_MERCHANT_SLUG,
} from './track-order.config';

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
  // Holds the token of the most recent request so a late-resolving fetch for a
  // previous token can never overwrite the current token's state, even if it
  // settles before the old effect's cleanup flips `cancelled`.
  const latestTokenRef = useRef(trackingToken);

  // Reset during render (instead of in the effect) so consumers never see a
  // stale frame while the token changes.
  const [prevTrackingToken, setPrevTrackingToken] = useState(trackingToken);
  if (prevTrackingToken !== trackingToken) {
    setPrevTrackingToken(trackingToken);
    latestTokenRef.current = trackingToken;
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

    const isStale = () => cancelled || latestTokenRef.current !== trackingToken;

    fetchTrackedOrder(trackingToken, controller.signal)
      .then((nextData) => {
        if (isStale()) return;
        setState({ data: nextData, error: null, isLoading: false });
      })
      .catch((err: unknown) => {
        if (isStale()) return;
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
