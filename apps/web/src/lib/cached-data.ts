import type { RegisteredAddress } from '@baci/shared';
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from '@/env';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { merchantFeatureSettingsDefaults } from '@/lib/merchant-feature-settings-defaults';
import { waitForMerchantLookupRetryBackoff } from '@/lib/merchant-lookup-backoff';
import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';
import { getProductScopedCacheTag } from '@/lib/product-cache-tags';
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';
import {
  filterPublicBlogCategories,
  filterPublicBlogPosts,
  isPublicBlogPost,
} from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import {
  normalizeRelatedBlogProductLinks,
  normalizeRelatedBlogProducts,
  RELATED_BLOG_PRODUCT_LINKS_SELECT,
  RELATED_BLOG_PRODUCTS_SELECT,
} from '@/lib/related-blog-products';
import { selectSemanticRelatedBlogPosts } from '@/lib/semantic-related-blog-posts';
import { generateSlug } from '@/lib/seo-utils';
import { normalizeOgabasseyBusinessType } from '@/lib/storefront/ogabassey-entity';
import { STOREFRONT_BLOG_POST_SELECT } from '@/lib/storefront-blog-post-select';
import { canonicalizeStorefrontMediaUrl } from '@/lib/storefront-media-cdn-url';
import { createTimeoutComposedFetch } from '@/lib/supabase/compose-fetch-signal';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import type { MerchantAboutPage } from '@/types/about-page';
import type { MerchantTrustProfileDraft } from '../../../../packages/shared/src/contracts/merchant-trust-profile';
import { sanitizePublicProduct } from './public-fulfillment-sanitizer';
import {
  getPublicSerializedVariantSummariesByProductId,
  type PublicSerializedVariantSummary,
} from './public-serialized-variant-summary';

// Supabase/PostgREST `estimated` keeps small public blog counts exact while
// avoiding full COUNT scans when stale route regeneration hits large merchant
// blog catalogs. These pages tolerate planner-estimated pagination for large
// result sets better than production 500s from exact COUNT pressure.
const PUBLIC_BLOG_COUNT_OPTIONS = { count: 'estimated' as const };

const RELATED_BLOG_POSTS_LIMIT = 3;
const RELATED_BLOG_POSTS_FETCH_LIMIT = 36;
const RELATED_BLOG_CATEGORY_FETCH_LIMIT = 24;

/**
 * Stock quantity shown to storefront when a variant using
 * `serialized_then_unlimited` has depleted serialized units but remains
 * purchasable as unlimited stock.
 */
const SERIALIZED_THEN_UNLIMITED_STOCK_QUANTITY = 9999;

type PublicVariantRecord = { id: string; [key: string]: unknown };

function hydratePublicSerializedVariants(
  variants: PublicVariantRecord[],
  productSummaries: PublicSerializedVariantSummary[]
): PublicVariantRecord[] {
  const summariesByVariantId = new Map(
    productSummaries
      .filter((summary) => summary.variantId !== null)
      .map((summary) => [summary.variantId, summary])
  );

  return variants.map((variant) => {
    const variantSummary = summariesByVariantId.get(variant.id);
    if (!variantSummary) {
      return variant;
    }

    const updatedVariant = { ...variant };
    updatedVariant.inventory_tracking_policy =
      variantSummary.inventoryTrackingPolicy;
    updatedVariant.stock_quantity = variantSummary.publicAvailableUnits;

    if (
      variantSummary.inventoryTrackingPolicy === 'serialized_then_unlimited' &&
      variantSummary.publicAvailableUnits === 0
    ) {
      updatedVariant.stock_quantity = SERIALIZED_THEN_UNLIMITED_STOCK_QUANTITY;
    }

    return updatedVariant;
  });
}
const RELATED_BLOG_POST_SELECT =
  'id, title, slug, excerpt, featured_image_url, category, tags, keywords, published_at, reading_time_minutes';

function getEstimatedPaginationCountFloor({
  count,
  itemCount,
  limit,
  page,
}: {
  count: number | null | undefined;
  itemCount: number;
  limit: number;
  page: number;
}): number {
  const countValue = count ?? 0;
  const currentPageFloor = itemCount > 0 ? (page - 1) * limit + itemCount : 0;

  return Math.max(countValue, currentPageFloor);
}
const MERCHANT_PUBLIC_SELECT = `
        id,
        business_name,
        site_title,
        site_tagline,
        site_description,
        business_type,
        logo_url,
        phone,
        email,
        support_email,
        support_phone,
        social_media,
        brand_colors,
        slug,
        business_address,
        legal_entity_name,
        registered_address,
        tax_identification_number,
        trust_profile,
        payout_currency,
        paystack_subaccount_code,
        is_published,
        template_id,
        plan_expires_at,
        plan_tier,
        premium_features,
        country,
        hero_slides,
        mobile_hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url,
        vat_registration_status,
        vat_rate,
        published_config,
        pages,
        about_page,
        faq_items,
        updated_at
      `;

interface RelatedBlogPostIdentity {
  id?: string | null;
  slug?: string | null;
}

function combineUniqueRelatedBlogPosts<T extends RelatedBlogPostIdentity>(
  ...postGroups: Array<T[] | null | undefined>
): T[] {
  const seenKeys = new Set<string>();
  const uniquePosts: T[] = [];

  for (const postGroup of postGroups) {
    for (const post of postGroup || []) {
      const key = post.id || post.slug;
      if (key && seenKeys.has(key)) {
        continue;
      }

      if (key) {
        seenKeys.add(key);
      }
      uniquePosts.push(post);
    }
  }

  return uniquePosts;
}

/** Default transport bound for cached-data Supabase clients. */
const CACHED_CLIENT_DEFAULT_TIMEOUT_MS = 10_000;
/**
 * Merchant shell lookups run on EVERY storefront request (layout + page) and
 * the queries execute in ~20ms server-side — the observed failures are
 * client-transport tail events (cold TLS, event-loop contention). A tight
 * bound lets retry + direct fallback complete in a few seconds instead of
 * stacking multiple 10s aborts on the hot path.
 */
const MERCHANT_LOOKUP_TIMEOUT_MS = 3_000;
/** The uncached direct-fallback path gets a little more headroom. */
const MERCHANT_DIRECT_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * Create a Supabase client for cached queries.
 * This client doesn't use cookies, so it's suitable for caching.
 * Only use for public/read-only data that doesn't require authentication.
 */
export function getPublicSupabaseClient(options?: { timeoutMs?: number }) {
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
    global: {
      headers: {
        'X-Client-Info': 'baci-web-cached',
      },
      fetch: createTimeoutComposedFetch(
        options?.timeoutMs ?? CACHED_CLIENT_DEFAULT_TIMEOUT_MS
      ),
    },
  });
}

/**
 * Create a Supabase client with Service Role for privileged cached queries.
 * Bypasses RLS to ensure we can fetch unpublished merchants for "Coming Soon" pages.
 */
function getServiceRoleSupabaseClient(options?: { timeoutMs?: number }) {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'baci-web-cached-service',
      },
      fetch: createTimeoutComposedFetch(
        options?.timeoutMs ?? CACHED_CLIENT_DEFAULT_TIMEOUT_MS
      ),
    },
  });
}

/**
 * Hydrates product list with public serialized variant summaries and sanitizes them.
 */
export async function hydrateAndSanitizeProducts<T extends { id: string }>(
  supabase: SupabaseClient,
  merchantId: string,
  products: T[]
): Promise<T[]> {
  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  let summaries: PublicSerializedVariantSummary[] = [];
  try {
    summaries = await getPublicSerializedVariantSummariesByProductId(
      supabase,
      merchantId,
      productIds
    );
  } catch (err) {
    console.error('Error fetching serialized variant summaries:', err);
    return products.map(sanitizePublicProduct);
  }

  const summariesByProduct = new Map<
    string,
    PublicSerializedVariantSummary[]
  >();
  for (const s of summaries) {
    const list = summariesByProduct.get(s.productId) || [];
    list.push(s);
    summariesByProduct.set(s.productId, list);
  }

  const hydrated = products.map((product) => {
    const productSummaries = summariesByProduct.get(product.id) || [];
    if (productSummaries.length === 0) {
      return product;
    }

    const updatedProduct = { ...product } as Record<string, unknown>;
    const productSummary = productSummaries.find((s) => s.variantId === null);

    if (productSummary) {
      const resolvedUnits =
        productSummary.inventoryTrackingPolicy ===
          'serialized_then_unlimited' &&
        productSummary.publicAvailableUnits === 0
          ? SERIALIZED_THEN_UNLIMITED_STOCK_QUANTITY
          : productSummary.publicAvailableUnits;

      updatedProduct.inventory_tracking_policy =
        productSummary.inventoryTrackingPolicy;
      updatedProduct.quantity = resolvedUnits;
      updatedProduct.stock_quantity = resolvedUnits;
      updatedProduct.stock = resolvedUnits;

      if (productSummary.inventoryTrackingPolicy === 'serialized_strict') {
        updatedProduct.track_quantity = true;
        updatedProduct.manage_stock = true;
      } else if (
        productSummary.inventoryTrackingPolicy === 'serialized_then_unlimited'
      ) {
        updatedProduct.track_quantity = false;
        updatedProduct.manage_stock = false;
      }
    }

    if (
      updatedProduct.product_variants &&
      Array.isArray(updatedProduct.product_variants)
    ) {
      updatedProduct.product_variants = hydratePublicSerializedVariants(
        updatedProduct.product_variants as PublicVariantRecord[],
        productSummaries
      );
    }

    if (updatedProduct.variants && Array.isArray(updatedProduct.variants)) {
      updatedProduct.variants = hydratePublicSerializedVariants(
        updatedProduct.variants as PublicVariantRecord[],
        productSummaries
      );
    }

    return updatedProduct as unknown as T;
  });

  return hydrated.map(sanitizePublicProduct);
}

interface PublicStorefrontProductVariant {
  attributes: Record<string, string> | null;
  condition?: string | null;
  created_at?: string | null;
  id: string;
  images?: unknown;
  price_override?: number | string | null;
  primary_image?: string | null;
  product_id: string;
  sku?: string | null;
  stock_quantity?: number | null;
  updated_at?: string | null;
}

interface StorefrontCategoryParentRow {
  name: string | null;
  slug: string | null;
}

interface StorefrontCategoryRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean | null;
  seo_heading: string | null;
  seo_description: string | null;
  seo_features: string[] | null;
  seo_faq: { answer: string; question: string }[] | null;
  parent: StorefrontCategoryParentRow | null;
}

interface StorefrontCategorySlugState {
  is_active: boolean | null;
}

interface LegacyPriceCompatibleProduct {
  price?: number | string | null;
  compare_at_price?: number | string | null;
  sale_price?: number | null;
  base_price?: number | null;
}

interface CachedCategoryFaqItem {
  question: string;
  answer: string;
}

interface CachedCategorySeo {
  description: string;
  faqs: CachedCategoryFaqItem[];
  features: string[];
  heading: string;
}

interface CachedCategoryRecord {
  description: string | null;
  id: string;
  image_url: string | null;
  is_active: boolean;
  name: string;
  parent:
    | { name: string; slug: string }
    | Array<{ name: string; slug: string }>
    | null;
  parent_id?: string | null;
  seo_description: string | null;
  seo_faq: CachedCategoryFaqItem[] | null;
  seo_features: string[] | null;
  seo_heading: string | null;
  slug: string;
}

export type CachedCategoryPageData =
  | {
      category?: null;
      description: string;
      fallbackDescription?: string;
      fallbackName?: string;
      isCollection: true;
      isInactiveCategory?: false;
      name: string;
      productIdsQueryFailed?: boolean;
      productCount?: number;
      productsArePrePaginated?: boolean;
      products: unknown[];
      productSlots?: unknown[];
      productsQueryFailed?: boolean;
      seo: CachedCategorySeo;
    }
  | {
      category: CachedCategoryRecord | null;
      fallbackDescription: string;
      fallbackName: string;
      isCollection: false;
      isInactiveCategory: boolean;
      name?: string;
      productIdsQueryFailed?: boolean;
      productCount?: number;
      productsArePrePaginated?: boolean;
      products: unknown[];
      productSlots?: unknown[];
      // True when the products fallback query errored (vs a genuinely empty
      // result) — consumers must fail open instead of 404ing.
      productsQueryFailed?: boolean;
      // True when the category `.single()` lookup hit a transient error (not a
      // normal "no rows") — consumers must also fail open on this.
      categoryQueryFailed?: boolean;
      seo?: null;
    };

/**
 * PostgREST returns code `PGRST116` when `.single()`/`.maybeSingle()` matches no
 * rows. That is the EXPECTED outcome for an unknown slug, not a failure — used
 * to keep "no rows" from being treated as a transient error in fail-open guards.
 */
function isPostgrestNoRowsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Object.hasOwn(error, 'code') &&
    Reflect.get(error, 'code') === 'PGRST116'
  );
}

function parsePriceValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function withLegacyPriceFields<T extends LegacyPriceCompatibleProduct>(
  product: T
): T & { base_price: number; sale_price: number | null } {
  const currentPrice = parsePriceValue(product.price);
  const compareAtPrice = parsePriceValue(product.compare_at_price);
  const hasSale =
    currentPrice !== null &&
    compareAtPrice !== null &&
    compareAtPrice > currentPrice;

  const basePrice = hasSale
    ? compareAtPrice
    : (currentPrice ?? compareAtPrice ?? 0);
  const salePrice = hasSale ? currentPrice : null;

  return {
    ...product,
    base_price: basePrice,
    sale_price: salePrice,
  };
}

async function getCachedPublicProductVariantsByProductIds(
  merchantId: string,
  productIds: string[]
) {
  'use cache';
  cacheLife('products');
  cacheTag('products', 'product-variants', `products-${merchantId}`);

  const uniqueProductIds = Array.from(
    new Set(productIds.filter((id): id is string => Boolean(id)))
  );

  if (uniqueProductIds.length === 0) {
    return {} as Record<string, PublicStorefrontProductVariant[]>;
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase.rpc(
    'get_storefront_product_variants',
    {
      p_product_ids: uniqueProductIds,
    }
  );

  if (error) {
    throw error;
  }

  const variantsByProductId: Record<string, PublicStorefrontProductVariant[]> =
    {};

  for (const variant of (data || []) as PublicStorefrontProductVariant[]) {
    if (!variantsByProductId[variant.product_id]) {
      variantsByProductId[variant.product_id] = [];
    }

    variantsByProductId[variant.product_id].push(variant);
  }

  return variantsByProductId;
}

async function getPublicProductVariantsByProductIds(
  merchantId: string,
  productIds: string[]
) {
  return await getCachedPublicProductVariantsByProductIds(
    merchantId,
    productIds
  );
}

// Type for merchant data with optional custom_domain
export interface HeroSlide {
  id: string;
  imageUrl: string;
  headline: string;
  description: string;
  cta: string;
}

export interface MerchantFeatureSettings {
  agentic_checkout_enabled?: boolean;
  blog_enabled?: boolean;
  blog_discover_image_validation_enabled?: boolean;
  facebook_pixel_id?: string | null;
  shipping_insurance_enabled?: boolean;
  shipping_insurance_min_order_value?: number;
  shipping_insurance_opt_in_default?: boolean;
  [key: string]: unknown;
}

const MERCHANT_PUBLIC_FEATURE_SETTINGS_SELECT: string = `
  about_page_enabled,
  agentic_checkout_enabled,
  auto_blog_enabled,
  blog_enabled,
  blog_discover_image_validation_enabled,
  checkout_collect_phone,
  checkout_require_account,
  checkout_show_order_notes,
  contact_page_enabled,
  credpal_enabled,
  credit_direct_enabled,
  credit_direct_max_amount,
  credit_direct_min_amount,
  custom_settings,
  discount_codes_enabled,
  faq_page_enabled,
  facebook_pixel_id,
  free_shipping_threshold,
  google_analytics_id,
  google_place_id,
  google_reviews_enabled,
  guest_checkout_enabled,
  juicyway_enabled,
  klump_enabled,
  klump_max_amount,
  klump_min_amount,
  korapay_enabled,
  loyalty_enabled,
  low_stock_threshold,
  order_tracking_enabled,
  pay_on_delivery_enabled,
  paystack_enabled,
  preferred_international_gateway,
  preferred_local_gateway,
  privacy_page_enabled,
  reviews_enabled,
  rewards_page_enabled,
  shipping_insurance_enabled,
  shipping_insurance_min_order_value,
  shipping_insurance_opt_in_default,
  shipping_providers,
  show_recent_purchases,
  show_stock_levels,
  snapchat_pixel_id,
  terms_page_enabled,
  tiktok_pixel_id,
  twitter_pixel_id,
  vtu_airtime_enabled,
  vtu_checkout_addon_amounts,
  vtu_checkout_addon_enabled,
  vtu_data_enabled,
  vtu_electricity_enabled,
  vtu_enabled,
  vtu_loyalty_reward_enabled,
  vtu_tv_enabled,
  wallet_order_auto_debit_enabled,
  wallet_paystack_dva_enabled,
  customer_device_savings_enabled,
  customer_device_savings_auto_debit_enabled,
  customer_device_savings_break_fee_enabled,
  wishlist_enabled
`;

export interface CachedMerchant {
  id: string;
  business_name: string;
  site_title: string;
  site_tagline: string;
  site_description: string;
  business_type: string;
  logo_url: string;
  phone: string;
  email: string;
  support_email?: string | null;
  support_phone?: string | null;
  social_media?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    pinterest?: string;
    linkedin?: string;
    snapchat?: string;
  };
  brand_colors?: {
    primary: string;
    secondary?: string;
    accent: string;
    background: string;
  };
  slug: string;
  business_address: string;
  legal_entity_name?: string | null;
  registered_address?: RegisteredAddress | null;
  tax_identification_number?: string | null;
  trust_profile?: MerchantTrustProfileDraft | null;
  payout_currency: string;
  paystack_subaccount_code?: string | null;
  is_published: boolean;
  template_id: string;
  plan_expires_at?: string | null;
  plan_tier: string;
  premium_features: unknown;
  custom_domain?: string;
  country?: string;
  hero_slides?: HeroSlide[];
  mobile_hero_slides?: HeroSlide[];
  // Favicon properties
  favicon_svg_url?: string;
  favicon_png_32_url?: string;
  favicon_apple_touch_url?: string;
  // VAT settings
  vat_registration_status?:
    | 'not_registered'
    | 'registered'
    | 'exempt'
    | 'pending';
  vat_rate?: number;
  feature_settings?: MerchantFeatureSettings;
  published_config?: Record<string, unknown> | null;
  // Legacy content pages (JSONB — used by contact, terms, privacy, faq, about pages)
  pages?: {
    contact?: string;
    terms?: string;
    privacy?: string;
    faq?: string;
    about?: string;
  };
  // Structured about page data — extends MerchantAboutPage with the
  // headline/image_url fields used by template-specific About pages
  // (e.g. Ogabassey hero) which aren't part of the canonical schema.
  about_page?: MerchantAboutPage & {
    headline?: string;
    image_url?: string;
  };
  // FAQ items array
  faq_items?: Array<{ question: string; answer: string }>;
  // Last update timestamp
  updated_at?: string;
}

type CachedMerchantMediaFields = {
  custom_domain?: string | null;
  favicon_apple_touch_url?: string | null;
  favicon_png_32_url?: string | null;
  favicon_svg_url?: string | null;
  id?: string | null;
  logo_url?: string | null;
  slug?: string | null;
};

function isOgabasseyMerchantEntity(merchant: CachedMerchantMediaFields) {
  const customDomain = merchant.custom_domain?.toLowerCase();
  const slug = merchant.slug?.toLowerCase();

  return (
    merchant.id === OGABASSEY_MERCHANT_ID ||
    customDomain === 'ogabassey.com' ||
    slug === 'ogabassey'
  );
}

function canonicalizeMerchantMediaUrl(value: string | null | undefined) {
  if (!value) {
    return value;
  }

  return canonicalizeStorefrontMediaUrl(value) ?? value;
}

function withStorefrontMediaCdnUrls<T extends CachedMerchantMediaFields>(
  merchant: T
): T {
  if (!isOgabasseyMerchantEntity(merchant)) {
    return merchant;
  }

  return {
    ...merchant,
    favicon_apple_touch_url: canonicalizeMerchantMediaUrl(
      merchant.favicon_apple_touch_url
    ),
    favicon_png_32_url: canonicalizeMerchantMediaUrl(
      merchant.favicon_png_32_url
    ),
    favicon_svg_url: canonicalizeMerchantMediaUrl(merchant.favicon_svg_url),
    logo_url: canonicalizeMerchantMediaUrl(merchant.logo_url),
  } as T;
}

function normalizeCachedMerchantEntity<
  T extends {
    business_type?: string | null;
    custom_domain?: string | null;
    favicon_apple_touch_url?: string | null;
    favicon_png_32_url?: string | null;
    favicon_svg_url?: string | null;
    id?: string | null;
    logo_url?: string | null;
    slug?: string | null;
    template_id?: string | null;
  },
>(merchant: T): Omit<T, 'business_type'> & { business_type: string } {
  const merchantWithCdnMedia = withStorefrontMediaCdnUrls(merchant);

  return {
    ...merchantWithCdnMedia,
    business_type: normalizeOgabasseyBusinessType(merchantWithCdnMedia),
  };
}

function redactUnpublishedMerchantContactFields<
  T extends {
    business_address?: unknown;
    email?: unknown;
    is_published?: boolean | null;
    legal_entity_name?: unknown;
    phone?: unknown;
    registered_address?: unknown;
    support_email?: unknown;
    support_phone?: unknown;
    tax_identification_number?: unknown;
    trust_profile?: unknown;
  },
>(merchant: T): T {
  if (merchant.is_published) return merchant;

  merchant.email = '';
  merchant.phone = '';
  merchant.support_email = '';
  merchant.support_phone = '';
  merchant.business_address = '';
  merchant.legal_entity_name = null;
  merchant.registered_address = null;
  merchant.tax_identification_number = null;
  merchant.trust_profile = null;
  return merchant;
}

interface ResolvedStorefrontCachedMerchantRow {
  custom_domain?: string | null;
  feature_settings?: MerchantFeatureSettings | null;
  merchant_data?: Partial<CachedMerchant> | null;
}

function firstResolvedStorefrontCachedMerchantRow(
  data: unknown
): ResolvedStorefrontCachedMerchantRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  return row as ResolvedStorefrontCachedMerchantRow;
}

function normalizeResolvedStorefrontCachedMerchantRow(
  row: ResolvedStorefrontCachedMerchantRow
): CachedMerchant | null {
  if (!row.merchant_data || typeof row.merchant_data !== 'object') {
    return null;
  }

  const merchant = row.merchant_data as CachedMerchant;
  redactUnpublishedMerchantContactFields(merchant);

  const featureSettings =
    row.feature_settings && typeof row.feature_settings === 'object'
      ? row.feature_settings
      : (merchantFeatureSettingsDefaults.buildPublicDefault(
          merchant.id
        ) as MerchantFeatureSettings);

  return {
    ...normalizeCachedMerchantEntity({
      ...merchant,
      custom_domain: row.custom_domain ?? undefined,
    }),
    feature_settings: featureSettings,
  };
}

/**
 * Cached merchant data by slug.
 * Keep this hot storefront shell lookup in the local Cache Components cache.
 * The official Next guidance calls out remote cache network-latency tradeoffs,
 * and live Vercel logs showed RemoteCacheHandler 408/502 failures here.
 */
export async function getCachedMerchant(
  slug: string
): Promise<CachedMerchant | null> {
  'use cache';
  cacheLife('merchant');
  cacheTag('merchants', `merchant-${slug}`);

  const supabase = getServiceRoleSupabaseClient({
    timeoutMs: MERCHANT_LOOKUP_TIMEOUT_MS,
  });

  const { data, error } = await supabase
    .from('merchants')
    .select(MERCHANT_PUBLIC_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    const safeSlug = sanitizeLookupLogValue(slug);
    const log = isTransientMerchantLookupError(error)
      ? console.warn
      : console.error;
    log(
      'Error fetching merchant for slug:',
      safeSlug,
      JSON.stringify(error, null, 2)
    );
    // CRITICAL: Throwing instead of returning null prevents negative caching
    // Next.js will not cache this error, allowing retries or stale data serving.
    throw createMerchantLookupError(
      `Failed to fetch merchant for slug: ${safeSlug}`,
      error
    );
  }

  let normalizedSettings: MerchantFeatureSettings | null = null;

  if (!data) {
    const safeSlug = sanitizeLookupLogValue(slug);
    console.warn('No merchant data found for slug:', safeSlug);
  } else {
    normalizedSettings = await getCachedFeatureSettings(data.id);

    const safeSlug = String(slug || '')
      .replace(/[\r\n]/g, '')
      .substring(0, 100);
    console.log('Successfully fetched merchant:', safeSlug, data.id);
  }

  // Fetch primary domain
  if (data) {
    // SECURITY: If the store is NOT published, mask sensitive contact info.
    redactUnpublishedMerchantContactFields(data);

    const { data: primaryDomain } = await supabase
      .from('domains')
      .select('domain')
      .eq('merchant_id', data.id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .single();

    if (primaryDomain) {
      const result: CachedMerchant = {
        ...normalizeCachedMerchantEntity({
          ...data,
          custom_domain: primaryDomain.domain,
        }),
        feature_settings: normalizedSettings ?? undefined,
      };
      return result;
    }
  }

  if (data) {
    const result: CachedMerchant = {
      ...normalizeCachedMerchantEntity(data),
      feature_settings: normalizedSettings ?? undefined,
    };
    return result;
  }
  return null;
}

/**
 * Cached merchant data by custom domain.
 * Normalizes the domain to lowercase before lookup.
 * Keep this hot storefront shell lookup in the local Cache Components cache;
 * remote cache handler failures should not be able to break merchant routing.
 */
export async function getCachedMerchantByDomain(
  domain: string
): Promise<CachedMerchant | null> {
  'use cache';
  cacheLife('merchant');
  cacheTag('merchants', 'domains', `domain-${domain.toLowerCase()}`);

  const normalizedDomain = domain.toLowerCase();
  // Use Service Role to allow lookup of unpublished merchants (for "Coming Soon" page).
  const supabase = getServiceRoleSupabaseClient({
    timeoutMs: MERCHANT_LOOKUP_TIMEOUT_MS,
  });

  const { data: resolvedData, error: resolveError } = await supabase.rpc(
    'resolve_storefront_cached_merchant',
    {
      p_identifier: normalizedDomain,
    }
  );

  if (resolveError) {
    const log = isTransientMerchantLookupError(resolveError)
      ? console.warn
      : console.error;
    log('Error resolving merchant for domain', {
      domain: normalizedDomain,
      error: resolveError,
    });
    throw createMerchantLookupError(
      `Database error resolving merchant for domain: ${normalizedDomain}`,
      resolveError
    );
  }

  const resolvedMerchant = normalizeResolvedStorefrontCachedMerchantRow(
    firstResolvedStorefrontCachedMerchantRow(resolvedData) ?? {}
  );

  if (!resolvedMerchant) {
    console.warn('No domain mapping found for:', normalizedDomain);
    return null;
  }

  console.log('Successfully fetched merchant by domain', {
    domain: normalizedDomain,
    slug: resolvedMerchant.slug,
    merchantId: resolvedMerchant.id,
  });

  return resolvedMerchant;
}

const TRANSIENT_MERCHANT_LOOKUP_ERROR = Symbol('transient-merchant-lookup');

type MerchantLookupError = Error & {
  [TRANSIENT_MERCHANT_LOOKUP_ERROR]?: true;
};

function createMerchantLookupError(message: string, cause: unknown): Error {
  const error = new Error(message) as MerchantLookupError;
  if (isTransientMerchantLookupError(cause)) {
    error[TRANSIENT_MERCHANT_LOOKUP_ERROR] = true;
  }
  return error;
}

export function sanitizeLookupLogValue(value: unknown): string {
  return String(value || '')
    .replace(/[\r\n\t]/g, '')
    .substring(0, 100);
}

function isTransientMerchantLookupError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if (
    TRANSIENT_MERCHANT_LOOKUP_ERROR in error &&
    (error as MerchantLookupError)[TRANSIENT_MERCHANT_LOOKUP_ERROR]
  ) {
    return true;
  }

  const maybeError = error as {
    details?: unknown;
    message?: unknown;
    name?: unknown;
    stack?: unknown;
  };
  const details =
    typeof maybeError.details === 'string' ? maybeError.details : '';
  const message =
    typeof maybeError.message === 'string' ? maybeError.message : '';
  const name = typeof maybeError.name === 'string' ? maybeError.name : '';
  const stack = typeof maybeError.stack === 'string' ? maybeError.stack : '';
  const combined =
    `${name}\n${message}\n${details}\n${stack}\n${String(error)}`.toLowerCase();

  return (
    combined.includes('remotecachehandler') ||
    combined.includes('invalid response from cache') ||
    // Production digest-masking: errors thrown inside a 'use cache' function
    // cross the React Flight boundary, which replaces the message (and every
    // diagnostic substring above/below) with this generic string. The real
    // failures behind it on this path are overwhelmingly transport-tail
    // events, and misclassifying them as non-transient made the retry +
    // direct-fallback path dead code in prod — serving 404s on live
    // storefronts during Supabase blips.
    combined.includes('an error occurred in the server components render') ||
    combined.includes('timeouterror') ||
    combined.includes('request timeout') ||
    combined.includes('aborted due to timeout') ||
    combined.includes('fetch failed') ||
    combined.includes('network timeout') ||
    combined.includes('network error') ||
    combined.includes('502 bad gateway') ||
    /\b(408 request timeout|http 408|status(?: code)? 408)\b/.test(combined) ||
    combined.includes('504 gateway timeout') ||
    combined.includes('bad gateway') ||
    combined.includes('econnreset') ||
    combined.includes('etimedout')
  );
}

function summarizeMerchantLookupError(error: unknown) {
  const maybeError = error as {
    details?: unknown;
    message?: unknown;
    name?: unknown;
  };
  return {
    name:
      typeof maybeError?.name === 'string'
        ? sanitizeLookupLogValue(maybeError.name)
        : undefined,
    message:
      typeof maybeError?.message === 'string'
        ? sanitizeLookupLogValue(maybeError.message)
        : sanitizeLookupLogValue(error),
    details:
      typeof maybeError?.details === 'string'
        ? sanitizeLookupLogValue(maybeError.details)
        : undefined,
    transient: isTransientMerchantLookupError(error),
  };
}

async function getDirectFeatureSettings(
  merchantId: string
): Promise<MerchantFeatureSettings | null> {
  const supabase = getPublicSupabaseClient({
    timeoutMs: MERCHANT_DIRECT_LOOKUP_TIMEOUT_MS,
  });
  const { data, error } = await supabase
    .from('merchant_feature_settings')
    .select(MERCHANT_PUBLIC_FEATURE_SETTINGS_SELECT)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return merchantFeatureSettingsDefaults.buildPublicDefault(
      merchantId
    ) as MerchantFeatureSettings;
  }

  return data as unknown as MerchantFeatureSettings;
}

async function attachDirectFeatureSettings<T extends { id: string }>(
  merchant: T
): Promise<T & { feature_settings?: MerchantFeatureSettings }> {
  const featureSettings = await getDirectFeatureSettings(merchant.id);
  return {
    ...merchant,
    feature_settings: featureSettings ?? undefined,
  };
}

async function getDirectMerchantBySlug(
  slug: string
): Promise<CachedMerchant | null> {
  const supabase = getPublicSupabaseClient({
    timeoutMs: MERCHANT_DIRECT_LOOKUP_TIMEOUT_MS,
  });
  const { data, error } = await supabase
    .from('merchants')
    .select(MERCHANT_PUBLIC_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw createMerchantLookupError(
      `Failed direct merchant lookup for slug: ${sanitizeLookupLogValue(slug)}`,
      error
    );
  }

  if (!data) return null;

  redactUnpublishedMerchantContactFields(data);

  const { data: primaryDomain } = await supabase
    .from('domains')
    .select('domain')
    .eq('merchant_id', data.id)
    .eq('is_primary', true)
    .eq('status', 'active')
    .maybeSingle();

  const normalizedMerchant = normalizeCachedMerchantEntity({
    ...data,
    ...(primaryDomain ? { custom_domain: primaryDomain.domain } : {}),
  });

  return attachDirectFeatureSettings(normalizedMerchant);
}

async function getDirectMerchantByDomain(
  domain: string
): Promise<CachedMerchant | null> {
  const normalizedDomain = domain.toLowerCase();
  const supabase = getPublicSupabaseClient({
    timeoutMs: MERCHANT_DIRECT_LOOKUP_TIMEOUT_MS,
  });
  const { data: domainData, error: domainError } = await supabase
    .from('domains')
    .select('merchant_id, domain')
    .eq('domain', normalizedDomain)
    .eq('status', 'active')
    .maybeSingle();

  if (domainError) {
    throw createMerchantLookupError(
      `Failed direct domain lookup: ${normalizedDomain}`,
      domainError
    );
  }

  if (!domainData) return null;

  const { data, error } = await supabase
    .from('merchants')
    .select(MERCHANT_PUBLIC_SELECT)
    .eq('id', domainData.merchant_id)
    .single();

  if (error) {
    throw createMerchantLookupError(
      `Failed direct merchant lookup for domain: ${normalizedDomain}`,
      error
    );
  }

  redactUnpublishedMerchantContactFields(data);

  const normalizedMerchant = normalizeCachedMerchantEntity({
    ...data,
    custom_domain: domainData.domain,
  });

  return attachDirectFeatureSettings(normalizedMerchant);
}

async function getMerchantByIdentifierDirect(
  identifier: string
): Promise<CachedMerchant | null> {
  if (!isValidMerchantIdentifier(identifier)) return null;

  if (isDomainIdentifier(identifier)) {
    return await getDirectMerchantByDomain(identifier.toLowerCase());
  }

  return await getDirectMerchantBySlug(identifier.toLowerCase());
}

/**
 * Get merchant by identifier (slug or custom domain)
 * Automatically detects whether the identifier is a domain or slug
 */
export async function getMerchantByIdentifier(
  identifier: string
): Promise<CachedMerchant | null> {
  if (!isValidMerchantIdentifier(identifier)) return null;

  if (isDomainIdentifier(identifier)) {
    return await getCachedMerchantByDomain(identifier.toLowerCase());
  }
  return await getCachedMerchant(identifier.toLowerCase());
}

/**
 * Safe merchant lookup with retry on transient failures.
 * Returns null instead of throwing — prevents 404s from transient Supabase errors.
 * Use this in layout.tsx and page.tsx where an unhandled throw triggers error boundaries.
 */
export async function getMerchantSafe(
  identifier: string
): Promise<CachedMerchant | null> {
  try {
    return await getMerchantByIdentifier(identifier);
  } catch (firstError) {
    unstable_rethrow(firstError);
    // Retry once on transient failure (e.g., Supabase timeout during cache
    // revalidation). The short jittered pause matters: an immediate retry
    // tends to hit the same event-loop/connection stall and fail identically.
    await waitForMerchantLookupRetryBackoff();
    try {
      return await getMerchantByIdentifier(identifier);
    } catch (retryError) {
      unstable_rethrow(retryError);
      const safeId = sanitizeLookupLogValue(identifier);
      const isTransient =
        isTransientMerchantLookupError(firstError) ||
        isTransientMerchantLookupError(retryError);
      const lookupSummary = {
        firstError: summarizeMerchantLookupError(firstError),
        retryError: summarizeMerchantLookupError(retryError),
      };

      if (isTransient) {
        try {
          const directMerchant =
            await getMerchantByIdentifierDirect(identifier);
          if (directMerchant) {
            console.warn(
              'Merchant fetch failed after retry; direct fallback succeeded:',
              safeId,
              lookupSummary
            );
            return directMerchant;
          }
          console.warn(
            'Merchant lookup direct fallback returned no merchant:',
            safeId,
            lookupSummary
          );
        } catch (directError) {
          console.error('Direct merchant lookup failed after retry:', safeId, {
            ...lookupSummary,
            directError: summarizeMerchantLookupError(directError),
          });
        }
      } else {
        console.error(
          'Non-transient merchant lookup failed after retry:',
          safeId,
          lookupSummary
        );
      }

      return null;
    }
  }
}

/**
 * Strict merchant lookup with retry — throws on transient failures.
 * Use inside cached functions where returning null on a transient error would
 * cache the failure instead of letting the caller retry on a later render.
 * A genuine "merchant not found" still returns null (safe to cache).
 */
export async function getMerchantStrict(
  identifier: string
): Promise<CachedMerchant | null> {
  try {
    return await getMerchantByIdentifier(identifier);
  } catch (firstError) {
    unstable_rethrow(firstError);
    await waitForMerchantLookupRetryBackoff();
    try {
      return await getMerchantByIdentifier(identifier);
    } catch (retryError) {
      unstable_rethrow(retryError);
      const safeId = sanitizeLookupLogValue(identifier);
      console.error('Strict merchant lookup failed after retry:', safeId);
      throw retryError;
    }
  }
}

/**
 * Request-scoped merchant lookup via React cache().
 * Deduplicates getMerchantSafe() calls within a single request — if both
 * layout.tsx and page.tsx call this with the same identifier, only one
 * actual fetch happens. The second call reuses the same Promise.
 */
export const getRequestScopedMerchant = cache(
  (identifier: string): Promise<CachedMerchant | null> => {
    return getMerchantSafe(identifier);
  }
);

/**
 * Cached merchant data by ID
 */
export async function getCachedMerchantById(
  merchantId: string
): Promise<CachedMerchant | null> {
  'use cache: remote';
  cacheLife('merchant');
  cacheTag('merchants', `merchant-id-${merchantId}`);

  const supabase = getPublicSupabaseClient();

  const { data, error } = await supabase
    .from('merchants')
    .select(`
        id,
        business_name,
        site_title,
        site_tagline,
        site_description,
        business_type,
        logo_url,
        phone,
        email,
        social_media,
        brand_colors,
        slug,
        business_address,
        payout_currency,
        paystack_subaccount_code,
        is_published,
        template_id,
        plan_expires_at,
        plan_tier,
        premium_features,
        country,
        hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url,
        vat_registration_status,
        vat_rate
      `)
    .eq('id', merchantId)
    .single();

  if (error) {
    console.error('Error fetching merchant by ID:', error);
    return null;
  }

  return normalizeCachedMerchantEntity(data);
}

/**
 * Cached products for a merchant.
 * Uses 'products' cacheLife profile (stale 5min, revalidate 5min, expire 24hr)
 *
 * Note: Returns product_categories as an array with nested categories objects.
 * Consumers should extract the first category like:
 * `product.product_categories?.[0]?.categories` to get { id, name, slug }
 */
export async function getCachedProducts(
  merchantId: string,
  options?: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    includeVariants?: boolean;
    /** Deprecated: the products table no longer has an is_featured column. */
    featured?: boolean;
  }
) {
  'use cache: remote';
  cacheLife('products');
  cacheTag('products', `products-${merchantId}`);

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('products')
    .select(`
        id,
        name,
        description,
        slug,
        canonical_url,
        price,
        compare_at_price,
        status,
        is_parent,
        quantity:stock_quantity,
        track_quantity:manage_stock,
        images,
        color_images,
        brand,
        condition,
        product_categories (
          category_id,
          categories (
            id,
            name,
            slug
          )
        )
      `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .or('is_parent.eq.true,parent_product_id.is.null') // Only show parent products or standalone products
    .order('created_at', { ascending: false });

  if (options?.categoryId) {
    query = query.eq('product_categories.category_id', options.categoryId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 20) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  const products = (data || []).map(withLegacyPriceFields);
  const variantsByProductId =
    options?.includeVariants === false
      ? {}
      : await getPublicProductVariantsByProductIds(
          merchantId,
          products.map((product) => product.id)
        );

  const rawProducts = products.map((product) => ({
    ...product,
    product_variants: variantsByProductId[product.id] || [],
  }));

  return hydrateAndSanitizeProducts(supabase, merchantId, rawProducts);
}

/**
 * Product fields required before the full PDP stream can render.
 * Keep this shape narrow so the LCP image hint is not delayed by rich product joins.
 */
export interface CachedProductLcpHint {
  base_price?: number | null;
  brand?: string | null;
  canonical_url?: string | null;
  category?: string | null;
  categories?:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
      }>
    | null;
  color?: string | null;
  condition?: string | null;
  compare_at_price?: number | string | null;
  default_variant_id?: string | null;
  has_variants?: boolean | null;
  id: string;
  images?: Array<
    | string
    | {
        alt?: string | null;
        url: string;
      }
  > | null;
  keywords?: string[] | null;
  manage_stock?: boolean | null;
  max_variant_price?: number | string | null;
  merchant_id?: string | null;
  meta_description?: string | null;
  meta_title?: string | null;
  min_variant_price?: number | string | null;
  name: string;
  price?: number | string | null;
  product_categories?: Array<{
    categories:
      | {
          id: string;
          name: string;
          slug: string;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
        }>
      | null;
  }> | null;
  product_variants?: PublicStorefrontProductVariant[] | null;
  sale_price?: number | null;
  schema_markup?: unknown;
  slug?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  updated_at?: string | null;
  variant_attributes?: unknown;
}

interface CachedProductLcpHintOptions {
  includeVariants?: boolean;
}

/**
 * Cached product route and image hint by slug.
 * Avoids the full product projection; callers that only need an image can skip
 * storefront variant hydration.
 */
export async function getCachedProductLcpHint(
  merchantId: string,
  productSlug: string,
  options: CachedProductLcpHintOptions = {}
): Promise<CachedProductLcpHint | null> {
  'use cache';
  cacheLife('products');
  cacheTag(
    'product',
    'product-lcp-hint',
    `products-${merchantId}`,
    getProductScopedCacheTag('product', merchantId, productSlug)
  );

  const supabase = getPublicSupabaseClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let query = supabase
    .from('products')
    .select(`
        id,
        merchant_id,
        brand,
        name,
        slug,
        price,
        compare_at_price,
        has_variants,
        min_variant_price,
        max_variant_price,
        default_variant_id,
        condition,
        color,
        manage_stock,
        stock_quantity,
        category,
        meta_title,
        meta_description,
        keywords,
        canonical_url,
        schema_markup,
        images,
        stock,
        updated_at,
        variant_attributes,
        categories:category_id (
          id,
          name,
          slug
        ),
        product_categories (
          category_id,
          categories (
            id,
            name,
            slug
          )
        )
      `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (isUuid) {
    query = query.or(
      `slug.eq.${productSlug.toLowerCase()},id.eq.${productSlug}`
    );
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching product LCP hint:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const product = withLegacyPriceFields(data as CachedProductLcpHint);

  if (options.includeVariants === false) {
    return product;
  }

  const variantsByProductId = await getPublicProductVariantsByProductIds(
    merchantId,
    [product.id]
  );
  const rawProduct = {
    ...product,
    product_variants: variantsByProductId[product.id] || [],
  };
  const hydrated = await hydrateAndSanitizeProducts(supabase, merchantId, [
    rawProduct,
  ]);

  return hydrated[0] || rawProduct;
}

/**
 * Cached single product by slug.
 * Uses 'products' cacheLife profile (stale 5min, revalidate 5min, expire 24hr)
 */
export async function getCachedProduct(
  merchantId: string,
  productSlug: string
) {
  'use cache';
  cacheLife('products');
  cacheTag(
    'product',
    getProductScopedCacheTag('product', merchantId, productSlug)
  );

  const supabase = getPublicSupabaseClient();

  // Check if the input LOOKS like a UUID (simple regex)
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let query = supabase
    .from('products')
    .select(`
        id,
        name,
        description,
        slug,
        canonical_url,
        price,
        compare_at_price,
        min_variant_price,
        max_variant_price,
        status,
        quantity:stock_quantity,
        track_quantity:manage_stock,
        images,
        color_images,
        created_at,
        ${PRODUCT_KEY_SPECS_RELATION_SELECT},
        specifications,
        condition,
        variant_model,
        available_conditions,
        has_condition_offers,
        meta_title,
        meta_description,
        keywords,
        offers:product_offers (
          id,
          condition,
          price,
          stock_quantity,
          images,
          status
        ),
        categories:category_id (
          id,
          name,
          slug
        ),
        product_categories (
          category_id,
          categories (
            id,
            name,
            slug
          )
        )
      `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (isUuid) {
    query = query.eq('id', productSlug);
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching product:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const product = withLegacyPriceFields(data);
  const variantsByProductId = await getPublicProductVariantsByProductIds(
    merchantId,
    [product.id]
  );

  const rawProduct = {
    ...product,
    product_variants: variantsByProductId[product.id] || [],
  };

  const hydrated = await hydrateAndSanitizeProducts(supabase, merchantId, [
    rawProduct,
  ]);
  return hydrated[0] || null;
}

const STOREFRONT_PRODUCT_DETAIL_COLUMNS = `
  id,
  merchant_id,
  category_id,
  created_at,
  updated_at,
  name,
  description,
  status,
  price,
  compare_at_price,
  stock,
  stock_quantity,
  manage_stock,
  low_stock_threshold,
  sku,
  slug,
  condition,
  condition_detail,
  variant_model,
  default_variant_id,
  available_conditions,
  min_variant_price,
  max_variant_price,
  brand,
  category,
  color,
  has_variants,
  has_condition_offers,
  variant_attributes,
  images,
  imageHint:image_hint,
  specifications,
  weight_value,
  weight_unit,
  dimensions,
  taxable,
  tax_code,
  meta_title,
  meta_description,
  keywords,
  canonical_url,
  schema_markup,
  gtin,
  mpn,
  google_product_category,
  fulfillmentFields:fulfillment_fields
`;

const STOREFRONT_PRODUCT_DETAIL_OFFERS_COLUMNS = `
  id,
  condition,
  price,
  compare_at_price,
  stock_quantity,
  images,
  condition_notes,
  grade,
  status
`;

/**
 * Comprehensive cached product data with all relations for product pages.
 * Fetches product + key_specs + offers + category in the main query.
 * Storefront-safe variants are hydrated separately through the public RPC.
 * Uses 'products' cacheLife profile (stale 5min, revalidate 5min, expire 24hr)
 */
export async function getCachedProductWithDetails(
  merchantId: string,
  productSlug: string
) {
  'use cache';
  cacheLife('products');
  cacheTag(
    'product',
    'product-details',
    getProductScopedCacheTag('product', merchantId, productSlug)
  );

  const supabase = getPublicSupabaseClient();

  // Check if the input looks like a UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let query = supabase
    .from('products')
    .select(`
        ${STOREFRONT_PRODUCT_DETAIL_COLUMNS},
        categories:category_id(id, name, slug, parent_id),
        ${PRODUCT_KEY_SPECS_RELATION_SELECT},
        product_offers (${STOREFRONT_PRODUCT_DETAIL_OFFERS_COLUMNS})
      `)
    .eq('merchant_id', merchantId);

  if (isUuid) {
    query = query.or(`slug.eq.${productSlug},id.eq.${productSlug}`);
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching product with details:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const variantsByProductId = await getPublicProductVariantsByProductIds(
    merchantId,
    [data.id]
  );

  const rawProduct = {
    ...data,
    product_variants: variantsByProductId[data.id] || [],
  };

  const hydrated = await hydrateAndSanitizeProducts(supabase, merchantId, [
    rawProduct,
  ]);
  return hydrated[0] || null;
}

interface CachedProductCanonicalCategory {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
}

export interface CachedProductCanonicalRedirectTarget {
  canonical_url?: string | null;
  category?: string | null;
  categories?:
    | CachedProductCanonicalCategory
    | CachedProductCanonicalCategory[]
    | null;
  id: string;
  name: string;
  slug: string;
  status?: string | null;
}

export interface CachedLegacyProductRedirectTarget {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  categories?: CachedProductCanonicalCategory | null;
}

/**
 * Narrow active-product lookup for the proxy canonical redirect preflight.
 * Keep this projection smaller than `getCachedProductWithDetails()` so normal
 * PDP requests do not hydrate variants/specs before the App Router render.
 */
export async function getCachedProductCanonicalRedirectTarget(
  merchantId: string,
  productSlug: string
): Promise<CachedProductCanonicalRedirectTarget | null> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'product',
    'product-canonical-redirect',
    getProductScopedCacheTag('product', merchantId, productSlug),
    getProductScopedCacheTag(
      'product-canonical-redirect',
      merchantId,
      productSlug
    )
  );

  const supabase = getPublicSupabaseClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let query = supabase
    .from('products')
    .select(`
        id,
        name,
        slug,
        status,
        category,
        canonical_url,
        categories:category_id(id, name, slug, parent_id)
      `)
    .eq('merchant_id', merchantId);

  if (isUuid) {
    query = query.or(
      `slug.eq.${productSlug.toLowerCase()},id.eq.${productSlug}`
    );
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CachedProductCanonicalRedirectTarget | null) || null;
}

/**
 * Resolves archived product slugs that were consolidated into an active parent
 * product, so old variant URLs can permanently redirect to the canonical page.
 */
export async function getCachedLegacyProductRedirectTarget(
  merchantId: string,
  productSlug: string
): Promise<CachedLegacyProductRedirectTarget | null> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'product',
    'product-legacy-redirect',
    getProductScopedCacheTag('product-legacy-redirect', merchantId, productSlug)
  );

  const supabase = getServiceRoleSupabaseClient();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let query = supabase
    .from('products')
    .select(`
        parent:parent_product_id (
          id,
          name,
          slug,
          status,
          category,
          categories:category_id(id, name, slug, parent_id)
        )
      `)
    .eq('merchant_id', merchantId)
    .eq('status', 'archived');

  if (isUuid) {
    query = query.eq('id', productSlug);
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching legacy product redirect target:', error);
    throw error;
  }

  const parent = data?.parent as
    | {
        id: string;
        name: string;
        slug: string | null;
        status: string | null;
        category?: string | null;
        categories?:
          | {
              id: string;
              name: string;
              slug: string;
              parent_id?: string | null;
            }
          | {
              id: string;
              name: string;
              slug: string;
              parent_id?: string | null;
            }[]
          | null;
      }
    | null
    | undefined;

  if (parent?.status !== 'active' || !parent.slug) {
    return null;
  }

  const normalizedCategory = Array.isArray(parent.categories)
    ? (parent.categories[0] ?? null)
    : (parent.categories ?? null);

  return {
    id: parent.id,
    name: parent.name,
    slug: parent.slug,
    category: parent.category ?? null,
    categories: normalizedCategory,
  };
}

/**
 * Cached categories for a merchant.
 * Uses 'categories' cacheLife profile (stale 5min, revalidate 1hr, expire 24hr)
 */
export async function getCachedCategories(merchantId: string) {
  'use cache: remote';
  cacheLife('categories');
  cacheTag('categories', `categories-${merchantId}`);

  const supabase = getPublicSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select(`
        id,
        name,
        slug,
        description,
        image_url,
        is_active,
        parent_id
      `)
    .eq('merchant_id', merchantId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data || [];
}

/**
 * Cached category by slug.
 * Uses 'categories' cacheLife profile (stale 5min, revalidate 1hr, expire 24hr)
 */
export async function getCachedCategory(
  merchantId: string,
  categorySlug: string
) {
  'use cache: remote';
  cacheLife('categories');
  cacheTag('category', `category-${merchantId}-${categorySlug}`);

  const supabase = getPublicSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select(`
        id,
        name,
        slug,
        description,
        image_url,
        parent_id
      `)
    .eq('merchant_id', merchantId)
    .eq('slug', categorySlug)
    .single();

  if (error) {
    console.error('Error fetching category:', error);
    return null;
  }

  return data;
}

/**
 * Cached published page config (Puck builder).
 * Uses 'merchant' cacheLife profile (stale 5min, revalidate 60s, expire 1hr)
 */
export async function getCachedPageConfig(
  merchantId: string,
  pageSlug: string = 'home'
) {
  'use cache: remote';
  cacheLife('merchant');
  cacheTag('page-config', `page-config-${merchantId}-${pageSlug}`);

  const supabase = getPublicSupabaseClient();

  const { data, error } = await supabase
    .from('page_configs')
    .select('published_config')
    .eq('merchant_id', merchantId)
    .eq('page_slug', pageSlug)
    .eq('is_published', true)
    .single();

  if (error) {
    console.error('Error fetching page config:', error);
    return null;
  }

  return data?.published_config;
}

const CATEGORY_PAGE_PRODUCT_DETAIL_CHUNK_SIZE = 48;
const CATEGORY_PAGE_PRODUCT_DETAIL_CONCURRENCY = 3;
const SPECIAL_COLLECTIONS = [
  'new-arrivals',
  'best-sellers',
  'on-sale',
  'featured',
] as const;

type SpecialCollectionSlug = (typeof SPECIAL_COLLECTIONS)[number];

type CachedCategoryPageProductScope =
  | {
      categoryId: string;
      categoryIds: string[];
      kind: 'category';
      scopeQueryFailed?: boolean;
    }
  | { kind: 'collection'; collectionSlug: SpecialCollectionSlug }
  | { categoryName: string; kind: 'legacy' }
  | { kind: 'none' };

type CachedCategoryPageShellData =
  | {
      description: string;
      fallbackDescription?: string;
      fallbackName?: string;
      isCollection: true;
      isInactiveCategory?: false;
      name: string;
      productScope: CachedCategoryPageProductScope;
      seo: CachedCategorySeo;
    }
  | {
      category: CachedCategoryRecord | null;
      categoryQueryFailed?: boolean;
      fallbackDescription: string;
      fallbackName: string;
      isCollection: false;
      isInactiveCategory: boolean;
      name?: string;
      productScope: CachedCategoryPageProductScope;
      seo?: null;
    };

interface CachedCategoryPageProductsResult {
  productIdsQueryFailed: boolean;
  productCount: number;
  productsArePrePaginated: boolean;
  products: unknown[];
  productSlots: unknown[];
  productsQueryFailed: boolean;
}

interface CachedCategoryPageProductIdsResult {
  productIds: string[];
  productsQueryFailed: boolean;
}

interface CategoryPageProductDetailsResult {
  missingProductCount: number;
  productSlots: Array<unknown | null>;
  productsQueryFailed: boolean;
}

const CATEGORY_PAGE_PRODUCT_BASE_SELECT = `
          id,
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
          manage_stock,
          ${PRODUCT_KEY_SPECS_RELATION_SELECT}
        `;

function getCategoryPageProductSelect(isCategoryScoped: boolean) {
  const productCategoriesSelect = isCategoryScoped
    ? 'product_categories!inner(categories(name, slug))'
    : 'product_categories(categories(name, slug))';

  return `${CATEGORY_PAGE_PRODUCT_BASE_SELECT}, ${productCategoriesSelect}`;
}

function isSpecialCollectionSlug(
  categorySlug: string
): categorySlug is SpecialCollectionSlug {
  return SPECIAL_COLLECTIONS.includes(categorySlug as SpecialCollectionSlug);
}

function getSpecialCollectionCopy(collectionSlug: SpecialCollectionSlug) {
  switch (collectionSlug) {
    case 'new-arrivals':
      return {
        description: 'Check out the latest additions to our store.',
        name: 'New Arrivals',
      };
    case 'best-sellers':
      return {
        description: 'Our most popular products loved by customers.',
        name: 'Best Sellers',
      };
    case 'on-sale':
      return {
        description: 'Great deals and discounts on top products.',
        name: 'On Sale',
      };
    case 'featured':
      return {
        description: 'Hand-picked highlights just for you.',
        name: 'Featured',
      };
  }
}

/**
 * Remote-cached category shell/status data. This output stays intentionally
 * small so it remains suitable for Vercel's shared remote cache and keeps
 * category/product mutation tag invalidation cross-instance.
 */
async function getCachedCategoryPageShellData(
  merchantId: string,
  categorySlug: string,
  _storeSlug: string
): Promise<CachedCategoryPageShellData> {
  'use cache: remote';
  cacheLife('storefront-page');
  cacheTag(
    'category-page-data',
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (isSpecialCollectionSlug(categorySlug)) {
    const collection = getSpecialCollectionCopy(categorySlug);

    return {
      isCollection: true,
      name: collection.name,
      description: collection.description,
      fallbackName: collection.name,
      fallbackDescription: collection.description,
      productScope: { kind: 'collection', collectionSlug: categorySlug },
      seo: {
        heading: collection.name,
        description: collection.description,
        features: [],
        faqs: [],
      },
    };
  }

  const supabase = getPublicSupabaseClient();

  const categoryQuery = supabase
    .from('categories')
    .select(
      'id, name, slug, description, image_url, is_active, seo_heading, seo_description, seo_features, seo_faq, parent:parent_id(name, slug)'
    )
    .eq('merchant_id', merchantId)
    .eq('slug', categorySlug)
    .single() as unknown as Promise<{
    data: StorefrontCategoryRow | null;
    error: unknown;
  }>;
  const { data: categoryRow, error: categoryError } = await categoryQuery;
  // `.single()` returns PGRST116 ("no rows") for a genuinely unknown slug — that
  // is the EXPECTED path for legacy category/brand URLs with no `categories`
  // row, so it must NOT count as a failure (else the doorway trap never fires).
  // Any OTHER error is transient (connection/timeout) → fail open downstream.
  const categoryQueryFailed =
    Boolean(categoryError) && !isPostgrestNoRowsError(categoryError);
  let hiddenCategoryState: StorefrontCategorySlugState | null = null;

  if (!categoryRow) {
    const { data: categoryStateData, error: categoryStateError } =
      await supabase.rpc('get_storefront_category_slug_state', {
        p_merchant_id: merchantId,
        p_slug: categorySlug,
      });

    if (categoryStateError) {
      console.error('Category state query error:', categoryStateError);
    }

    const stateArray = categoryStateData as
      | StorefrontCategorySlugState[]
      | null;
    hiddenCategoryState =
      stateArray && stateArray.length > 0 ? stateArray[0] : null;
  }

  const isInactiveCategory =
    categoryRow?.is_active === false ||
    hiddenCategoryState?.is_active === false;
  const category: CachedCategoryRecord | null =
    categoryRow && categoryRow.is_active !== false
      ? ({
          ...categoryRow,
          is_active: categoryRow.is_active ?? true,
        } as CachedCategoryRecord)
      : null;

  // Fallback: decode the slug to get category name and Title Case it.
  const categoryName =
    categoryRow?.name ||
    decodeURIComponent(categorySlug)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const categoryDescription =
    categoryRow?.description ||
    `Browse our collection of ${categoryName} products.`;

  let productScope: CachedCategoryPageProductScope = isInactiveCategory
    ? { kind: 'none' }
    : { kind: 'legacy', categoryName };

  if (category?.id) {
    const { data: categoryScope, error: categoryScopeError } = await supabase
      .from('categories')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .or(`id.eq.${category.id},parent_id.eq.${category.id}`);

    if (categoryScopeError) {
      console.error('Category scope query error:', categoryScopeError);
    }

    const categoryIds = Array.from(
      new Set(
        [
          category.id,
          ...((categoryScope || []) as Array<{ id?: string | null }>).map(
            (item) => item.id
          ),
        ].filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    productScope = {
      kind: 'category',
      categoryId: category.id,
      categoryIds,
      scopeQueryFailed: Boolean(categoryScopeError),
    };
  }

  return {
    isCollection: false,
    category,
    fallbackName: categoryName,
    fallbackDescription: categoryDescription,
    isInactiveCategory,
    categoryQueryFailed,
    productScope,
  };
}

/**
 * Remote-cached ordered product IDs for category/collection pages.
 * IDs are compact enough for a single shared cache entry and make the product
 * detail fetch snapshot-safe: detail chunks are keyed by stable ID slices, not
 * shifting offset windows.
 */
async function getCachedCategoryPageProductIds({
  merchantId,
  scope,
}: {
  merchantId: string;
  scope: CachedCategoryPageProductScope;
}): Promise<CachedCategoryPageProductIdsResult> {
  'use cache: remote';
  cacheLife('storefront-page');
  cacheTag(
    'category-page-data',
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (scope.kind === 'none') {
    return { productIds: [], productsQueryFailed: false };
  }

  const supabase = getPublicSupabaseClient();
  let productIds: string[] = [];
  let productsError: unknown = null;

  if (scope.kind === 'collection') {
    let query = supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    switch (scope.collectionSlug) {
      case 'new-arrivals':
        query = query
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });
        break;
      case 'best-sellers':
        query = query
          .order('rating', { ascending: false })
          .order('id', { ascending: true });
        break;
      case 'on-sale':
        query = query
          .not('compare_at_price', 'is', null)
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true });
        break;
      case 'featured':
        query = query
          .order('price', { ascending: false })
          .order('id', { ascending: true });
        break;
    }

    const { data, error } = await query;
    productIds = ((data || []) as Array<{ id?: string | null }>)
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id));
    productsError = error;
  }

  if (scope.kind === 'category') {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_categories!inner(category_id)')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .in('product_categories.category_id', scope.categoryIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    productIds = ((data || []) as Array<{ id?: string | null }>)
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id));
    productsError = error || (scope.scopeQueryFailed ? true : null);
  }

  if (scope.kind === 'legacy') {
    // Legacy fallback for category URLs that predate canonical category rows.
    const sanitizedCategoryName = scope.categoryName.replace(/[,().]/g, '');
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(
        `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    productIds = ((data || []) as Array<{ id?: string | null }>)
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id));
    productsError = error;
  }

  if (productsError) {
    console.error('Product ID query error:', productsError);
  }

  return {
    productIds,
    productsQueryFailed: Boolean(productsError),
  };
}

/**
 * Direct product detail fetch for an ordered ID slice.
 *
 * This is deliberately local-cached, not remote-cached. Rich category-card
 * payloads include descriptions, images, and key specs, so writing them to
 * Vercel's remote cache can still trip per-item byte limits. The shared remote
 * ID list carries membership/order; detail rows are bounded by stable ID slices.
 */
async function getCachedCategoryPageProductDetailsChunk({
  categoryIds,
  merchantId,
  productIds,
}: {
  categoryIds?: string[];
  merchantId: string;
  productIds: string[];
}): Promise<CategoryPageProductDetailsResult> {
  'use cache';
  cacheLife('products');
  cacheTag(
    'category-page-data',
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (productIds.length === 0) {
    return {
      missingProductCount: 0,
      productSlots: [],
      productsQueryFailed: false,
    };
  }

  const supabase = getPublicSupabaseClient();
  const isCategoryScoped = Boolean(categoryIds?.length);
  let query = supabase
    .from('products')
    .select(getCategoryPageProductSelect(isCategoryScoped))
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('id', productIds);

  if (isCategoryScoped && categoryIds) {
    query = query.in('product_categories.category_id', categoryIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const productsById = new Map(
    ((data || []) as Array<{ id?: string | null }>).map((product) => [
      product.id,
      product,
    ])
  );

  const productSlots = productIds.map(
    (productId) => productsById.get(productId) ?? null
  );

  return {
    missingProductCount: productSlots.filter((product) => product === null)
      .length,
    productSlots: productSlots.filter(
      (product): product is { id?: string | null } => product !== null
    ),
    productsQueryFailed: false,
  };
}

async function getCategoryPageProductDetailsChunk({
  categoryIds,
  merchantId,
  productIds,
}: {
  categoryIds?: string[];
  merchantId: string;
  productIds: string[];
}): Promise<CategoryPageProductDetailsResult> {
  try {
    return await getCachedCategoryPageProductDetailsChunk({
      categoryIds,
      merchantId,
      productIds,
    });
  } catch (error) {
    console.error('Product detail query error:', error);
    return {
      missingProductCount: 0,
      productSlots: productIds.map(() => null),
      productsQueryFailed: true,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function getCachedCategoryPageProductsUncached({
  merchantId,
  productLimit,
  productOffset,
  scope,
}: {
  merchantId: string;
  productLimit?: number;
  productOffset?: number;
  scope: CachedCategoryPageProductScope;
}): Promise<CachedCategoryPageProductsResult> {
  const idResult = await getCachedCategoryPageProductIds({
    merchantId,
    scope,
  });

  if (idResult.productIds.length === 0) {
    return {
      productIdsQueryFailed: idResult.productsQueryFailed,
      productCount: 0,
      productsArePrePaginated: Boolean(productLimit),
      products: [],
      productSlots: [],
      productsQueryFailed: idResult.productsQueryFailed,
    };
  }

  const productWindow =
    typeof productLimit === 'number' && productLimit > 0
      ? idResult.productIds.slice(
          productOffset ?? 0,
          (productOffset ?? 0) + productLimit
        )
      : idResult.productIds;

  const idChunks = Array.from(
    {
      length: Math.ceil(
        productWindow.length / CATEGORY_PAGE_PRODUCT_DETAIL_CHUNK_SIZE
      ),
    },
    (_, chunkIndex) =>
      productWindow.slice(
        chunkIndex * CATEGORY_PAGE_PRODUCT_DETAIL_CHUNK_SIZE,
        (chunkIndex + 1) * CATEGORY_PAGE_PRODUCT_DETAIL_CHUNK_SIZE
      )
  );
  const detailChunks = await mapWithConcurrency(
    idChunks,
    CATEGORY_PAGE_PRODUCT_DETAIL_CONCURRENCY,
    (productIds) =>
      getCategoryPageProductDetailsChunk({
        categoryIds: scope.kind === 'category' ? scope.categoryIds : undefined,
        merchantId,
        productIds,
      })
  );
  const productSlots = detailChunks.flatMap((chunk) => chunk.productSlots);
  const missingProductCount = detailChunks.reduce(
    (count, chunk) => count + chunk.missingProductCount,
    0
  );

  return {
    productIdsQueryFailed: idResult.productsQueryFailed,
    productCount: Math.max(0, idResult.productIds.length - missingProductCount),
    productsArePrePaginated: Boolean(productLimit),
    products: productSlots.filter(
      (product): product is unknown => product !== null
    ),
    productSlots,
    productsQueryFailed:
      idResult.productsQueryFailed ||
      detailChunks.some((chunk) => chunk.productsQueryFailed),
  };
}

const getCachedCategoryPageProducts = cache(
  (
    merchantId: string,
    scope: CachedCategoryPageProductScope,
    productOffset?: number,
    productLimit?: number
  ) =>
    getCachedCategoryPageProductsUncached({
      merchantId,
      productLimit,
      productOffset,
      scope,
    })
);

/**
 * Cache-friendly data fetcher for Category/Collection pages.
 * The unbounded aggregate wrapper itself is intentionally not remote-cached.
 * Instead, its shell and product chunks are cached remotely as bounded records
 * so category/product revalidation stays shared across Vercel instances without
 * putting the entire product array into one 2 MB-limited cache item.
 */
export async function getCachedCategoryPageData(
  merchantId: string,
  categorySlug: string,
  storeSlug: string,
  productOffset?: number,
  productLimit?: number
): Promise<CachedCategoryPageData> {
  const shell = await getCachedCategoryPageShellData(
    merchantId,
    categorySlug,
    storeSlug
  );
  const productResult = await getCachedCategoryPageProducts(
    merchantId,
    shell.productScope,
    productOffset,
    productLimit
  );

  if (shell.isCollection) {
    return {
      isCollection: true,
      name: shell.name,
      description: shell.description,
      fallbackName: shell.fallbackName,
      fallbackDescription: shell.fallbackDescription,
      seo: shell.seo,
      ...(productResult.productIdsQueryFailed
        ? { productIdsQueryFailed: true }
        : {}),
      productCount: productResult.productCount,
      ...(productResult.productsArePrePaginated
        ? { productsArePrePaginated: true }
        : {}),
      products: productResult.products,
      ...(productResult.productSlots.length !== productResult.products.length
        ? { productSlots: productResult.productSlots }
        : {}),
      productsQueryFailed: productResult.productsQueryFailed,
    };
  }

  return {
    isCollection: false,
    category: shell.category,
    fallbackName: shell.fallbackName,
    fallbackDescription: shell.fallbackDescription,
    isInactiveCategory: shell.isInactiveCategory,
    categoryQueryFailed: shell.categoryQueryFailed,
    ...(productResult.productIdsQueryFailed
      ? { productIdsQueryFailed: true }
      : {}),
    productCount: productResult.productCount,
    ...(productResult.productsArePrePaginated
      ? { productsArePrePaginated: true }
      : {}),
    products: productResult.products,
    ...(productResult.productSlots.length !== productResult.products.length
      ? { productSlots: productResult.productSlots }
      : {}),
    productsQueryFailed: productResult.productsQueryFailed,
  };
}

/**
 * Cached product reviews.
 * Uses 'products' cacheLife profile (stale 5min, revalidate 5min, expire 24hr)
 */
export async function getCachedProductReviews(
  productId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  'use cache';
  cacheLife('products');
  cacheTag('reviews', `reviews-${productId}`);

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('product_reviews')
    .select(`
        id,
        rating,
        review_title:title,
        review_text:body,
        reviewer_name:customer_name,
        is_verified_purchase:verified_purchase,
        helpful_count,
        created_at,
        merchant_response,
        response_at:merchant_response_at
      `)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 10) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }

  return data || [];
}

/**
 * Cached product rating stats.
 * Uses 'products' cacheLife profile (stale 5min, revalidate 5min, expire 24hr)
 */
export async function getCachedProductRatingStats(productId: string) {
  'use cache';
  cacheLife('products');
  cacheTag('reviews', `rating-stats-${productId}`);

  const supabase = getPublicSupabaseClient();

  const { data, error } = await supabase
    .from('product_reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('status', 'approved');

  if (error || !data || data.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const totalReviews = data.length;
  const sumRatings = data.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = sumRatings / totalReviews;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data.forEach((r) => {
    const rating = r.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating]++;
    }
  });

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    distribution,
  };
}

/**
 * Create a Supabase client with Service Role key for secure operations.
 * SERVER-SIDE ONLY. Never use on client.
 */
function getServiceSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey(); // Throws if on client or missing

  return createSupabaseClient(url, key, {
    global: {
      // This client previously had NO transport bound at all — and it sits
      // inside the hot merchant shell path via getCachedFeatureSettings.
      fetch: createTimeoutComposedFetch(CACHED_CLIENT_DEFAULT_TIMEOUT_MS),
    },
  });
}

/**
 * Cached dashboard stats (Revenue, Orders, etc.)
 * Uses 'merchant' cacheLife profile (revalidate 60s)
 */
export async function getCachedDashboardStats(merchantId: string) {
  'use cache: remote';
  cacheLife('merchant');
  cacheTag('dashboard', `dashboard-${merchantId}`);

  const supabase = getServiceSupabaseClient();

  const { data: stats, error } = await supabase.rpc(
    'get_sales_dashboard_stats',
    { p_merchant_id: merchantId }
  );

  if (error) {
    console.error('Error fetching cached dashboard stats:', error);
    return null;
  }

  return stats;
}

/**
 * Cached platform analytics (Admin).
 * Uses 'products' cacheLife profile (revalidate 5min)
 */
export async function getCachedPlatformAnalytics(
  startDate: string,
  endDate: string
) {
  'use cache: remote';
  cacheLife('products');
  cacheTag('analytics');

  const supabase = getServiceSupabaseClient();

  const { data: summaryData, error: summaryError } = await supabase.rpc(
    'get_platform_analytics_summary',
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (summaryError) {
    console.error('Error fetching cached platform analytics:', summaryError);
    return null;
  }

  return summaryData;
}

/**
 * Cached merchant feature settings.
 * Uses a server-only service-role query with an explicit public-safe column allowlist because
 * this table also stores private integration credentials.
 * Uses local Cache Components caching to avoid Vercel RemoteCacheHandler failures
 * on the hot storefront merchant shell path.
 */
export async function getCachedFeatureSettings(
  merchantId: string
): Promise<MerchantFeatureSettings | null> {
  'use cache';
  cacheLife('products');
  cacheTag(`features-${merchantId}`);

  try {
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from('merchant_feature_settings')
      .select(MERCHANT_PUBLIC_FEATURE_SETTINGS_SELECT)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) {
      // Transient DB failure — throw so the cache does not persist the error state.
      throw error;
    }

    if (!data) {
      return merchantFeatureSettingsDefaults.buildPublicDefault(
        merchantId
      ) as MerchantFeatureSettings;
    }

    return data as unknown as MerchantFeatureSettings;
  } catch (error) {
    console.error('Error fetching feature settings:', error);
    // Rethrow so Cache Components skips caching this failure.
    throw error;
  }
}

/**
 * Cached blog post with related posts.
 * Keep public blog metadata/content in the local Cache Components cache.
 * Live Vercel logs showed RemoteCacheHandler errors for post-specific keys,
 * and official Next guidance reserves remote cache for cases where the
 * network lookup/infrastructure cost is justified.
 */
export async function getCachedBlogPost(
  identifier: string,
  postSlug: string,
  includeDrafts: boolean = false
) {
  'use cache';
  cacheLife('blog');
  cacheTag('blog-posts', getBlogCacheTag(identifier, postSlug));

  const lookupKey = identifier.toLowerCase();
  const merchant = await getMerchantStrict(lookupKey);

  if (!merchant) return null;

  cacheTag('products', `products-${merchant.id}`);

  // Check if blog is enabled
  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  // Fetch Post
  let query = supabase
    .from('blog_posts')
    .select(STOREFRONT_BLOG_POST_SELECT)
    .eq('merchant_id', merchant.id)
    .eq('slug', postSlug.toLowerCase());

  if (!includeDrafts) {
    query = query.eq('status', 'published').not('published_at', 'is', null);
  }

  const { data: post, error: postError } = await query.single();

  if (postError || !post) {
    if (postError && postError.code !== 'PGRST116') {
      console.error('Error fetching blog post:', postError);
    }
    return null;
  }
  if (!includeDrafts && !isPublicBlogPost(post)) {
    return null;
  }

  // Fetch Related Posts. Over-fetch bounded public candidate sets and rank
  // server-side by semantic overlap instead of category-only filtering.
  const buildRelatedPostsQuery = () => {
    let relatedQuery = supabase
      .from('blog_posts')
      .select(RELATED_BLOG_POST_SELECT)
      .eq('merchant_id', merchant.id)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('title', 'is', null)
      .not('slug', 'is', null)
      .neq('title', '')
      .neq('slug', '')
      .neq('id', post.id)
      .order('published_at', { ascending: false });

    relatedQuery = applyPublicBlogSqlFilters(relatedQuery);

    return relatedQuery;
  };

  const recentRelatedPostsPromise = buildRelatedPostsQuery().limit(
    RELATED_BLOG_POSTS_FETCH_LIMIT
  );
  const sourceBlogCategory =
    typeof post.category === 'string' ? post.category.trim() : '';
  const categoryRelatedPostsPromise = sourceBlogCategory
    ? buildRelatedPostsQuery()
        .eq('category', sourceBlogCategory)
        .limit(RELATED_BLOG_CATEGORY_FETCH_LIMIT)
    : Promise.resolve({ data: null, error: null });

  const [
    { data: recentRelatedPosts, error: relatedPostsError },
    { data: categoryRelatedPosts, error: categoryRelatedPostsError },
    { data: linkedProducts, error: linkedProductsError },
  ] = await Promise.all([
    recentRelatedPostsPromise,
    categoryRelatedPostsPromise,
    supabase
      .from('blog_post_products')
      .select(RELATED_BLOG_PRODUCT_LINKS_SELECT)
      .eq('merchant_id', merchant.id)
      .eq('blog_post_id', post.id)
      .order('created_at', { ascending: true }),
  ]);

  if (relatedPostsError) {
    console.error('Error fetching related blog posts:', relatedPostsError);
  }

  if (categoryRelatedPostsError) {
    console.error(
      'Error fetching category related blog posts:',
      categoryRelatedPostsError
    );
  }

  const relatedPostCandidates = combineUniqueRelatedBlogPosts(
    relatedPostsError ? [] : recentRelatedPosts,
    categoryRelatedPostsError ? [] : categoryRelatedPosts
  );

  if (linkedProductsError) {
    console.error('Error fetching linked blog products:', linkedProductsError);
  }

  let normalizedRelatedProducts = linkedProductsError
    ? []
    : normalizeRelatedBlogProductLinks(linkedProducts).slice(0, 8);

  const normalizedCategorySlug = normalizeStorefrontCategoryValue(
    post.category
  );

  if (normalizedRelatedProducts.length === 0 && normalizedCategorySlug) {
    const { data: relatedProducts, error: relatedProductsError } =
      await supabase
        .from('products')
        .select(RELATED_BLOG_PRODUCTS_SELECT)
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .eq('categories.slug', normalizedCategorySlug)
        .order('updated_at', { ascending: false })
        .limit(6);

    if (relatedProductsError) {
      console.error(
        'Error fetching related blog products:',
        relatedProductsError
      );
    }

    normalizedRelatedProducts = relatedProductsError
      ? []
      : normalizeRelatedBlogProducts(relatedProducts);
  }

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
      custom_domain: merchant.custom_domain,
      country: merchant.country,
      social_media: merchant.social_media,
    },
    post,
    relatedPosts: selectSemanticRelatedBlogPosts(
      post,
      filterPublicBlogPosts(relatedPostCandidates),
      RELATED_BLOG_POSTS_LIMIT
    ),
    relatedProducts: normalizedRelatedProducts,
  };
}

/**
 * Cached blog listing data for storefront markdown mirrors and list pages.
 * Keep public blog listing data in the local Cache Components cache; the key
 * cardinality is storefront/category/page/search-specific, and remote cache
 * lookups have produced production handler errors on adjacent blog routes.
 */
export async function getCachedBlogListing(
  identifier: string,
  options?: {
    category?: string;
    page?: number;
    searchQuery?: string;
  }
) {
  'use cache';
  const category = options?.category;
  const page = options?.page || 1;
  const searchQuery = options?.searchQuery;
  // A `'use cache'` function takes a single static cache profile, so the
  // listing stays on the short `merchant` profile: it takes user-supplied
  // search/category args, and keeping it short avoids retaining unbounded
  // one-off filter permutations. The high-cost blog POST renders are what move
  // to the long-lived `blog` profile (see getCachedBlogPost).
  cacheLife('merchant');
  cacheTag(
    'blog-posts',
    `blog-list-${identifier.toLowerCase()}-${category || 'all'}-${page}`
  );

  const limit = BLOG_LISTING_PAGE_SIZE;
  const offset = (page - 1) * limit;
  const lookupKey = identifier.toLowerCase();
  const merchant = await getMerchantStrict(lookupKey);

  if (!merchant) return null;

  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, featured_image_variants, category, tags, author_name, published_at, reading_time_minutes, view_count',
      PUBLIC_BLOG_COUNT_OPTIONS
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .order('published_at', { ascending: false });

  query = applyPublicBlogSqlFilters(query);

  if (category) {
    query = query.eq('category', category);
  }

  if (searchQuery) {
    const sanitizedSearch = searchQuery.trim().slice(0, 100);

    if (sanitizedSearch) {
      query = query.textSearch('search_vector', sanitizedSearch, {
        type: 'websearch',
        config: 'english',
      });
    }
  }

  query = query.range(offset, offset + limit - 1);

  const { data: posts, count, error: postsError } = await query;
  if (postsError) {
    console.error('Failed to load blog posts', {
      merchantId: merchant.id,
      error: postsError,
    });
    throw postsError;
  }

  let categoriesQuery = supabase
    .from('blog_posts')
    .select('category')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .not('category', 'is', null);

  categoriesQuery = applyPublicBlogSqlFilters(categoriesQuery, {
    includeCategoryFilters: true,
  });

  const { data: categories, error: categoriesError } = await categoriesQuery;
  if (categoriesError) {
    console.warn('Failed to load blog categories', {
      merchantId: merchant.id,
      error: categoriesError,
    });
  }

  const uniqueCategories = categoriesError
    ? []
    : [...new Set(categories?.map((entry) => entry.category).filter(Boolean))];
  const publicPosts = filterPublicBlogPosts(posts || []);
  const publicCategories = filterPublicBlogCategories(uniqueCategories);

  const totalPosts = getEstimatedPaginationCountFloor({
    count,
    itemCount: publicPosts.length,
    limit,
    page,
  });

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
      template_id: merchant.template_id,
      custom_domain: merchant.custom_domain,
      country: merchant.country,
      social_media: merchant.social_media,
    },
    posts: publicPosts,
    totalPosts,
    categories: publicCategories,
    currentPage: page,
    totalPages: Math.ceil(totalPosts / limit),
    searchQuery,
  };
}

/**
 * Cached published posts + denormalized identity for a single blog author,
 * matched by generated author slug. Powers the `/blog/author/<slug>` pages. The
 * author's title/bio/headshot are read from the most recent post (they are
 * denormalized identically across an author's posts); `sameAs` is supplied
 * separately from the in-code author registry.
 */
export async function getCachedBlogAuthor(
  identifier: string,
  authorName: string,
  options?: { page?: number }
) {
  'use cache';
  const requestedPage = options?.page ?? 1;
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const authorSlug = generateSlug(authorName);
  if (!authorSlug) return null;
  cacheLife('merchant');
  cacheTag(
    'blog-posts',
    `blog-author-${identifier.toLowerCase()}-${authorSlug}-${page}`
  );

  const limit = BLOG_LISTING_PAGE_SIZE;
  const offset = (page - 1) * limit;
  const merchant = await getMerchantStrict(identifier.toLowerCase());
  if (!merchant) return null;

  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, author_name, author_title, author_bio, author_image_url, published_at, reading_time_minutes',
      PUBLIC_BLOG_COUNT_OPTIONS
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .eq('author_name', authorName)
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .order('published_at', { ascending: false });

  query = applyPublicBlogSqlFilters(query);
  query = query.range(offset, offset + limit - 1);

  const { data: posts, count, error: postsError } = await query;
  if (postsError) {
    console.error('Failed to load blog author posts', {
      merchantId: merchant.id,
      authorName,
      error: postsError,
    });
    throw postsError;
  }

  const publicPosts = filterPublicBlogPosts(posts || []);
  const totalCount = getEstimatedPaginationCountFloor({
    count,
    itemCount: publicPosts.length,
    limit,
    page,
  });
  // No public posts anywhere for this author -> genuine missing author (404).
  if (totalCount === 0) {
    return null;
  }
  // `identity` is absent only on an out-of-range page (count > 0 but this
  // ranged window is empty); the route redirects those stale paginated URLs to
  // the last valid page rather than 404ing a real author.
  const identity = publicPosts[0];

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
      custom_domain: merchant.custom_domain,
    },
    author: {
      name: authorName,
      title: identity?.author_title ?? null,
      bio: identity?.author_bio ?? null,
      imageUrl: identity?.author_image_url ?? null,
    },
    posts: publicPosts,
    totalPosts: totalCount,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

export interface StorefrontHomeProductDirectCategoryRecord {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parent_id?: string | null;
}

interface StorefrontHomeProductCategoryJoinRecord {
  categories?:
    | StorefrontHomeProductDirectCategoryRecord
    | StorefrontHomeProductDirectCategoryRecord[]
    | null;
}

export interface StorefrontHomeProduct {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  price?: number | string | null;
  compare_at_price?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  images?: unknown[] | null;
  category?: string | null;
  brand?: string | null;
  condition?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  manage_stock?: boolean | null;
  low_stock_threshold?: number | null;
  categories?:
    | StorefrontHomeProductDirectCategoryRecord
    | StorefrontHomeProductDirectCategoryRecord[]
    | null;
  product_categories?: StorefrontHomeProductCategoryJoinRecord[] | null;
}

interface StorefrontHomeProductRecencyCandidate {
  id?: string | null;
  categories?:
    | StorefrontHomeProductDirectCategoryRecord
    | StorefrontHomeProductDirectCategoryRecord[]
    | null;
  price?: number | string | null;
  updated_at?: string | null;
}

interface StorefrontHomeProductsQuery
  extends PromiseLike<{
    data: StorefrontHomeProduct[] | null;
    error: unknown;
  }> {
  eq(column: string, value: unknown): StorefrontHomeProductsQuery;
  in(column: string, values: readonly string[]): StorefrontHomeProductsQuery;
  limit(count: number): StorefrontHomeProductsQuery;
  not(
    column: string,
    operator: string,
    value: unknown
  ): StorefrontHomeProductsQuery;
  or(
    filters: string,
    options?: { referencedTable?: string }
  ): StorefrontHomeProductsQuery;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): StorefrontHomeProductsQuery;
}

interface StorefrontHomeProductsTable {
  select(columns: string): StorefrontHomeProductsQuery;
}

function storefrontHomeProductsTable(
  supabase: SupabaseClient
): StorefrontHomeProductsTable {
  // Keep the runtime Supabase query builder while avoiding type-level parsing of
  // several large nested select strings on every web typecheck. Result shape is
  // still explicitly represented by StorefrontHomeProduct above and covered by
  // the home-product adapter/query tests.
  return supabase.from('products') as unknown as StorefrontHomeProductsTable;
}

const HOME_HANDSET_CATEGORY_KEYWORDS = ['smartphone', 'mobile', 'phone'];
const HOME_HANDSET_EXCLUDED_CATEGORY_TERMS = [
  'headphone',
  'earphone',
  'microphone',
  'case',
  'charger',
  'cable',
  'cover',
  'protector',
  'accessor',
];

function getHomeProductRecencyTime(
  product: StorefrontHomeProductRecencyCandidate
): number {
  if (!product.updated_at) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(product.updated_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function getHomeProductPrice(
  product: StorefrontHomeProductRecencyCandidate
): number {
  const price = Number(product.price ?? 0);
  return Number.isFinite(price) ? price : 0;
}

function compareHomeProductRecency<
  T extends StorefrontHomeProductRecencyCandidate,
>(first: T, second: T): number {
  const firstUpdatedAt = getHomeProductRecencyTime(first);
  const secondUpdatedAt = getHomeProductRecencyTime(second);

  if (firstUpdatedAt !== secondUpdatedAt) {
    if (firstUpdatedAt === Number.NEGATIVE_INFINITY) return 1;
    if (secondUpdatedAt === Number.NEGATIVE_INFINITY) return -1;
    return secondUpdatedAt - firstUpdatedAt;
  }

  return getHomeProductPrice(second) - getHomeProductPrice(first);
}

function getHomeProductDirectCategories(
  product: StorefrontHomeProductRecencyCandidate
): StorefrontHomeProductDirectCategoryRecord[] {
  const directCategories = product.categories;
  if (!directCategories) {
    return [];
  }

  return (
    Array.isArray(directCategories) ? directCategories : [directCategories]
  ).filter(
    (category): category is StorefrontHomeProductDirectCategoryRecord =>
      !!category && typeof category === 'object'
  );
}

function homeCategoryMatchesHandset(
  category: StorefrontHomeProductDirectCategoryRecord
): boolean {
  const candidates = [category.name, category.slug].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0
  );

  return candidates.some((candidate) => {
    const normalized = candidate.toLowerCase().trim();
    return (
      HOME_HANDSET_CATEGORY_KEYWORDS.some((keyword) =>
        normalized.includes(keyword)
      ) &&
      !HOME_HANDSET_EXCLUDED_CATEGORY_TERMS.some((term) =>
        normalized.includes(term)
      )
    );
  });
}

function allowsRelationBackedHomePhonePriority(
  product: StorefrontHomeProductRecencyCandidate
): boolean {
  const directCategories = getHomeProductDirectCategories(product);
  return (
    directCategories.length === 0 ||
    directCategories.some(homeCategoryMatchesHandset)
  );
}

/**
 * Ordering strategy for the storefront home product grid.
 * - 'price': highest price first (default for all storefronts).
 * - 'recent': most recently updated first (opt-in, e.g. OgaBassey).
 */
export type StorefrontHomeProductSort = 'price' | 'recent';

const STOREFRONT_HOME_PRODUCT_LIMIT = 50;
const STOREFRONT_HOME_PRIORITY_PRODUCT_LIMIT = 24;
const STOREFRONT_HOME_PRODUCT_SELECT = `
    id, name, slug, description, price, compare_at_price, created_at,
    images, category, brand, condition, stock, stock_quantity,
    manage_stock, low_stock_threshold,
    product_categories(categories(name, slug))
  `;
const STOREFRONT_HOME_PRODUCT_RECENT_SELECT = `
    id, name, slug, description, price, compare_at_price, created_at, updated_at,
    images, category, brand, condition, stock, stock_quantity,
    manage_stock, low_stock_threshold,
    categories:category_id(id, name, slug, parent_id),
    product_categories(categories(name, slug))
  `;
const STOREFRONT_HOME_PRODUCT_DIRECT_CATEGORY_SELECT = `
    id, name, slug, description, price, compare_at_price, created_at, updated_at,
    images, category, brand, condition, stock, stock_quantity,
    manage_stock, low_stock_threshold,
    categories:category_id!inner(id, name, slug, parent_id),
    product_categories(categories(name, slug))
  `;
const STOREFRONT_HOME_PRODUCT_RELATION_CATEGORY_SELECT = `
    id, name, slug, description, price, compare_at_price, created_at, updated_at,
    images, category, brand, condition, stock, stock_quantity,
    manage_stock, low_stock_threshold,
    categories:category_id(id, name, slug, parent_id),
    product_categories!inner(categories!inner(name, slug))
  `;

/**
 * Remote-cached launch-carousel candidate window ordered by creation time, not
 * edits. OgaBassey uses this for the product-driven hero so an old product
 * update can never eject a genuinely new launch before the carousel pin/cap
 * logic runs, while product mutations stay shared across Vercel instances.
 */
export async function getCachedStorefrontLaunchProducts(
  merchantId: string
): Promise<StorefrontHomeProduct[]> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'products',
    `products-${merchantId}`,
    `products-launch-${merchantId}-created`
  );

  const supabase = getPublicSupabaseClient();
  const productsTable = storefrontHomeProductsTable(supabase);
  const { data, error } = await productsTable
    .select(STOREFRONT_HOME_PRODUCT_RECENT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('price', { ascending: false })
    .limit(STOREFRONT_HOME_PRODUCT_LIMIT);

  if (error) {
    console.error('Failed to load storefront launch products', {
      merchantId,
      error,
    });
    throw error;
  }

  return hydrateAndSanitizeProducts(supabase, merchantId, data ?? []);
}

/**
 * Remote-cached storefront homepage products.
 * Uses the products cacheLife profile plus shared and sort-specific product
 * tags so revalidateProducts() can bust every home-product ordering across
 * Vercel instances.
 */
export async function getCachedStorefrontHomeProducts(
  merchantId: string,
  sort: StorefrontHomeProductSort = 'price'
): Promise<StorefrontHomeProduct[]> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'products',
    `products-${merchantId}`,
    `products-home-${merchantId}-${sort}`
  );

  const supabase = getPublicSupabaseClient();
  const productsTable = storefrontHomeProductsTable(supabase);
  const buildHandsetCategoryClause = (
    column: 'name' | 'slug',
    keyword: string
  ) =>
    [
      `${column}.ilike.%${keyword}%`,
      ...HOME_HANDSET_EXCLUDED_CATEGORY_TERMS.map(
        (term) => `${column}.not.ilike.%${term}%`
      ),
    ].join(',');
  const handsetCategoryClauses = HOME_HANDSET_CATEGORY_KEYWORDS.flatMap(
    (keyword) => [
      `and(${buildHandsetCategoryClause('name', keyword)})`,
      `and(${buildHandsetCategoryClause('slug', keyword)})`,
    ]
  ).join(',');

  // 'recent' surfaces the most recently updated devices first. `updated_at` is
  // trigger-maintained on every row update, with price as a stable tiebreaker.
  // It fetches phone candidates separately before the general recent window so
  // the downstream phone-first homepage slice cannot lose older smartphones to
  // the database LIMIT.
  if (sort === 'recent') {
    let phoneCandidatesQuery = productsTable
      .select(STOREFRONT_HOME_PRODUCT_RECENT_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(
        'category.ilike.%smartphone%,category.ilike.%mobile%,category.ilike.%phone%'
      );
    for (const excludedTerm of HOME_HANDSET_EXCLUDED_CATEGORY_TERMS) {
      phoneCandidatesQuery = phoneCandidatesQuery.not(
        'category',
        'ilike',
        `%${excludedTerm}%`
      );
    }
    phoneCandidatesQuery = phoneCandidatesQuery
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('price', { ascending: false })
      .limit(STOREFRONT_HOME_PRIORITY_PRODUCT_LIMIT);

    const directCategoryPhoneCandidatesQuery = productsTable
      .select(STOREFRONT_HOME_PRODUCT_DIRECT_CATEGORY_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(handsetCategoryClauses, { referencedTable: 'categories' })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('price', { ascending: false })
      .limit(STOREFRONT_HOME_PRIORITY_PRODUCT_LIMIT);

    const relationPhoneCandidatesQuery = productsTable
      .select(STOREFRONT_HOME_PRODUCT_RELATION_CATEGORY_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(handsetCategoryClauses, {
        referencedTable: 'product_categories.categories',
      })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('price', { ascending: false })
      .limit(STOREFRONT_HOME_PRIORITY_PRODUCT_LIMIT);

    const recentProductsQuery = productsTable
      .select(STOREFRONT_HOME_PRODUCT_RECENT_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('price', { ascending: false })
      .limit(STOREFRONT_HOME_PRODUCT_LIMIT);

    // Keep these awaits sequential instead of Promise.all: a cold shared-cache
    // miss should not spend four PostgREST/Postgres connections at once for
    // one homepage request.
    const { data: phoneCandidates, error: phoneCandidatesError } =
      await phoneCandidatesQuery;
    if (phoneCandidatesError) {
      console.error('Failed to load storefront home products', {
        merchantId,
        error: phoneCandidatesError,
      });
      throw phoneCandidatesError;
    }

    const {
      data: directCategoryPhoneCandidates,
      error: directCategoryPhoneCandidatesError,
    } = await directCategoryPhoneCandidatesQuery;
    if (directCategoryPhoneCandidatesError) {
      console.error('Failed to load storefront home products', {
        merchantId,
        error: directCategoryPhoneCandidatesError,
      });
      throw directCategoryPhoneCandidatesError;
    }

    const {
      data: relationPhoneCandidates,
      error: relationPhoneCandidatesError,
    } = await relationPhoneCandidatesQuery;
    if (relationPhoneCandidatesError) {
      console.error('Failed to load storefront home products', {
        merchantId,
        error: relationPhoneCandidatesError,
      });
      throw relationPhoneCandidatesError;
    }

    const { data: recentProducts, error: recentProductsError } =
      await recentProductsQuery;
    if (recentProductsError) {
      console.error('Failed to load storefront home products', {
        merchantId,
        error: recentProductsError,
      });
      throw recentProductsError;
    }

    const scopedRelationPhoneCandidates = (
      relationPhoneCandidates ?? []
    ).filter(allowsRelationBackedHomePhonePriority);
    const phonePriorityProducts = [
      ...(phoneCandidates ?? []),
      ...(directCategoryPhoneCandidates ?? []),
      ...scopedRelationPhoneCandidates,
    ].sort(compareHomeProductRecency);
    const seenProductIds = new Set<string>();
    const combinedProducts = [
      ...phonePriorityProducts,
      ...(recentProducts ?? []),
    ]
      .filter((product) => {
        if (!product?.id || seenProductIds.has(product.id)) {
          return false;
        }
        seenProductIds.add(product.id);
        return true;
      })
      .slice(0, STOREFRONT_HOME_PRODUCT_LIMIT);

    return hydrateAndSanitizeProducts(supabase, merchantId, combinedProducts);
  }

  // 'price' (the default for all other storefronts) keeps the original
  // highest-price-first ordering.
  const { data, error } = await productsTable
    .select(STOREFRONT_HOME_PRODUCT_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(STOREFRONT_HOME_PRODUCT_LIMIT);

  if (error) {
    console.error('Failed to load storefront home products', {
      merchantId,
      error,
    });
    throw error;
  }

  return hydrateAndSanitizeProducts(supabase, merchantId, data ?? []);
}
