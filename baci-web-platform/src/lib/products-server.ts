import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/lib/products';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';

/**
 * Extract denormalized variant attributes for fast UI rendering
 */
function extractVariantAttributes(variants: Record<string, unknown>[]): {
  colors: string[];
  storage_options: string[];
  available_sizes: string[];
} {
  const colors = new Set<string>();
  const storage = new Set<string>();
  const sizes = new Set<string>();

  for (const v of variants) {
    const attrs = v.attributes as Record<string, string> | undefined;
    if (attrs?.color) colors.add(attrs.color);
    if (attrs?.storage) storage.add(attrs.storage);
    if (attrs?.size) sizes.add(attrs.size);
  }

  return {
    colors: [...colors],
    storage_options: [...storage],
    available_sizes: [...sizes],
  };
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  stock?: string;
}

export interface ProductsResult {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    inventoryValue: number;
    outOfStockCount: number;
    categoryCount: number;
  };
}

export async function getProducts(
  supabase: SupabaseClient,
  merchantId: string,
  params: GetProductsParams
): Promise<ProductsResult> {
  const {
    page = 1,
    limit = 10,
    search: searchRaw = '',
    status = 'All',
    stock = 'All',
  } = params;

  // Sanitize search input
  const search = searchRaw ? sanitizeSearchQuery(searchRaw) : '';
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('products')
    .select('*, variants:product_variants(*)', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (status !== 'All') {
    query = query.eq('status', status);
  }

  if (stock !== 'All') {
    if (stock === 'out_of_stock') {
      query = query.eq('stock_quantity', 0);
    } else if (stock === 'in_stock') {
      query = query.gt('stock_quantity', 0);
    }
  }

  if (search?.trim()) {
    const sanitizedPattern = sanitizeLikePattern(search);
    query = query.or(
      `name.ilike.%${sanitizedPattern}%,sku.ilike.%${sanitizedPattern}%,description.ilike.%${sanitizedPattern}%,brand.ilike.%${sanitizedPattern}%`
    );
  }

  const { data: productsData, error, count } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products');
  }

  // Transform to match UI Product interface
  const transformedProducts: Product[] =
    productsData?.map((p) => {
      // Extract denormalized attributes
      const variantAttrs = p.variants?.length
        ? extractVariantAttributes(p.variants)
        : { colors: [], storage_options: [], available_sizes: [] };

      // Extract rating from schema_markup if available
      const schemaRating = p.schema_markup?.aggregateRating;
      const rating =
        typeof schemaRating?.ratingValue === 'number'
          ? schemaRating.ratingValue
          : undefined;
      const review_count =
        typeof schemaRating?.reviewCount === 'number'
          ? schemaRating.reviewCount
          : undefined;

      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        status: p.status || (p.is_active ? 'active' : 'draft'),
        price: Number.parseFloat(p.price),
        manage_stock: p.manage_stock ?? true,
        stock: p.stock_quantity,
        minimum_order_quantity: p.min_order_quantity,

        // Image handling
        image:
          (typeof p.images?.[0] === 'string'
            ? p.images[0]
            : p.images?.[0]?.url) ||
          p.image_small ||
          'https://picsum.photos/seed/placeholder/80/80',
        imageLarge:
          (typeof p.images?.[0] === 'string'
            ? p.images[0]
            : p.images?.[0]?.url) ||
          p.image_large ||
          'https://picsum.photos/seed/placeholder/600/400',
        imageHint: p.image_hint || '',
        images: p.images || [],

        brand: p.brand || '',
        gtin: p.gtin || '',
        mpn: p.mpn || '',
        google_product_category: p.google_product_category,

        has_variants: p.has_variants || false,
        variants:
          p.variants?.map((v: Record<string, unknown>) => ({
            id: v.id,
            product_id: v.product_id,
            merchant_id: v.merchant_id,
            attributes: v.attributes,
            price_override: v.price_override,
            stock_quantity: v.stock_quantity,
            sku: v.sku,
            primary_image: v.primary_image,
            images: v.images,
          })) || [],
        category: p.category || 'General',
        color: p.color,

        // Denormalized fields for fast UI rendering
        colors:
          variantAttrs.colors.length > 0
            ? variantAttrs.colors
            : p.color
              ? [p.color]
              : undefined,
        storage_options:
          variantAttrs.storage_options.length > 0
            ? variantAttrs.storage_options
            : undefined,
        available_sizes:
          variantAttrs.available_sizes.length > 0
            ? variantAttrs.available_sizes
            : undefined,
        rating,
        review_count,

        // Other fields
        sku: p.sku,
        slug: p.slug,
        compare_at_price: p.compare_at_price
          ? Number.parseFloat(p.compare_at_price)
          : undefined,
        cost_price: p.cost_price ? Number.parseFloat(p.cost_price) : undefined,
        low_stock_threshold: p.low_stock_threshold,

        weight_value: p.weight_value
          ? Number.parseFloat(p.weight_value)
          : undefined,
        weight_unit: p.weight_unit,
        dimensions: p.dimensions,

        taxable: p.taxable,
        tax_code: p.tax_code,

        condition: p.condition,
        condition_detail: p.condition_detail,

        meta_title: p.meta_title,
        meta_description: p.meta_description,
        keywords: p.keywords,
        canonical_url: p.canonical_url,
        schema_markup: p.schema_markup,
      };
    }) || [];

  // OPTIMIZED: Use database RPC instead of fetching all products
  let inventoryValue = 0;
  let outOfStockCount = 0;
  let categoryCount = 0;

  // Define RPC response type
  interface MerchantInventoryStats {
    inventoryValue: number;
    outOfStockCount: number;
    categoryCount: number;
  }

  try {
    const { data: rpcStats, error: rpcError } = await supabase.rpc(
      'get_merchant_inventory_stats',
      { p_merchant_id: merchantId }
    );

    if (!rpcError && rpcStats) {
      const stats = rpcStats as unknown as MerchantInventoryStats;
      inventoryValue = Number(stats.inventoryValue || 0);
      outOfStockCount = Number(stats.outOfStockCount || 0);
      categoryCount = Number(stats.categoryCount || 0);
    }
  } catch (statsErr) {
    console.error('Error fetching inventory stats:', statsErr);
    // Continue with zeros - stats are not critical
  }

  return {
    products: transformedProducts,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
    stats: {
      inventoryValue,
      outOfStockCount,
      categoryCount,
    },
  };
}

export async function getCategories(
  supabase: SupabaseClient,
  merchantId: string
): Promise<{ name: string; count: number }[]> {
  const { data } = await supabase
    .from('products')
    .select('category')
    .eq('merchant_id', merchantId);

  const categoryMap = new Map<string, number>();
  data?.forEach((p) => {
    // Handle potentially null or empty categories
    const cat = p.category;
    if (cat && typeof cat === 'string') {
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }
  });

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count); // Sort by count desc
}
