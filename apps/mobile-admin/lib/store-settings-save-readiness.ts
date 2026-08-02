import type { QueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from './invalidate-store-readiness';
import { tryRefreshStoreReadiness } from './try-refresh-store-readiness';

export async function invalidateStoreSettingsAfterSave(
  queryClient: QueryClient,
  merchantId: string | undefined
): Promise<void> {
  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ['merchant'] }),
    queryClient.invalidateQueries({ queryKey: ['merchant-settings'] }),
  ];
  const normalizedMerchantId = merchantId?.trim();
  if (normalizedMerchantId) {
    invalidations.push(
      tryRefreshStoreReadiness(() =>
        invalidateStoreReadiness(queryClient, normalizedMerchantId)
      )
    );
  }
  await Promise.all(invalidations);
}
