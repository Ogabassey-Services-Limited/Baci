import type { QueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from './invalidate-store-readiness';

export async function invalidateAnalyticsSaveReadiness(
  queryClient: QueryClient,
  merchantId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['merchant'] }),
    queryClient.invalidateQueries({ queryKey: ['merchant-analytics-full'] }),
    invalidateStoreReadiness(queryClient, merchantId),
  ]);
}
