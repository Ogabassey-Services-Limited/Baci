import type { useQueryClient } from '@tanstack/react-query';

type QueryClient = ReturnType<typeof useQueryClient>;

export function invalidateVariantInventoryQueries(
  queryClient: QueryClient,
  merchantId: string | undefined,
  productId?: string
) {
  queryClient.invalidateQueries({
    queryKey: ['variant-inventory', merchantId],
  });
  queryClient.invalidateQueries({ queryKey: ['products', merchantId] });

  if (productId) {
    queryClient.invalidateQueries({
      queryKey: ['product', merchantId, productId],
    });
  }

  queryClient.invalidateQueries({ queryKey: ['inventory-stats', merchantId] });
}

export function toInventoryMutationError(error: { message?: string }) {
  return new Error(error.message || 'Inventory mutation failed');
}
