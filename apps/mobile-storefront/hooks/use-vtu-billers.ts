import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { fetchWithRetry } from '@/lib/api';
import { logger } from '@/lib/logger';
import { BILLER_GC_TIME, BILLER_STALE_TIME } from '@/lib/vtu-constants';
import {
  type Biller,
  type BillItem,
  BillerListSchema,
} from '@/lib/vtu-schemas';
export type { Biller, BillItem };

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

const log = logger;

export const vtuBillerKeys = {
  all: ['vtu', 'billers'] as const,
  byType: (type: string) => ['vtu', 'billers', type] as const,
};

/** All bill types that can be prefetched */
const PREFETCH_TYPES = ['data', 'cable_tv', 'electricity', 'betting'] as const;

/** Shared fetch function used by both useQuery and prefetch */
async function fetchBillers(type: string): Promise<Biller[]> {
  const startTime = Date.now();
  log.info('VTU', `Fetching billers for type: ${type}`);

  try {
    const response = await fetchWithRetry(
      `${API_URL}/api/vtu/billers?type=${type}`,
      {
        cache: 'no-store',
      },
      {
        timeout: 10000,
        maxRetries: 2,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch providers (HTTP ${response.status})`);
    }

    const data = await response.json();

    const duration = Date.now() - startTime;
    log.info('VTU', `Biller fetch completed in ${duration}ms`);

    if (data.error) {
      throw new Error(data.error);
    }

    const result = BillerListSchema.safeParse(data);
    if (!result.success) {
      log.warn(
        'VTU',
        'Biller API response failed Zod validation',
        result.error.format()
      );
      throw new Error('Invalid provider data received. Please try again.');
    }

    return result.data.billers;
  } catch (error) {
    log.error(
      'VTU',
      `Failed to fetch billers: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
}

/**
 * Fetches available billers for a given bill type.
 * Uses a short stale window because provider packages and nested bill items
 * can change independently of the app release cycle.
 */
export function useVTUBillers(type: string, enabled = true) {
  return useQuery<Biller[]>({
    queryKey: vtuBillerKeys.byType(type),
    queryFn: () => fetchBillers(type),
    staleTime: BILLER_STALE_TIME,
    gcTime: BILLER_GC_TIME,
    enabled,
  });
}

/**
 * Prefetches billers for all bill categories on mount.
 * Call this from UtilityPanel so data is cached before the user taps a category.
 */
export function usePrefetchBillers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    for (const type of PREFETCH_TYPES) {
      queryClient.prefetchQuery({
        queryKey: vtuBillerKeys.byType(type),
        queryFn: () => fetchBillers(type),
        staleTime: BILLER_STALE_TIME,
      });
    }
  }, [queryClient]);
}
