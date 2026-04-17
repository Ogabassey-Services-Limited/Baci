import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';
import { storefrontProductFilters } from '@/lib/storefront-product-filters';
import { buildStorefrontProductsCacheKeyParts } from '@/lib/storefront-products-cache-key';
import { createClient } from '@/lib/supabase/server';
import { storefrontProductsQuerySchema } from '@/schemas/storefront-products-query';
import type { StorefrontProductsQuery } from '@/schemas/storefront-products-query.types';

/**
 * Map database product to API response format
 * Uses unified normalizeProduct for core fields and extends with API-specific fields
 */
function mapProduct(p: Record<string, unknown>) {
  // Use unified normalization for core fields
  const normalized = normalizeProduct(p as unknown as RawDbProduct);

  // Process images with additional metadata (alt, order) for gallery
  type ImageInput = string | { url?: string; alt?: string; order?: number };
  const rawImages = (p.images as ImageInput[]) || [];
  const processedImages = rawImages.map((img, index) => {
    if (typeof img === 'string') {
      return { url: img, alt: (p.name as string) || '', order: index };
    }
    return {
      url: img.url || '',
      alt: img.alt || (p.name as string) || '',
      order: img.order || index,
    };
  });

  return {
    // Core normalized fields
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    price: normalized.price,
    compare_at_price: normalized.compare_at_price,
    image: normalized.image,
    imageLarge: normalized.imageLarge,
    category: normalized.category,
    category_slug: normalized.category_slug,
    brand: normalized.brand,
    stock: normalized.stock,
    slug: normalized.slug,
    status: normalized.status || 'active',
    condition: normalized.condition,

    // API-specific extended fields
    imageHint: p.image_hint,
    images: processedImages, // With alt/order metadata for gallery
    has_variants: p.has_variants,
    sku: p.sku,
    manage_stock: p.manage_stock,
    low_stock_threshold: p.low_stock_threshold,
    specifications: p.specifications,
    // Condition Offers & Colors
    has_condition_offers:
      typeof p.has_condition_offers === 'boolean'
        ? p.has_condition_offers
        : false,
    available_conditions: Array.isArray(p.available_conditions)
      ? p.available_conditions.filter(
          (condition): condition is string => typeof condition === 'string'
        )
      : [],
    variant_model: p.variant_model,
    offers: p.offers,
    // Map colors from color_images keys if distinct colors column is missing/empty
    colors:
      (p.colors as string[]) ||
      (p.color_images ? Object.keys(p.color_images as object) : []),

    // Variant Attributes for Listing Cards (Phase 4 Extension)
    variant_attributes: p.variant_attributes,
  };
}

function buildCategoryFilterSource(product: Record<string, unknown>) {
  const primaryCategory = Array.isArray(product.categories)
    ? product.categories[0]
    : product.categories;
  const relationCategories = Array.isArray(product.product_categories)
    ? product.product_categories.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || !('categories' in entry)) {
          return [];
        }

        const category = entry.categories;
        return category && typeof category === 'object'
          ? [
              {
                name:
                  typeof category.name === 'string' ? category.name : undefined,
                slug:
                  typeof category.slug === 'string' ? category.slug : undefined,
              },
            ]
          : [];
      })
    : [];
  const normalizedPrimaryCategory =
    primaryCategory && typeof primaryCategory === 'object'
      ? [
          {
            name:
              typeof primaryCategory.name === 'string'
                ? primaryCategory.name
                : undefined,
            slug:
              typeof primaryCategory.slug === 'string'
                ? primaryCategory.slug
                : undefined,
          },
        ]
      : [];

  return {
    category: typeof product.category === 'string' ? product.category : null,
    categories: [...normalizedPrimaryCategory, ...relationCategories],
  };
}

type ProductFilters = StorefrontProductsQuery;

function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

function getConditionPrefilterClauses(condition: string) {
  const normalized = normalizeCanonicalProductCondition(condition);

  if (!normalized) {
    return [];
  }

  const rawConditions =
    normalized === 'open_box'
      ? ['open_box', 'refurbished']
      : normalized === 'used'
        ? ['used', 'uk_used']
        : ['new'];
  const clauses = new Set<string>();

  for (const rawCondition of rawConditions) {
    clauses.add(`condition.eq.${rawCondition}`);
    clauses.add(`available_conditions.cs.{${rawCondition}}`);
  }

  if (normalized === 'new' || normalized === 'used') {
    clauses.add('has_condition_offers.eq.true');
  }

  return Array.from(clauses);
}

const STOREFRONT_PRODUCTS_SELECT = `
  id,
  created_at,
  name,
  description,
  price,
  compare_at_price,
  images,
  image_hint,
  category,
  category_id,
  brand,
  stock,
  stock_quantity,
  slug,
  status,
  condition,
  has_variants,
  sku,
  manage_stock,
  low_stock_threshold,
  specifications,
  has_condition_offers,
  available_conditions,
  variant_model,
  offers,
  colors,
  color_images,
  variant_attributes,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

// Factory function that creates a cached function for each merchant + filters combination
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
        .select(STOREFRONT_PRODUCTS_SELECT)
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      // Category matching needs to stay relation-aware across the legacy text
      // field, primary category join, and many-to-many product_categories join.
      // A SQL prefilter on the legacy text column would drop valid relation
      // matches before the in-memory compatibility matcher sees them.

      if (
        filters.brand &&
        !storefrontProductFilters.isAllFilter(filters.brand)
      ) {
        query = query.ilike(
          'brand',
          `%${escapeLikePattern(filters.brand.trim())}%`
        );
      }

      if (filters.condition && filters.condition !== 'all') {
        const clauses = getConditionPrefilterClauses(filters.condition);
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

      const { data: products, error } = await query;

      if (error) throw error;

      let filteredProducts = products || [];

      if (filters.category && filters.category !== 'all') {
        const category = filters.category;
        filteredProducts = filteredProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontCategoryFilter(
            buildCategoryFilterSource(product),
            category
          )
        );
      }

      let mappedProducts = filteredProducts.map(mapProduct);

      if (
        filters.brand &&
        !storefrontProductFilters.isAllFilter(filters.brand)
      ) {
        const brand = filters.brand;
        mappedProducts = mappedProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontBrandFilter(product, brand)
        );
      }

      if (filters.condition && filters.condition !== 'all') {
        const condition = filters.condition;
        mappedProducts = mappedProducts.filter((product) =>
          storefrontProductFilters.matchesStorefrontConditionFilter(
            product,
            condition
          )
        );
      }

      return mappedProducts;
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
    .select(STOREFRONT_PRODUCTS_SELECT)
    .eq('merchant_id', merchantId)
    .in('id', ids);

  if (error) throw error;

  return (products || []).map(mapProduct);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    // Validate parameters
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
