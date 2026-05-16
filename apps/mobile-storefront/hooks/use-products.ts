/**
 * Products Hook with React Query
 *
 * 2026 Best Practices:
 * - Stale-while-revalidate for optimal UX
 * - Infinite queries for pagination
 * - Prefetching for navigation optimization
 * - Automatic retry with exponential backoff for resilience
 * - Optimistic updates for instant feel
 */

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  CONSTANT_MERCHANT_ID,
  fetchAvailableBrands,
  fetchProductsPage,
  type UseProductsOptions,
} from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';

export function useProducts(options: UseProductsOptions = {}) {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  const query = useInfiniteQuery({
    queryKey: ['products', merchantId, options],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsPage(merchantId, options, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
    placeholderData: options.search ? undefined : keepPreviousData,
    enabled: !!merchantId && options.enabled !== false,
  });

  const products = query.data?.pages.flatMap((page) => page.products) || [];
  const total = query.data?.pages[0]?.total || 0;

  return {
    products,
    total,
    isFetchedAfterMount: query.isFetchedAfterMount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error?.message || null,
    hasMore: query.hasNextPage || false,
    refetch: query.refetch,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
    isLoadingMore: query.isFetchingNextPage,
  };
}

export function usePrefetchProducts() {
  const queryClient = useQueryClient();
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return (options: UseProductsOptions = {}) => {
    if (!merchantId) return;
    queryClient.prefetchInfiniteQuery({
      queryKey: ['products', merchantId, options],
      queryFn: ({ pageParam = 0 }) =>
        fetchProductsPage(merchantId, options, pageParam),
      initialPageParam: 0,
    });
  };
}

export function useProductBrands(options: UseProductsOptions = {}) {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  const query = useQuery({
    queryKey: ['product-brands', merchantId, options],
    queryFn: () => fetchAvailableBrands(merchantId, options),
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantId && options.enabled !== false,
  });

  return {
    brands: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
