import type { QueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from './invalidate-store-readiness';
import { tryRefreshStoreReadiness } from './try-refresh-store-readiness';

export async function invalidateAnalyticsSaveReadiness(
  queryClient: QueryClient,
  merchantId: string,
  userId: string
): Promise<void> {
  await Promise.all([
    tryRefreshStoreReadiness(() =>
      queryClient.invalidateQueries({ queryKey: ['merchant'] })
    ),
    tryRefreshStoreReadiness(() =>
      queryClient.invalidateQueries({
        queryKey: ['merchant-analytics-full', userId, merchantId],
      })
    ),
    tryRefreshStoreReadiness(() =>
      invalidateStoreReadiness(queryClient, merchantId)
    ),
  ]);
}
