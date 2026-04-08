import { cacheLife, cacheTag } from 'next/cache';
import {
  type NormalizedProduct,
  normalizeProducts,
  type RawDbProduct,
} from '@/lib/normalize-product';
import { createPublicClient } from '@/lib/supabase/public';

interface StorefrontProductIndexOptions {
  page: number;
  limit: number;
}

interface StorefrontProductIndexResult {
  hasError: boolean;
  errorMessage?: string | null;
  products: NormalizedProduct[];
  totalCount: number;
  totalPages: number;
}

export async function getCachedStorefrontProductIndex(
  merchantId: string,
  options: StorefrontProductIndexOptions
): Promise<StorefrontProductIndexResult> {
  'use cache: remote';

  const page = Number.isInteger(options.page) ? options.page : Number.NaN;
  const limit = Number.isInteger(options.limit) ? options.limit : Number.NaN;
  if (!Number.isFinite(page) || page <= 0) {
    throw new Error('Storefront product index page must be a positive integer');
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(
      'Storefront product index limit must be a positive integer'
    );
  }
  cacheLife('products');
  cacheTag(
    'products',
    `product-index-${merchantId}`,
    `product-index-${merchantId}-${page}-${limit}`
  );

  const supabase = createPublicClient({
    clientInfo: 'baci-storefront-product-index',
  });
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('products')
    .select(
      `
        id,
        merchant_id,
        name,
        slug,
        description,
        price,
        compare_at_price,
        images,
        category,
        brand,
        condition,
        stock,
        stock_quantity,
        status,
        has_condition_offers,
        product_categories(
          categories(name, slug)
        )
      `,
      { count: 'exact' }
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .or('is_parent.eq.true,parent_product_id.is.null')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching storefront product index:', error);
    return {
      errorMessage: error.message,
      hasError: true,
      products: [],
      totalCount: 0,
      totalPages: 0,
    };
  }

  return {
    errorMessage: null,
    hasError: false,
    products: normalizeProducts((data || []) as unknown as RawDbProduct[]),
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  };
}
