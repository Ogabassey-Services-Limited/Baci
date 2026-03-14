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
import { withSupabaseRetry } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { fetchProductDetails } from '@/lib/storefront-product-details';
import { transformProduct } from '@/lib/storefront-product-transform';
import { supabase } from '@/lib/supabase';
import type { PageConfig } from '@/types/blocks';
import type { Product } from '@/types/product';

const log = createLogger('Products');

// Use slug as the source of truth if ID is uncertain
const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG || 'ogabassey';
// Initial fallback
const CONSTANT_MERCHANT_ID = CONFIG.MERCHANT_ID;

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  icon?: string;
}

export interface UseProductsOptions {
  category?: string;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  search?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  enabled?: boolean;
}

interface ProductsPage {
  products: Product[];
  nextOffset: number | null;
  total: number;
}

interface Merchant {
  id: string;
  slug: string;
  business_name: string;
  social_media: Record<string, string>;
  email?: string;
  phone?: string;
  business_address?: string;
  hero_slides?: Record<string, string>[];
}

/**
 * Hook to resolve Merchant ID from Slug (Cached)
 * This ensures we always get the correct ID even if config is stale
 */
export function useMerchant() {
  return useQuery<Merchant>({
    queryKey: ['merchant_id', MERCHANT_SLUG],
    queryFn: async () => {
      log.info('Resolving ID for slug:', MERCHANT_SLUG);

      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('merchants')
            .select(
              'id, slug, business_name, social_media, email, phone, business_address, hero_slides'
            )
            .eq('slug', MERCHANT_SLUG)
            .single(),
        { maxRetries: 3 }
      );

      if (error) throw error;
      if (!data) throw new Error('Merchant not found');
      return data as Merchant;
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    placeholderData: {
      id: CONSTANT_MERCHANT_ID,
      slug: MERCHANT_SLUG,
      business_name: 'Store',
      social_media: {},
    } as Merchant,
  });
}

// Fetch products with pagination
async function fetchProductsPage(
  merchantId: string,
  options: UseProductsOptions,
  offset: number
): Promise<ProductsPage> {
  const limit = options.limit || 20;

  // Use await to ensure query is built first
  let query = supabase
    .from('products')
    .select(
      `
      id, name, slug, description, price, compare_at_price,
      images, brand, condition, manage_stock, stock_quantity,
      categories (id, name, slug)
    `,
      { count: 'exact' }
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (options.category) {
    query = query.eq('category_id', options.category);
  }
  if (options.search) {
    // L5 FIX: Escape % and _ wildcards in search query before passing to ilike
    const escapedSearch = options.search
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    query = query.ilike('name', `%${escapedSearch}%`);
  }
  if (options.condition) {
    query = query.eq('condition', options.condition);
  }
  if (options.brand) {
    query = query.eq('brand', options.brand);
  }
  if (options.minPrice !== undefined) {
    query = query.gte('price', options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    query = query.lte('price', options.maxPrice);
  }
  if (options.minRating !== undefined && options.minRating > 0) {
    query = query.gte('average_rating', options.minRating);
  }

  switch (options.sortBy) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'popular':
      query = query.order('view_count', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  // Wrap explicitly in async function to satisfy type checker
  const result = await withSupabaseRetry(async () => await query, {
    maxRetries: 3,
    onRetry: (attempt, err) => {
      log.warn(`Retry ${attempt}: ${err.message}`);
    },
  });

  if (result.error) throw result.error;

  const products = (result.data || []).map(transformProduct);
  // 2026 Critical Fix: Access count from Supabase response with proper typing
  // The count is returned when using { count: 'exact' } in select
  const resultWithCount = result as typeof result & { count: number | null };
  const total = resultWithCount.count ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return { products, nextOffset, total };
}

/**
 * Hook for fetching a specific page configuration
 */
export function usePageConfig(slug: string = 'home') {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery({
    queryKey: ['page_config', slug, merchantId],
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('page_configs')
            .select('published_config')
            .eq('merchant_id', merchantId)
            .eq('page_slug', slug)
            .eq('is_published', true)
            .maybeSingle(),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`PageConfig retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      // 2026 Critical Fix: Access published_config with null safety
      // The select('published_config') returns { published_config: unknown } | null
      return (data?.published_config ?? null) as PageConfig | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!merchantId,
  });
}

/**
 * Hook for fetching all active categories
 */
export function useCategories() {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery({
    queryKey: ['categories', merchantId],
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('categories')
            .select('id, name, slug, image_url')
            .eq('merchant_id', merchantId)
            .order('name'),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`Categories retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      return (data as Category[]) || [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!merchantId,
  });
}

/**
 * Hook for infinite product list with caching
 */
export function useProducts(options: UseProductsOptions = {}) {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  const query = useInfiniteQuery({
    queryKey: ['products', merchantId, options],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsPage(merchantId, options, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: keepPreviousData, // 2026 Best Practice: Keep previous data while fetching new category
    enabled: !!merchantId && options.enabled !== false,
  });

  const products = query.data?.pages.flatMap((page) => page.products) || [];
  const total = query.data?.pages[0]?.total || 0;

  return {
    products,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
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

/**
 * Hook for single product with caching
 */
export function useProduct(slug: string) {
  const queryClient = useQueryClient();
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  const query = useQuery({
    queryKey: ['product', slug, merchantId],
    queryFn: () => {
      log.info('Fetching product:', slug);
      return fetchProductDetails(merchantId, slug);
    },
    enabled: !!slug && !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: () => {
      const productsCache = queryClient.getQueryData<{ pages: ProductsPage[] }>(
        ['products', merchantId, {}] // Use correct query key with merchantId
      );
      if (!productsCache) return undefined;

      for (const page of productsCache.pages) {
        const found = page.products.find((p) => p.slug === slug);
        if (found) return found;
      }
      return undefined;
    },
  });

  return {
    product: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/**
 * Prefetch products for a route before navigation
 */
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

/**
 * Prefetch a single product
 */
export function usePrefetchProduct() {
  const queryClient = useQueryClient();
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return (slug: string) => {
    if (!merchantId) return;
    queryClient.prefetchQuery({
      queryKey: ['product', slug, merchantId],
      queryFn: () => fetchProductDetails(merchantId, slug),
    });
  };
}
