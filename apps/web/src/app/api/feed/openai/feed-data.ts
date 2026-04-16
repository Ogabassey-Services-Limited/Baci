import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

export interface OpenAIFeedVariant {
  id: string;
  attributes: Record<string, string>;
  price_override?: number;
  stock_quantity?: number;
  sku?: string;
  primary_image?: string;
}

export interface OpenAIFeedProduct {
  id: string;
  name: string;
  description: string;
  slug?: string;
  price: number;
  compare_at_price?: number;
  images?: string[] | Array<{ url: string; alt?: string }>;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean;
  condition?: 'new' | 'used' | 'refurbished';
  google_product_category?: string;
  category?: string;
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  updated_at?: string;
  variants?: OpenAIFeedVariant[];
}

export interface OpenAIFeedData {
  products: OpenAIFeedProduct[];
}

/**
 * Cached data fetcher for OpenAI product feed.
 * Uses `'use cache'` with the `products` cache profile.
 *
 * Must use `createAnonClient()` (stateless, no request-scoped state)
 * because `'use cache'` functions must not capture request context.
 */
export async function getCachedOpenAIFeedData(
  merchantId: string
): Promise<OpenAIFeedData> {
  'use cache: remote';
  cacheLife('products');
  cacheTag('openai-product-feed', 'products', `merchant-feed-${merchantId}`);

  const supabase = createAnonClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      `id, name, description, slug, price, compare_at_price, images,
       brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition, google_product_category, category,
       weight_value, weight_unit, updated_at,
       variants:product_variants!product_variants_product_id_fkey(id, attributes, price_override, stock_quantity, sku, primary_image)`
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (productsError) {
    console.error('DB_PRODUCTS_ERROR:', productsError);
    throw new Error('Failed to fetch products');
  }

  return { products: (products || []) as OpenAIFeedProduct[] };
}
