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
    onSuccess: async () => {
      if (!merchant?.id) return;
      await invalidateStoreReadiness(queryClient, merchant.id);
    },
    mutationKey: ['archiveProduct'],
    onSettled: (_data, _error, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['product', merchant?.id, productId],
      });
      queryClient.invalidateQueries({
        queryKey: ['inventory-stats', merchant?.id],
      });
    },
  });
}
