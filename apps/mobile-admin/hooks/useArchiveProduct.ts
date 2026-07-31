import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import { useMerchant } from './useMerchant';

interface ArchiveProductResponse {
  product: {
    id: string;
    status: string;
  };
  success: boolean;
}

interface ArchiveProductMutationContext {
  merchantId: string | undefined;
}

export function archiveProductById(
  productId: string,
  merchantId: string | undefined
): Promise<ArchiveProductResponse> {
  if (!productId) {
    throw new Error('Product id is required');
  }
  const normalizedMerchantId = merchantId?.trim();
  if (!normalizedMerchantId) {
    throw new Error('Merchant id is required');
  }

  return apiClient<ArchiveProductResponse>(
    `/api/products/${encodeURIComponent(productId)}/archive`,
    {
      method: 'PATCH',
      body: JSON.stringify({ merchantId: normalizedMerchantId }),
    }
  );
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id?.trim() || undefined;

  return useMutation({
    mutationFn: ({ productId }: { productId: string }) =>
      archiveProductById(productId, merchantId),
    mutationKey: ['archiveProduct'],
    onMutate: (): ArchiveProductMutationContext => ({
      merchantId,
    }),
    onSettled: async (_data, error, { productId }, context) => {
      const merchantId = context?.merchantId;
      if (!merchantId) return;
      const productsQueryKey = merchantId
        ? ['products', merchantId]
        : ['products'];
      const productQueryKey = merchantId
        ? ['product', merchantId, productId]
        : ['product'];
      const inventoryStatsQueryKey = merchantId
        ? ['inventory-stats', merchantId]
        : ['inventory-stats'];
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: productsQueryKey }),
        queryClient.invalidateQueries({ queryKey: productQueryKey }),
        queryClient.invalidateQueries({ queryKey: inventoryStatsQueryKey }),
      ];
      if (!error && merchantId?.trim()) {
        invalidations.push(
          tryRefreshStoreReadiness(() =>
            invalidateStoreReadiness(queryClient, merchantId)
          )
        );
      }
      await Promise.all(invalidations);
    },
  });
}
