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

interface FetchStorefrontProductsArgs {
  storeSlug: string;
  limit: number;
  category?: string;
  signal: AbortSignal;
  setProducts: (products: Product[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

// Module-scope helper so the try/finally control flow lives outside the hook
// body, keeping the hook compilable by the React Compiler.
async function fetchStorefrontProducts({
  storeSlug,
  limit,
  category,
  signal,
  setProducts,
  setLoading,
  setError,
}: FetchStorefrontProductsArgs): Promise<void> {
  try {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (category && category !== 'All') params.set('category', category);

    const response = await fetch(
      `/api/storefront/${storeSlug}/products?${params.toString()}`,
      { signal }
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
    if (!signal.aborted) {
      setLoading(false);
    }
  }
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
  const [error, setError] = useState<Error | null>(null);

  // When there is no store slug there is nothing to fetch, so we are never
  // loading. Deriving this during render (and tracking the slug transition with
  // a prev-prop comparison) avoids a synchronous setState inside the effect,
  // which would force an extra render with a stale `loading` value.
  const [loading, setLoading] = useState(Boolean(storeSlug));
  const [prevStoreSlug, setPrevStoreSlug] = useState(storeSlug);
  if (storeSlug !== prevStoreSlug) {
    setPrevStoreSlug(storeSlug);
    if (!storeSlug) {
      setLoading(false);
      setProducts([]);
      setError(null);
    }
  }

  useEffect(() => {
    if (!storeSlug) {
      setProducts([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    void fetchStorefrontProducts({
      storeSlug,
      limit,
      category,
      signal: controller.signal,
      setProducts,
      setLoading,
      setError,
    });

    return () => {
      controller.abort();
    };
  }, [storeSlug, limit, category]);

  return { products, loading, error };
}
