import type { QueryClient } from '@tanstack/react-query';
import { storeReadinessKeys } from './store-readiness-query';

export async function invalidateStoreReadiness(
  queryClient: QueryClient,
  merchantId: string
): Promise<void> {
  const normalizedMerchantId = merchantId.trim();
  if (!normalizedMerchantId) {
    throw new Error('Merchant ID is required to invalidate store readiness');
  }

  await queryClient.invalidateQueries({
    queryKey: storeReadinessKeys.detail(normalizedMerchantId),
  });
}
