import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { storefrontProductFilters } from '@/lib/storefront-product-filters';
import { buildStorefrontProductsCacheKeyParts } from '@/lib/storefront-products-cache-key';
import { createClient } from '@/lib/supabase/server';
import { storefrontProductsQuerySchema } from '@/schemas/storefront-products-query';
import type { StorefrontProductsQuery } from '@/schemas/storefront-products-query.types';
import { storefrontProductsRouteData } from './storefront-products-route-data';

type ProductFilters = StorefrontProductsQuery;

function createCachedProductsFetcher(
  merchantId: string,
  filters: ProductFilters = { sort: 'newest' }
) {
  const cacheKeyParts = buildStorefrontProductsCacheKeyParts(
    merchantId,
    filters
  );

  return unstable_cache(
    async () => {
      const supabase = createStaticClient(
        getSupabaseUrl(),
        getSupabaseAnonKey()
      );

      let query = supabase
        .from('products')
        .select(storefrontProductsRouteData.STOREFRONT_PRODUCTS_SELECT)
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      if (
        filters.condition &&
        !storefrontProductFilters.isAllFilter(filters.condition)
      ) {
        const clauses =
          storefrontProductsRouteData.getConditionPrefilterClauses(
            filters.condition
          );
        if (clauses.length > 0) {
          query = query.or(clauses.join(','));
        }
      }

      if (filters.min_price !== undefined) {
        query = query.gte('price', filters.min_price);
      }

      if (filters.max_price !== undefined) {
        query = query.lte('price', filters.max_price);
      }

      if (filters.has_images) {
        query = query.not('images->0', 'is', null);
      }

      if (filters.q) {
        const sanitizedQuery = filters.q.slice(0, 100);
        query = query.or(
          `name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
        );
      }

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

      let filteredProducts = products || [];

      if (
        filters.category &&
        !storefrontProductFilters.isAllFilter(filters.category)
      ) {
        const category = filters.category;
        filteredProducts = filteredProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontCategoryFilter(
            storefrontProductsRouteData.buildCategoryFilterSource(product),
            category
          )
        );
      }

      if (
        filters.brand &&
        !storefrontProductFilters.isAllFilter(filters.brand)
      ) {
        const brand = filters.brand;
        filteredProducts = filteredProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontBrandFilter(product, brand)
        );
      }

      if (
        filters.condition &&
        !storefrontProductFilters.isAllFilter(filters.condition)
      ) {
        const condition = filters.condition;
        filteredProducts = filteredProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontConditionFilter(
            product,
            condition
          )
        );
      }

      return filteredProducts.map(storefrontProductsRouteData.mapProduct);
    },
    cacheKeyParts,
    {
      revalidate: 300,
      tags: ['storefront-products', `merchant-${merchantId}`],
    }
  );
}

async function fetchProductsByIds(merchantId: string, ids: string[]) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: products, error } = await supabase
    .from('products')
    .select(storefrontProductsRouteData.STOREFRONT_PRODUCTS_SELECT)
    .eq('merchant_id', merchantId)
    .in('id', ids);

  if (error) throw error;

  return (products || []).map(storefrontProductsRouteData.mapProduct);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const parsed = storefrontProductsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

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

    if (ids) {
      const idList = ids.split(',').filter((id) => id.trim());
      if (idList.length === 0) {
        return NextResponse.json({ products: [] });
      }

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

    const filters = {
      category: category || undefined,
      brand: brand || undefined,
      condition: condition || undefined,
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
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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
