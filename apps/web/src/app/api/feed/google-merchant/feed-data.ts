import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';
import type { FeedOffer, FeedProduct, ImageManifestMap } from './feed-builder';
import { FEED_PRODUCTS_SELECT } from './feed-query';

export interface GoogleMerchantFeedData {
  custom_domain: string | null;
  slug: string;
  products: FeedProduct[];
  imageManifest: ImageManifestMap;
}

/**
 * Cached data fetcher for Google Merchant feed.
 * Uses `'use cache'` with the `products` cache profile.
 *
 * Must use `createAnonClient()` (stateless, no request-scoped state)
 * because `'use cache'` functions must not capture request context.
 */
export async function getCachedGoogleMerchantFeedData(
  merchantId: string,
  merchantSlug: string
): Promise<GoogleMerchantFeedData> {
  'use cache';
  cacheLife('products');
  cacheTag('google-merchant-feed', 'products', `merchant-feed-${merchantId}`);

  const supabase = createAnonClient();

  const { data: primaryDomain, error: domainError } = await supabase
    .from('domains')
    .select('domain')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .eq('is_primary', true)
    .maybeSingle();

  if (domainError) {
    console.error('DB_DOMAIN_ERROR:', domainError);
    throw new Error('Failed to fetch merchant domain');
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(FEED_PRODUCTS_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (productsError) {
    console.error('DB_PRODUCTS_ERROR:', productsError);
    throw new Error('Failed to fetch products');
  }

  // Fetch prevalidated image manifest once per merchant and keep only active
  // product entries in memory. This avoids oversized PostgREST `in(...)`
  // filters for larger catalogs while preserving active-product scoping.
  const productIds = (products || []).map((p: { id: string }) => p.id);
  const activeProductIds = new Set(productIds);

  if (productIds.length === 0) {
    return {
      custom_domain: primaryDomain?.domain ?? null,
      slug: merchantSlug,
      products: [] as FeedProduct[],
      imageManifest: {} as ImageManifestMap,
    };
  }

  const { data: manifestRows, error: manifestError } = await supabase
    .from('product_feed_images')
    .select(
      'product_id, verified_url, verified_format, status, is_primary, position'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'verified');

  if (manifestError) {
    console.error('DB_MANIFEST_ERROR:', manifestError);
    throw new Error('Failed to fetch image manifest');
  }

  // Group manifest rows by product_id
  type ManifestRow = {
    product_id: string;
    verified_url: string | null;
    verified_format: string | null;
    status: string;
    is_primary: boolean;
    position: number;
  };

  const imageManifest: ImageManifestMap = {};
  for (const row of (manifestRows || []) as ManifestRow[]) {
    if (!activeProductIds.has(row.product_id)) {
      continue;
    }

    if (!imageManifest[row.product_id]) {
      imageManifest[row.product_id] = [];
    }
    imageManifest[row.product_id].push({
      verified_url: row.verified_url,
      verified_format: row.verified_format,
      status: 'verified' as const,
      is_primary: row.is_primary,
      position: row.position,
    });
  }

  // Fetch condition offers for products that have them
  const feedProducts = (products || []) as FeedProduct[];
  const productsWithOffers = feedProducts.filter((p) => p.has_condition_offers);

  if (productsWithOffers.length > 0) {
    const offerProductIds = productsWithOffers.map((p) => p.id);
    const { data: offerRows } = await supabase
      .from('product_offers')
      .select('id, product_id, condition, price, stock_quantity')
      .in('product_id', offerProductIds)
      .eq('status', 'active');

    if (offerRows && offerRows.length > 0) {
      const offersByProduct = new Map<string, FeedOffer[]>();
      for (const row of offerRows) {
        const pid = row.product_id as string;
        if (!offersByProduct.has(pid)) {
          offersByProduct.set(pid, []);
        }
        offersByProduct.get(pid)?.push({
          id: row.id as string,
          condition: row.condition as FeedOffer['condition'],
          price: Number(row.price),
          stock_quantity: row.stock_quantity as number,
        });
      }
      for (const product of feedProducts) {
        product.offers = offersByProduct.get(product.id);
      }
    }
  }

  return {
    custom_domain: primaryDomain?.domain ?? null,
    slug: merchantSlug,
    products: feedProducts,
    imageManifest,
  };
}
