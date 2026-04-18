import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import type { RawDbProduct } from '@/lib/normalize-product';
import { createClient } from '@/lib/supabase/server';
import {
  mapStorefrontProduct,
  STOREFRONT_PRODUCTS_COMPACT_SELECT,
  STOREFRONT_PRODUCTS_FULL_SELECT,
} from './product-response';

// Zod schema for query parameters
const querySchema = z.object({
  merchant_id: z.string().uuid().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  condition: z.enum(['new', 'used', 'refurbished', 'all']).optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  compact: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
  q: z.string().max(100).optional(),
  ids: z.string().optional(),
  has_images: z.coerce.boolean().optional(),
});

type ProductFilters = z.infer<typeof querySchema>;

// Factory function that creates a cached function for each merchant + filters combination
function createCachedProductsFetcher(
  merchantId: string,
  filters: ProductFilters = { sort: 'newest' }
) {
  // Create a cache key based on merchant and all active filters
  const cacheKeyParts = ['storefront-products', merchantId];
  if (filters.category) cacheKeyParts.push(`cat-${filters.category}`);
  if (filters.brand) cacheKeyParts.push(`brand-${filters.brand}`);
  if (filters.condition) cacheKeyParts.push(`cond-${filters.condition}`);
  if (filters.min_price !== undefined)
    cacheKeyParts.push(`min-${filters.min_price}`);
  if (filters.max_price !== undefined)
    cacheKeyParts.push(`max-${filters.max_price}`);
  if (filters.sort) cacheKeyParts.push(`sort-${filters.sort}`);
  if (filters.limit !== undefined) cacheKeyParts.push(`limit-${filters.limit}`);
  if (filters.compact) cacheKeyParts.push('compact');
  if (filters.has_images) cacheKeyParts.push(`img-${filters.has_images}`);
  if (filters.q)
    cacheKeyParts.push(`q-${filters.q.slice(0, 100).toLowerCase().trim()}`);

  return unstable_cache(
    async () => {
      const supabase = createStaticClient(
        getSupabaseUrl(),
        getSupabaseAnonKey()
      );

      let query = supabase
        .from('products')
        .select(
          filters.compact
            ? STOREFRONT_PRODUCTS_COMPACT_SELECT
            : STOREFRONT_PRODUCTS_FULL_SELECT
        )
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      // Apply category filter - match by category name (case-insensitive)
      // Products store category as a direct text field (e.g., "Laptops", "Smartphones")
      if (filters.category && filters.category !== 'all') {
        query = query.ilike('category', filters.category);
      }

      if (filters.brand && filters.brand !== 'all') {
        query = query.ilike('brand', filters.brand);
      }

      if (filters.condition && filters.condition !== 'all') {
        query = query.eq('condition', filters.condition);
      }

      if (filters.min_price !== undefined) {
        query = query.gte('price', filters.min_price);
      }

      if (filters.max_price !== undefined) {
        query = query.lte('price', filters.max_price);
      }

      if (filters.has_images) {
        // Filter for products with non-empty images
        // Reliable check for JSONB array: ensure index 0 is not null.
        query = query.not('images->0', 'is', null);
      }

      if (filters.q) {
        const sanitizedQuery = filters.q.slice(0, 100);
        // Search in both name and description to catch specs like "Core i3"
        query = query.or(
          `name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
        );
      }

      // Apply Sort
      switch (filters.sort) {
        case 'price-asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price-desc':
          query = query.order('price', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      if (filters.limit !== undefined) {
        query = query.limit(filters.limit);
      }

      const { data: products, error } = (await query) as {
        data: RawDbProduct[] | null;
        error: Error | null;
      };

      if (error) throw error;

      return (products || []).map(mapStorefrontProduct);
    },
    cacheKeyParts,
    {
      revalidate: 300, // Revalidate every 5 minutes
      tags: ['storefront-products', `merchant-${merchantId}`],
    }
  );
}

// Fetch products by specific IDs (not cached as this is for dynamic recently-viewed)
async function fetchProductsByIds(merchantId: string, ids: string[]) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: products, error } = (await supabase
    .from('products')
    .select(STOREFRONT_PRODUCTS_FULL_SELECT)
    .eq('merchant_id', merchantId)
    .in('id', ids)) as {
    data: RawDbProduct[] | null;
    error: Error | null;
  };

  if (error) throw error;

  return (products || []).map(mapStorefrontProduct);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    // Validate parameters
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      console.error(
        'API Validation Failed:',
        JSON.stringify(parsed.error.flatten(), null, 2)
      );
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      merchant_id: merchantId,
      ids,
      category,
      brand,
      condition,
      compact,
      limit,
      min_price,
      max_price,
      sort,
      q,
    } = parsed.data;

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID is required' },
        { status: 400 }
      );
    }

    // If specific IDs are requested, fetch only those products
    if (ids) {
      const idList = ids.split(',').filter((id) => id.trim());
      if (idList.length === 0) {
        return NextResponse.json({ products: [] });
      }

      // Limit to prevent abuse
      if (idList.length > 50) {
        return NextResponse.json(
          { error: 'Too many IDs requested. Maximum is 50.' },
          { status: 400 }
        );
      }

      const products = await fetchProductsByIds(merchantId, idList);
      return NextResponse.json(
        { products },
        {
          headers: {
            'Cache-Control': 'private, max-age=60',
          },
        }
      );
    }

    // Otherwise, return all active products (cached)
    const filters = {
      category: category || undefined,
      brand: brand || undefined,
      condition: condition || undefined,
      compact: compact || undefined,
      limit,
      min_price,
      max_price,
      sort,
      has_images: parsed.data.has_images,
      q: q || undefined,
    };

    const getCachedProducts = createCachedProductsFetcher(merchantId, filters);
    const mappedProducts = await getCachedProducts();

    return NextResponse.json(
      { products: mappedProducts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // Reduced cache time for search interactions
        },
      }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/storefront/products:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      merchantId: searchParams.get('merchant_id'),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
