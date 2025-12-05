import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';

interface UseStorefrontProductsOptions {
  storeSlug?: string;
  limit?: number;
  category?: string;
}

interface UseStorefrontProductsResult {
  products: Product[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch products for a specific storefront
 * Used by templates to easily access engine data
 */
export function useStorefrontProducts({
  storeSlug,
  limit = 20,
  category,
}: UseStorefrontProductsOptions): UseStorefrontProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      if (!storeSlug) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (limit) params.set('limit', limit.toString());
        if (category && category !== 'All') params.set('category', category);

        const response = await fetch(
          `/api/storefront/${storeSlug}/products?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const data = await response.json();

        if (data.products && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching storefront products:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();

    return () => {
      controller.abort();
    };
  }, [storeSlug, limit, category]);

  return { products, loading, error };
}
