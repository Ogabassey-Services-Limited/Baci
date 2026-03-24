import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';

/**
 * Cached data fetcher for OpenAI product feed.
 * Uses `'use cache'` with the `products` cache profile.
 *
 * Must use `createAnonClient()` (stateless, no request-scoped state)
 * because `'use cache'` functions must not capture request context.
 */
export async function getCachedOpenAIFeedData(merchantId: string) {
  'use cache';
  cacheLife('products');
  cacheTag('openai-product-feed', 'products', `merchant-feed-${merchantId}`);

  const supabase = createAnonClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      `id, name, description, slug, price, compare_at_price, images,
       brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition, google_product_category, category,
       weight_value, weight_unit, updated_at,
       variants:product_variants(id, attributes, price_override, stock_quantity, sku, primary_image)`
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (productsError) {
    console.error('DB_PRODUCTS_ERROR:', productsError);
    throw new Error('Failed to fetch products');
  }

  return { products: products || [] };
}
