import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

// Map database product to API response format function
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
    brand: p.brand,
    status: p.status || 'active',
    has_variants: p.has_variants,
    slug: p.slug,
    sku: p.sku,
    manage_stock: p.manage_stock,
    stock: p.stock_quantity || 0,
    low_stock_threshold: p.low_stock_threshold,
    colors: p.colors || [],
    storage_options: p.storage_options || [],
    condition: p.condition || 'new',
    rating: p.rating || 5,
  };
}

// Cached function to get merchant ID from slug
const getMerchantIdBySlug = unstable_cache(
  async (slug: string) => {
    console.log(`[API] Looking up merchant ID for slug: ${slug}`);
    const supabase = createStaticClient(getSupabaseUrl(), getSupabaseAnonKey());

    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error(`[API] Merchant lookup error for slug ${slug}:`, error);
      return null;
    }
    console.log(`[API] Found merchant ID: ${data?.id}`);
    return data?.id;
  },
  ['merchant-slug-id-lookup'], // Changed key to force cache invalidation
  { revalidate: 60, tags: ['merchant-slug'] }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Store slug is required' },
        { status: 400 }
      );
    }

    // 1. Resolve slug to merchant_id
    const merchantId = await getMerchantIdBySlug(slug);

    if (!merchantId) {
      return NextResponse.json(
        { error: `Store not found for slug: ${slug}` },
        { status: 404 }
      );
    }

    // 2. Fetch products for this merchant
    // We use a fresh client here to ensure we get latest data if cache is stale
    const supabase = createStaticClient(getSupabaseUrl(), getSupabaseAnonKey());

    console.log(`[API] Fetching products for merchant: ${merchantId}`);
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        `[API] Product fetch error for merchant ${merchantId}:`,
        error
      );
      throw error;
    }

    console.log(`[API] Found ${products?.length || 0} products`);

    const mappedProducts = (products || []).map(mapProduct);

    return NextResponse.json(
      { products: mappedProducts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30', // Low cache for debugging
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/storefront/[slug]/products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
