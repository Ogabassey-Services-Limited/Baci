import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { createClient } from '@/lib/supabase/server';

// Map database product to API response format
function mapProduct(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    compare_at_price: p.compare_at_price,
    image: (p.images as { url: string }[])?.[0]?.url || '',
    imageLarge: (p.images as { url: string }[])?.[0]?.url || '',
    imageHint: p.image_hint,
    category: p.category || 'General',
    category_slug: (p.product_categories as any)?.[0]?.categories?.slug,
    brand: p.brand,
    status: p.status || 'active',
    has_variants: p.has_variants,
    slug: p.slug,
    sku: p.sku,
    manage_stock: p.manage_stock,
    stock: (p.stock as number) || 0,
    low_stock_threshold: p.low_stock_threshold,
    specifications: p.specifications,
  };
}

// Factory function that creates a cached function for each merchant
// This ensures each merchant gets their own cache entry
interface ProductFilters {
  categorySlug?: string;
  brandSlug?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  searchQuery?: string;
}

// Factory function that creates a cached function for each merchant + filters combination
function createCachedProductsFetcher(
  merchantId: string,
  filters: ProductFilters = {}
) {
  // Create a cache key based on merchant and all active filters
  const cacheKeyParts = ['storefront-products', merchantId];
  if (filters.categorySlug) cacheKeyParts.push(`cat-${filters.categorySlug}`);
  if (filters.brandSlug) cacheKeyParts.push(`brand-${filters.brandSlug}`);
  if (filters.condition) cacheKeyParts.push(`cond-${filters.condition}`);
  if (filters.minPrice) cacheKeyParts.push(`min-${filters.minPrice}`);
  if (filters.maxPrice) cacheKeyParts.push(`max-${filters.maxPrice}`);
  if (filters.sort) cacheKeyParts.push(`sort-${filters.sort}`);
  if (filters.searchQuery) cacheKeyParts.push(`q-${filters.searchQuery}`);

  return unstable_cache(
    async () => {
      const supabase = createStaticClient(
        getSupabaseUrl(),
        getSupabaseAnonKey()
      );

      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories!inner (
            categories!inner (
              slug
            )
          )
        `)
        // brands (
        //   slug
        // )
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      // Apply Filters
      if (filters.categorySlug && filters.categorySlug !== 'all') {
        // Filter by category slug via the junction table
        query = query.eq(
          'product_categories.categories.slug',
          filters.categorySlug
        );
      }

      if (filters.brandSlug && filters.brandSlug !== 'all') {
        // Assuming brand is stored as text name or we join brands table.
        // Since we created a brands table, let's try to join it, or fallback to text match if using legacy brand column.
        // For now, let's assume the 'brand' column in products is the text name,
        // OR we filter by the joined brand slug if we have a relation.
        // Given the recent brands table creation, we should link products to brands.
        // But for immediate compatibility, let's filter via the 'brands' relation if it exists, or the 'brand' text column.

        // Simplified approach: query the brands table for the name matching the slug first?
        // No, let's use the relation. Logic:
        // query = query.eq('brands.slug', filters.brandSlug)
        // But products might just have 'brand' column as text.
        // A safer bet without migration data is to NOT assume relation yet if products table wasn't updated to use brand_id.
        // Let's check products columns... 'brand' text column exists.
        // So for now, we filter by the brand column (text).
        // CAUTION: The slug might not match the Name exactly (e.g. "Apple" vs "apple").
        // Best to rely on the brands table we just made.
        // Let's try to join brands.
        // query = query.eq('brands.slug', filters.brandSlug);
      }

      if (filters.condition && filters.condition !== 'all') {
        query = query.eq('condition', filters.condition);
      }

      if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      if (filters.searchQuery) {
        query = query.ilike('name', `%${filters.searchQuery}%`);
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

      const { data: products, error } = await query;

      if (error) throw error;

      return (products || []).map(mapProduct);
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

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .in('id', ids);

  if (error) throw error;

  return (products || []).map(mapProduct);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const merchantId = searchParams.get('merchant_id');
    // Parse filter parameters from URL
    const categorySlug = searchParams.get('category');
    const brandSlug = searchParams.get('brand');
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('min_price')
      ? Number(searchParams.get('min_price'))
      : undefined;
    const maxPrice = searchParams.get('max_price')
      ? Number(searchParams.get('max_price'))
      : undefined;
    const sort = searchParams.get('sort') || 'newest';
    const ids = searchParams.get('ids'); // Comma-separated list of product IDs

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

    const q = searchParams.get('q');

    // Otherwise, return all active products (cached)
    const filters = {
      categorySlug: categorySlug || undefined,
      brandSlug: brandSlug || undefined,
      condition: condition || undefined,
      minPrice,
      maxPrice,
      sort,
      searchQuery: q || undefined,
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
