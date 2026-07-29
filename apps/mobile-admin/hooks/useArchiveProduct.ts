import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { useMerchant } from './useMerchant';

interface ArchiveProductResponse {
  product: {
    id: string;
    status: string;
  };
  success: boolean;
}

export function archiveProductById(
  productId: string
): Promise<ArchiveProductResponse> {
  if (!productId) {
    throw new Error('Product id is required');
  }

  return apiClient<ArchiveProductResponse>(
    `/api/products/${encodeURIComponent(productId)}/archive`,
    { method: 'PATCH' }
  );
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: ({ productId }: { productId: string }) =>
      archiveProductById(productId),
    mutationKey: ['archiveProduct'],
    onSettled: async (_data, error, { productId }) => {
      const merchantId = merchant?.id;
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['products', merchantId] }),
        queryClient.invalidateQueries({
          queryKey: ['product', merchantId, productId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inventory-stats', merchantId],
        }),
      ];
      if (!error && merchantId?.trim()) {
        invalidations.push(invalidateStoreReadiness(queryClient, merchantId));
      }
      await Promise.all(invalidations);
    },
  });
}
