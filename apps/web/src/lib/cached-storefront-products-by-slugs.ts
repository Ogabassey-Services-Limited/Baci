import { cacheLife, cacheTag } from 'next/cache';
import {
  getPublicSupabaseClient,
  hydrateAndSanitizeProducts,
} from '@/lib/cached-data';

/**
 * Same column list as `getCachedStorefrontHomeProducts`'s base select, so rows
 * are shape-compatible with `mapHomeProductsToTemplateProducts`.
 */
const PRODUCTS_BY_SLUG_SELECT = `
      id, name, slug, description, price, compare_at_price,
      images, category, brand, condition, stock, stock_quantity,
      manage_stock, low_stock_threshold,
      product_categories(categories(name, slug))
    `;

/**
 * Deterministically fetch specific active products by slug for the current
 * merchant, regardless of any recency/handset candidate window.
 *
 * The home "recent" feed is capped (top-50 mixed window), so explicitly-pinned
 * launch devices can fall outside it. This targeted `.in('slug', …)` query
 * guarantees they're available to merge into the launch carousel before
 * selection and JSON-LD slicing. Cached + tagged like the other home product
 * queries so `revalidateProducts()` busts it too.
 */
export async function getCachedStorefrontProductsBySlugs(
  merchantId: string,
  slugs: readonly string[]
) {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'products',
    `products-${merchantId}`,
    `products-by-slugs-${merchantId}`
  );

  if (slugs.length === 0) {
    return [];
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCTS_BY_SLUG_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('slug', slugs as string[]);

  if (error) {
    console.error('Failed to load storefront products by slug', {
      merchantId,
      error,
    });
    throw error;
  }

  return hydrateAndSanitizeProducts(supabase, merchantId, data ?? []);
}
