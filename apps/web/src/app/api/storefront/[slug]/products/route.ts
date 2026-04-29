import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { STOREFRONT_CACHE } from '@/config/storefront-cache';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { PRODUCT_COLUMNS } from '@/lib/product-queries';
import {
  coerceStorefrontManageStock,
  getStorefrontAgentAvailability,
} from '@/lib/storefront-agent-availability';
import { storefrontProductsQuerySchema } from '@/schemas/storefront-products-query';
import { storefrontProductsRouteParamsSchema } from '@/schemas/storefront-products-route-params';

const storefrontProductsQueryParamKeys =
  storefrontProductsQuerySchema.keyof().options;

// Extract primary image URL from mixed format (string[] or {url}[])
function extractPrimaryImage(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object' && 'url' in first)
    return (first as { url: string }).url || '';
  return '';
}

function getStorefrontProductsQueryParams(searchParams: URLSearchParams) {
  return Object.fromEntries(
    storefrontProductsQueryParamKeys.map((key) => [
      key,
      searchParams.get(key) ?? undefined,
    ])
  );
}

// Map database product to API response format function
function mapProduct(p: Record<string, unknown>) {
  const primaryImage = extractPrimaryImage(p.images);
  const manageStock = coerceStorefrontManageStock(
    p.manage_stock as boolean | null | undefined
  );
  const agentAvailability = getStorefrontAgentAvailability({
    manage_stock: manageStock,
    stock: p.stock as number | string | null | undefined,
    stock_quantity: p.stock_quantity as number | string | null | undefined,
    low_stock_threshold: p.low_stock_threshold as
      | number
      | string
      | null
      | undefined,
  });

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    compare_at_price: p.compare_at_price,
    image: primaryImage,
    imageLarge: primaryImage,
    imageHint: p.image_hint,
    category: p.category || 'General',
    brand: p.brand,
    status: p.status || 'active',
    has_variants: p.has_variants,
    slug: p.slug,
    sku: p.sku,
    manage_stock: manageStock,
    availability: agentAvailability.availability,
    inventory_policy: agentAvailability.inventory_policy,
    is_purchasable: agentAvailability.is_purchasable,
    quantity_available: agentAvailability.quantity_available,
    stock: agentAvailability.stock,
    low_stock_threshold: p.low_stock_threshold,
    color: p.color || '',
    condition: p.condition || 'new',
  };
}

// Cached function to get merchant ID from slug
const getMerchantIdBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createStaticClient(getSupabaseUrl(), getSupabaseAnonKey());

    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error) {
      return null;
    }
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
    const parsedParams = storefrontProductsRouteParamsSchema.safeParse(
      await params
    );

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          code: 'INVALID_PARAMS',
          details: parsedParams.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { slug } = parsedParams.data;
    const parsedQuery = storefrontProductsQuerySchema.safeParse(
      getStorefrontProductsQueryParams(request.nextUrl.searchParams)
    );

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY',
          details: parsedQuery.error.flatten(),
        },
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
    let productQuery = supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (parsedQuery.data.limit !== undefined) {
      productQuery = productQuery.limit(parsedQuery.data.limit);
    }

    const { data: products, error } = await productQuery;

    if (error) {
      console.error(
        '[API] Product fetch error for merchant:',
        merchantId,
        error
      );
      throw error;
    }

    const mappedProducts = (products || []).map(mapProduct);

    return NextResponse.json(
      { products: mappedProducts },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${STOREFRONT_CACHE.productsSMaxAge}, stale-while-revalidate=${STOREFRONT_CACHE.productsStaleWhileRevalidate}`,
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
