import { isStoreReadiness, type MobileStoreReadiness } from '@baci/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const storeReadinessKeys = {
  all: ['store-readiness'] as const,
  detail: (merchantId: string) =>
    ['store-readiness', 'mobile', merchantId] as const,
};

export function storeReadinessOptions(merchantId: string) {
  return queryOptions({
    queryKey: storeReadinessKeys.detail(merchantId),
    queryFn: async ({ signal }): Promise<MobileStoreReadiness> => {
      const endpoint =
        `/api/merchant/readiness?merchantId=${encodeURIComponent(merchantId)}` +
        '&surface=mobile';
      const value = await apiClient<unknown>(endpoint, { signal });

      if (
        !isStoreReadiness(value) ||
        value.merchantId !== merchantId ||
        value.surface !== 'mobile'
      ) {
        throw new Error('Invalid store readiness response');
      }

      return value;
    },
    staleTime: 0,
  });
}
