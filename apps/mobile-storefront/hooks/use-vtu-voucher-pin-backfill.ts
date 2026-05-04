import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import type { ValidUtilityType } from '@/components/utilities/utility-purchase.types';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { CONFIG } from '@/lib/config';
import { fetchWithTimeout, SHORT_TIMEOUT } from '@/lib/fetch-with-timeout';
import { supabase } from '@/lib/supabase';
import { VtuHistoryResponseSchema } from '@/schemas/vtu-history';
import { useAuthStore } from '@/stores/auth-store';

// Bill-style purchases (electricity, TV, betting) may receive their voucher /
// token after the initial confirm response returns, once the upstream provider
// reports back. Poll the history endpoint until the pin is persisted so the
// success screen can surface it without forcing the user to re-open history.
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 10;

const UTILITY_TYPE_TO_API_TYPE: Partial<
  Record<ValidUtilityType, 'electricity' | 'cable_tv' | 'betting'>
> = {
  power: 'electricity',
  tv: 'cable_tv',
  gaming: 'betting',
};

interface UseVtuVoucherPinBackfillInput {
  enabled: boolean;
  reference: string | null | undefined;
  utilityType: ValidUtilityType;
}

export function useVtuVoucherPinBackfill({
  enabled,
  reference,
  utilityType,
}: UseVtuVoucherPinBackfillInput) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const apiType = UTILITY_TYPE_TO_API_TYPE[utilityType] ?? null;
  const queryEnabled = Boolean(enabled && reference && apiType && userId);
  // dataUpdateCount only increments on referential change; null === null keeps
  // it at 1 forever. Track fetch attempts independently so the cap is reliable.
  const fetchCountRef = useRef(0);

  const query = useQuery<string | null>({
    queryKey: ['vtu', 'voucher-pin-backfill', userId, apiType, reference],
    enabled: queryEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: 0,
    refetchInterval: (q) => {
      if (q.state.data || q.state.status === 'error') {
        return false;
      }
      if (fetchCountRef.current >= MAX_POLL_ATTEMPTS) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      fetchCountRef.current += 1;

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return null;
      }

      const params = new URLSearchParams({
        merchantSlug: CONFIG.MERCHANT_SLUG,
        limit: '20',
      });
      if (apiType) {
        params.set('type', apiType);
      }

      let response: Response;
      let body: unknown;
      try {
        response = await fetchWithTimeout(
          `${EXPO_PUBLIC_API_URL}/api/vtu/history?${params.toString()}`,
          {
            method: 'GET',
            timeout: SHORT_TIMEOUT,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          }
        );
        if (!response.ok) {
          // Throw so React Query sets status='error', halting refetchInterval
          // immediately instead of wasting attempts on a non-retriable error.
          throw new Error(`VTU history fetch failed: ${response.status}`);
        }
        body = await response.json();
      } catch (error) {
        // Re-throw HTTP errors; wrap network/timeout/parse failures so the
        // error state is set and polling stops.
        throw error instanceof Error
          ? error
          : new Error('VTU history fetch failed');
      }

      const parsed = VtuHistoryResponseSchema.safeParse(body);
      if (!parsed.success) {
        // Broken contract — throw so polling halts instead of burning remaining
        // attempts returning null that React Query treats as successful empty data.
        throw new Error('VTU history response schema mismatch');
      }

      const match = parsed.data.transactions.find(
        (transaction) => transaction.request_reference === reference
      );
      const pin =
        typeof match?.voucher_pin === 'string' ? match.voucher_pin.trim() : '';
      return pin || null;
    },
  });

  return query.data ?? null;
}
