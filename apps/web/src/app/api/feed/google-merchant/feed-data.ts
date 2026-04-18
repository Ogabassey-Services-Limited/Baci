import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/lib/supabase/anon';
import type {
  FeedOffer,
  FeedProduct,
  FeedVariant,
  ImageManifestMap,
} from './feed-builder';
import { FEED_PRODUCTS_SELECT } from './feed-query';

export interface GoogleMerchantFeedData {
  custom_domain: string | null;
  slug: string;
  products: FeedProduct[];
  imageManifest: ImageManifestMap;
}

interface RawFeedProductRow extends Omit<FeedProduct, 'categories'> {
  categories?:
    | { name?: string; slug?: string }
    | Array<{ name?: string; slug?: string }>
    | null;
  product_categories?: Array<{
    categories?: { name?: string; slug?: string } | null;
  }>;
}

function getJoinedCategory(
  product: RawFeedProductRow
): { name?: string; slug?: string } | null {
  if (Array.isArray(product.categories)) {
    return product.categories[0] ?? null;
  }

  if (product.categories) {
    return product.categories;
  }

  return product.product_categories?.[0]?.categories ?? null;
}

function normalizeFeedProducts(products: RawFeedProductRow[]): FeedProduct[] {
  return products.map((product) => {
    const { product_categories: _productCategories, ...rest } = product;
    const joinedCategory = getJoinedCategory(product);

    return {
      ...rest,
      categories: joinedCategory ?? null,
      category_slug: rest.category_slug || joinedCategory?.slug,
      category: rest.category || joinedCategory?.name,
    };
  });
}

interface FeedVariantRow {
  attributes: Record<string, string> | null;
  condition?: FeedVariant['condition'];
  id: string;
  price_override?: number | string | null;
  product_id: string;
  sku?: string | null;
  stock_quantity?: number | null;
}

function normalizeFeedVariantPrice(
  value: number | string | null | undefined
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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
  const feedProducts: FeedProduct[] = normalizeFeedProducts(
    (products || []) as RawFeedProductRow[]
  ).map((product) => ({
    ...product,
    variants: [] as FeedVariant[],
  }));
  const productIds = feedProducts.map((p) => p.id);
  const activeProductIds = new Set(productIds);

  if (productIds.length === 0) {
    return {
      custom_domain: primaryDomain?.domain ?? null,
      slug: merchantSlug,
      products: [],
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

  const { data: variantRows, error: variantsError } = await supabase.rpc(
    'get_feed_product_variants',
    {
      p_merchant_id: merchantId,
      p_product_ids: productIds,
    }
  );

  if (variantsError) {
    console.error('DB_VARIANTS_ERROR:', variantsError);
    throw new Error('Failed to fetch product variants');
  }

  if (variantRows && variantRows.length > 0) {
    const variantsByProduct = new Map<string, FeedVariant[]>();

    for (const row of variantRows as FeedVariantRow[]) {
      const productVariants = variantsByProduct.get(row.product_id) ?? [];
      productVariants.push({
        id: row.id,
        attributes: row.attributes,
        condition: row.condition,
        price_override: normalizeFeedVariantPrice(row.price_override),
        sku: row.sku ?? null,
        stock_quantity: row.stock_quantity ?? null,
      });
      variantsByProduct.set(row.product_id, productVariants);
    }

    for (const product of feedProducts) {
      product.variants = variantsByProduct.get(product.id) ?? [];
    }
  }

  // Fetch condition offers for legacy products that still use them
  const productsWithOffers = feedProducts.filter(
    (p) => p.variant_model !== 'sku_matrix' && p.has_condition_offers
  );

  if (productsWithOffers.length > 0) {
    const offerProductIds = productsWithOffers.map((p) => p.id);
    const { data: offerRows, error: offersError } = await supabase
      .from('product_offers')
      .select('id, product_id, condition, price, stock_quantity')
      .in('product_id', offerProductIds)
      .eq('status', 'active');

    if (offersError) {
      console.error('DB_OFFERS_ERROR:', offersError);
      throw new Error('Failed to fetch product offers');
    }

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
