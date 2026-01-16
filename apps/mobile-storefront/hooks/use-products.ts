/**
 * Products Hook
 * Fetches products from Supabase for the mobile storefront
 */

import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/product';

const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

interface UseProductsOptions {
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  search?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface UseProductsResult {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useProducts(
  options: UseProductsOptions = {}
): UseProductsResult {
  const {
    category,
    limit = 20,
    offset = 0,
    sortBy = 'newest',
    search,
    condition,
    minPrice,
    maxPrice,
  } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(offset);

  const fetchProducts = useCallback(
    async (isLoadMore = false) => {
      try {
        if (!isLoadMore) {
          setIsLoading(true);
          setCurrentOffset(0);
        }

        // First get the merchant ID
        console.log('Fetching merchant with slug:', MERCHANT_SLUG);
        const { data: merchant, error: merchantError } = await supabase
          .from('merchants')
          .select('id')
          .eq('slug', MERCHANT_SLUG)
          .single();

        console.log('Merchant query result:', { merchant, merchantError });

        if (merchantError || !merchant) {
          // Merchant not found - return empty products
          console.warn(
            `Store "${MERCHANT_SLUG}" not found. Error:`,
            merchantError
          );
          setProducts([]);
          setTotal(0);
          setHasMore(false);
          setError(null);
          setIsLoading(false);
          return;
        }

        // Build query
        let query = supabase
          .from('products')
          .select(
            `
            id,
            name,
            slug,
            description,
            price,
            compare_at_price,
            images,
            brand,
            condition,
            status,
            categories (
              id,
              name,
              slug
            )
          `,
            { count: 'exact' }
          )
          .eq('merchant_id', merchant.id)
          .eq('status', 'active');

        // Apply filters
        if (category) {
          query = query.contains('category_ids', [category]);
        }

        if (search) {
          query = query.ilike('name', `%${search}%`);
        }

        if (condition) {
          query = query.eq('condition', condition);
        }

        if (minPrice !== undefined) {
          query = query.gte('price', minPrice);
        }

        if (maxPrice !== undefined) {
          query = query.lte('price', maxPrice);
        }

        // Apply sorting
        switch (sortBy) {
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
        const queryOffset = isLoadMore ? currentOffset : 0;
        query = query.range(queryOffset, queryOffset + limit - 1);

        const { data, error: queryError, count } = await query;

        if (queryError) {
          throw queryError;
        }

        // Transform data to match Product type
        const transformedProducts: Product[] = (data || []).map(
          (item: any) => ({
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
            rating: 4.5, // Default rating - implement actual ratings later
            review_count: 0,
            in_stock: true,
          })
        );

        if (isLoadMore) {
          setProducts((prev) => [...prev, ...transformedProducts]);
        } else {
          setProducts(transformedProducts);
        }

        setTotal(count || 0);
        setHasMore((count || 0) > queryOffset + limit);
        setCurrentOffset(queryOffset + limit);
        setError(null);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch products'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      category,
      limit,
      sortBy,
      search,
      condition,
      minPrice,
      maxPrice,
      currentOffset,
    ]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refetch = useCallback(async () => {
    await fetchProducts(false);
  }, [fetchProducts]);

  const loadMore = useCallback(async () => {
    if (!isLoading && hasMore) {
      await fetchProducts(true);
    }
  }, [fetchProducts, isLoading, hasMore]);

  return {
    products,
    isLoading,
    error,
    hasMore,
    total,
    refetch,
    loadMore,
  };
}

/**
 * Fetch a single product by slug
 */
export function useProduct(slug: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setIsLoading(true);

        const { data: merchant, error: merchantError } = await supabase
          .from('merchants')
          .select('id')
          .eq('slug', MERCHANT_SLUG)
          .single();

        if (merchantError || !merchant) {
          console.warn('Store not found');
          setProduct(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        const { data, error: queryError } = await supabase
          .from('products')
          .select(
            `
            id,
            name,
            slug,
            description,
            price,
            compare_at_price,
            images,
            brand,
            condition,
            specifications,
            has_variants,
            variant_attributes,
            categories (
              id,
              name,
              slug
            )
          `
          )
          .eq('merchant_id', merchant.id)
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (queryError) {
          throw queryError;
        }

        if (!data) {
          throw new Error('Product not found');
        }

        // Build variants from variant_attributes if product has variants
        // Note: product_variants table requires merchant auth, so we use variant_attributes instead
        const variantAttrs = (data as any).variant_attributes as Record<
          string,
          string[]
        > | null;
        const variants: any[] = [];

        // If product has variants, create synthetic variant entries from attributes
        if ((data as any).has_variants && variantAttrs) {
          // For now, just indicate variants exist - full variant selection
          // would require authenticated access to product_variants table
        }

        const transformedProduct: Product = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: data.price,
          compare_at_price: data.compare_at_price,
          image: data.images?.[0] || '',
          images: data.images || [],
          brand: data.brand,
          category: (data.categories as any)?.[0]?.name,
          condition: data.condition,
          specifications: data.specifications,
          has_variants: (data as any).has_variants || false,
          variant_attributes: (data as any).variant_attributes,
          variants,
          rating: 4.5,
          review_count: 0,
          in_stock: true,
        };

        setProduct(transformedProduct);
        setError(null);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch product'
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  return { product, isLoading, error };
}
