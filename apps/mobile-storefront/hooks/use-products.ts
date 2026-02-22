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
import { resolveLatestPublishedPageConfigWithMeta } from '@/hooks/page-config-resolution';
import { withSupabaseRetry } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { ProductRowSchema } from '@/lib/validation';
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

/** Convert [{param, options}] array to Record<string, string[]> for UI consumption */
function normalizeVariantAttributes(
  attrs: { param: string; options: string[] }[] | null | undefined
): Record<string, string[]> | undefined {
  if (!attrs || !Array.isArray(attrs)) return undefined;
  const record: Record<string, string[]> = {};
  for (const { param, options } of attrs) {
    record[param] = options;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

// 2026 Best Practice: Transform database product to app Product type with validation
function transformProduct(item: unknown): Product {
  // Validate the item shape
  const validated = ProductRowSchema.safeParse(item);
  const product = validated.success
    ? validated.data
    : (item as Record<string, unknown>);

  return {
    id: String(product.id ?? ''),
    name: String(product.name ?? ''),
    slug: String(product.slug ?? ''),
    description: product.description as string | undefined,
    price: Number(product.price ?? 0),
    compare_at_price: product.compare_at_price as number | undefined,
    image: Array.isArray(product.images) ? (product.images[0] ?? '') : '',
    images: Array.isArray(product.images) ? product.images : [],
    brand: product.brand as string | undefined,
    category: Array.isArray(product.categories)
      ? product.categories.length > 0
        ? (product.categories[0] as Category).name
        : ''
      : product.categories != null
        ? (product.categories as unknown as Category).name
        : '',
    condition: product.condition as Product['condition'],
    rating: 4.5,
    review_count: 0,
    manage_stock: (product.manage_stock as boolean) ?? false,
    in_stock:
      !(product.manage_stock as boolean) ||
      ((product.stock_quantity as number) ?? 0) > 0,
  };
}

interface Merchant {
  id: string;
  slug: string;
  business_name: string;
  updated_at?: string | null;
  social_media: Record<string, string>;
  email?: string;
  phone?: string;
  business_address?: string;
  mobile_hero_slides?: Record<string, string>[];
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
              'id, slug, business_name, updated_at, social_media, email, phone, business_address, mobile_hero_slides'
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
            .select('published_config, updated_at')
            .eq('merchant_id', merchantId)
            .eq('page_slug', slug)
            .eq('is_published', true)
            .order('updated_at', { ascending: false })
            .limit(5),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`PageConfig retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      return resolveLatestPublishedPageConfigWithMeta(
        (data ?? []) as Array<{
          published_config: unknown;
          updated_at?: string | null;
        }>
      ) as
        | {
            config: PageConfig;
            updatedAt: string | null;
          }
        | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always',
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
    queryFn: async () => {
      log.info('Fetching product:', slug);

      // Determine if slug is actually an ID (UUID)
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          slug
        );

      let supabaseQuery = supabase
        .from('products')
        .select(
          `
          id, name, slug, description, price, compare_at_price,
          images, brand, condition, specifications,
          has_variants, variant_attributes, manage_stock, stock_quantity,
          categories (id, name, slug)
        `
        )
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      if (isUuid) {
        supabaseQuery = supabaseQuery.eq('id', slug);
      } else {
        supabaseQuery = supabaseQuery.eq('slug', slug);
      }

      const { data, error } = await withSupabaseRetry(
        async () => await supabaseQuery.single(),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`Product retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      if (!data) throw new Error('Product not found');

      // 2026 Best Practice: Validate data at the edge
      const validated = ProductRowSchema.safeParse(data);
      if (!validated.success) {
        // BUG-2-002 FIX: Log validation error and throw instead of silently falling back
        log.error('Product validation failed:', validated.error.format());
        throw new Error(
          `Product validation failed: ${validated.error.message}`
        );
      }

      const item = validated.data;

      return {
        ...transformProduct(item),
        specifications: item.specifications,
        has_variants: item.has_variants || false,
        variant_attributes: normalizeVariantAttributes(item.variant_attributes),
        variants: [], // To be populated by separate variants fetch if needed
      } as Product;
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
      queryFn: async () => {
        // Determine if slug is actually an ID (UUID)
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            slug
          );

        let supabaseQuery = supabase
          .from('products')
          .select(
            `
            id, name, slug, description, price, compare_at_price,
            images, brand, condition, specifications,
            has_variants, variant_attributes, manage_stock, stock_quantity,
            categories (id, name, slug)
          `
          )
          .eq('merchant_id', merchantId)
          .eq('status', 'active');

        if (isUuid) {
          supabaseQuery = supabaseQuery.eq('id', slug);
        } else {
          supabaseQuery = supabaseQuery.eq('slug', slug);
        }

        const { data, error } = await withSupabaseRetry(
          async () => await supabaseQuery.single(),
          {
            maxRetries: 3,
            onRetry: (attempt, err) => {
              log.warn(`Prefetch product retry ${attempt}: ${err.message}`);
            },
          }
        );

        if (error) throw error;

        // 2026 Best Practice: Validate data at the edge
        const validated = ProductRowSchema.safeParse(data);
        if (!validated.success) {
          log.error(
            'Prefetch product validation failed:',
            validated.error.format()
          );
        }

        return transformProduct(validated.success ? validated.data : data);
      },
    });
  };
}
