import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import {
  type NormalizedProduct,
  normalizeProducts,
  type RawDbProduct,
} from '@/lib/normalize-product';

function getPublicSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

interface StorefrontProductIndexOptions {
  page: number;
  limit: number;
}

interface StorefrontProductIndexResult {
  products: NormalizedProduct[];
  totalCount: number;
  totalPages: number;
}

export async function getCachedStorefrontProductIndex(
  merchantId: string,
  options: StorefrontProductIndexOptions
): Promise<StorefrontProductIndexResult> {
  'use cache';
  cacheLife('products');
  cacheTag(
    'products',
    `product-index-${merchantId}`,
    `product-index-${merchantId}-${options.page}-${options.limit}`
  );

  const supabase = getPublicSupabaseClient();
  const offset = (options.page - 1) * options.limit;

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
    .range(offset, offset + options.limit - 1);

  if (error) {
    console.error('Error fetching storefront product index:', error);
    return {
      products: [],
      totalCount: 0,
      totalPages: 0,
    };
  }

  return {
    products: normalizeProducts((data || []) as unknown as RawDbProduct[]),
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / options.limit),
  };
}
