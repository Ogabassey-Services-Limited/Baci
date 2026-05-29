import type { QueryClient } from '@tanstack/react-query';

interface CachedProductStock {
  id: string;
  stock_quantity?: number;
}

export function getCachedProductStock(
  queryClient: QueryClient,
  productId: string
): number | undefined {
  const queries = queryClient.getQueriesData<CachedProductStock[]>({
    queryKey: ['products'],
  });

  for (const [, data] of queries) {
    if (!Array.isArray(data)) continue;
    const product = data.find(
      (item): item is CachedProductStock =>
        item?.id === productId && item.stock_quantity != null
    );
    if (product) return product.stock_quantity;
  }

  return undefined;
}
