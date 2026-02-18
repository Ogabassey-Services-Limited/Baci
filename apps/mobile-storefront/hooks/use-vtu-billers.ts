import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { fetchWithRetry } from '@/lib/api';
import { logger } from '@/lib/logger';
import { type Biller, BillerListSchema } from '@/lib/vtu-schemas';
export type { Biller };

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

const log = logger;

export const vtuBillerKeys = {
  all: ['vtu', 'billers'] as const,
  byType: (type: string) => ['vtu', 'billers', type] as const,
};

/**
 * Fetches available billers for a given bill type.
 * 2026 Best Practices:
 * - Runtime validation via Zod
 * - Network resilience via fetchWithRetry
 * - Performance telemetry for observability
 */
export function useVTUBillers(type: string, enabled = true) {
  return useQuery<Biller[]>({
    queryKey: vtuBillerKeys.byType(type),
    queryFn: async () => {
      const startTime = Date.now();
      log.info('VTU', `Fetching billers for type: ${type}`);

      try {
        const response = await fetchWithRetry(
          `${API_URL}/api/vtu/billers?type=${type}`,
          {},
          {
            timeout: 10000,
            maxRetries: 2,
          }
        );

        // Check response status BEFORE parsing JSON to avoid SyntaxError
        // on non-JSON error responses (e.g. 502 proxy HTML pages)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch providers (HTTP ${response.status})`
          );
        }

        const data = await response.json();

        // Performance Telemetry
        const duration = Date.now() - startTime;
        log.info('VTU', `Biller fetch completed in ${duration}ms`);

        // Check for API error response (e.g. { error: "..." })
        if (data.error) {
          throw new Error(data.error);
        }

        // Runtime Integrity Check
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
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours (Flash-Load)
    enabled,
  });
}
