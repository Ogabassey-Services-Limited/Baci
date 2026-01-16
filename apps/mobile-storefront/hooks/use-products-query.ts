/**
 * Products Hook with React Query
 * 2025 Best Practice: Stale-while-revalidate, infinite queries, prefetching
 */

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { CONFIG } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import type { PageConfig } from '@/types/blocks';
import type { Product } from '@/types/product';

const MERCHANT_ID = CONFIG.MERCHANT_ID;

interface UseProductsOptions {
  category?: string;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  search?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

interface ProductsPage {
  products: Product[];
  nextOffset: number | null;
  total: number;
}

// Transform database product to app Product type
function transformProduct(item: any): Product {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    price: item.price,
    compare_at_price: item.compare_at_price,
    image: item.images?.[0] || '',
    images: item.images || [],
    brand: item.brand,
    category: item.categories?.[0]?.name,
    condition: item.condition,
    rating: 4.5,
    review_count: 0,
    in_stock: true,
  };
}

// Fetch products with pagination
async function fetchProductsPage(
  options: UseProductsOptions,
  offset: number
): Promise<ProductsPage> {
  const limit = options.limit || 20;

  let query = supabase
    .from('products')
    .select(
      `
      id, name, slug, description, price, compare_at_price,
      images, brand, condition,
      categories (id, name, slug)
    `,
      { count: 'exact' }
    )
    .eq('merchant_id', MERCHANT_ID)
    .eq('status', 'active');

  // Apply filters
  if (options.category) {
    query = query.contains('category_ids', [options.category]);
  }
  if (options.search) {
    query = query.ilike('name', `%${options.search}%`);
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
  // Note: minRating filter would require a rating column in DB or client-side filtering

  // Apply sorting
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

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  const products = (data || []).map(transformProduct);
  const total = count || 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return { products, nextOffset, total };
}

/**
 * Hook for fetching a specific page configuration
 */
export function usePageConfig(slug: string = 'home') {
  return useQuery({
    queryKey: ['page_config', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_configs')
        .select('published_config')
        .eq('merchant_id', MERCHANT_ID)
        .eq('page_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data?.published_config as PageConfig | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching all active categories
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('merchant_id', MERCHANT_ID)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for infinite product list with caching
 */
export function useProducts(options: UseProductsOptions = {}) {
  const query = useInfiniteQuery({
    queryKey: ['products', options],
    queryFn: ({ pageParam = 0 }) => fetchProductsPage(options, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Flatten pages into single array
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

  const query = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          id, name, slug, description, price, compare_at_price,
          images, brand, condition, specifications,
          has_variants, variant_attributes,
          categories (id, name, slug)
        `
        )
        .eq('merchant_id', MERCHANT_ID)
        .eq('slug', slug)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Product not found');

      return {
        ...transformProduct(data),
        specifications: data.specifications,
        has_variants: data.has_variants || false,
        variant_attributes: data.variant_attributes,
        variants: [],
      } as Product;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Try to get initial data from products list cache
    initialData: () => {
      const productsCache = queryClient.getQueryData<{ pages: ProductsPage[] }>(
        ['products', {}]
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
  };
}

/**
 * Prefetch products for a route before navigation
 */
export function usePrefetchProducts() {
  const queryClient = useQueryClient();

  return (options: UseProductsOptions = {}) => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ['products', options],
      queryFn: ({ pageParam = 0 }) => fetchProductsPage(options, pageParam),
      initialPageParam: 0,
    });
  };
}

/**
 * Prefetch a single product
 */
export function usePrefetchProduct() {
  const queryClient = useQueryClient();

  return (slug: string) => {
    queryClient.prefetchQuery({
      queryKey: ['product', slug],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('products')
          .select(
            `
            id, name, slug, description, price, compare_at_price,
            images, brand, condition, specifications,
            has_variants, variant_attributes,
            categories (id, name, slug)
          `
          )
          .eq('merchant_id', MERCHANT_ID)
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (error) throw error;
        return transformProduct(data);
      },
    });
  };
}
