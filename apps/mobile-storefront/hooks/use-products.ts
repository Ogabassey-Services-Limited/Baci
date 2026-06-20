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

import { dedupeById } from '@baci/shared/lib';
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

  // Destructure exactly the fields consumed so TanStack Query's
  // tracked-property optimization limits re-renders to those fields.
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchedAfterMount,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['products', merchantId, options],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsPage(merchantId, options, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: options.search ? undefined : keepPreviousData,
    enabled: !!merchantId && options.enabled !== false,
  });

  const products = dedupeById(
    data?.pages.flatMap((page) => page.products) || []
  );
  const total = data?.pages[0]?.total || 0;

  return {
    products,
    total,
    isFetchedAfterMount,
    isLoading,
    isFetching,
    isError,
    error: error?.message || null,
    hasMore: hasNextPage || false,
    refetch,
    loadMore: () => {
      // Guard general `isFetching` (not just `isFetchingNextPage`) so a fast
      // scroll-to-bottom during a background refetch doesn't double-fetch.
      if (hasNextPage && !isFetching && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    isLoadingMore: isFetchingNextPage,
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

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ['product-brands', merchantId, options],
    queryFn: () => fetchAvailableBrands(merchantId, options),
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantId && options.enabled !== false,
  });

  return {
    brands: data ?? [],
    isLoading,
    isError,
    error: error?.message || null,
    refetch,
  };
}
