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
    stock: p.stock_quantity || 0,
    low_stock_threshold: p.low_stock_threshold,
  };
}

// Factory function that creates a cached function for each merchant
// This ensures each merchant gets their own cache entry
function createCachedProductsFetcher(merchantId: string) {
  return unstable_cache(
    async () => {
      const supabase = createStaticClient(
        getSupabaseUrl(),
        getSupabaseAnonKey()
      );

      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (
            categories (
              slug
            )
          )
        `)
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (products || []).map(mapProduct);
    },
    ['storefront-products', merchantId], // Include merchantId in cache key
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

    // Otherwise, return all active products (cached)
    const getCachedProducts = createCachedProductsFetcher(merchantId);
    const mappedProducts = await getCachedProducts();

    return NextResponse.json(
      { products: mappedProducts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
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
