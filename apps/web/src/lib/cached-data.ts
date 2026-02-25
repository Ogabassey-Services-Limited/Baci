import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from '@/env';

/**
 * Create a Supabase client for cached queries.
 * This client doesn't use cookies, so it's suitable for caching.
 * Only use for public/read-only data that doesn't require authentication.
 */
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
    global: {
      headers: {
        'X-Client-Info': 'baci-web-cached',
      },
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
      },
    },
  });
}

/**
 * Create a Supabase client with Service Role for privileged cached queries.
 * Bypasses RLS to ensure we can fetch unpublished merchants for "Coming Soon" pages.
 */
function getServiceRoleSupabaseClient() {
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
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
      },
    },
  });
}

// Type for merchant data with optional custom_domain
export interface HeroSlide {
  id: string;
  imageUrl: string;
  headline: string;
  description: string;
  cta: string;
}

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
  payout_currency: string;
  is_published: boolean;
  template_id: string;
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
  // biome-ignore lint/suspicious/noExplicitAny: Supabase returns dynamic JSON types
  feature_settings?: any;
  // Legacy content pages (JSONB — used by contact, terms, privacy, faq, about pages)
  pages?: {
    contact?: string;
    terms?: string;
    privacy?: string;
    faq?: string;
    about?: string;
  };
  // Structured about page data
  // biome-ignore lint/suspicious/noExplicitAny: Supabase returns dynamic JSON types
  about_page?: any;
  // FAQ items array
  faq_items?: unknown[];
  // Last update timestamp
  updated_at?: string;
}

/**
 * Cached merchant data by slug
 * Uses 'merchant' cacheLife profile (stale 5min, revalidate 60s, expire 1hr)
 */
export async function getCachedMerchant(
  slug: string
): Promise<CachedMerchant | null> {
  'use cache';
  cacheLife('merchant');
  cacheTag('merchants', `merchant-${slug}`);

  const supabase = getServiceRoleSupabaseClient();

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
        is_published,
        template_id,
        plan_tier,
        premium_features,
        country,
        hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url,
        vat_registration_status,
        vat_rate,
        feature_settings:merchant_feature_settings(*),
        pages,
        about_page,
        faq_items,
        updated_at
      `)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    // Sanitize user-controlled slug to prevent log injection
    const safeSlug = String(slug || '')
      .replace(/[\r\n]/g, '')
      .substring(0, 100);
    console.error(
      'Error fetching merchant for slug:',
      safeSlug,
      JSON.stringify(error, null, 2)
    );
    // CRITICAL: Throwing instead of returning null prevents negative caching
    // Next.js will not cache this error, allowing retries or stale data serving.
    throw new Error(`Failed to fetch merchant for slug: ${safeSlug}`);
  }

  if (!data) {
    const safeSlug = String(slug || '')
      .replace(/[\r\n]/g, '')
      .substring(0, 100);
    console.warn('No merchant data found for slug:', safeSlug);
  } else {
    // Normalize feature_settings from array to object (Edge Compatibility Pattern)
    const settings = data.feature_settings;
    data.feature_settings = Array.isArray(settings) ? settings[0] : settings;

    const safeSlug = String(slug || '')
      .replace(/[\r\n]/g, '')
      .substring(0, 100);
    console.log('Successfully fetched merchant:', safeSlug, data.id);
  }

  // Fetch primary domain
  if (data) {
    // SECURITY: If the store is NOT published, mask sensitive contact info.
    if (!data.is_published) {
      data.email = ''; // Redacted
      data.phone = ''; // Redacted
      data.business_address = ''; // Redacted
    }

    const { data: primaryDomain } = await supabase
      .from('domains')
      .select('domain')
      .eq('merchant_id', data.id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .single();

    if (primaryDomain) {
      return { ...data, custom_domain: primaryDomain.domain };
    }
  }

  return data;
}

/**
 * Cached merchant data by custom domain.
 * Normalizes the domain to lowercase before lookup.
 * Uses 'merchant' cacheLife profile (stale 5min, revalidate 60s, expire 1hr)
 */
export async function getCachedMerchantByDomain(
  domain: string
): Promise<CachedMerchant | null> {
  'use cache';
  cacheLife('merchant');
  cacheTag('merchants', 'domains', `domain-${domain.toLowerCase()}`);

  const normalizedDomain = domain.toLowerCase();
  // Use Service Role to allow lookup of unpublished merchants (for "Coming Soon" page)
  const supabase = getServiceRoleSupabaseClient();

  // First, find the merchant_id from the domains table
  const { data: domainData, error: domainError } = await supabase
    .from('domains')
    .select('merchant_id, domain')
    .eq('domain', normalizedDomain)
    .eq('status', 'active')
    .single();

  if (domainError) {
    console.error('Error fetching domain', {
      domain: normalizedDomain,
      error: domainError,
    });
    // Throw on DB error to prevent negative caching
    throw new Error(`Database error fetching domain: ${normalizedDomain}`);
  }

  if (!domainData) {
    console.warn('No domain mapping found for:', normalizedDomain);
    return null;
  }

  // Now fetch the merchant using the merchant_id
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
        is_published,
        template_id,
        plan_tier,
        premium_features,
        country,
        hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url,
        vat_registration_status,
        vat_rate,
        feature_settings:merchant_feature_settings(*),
        pages,
        about_page,
        faq_items,
        updated_at
      `)
    .eq('id', domainData.merchant_id)
    .single();

  if (error) {
    console.error('Error fetching merchant for domain', {
      domain: normalizedDomain,
      error: error,
    });
    throw new Error(`Failed to fetch merchant for domain: ${normalizedDomain}`);
  }

  // Normalize feature_settings from array to object (Edge Compatibility Pattern)
  // biome-ignore lint/suspicious/noExplicitAny: Supabase returns loose types for joined data
  const settings = (data as any).feature_settings; // Type assertion since Supabase types might be loose
  data.feature_settings = Array.isArray(settings) ? settings[0] : settings;

  console.log('Successfully fetched merchant by domain', {
    domain: normalizedDomain,
    slug: data.slug,
    merchantId: data.id,
  });

  // SECURITY: If the store is NOT published, mask sensitive contact info.
  // This allows the "Coming Soon" page to render the business name/logo
  // without leaking the owner's private phone/email/address to the public.
  if (!data.is_published) {
    data.email = ''; // Redacted
    data.phone = ''; // Redacted
    data.business_address = ''; // Redacted
  }

  // Return with the custom_domain set
  return { ...data, custom_domain: domainData.domain };
}

/**
 * Check if a string looks like a domain (contains a dot but isn't a UUID)
 */
function isDomainIdentifier(identifier: string): boolean {
  // UUIDs contain dashes but no dots
  // Domains contain dots
  return identifier.includes('.') && !identifier.includes('-');
}

/**
 * Validate merchant identifier format
 * Prevents injection attacks and invalid lookups
 */
function isValidMerchantIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') return false;
  // Allow slugs (alphanumeric, hyphens) and domains (alphanumeric, dots, hyphens)
  return /^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$/i.test(identifier);
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
  } catch {
    // Retry once on transient failure (e.g., Supabase timeout during cache revalidation)
    try {
      return await getMerchantByIdentifier(identifier);
    } catch {
      const safeId = String(identifier || '')
        .replace(/[\r\n]/g, '')
        .substring(0, 100);
      console.error('Merchant fetch failed after retry:', safeId);
      return null;
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
export async function getCachedMerchantById(merchantId: string) {
  'use cache';
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
        country,
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

  return data;
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
    featured?: boolean;
  }
) {
  'use cache';
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
        base_price,
        sale_price,
        currency,
        status,
        is_featured,
        is_parent,
        quantity,
        track_quantity,
        images,
        color_images,
        brand,
        condition,
        product_variants (
          id,
          name,
          options,
          price_modifier,
          stock,
          storage,
          sim_type,
          color,
          price_override
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
    .eq('status', 'active')
    .or('is_parent.eq.true,parent_product_id.is.null') // Only show parent products or standalone products
    .order('created_at', { ascending: false });

  if (options?.categoryId) {
    query = query.eq('product_categories.category_id', options.categoryId);
  }

  if (options?.featured) {
    query = query.eq('is_featured', true);
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

  return data || [];
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
  cacheTag('product', `product-${merchantId}-${productSlug}`);

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
        base_price,
        sale_price,
        currency,
        status,
        is_featured,
        quantity,
        track_quantity,
        images,
        color_images,
        created_at,
        product_key_specs,
        specifications,
        condition,
        has_condition_offers,
        offers:product_offers (
          id,
          condition,
          price,
          stock_quantity,
          images
        ),
        product_variants (
          id,
          sku,
          attributes,
          price_override,
          stock_quantity,
          storage,
          sim_type,
          color,
          images,
          primary_image,
          ram_gb,
          condition
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

  const { data, error } = await query.single();

  if (error) {
    console.error('Error fetching product:', error);
    return null;
  }

  return data;
}

/**
 * Comprehensive cached product data with all relations for product pages.
 * Fetches product + key_specs + variants + offers + category in a single query.
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
    `product-${merchantId}-${productSlug}`
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
        *,
        category_id,
        categories:category_id(id, name, slug, parent_id),
        product_key_specs (
          screen_size_inches,
          refresh_rate_hz,
          chipset,
          ram_gb,
          storage_gb,
          main_camera_mp,
          battery_mah,
          charging_watt,
          has_5g,
          android_version,
          network_technology,
          sim_type,
          has_nfc,
          wifi_bands,
          bluetooth_version,
          usb_type,
          has_usb_otg,
          positioning,
          has_fm_radio,
          dimensions_mm,
          weight_g,
          build_materials,
          ip_rating,
          display_type,
          display_resolution,
          display_ppi,
          display_protection,
          display_peak_brightness,
          front_camera_mp,
          front_camera_features,
          front_camera_video,
          rear_camera_features,
          rear_camera_video,
          has_dual_camera,
          has_triple_camera,
          has_quad_camera,
          has_stereo_speakers,
          has_headphone_jack,
          fingerprint_type,
          sensors,
          battery_removable,
          has_wireless_charging,
          wireless_charging_watt,
          has_reverse_charging,
          cpu_cores,
          gpu,
          has_card_slot,
          card_slot_type,
          available_colors,
          model_numbers,
          announced_date,
          release_date
        ),
        product_variants (
          id,
          sku,
          attributes,
          price_override,
          stock_quantity,
          storage,
          sim_type,
          color,
          images,
          primary_image,
          ram_gb,
          condition
        ),
        product_offers (
          id,
          condition,
          price,
          compare_at_price,
          stock_quantity,
          images,
          condition_notes,
          grade,
          status
        )
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

  return data;
}

/**
 * Cached categories for a merchant.
 * Uses 'categories' cacheLife profile (stale 5min, revalidate 1hr, expire 24hr)
 */
export async function getCachedCategories(merchantId: string) {
  'use cache';
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
  'use cache';
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
  'use cache';
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

/**
 * Cache-friendly data fetcher for Category/Collection pages.
 * Consolidates multiple DB queries into a single cached operation.
 * Uses 'storefront-page' cacheLife profile (stale 1min, revalidate 5min, expire 1hr)
 */
export async function getCachedCategoryPageData(
  merchantId: string,
  categorySlug: string,
  _storeSlug: string
) {
  'use cache';
  cacheLife('storefront-page');
  cacheTag('category-page-data', 'products', 'categories');

  // Added storeSlug for logic if needed
  // Use public client (no cookies)
  const supabase = getPublicSupabaseClient();

  // 1. Get Merchant (Optimization: We already have merchantId, but we need the object for consistency if the caller needs it)
  // Actually, the caller usually has the merchant. But let's fetch it if we want to be self-contained.
  // However, to keep it efficient, we'll assume the caller passes the ID.
  // ... logic ...

  // 2. Special Collection Handling (Smart Collections)
  const SPECIAL_COLLECTIONS = [
    'new-arrivals',
    'best-sellers',
    'on-sale',
    'featured',
  ];

  if (SPECIAL_COLLECTIONS.includes(categorySlug)) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .limit(50);

    let collectionName = 'Collection';
    let collectionDesc = 'Browse our collection.';

    // Apply specific logic based on collection type
    switch (categorySlug) {
      case 'new-arrivals':
        collectionName = 'New Arrivals';
        collectionDesc = 'Check out the latest additions to our store.';
        query = query.order('created_at', { ascending: false });
        break;
      case 'best-sellers':
        collectionName = 'Best Sellers';
        collectionDesc = 'Our most popular products loved by customers.';
        // robust fallback: sort by rating desc
        query = query.order('rating', { ascending: false });
        break;
      case 'on-sale':
        collectionName = 'On Sale';
        collectionDesc = 'Great deals and discounts on top products.';
        // Filter for products with a compare_at_price set
        query = query.not('compare_at_price', 'is', null);
        break;
      case 'featured':
        collectionName = 'Featured';
        collectionDesc = 'Hand-picked highlights just for you.';
        // For now, sort by price desc as a proxy for "premium/featured"
        query = query.order('price', { ascending: false });
        break;
    }

    const { data: productsData, error: productsError } = await query;

    if (productsError) {
      console.error('Smart Collection Error:', productsError);
    }

    return {
      isCollection: true,
      name: collectionName,
      description: collectionDesc,
      products: productsData || [],
      seo: {
        heading: collectionName,
        description: collectionDesc,
        features: [],
        faqs: [],
      },
    };
  }

  // 3. Try to find category by slug
  const { data: category } = await supabase
    .from('categories')
    .select(
      'id, name, slug, description, image_url, seo_heading, seo_description, seo_features, seo_faq, parent:parent_id(name, slug)'
    )
    .eq('merchant_id', merchantId)
    .eq('slug', categorySlug)
    .single();

  // Fallback: decode the slug to get category name and Title Case it
  const categoryName =
    category?.name ||
    decodeURIComponent(categorySlug)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

  const categoryDescription =
    category?.description ||
    `Browse our collection of ${categoryName} products.`;

  // Note: We need CATEGORY_SEO_DEFAULTS here.
  // Since this file is in lib, we need to import it.
  // I will add the import in a separate edit or assume it's available.
  // For now, I'll return the raw data and let the page handle SEO defaults merging if possible,
  // or better, handle it here to ensure it's cached.

  // I'll skip the import for now and handle "effectiveConfig" logic in the function if I can,
  // or just return the category object and let the page do the merging.
  // BUT the goal is to cache the RESULT.

  // Let's keep it simple: Return the category object + products.

  // 4. Get products
  // biome-ignore lint/suspicious/noExplicitAny: Supabase returns dynamic types
  let products: any[] = [];
  let productsError = null;

  if (category?.id) {
    const { data: productData, error: err } = await supabase
      .from('products')
      .select(`
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
          product_categories!inner(category_id, categories(name, slug))
        `)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .eq('product_categories.category_id', category.id)
      .limit(50);

    products = productData || [];
    productsError = err;
  }

  if (!category?.id || products.length === 0) {
    // Fallback
    const sanitizedCategoryName = categoryName.replace(/[,().]/g, '');
    const { data: productData, error: err } = await supabase
      .from('products')
      .select(`
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
          product_categories(categories(name, slug))
        `)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(
        `category.ilike.%${sanitizedCategoryName}%,brand.ilike.%${sanitizedCategoryName}%,name.ilike.%${sanitizedCategoryName}%`
      )
      .limit(50);

    products = productData || [];
    productsError = err;
  }

  if (productsError) {
    console.error('Products query error:', productsError);
  }

  return {
    isCollection: false,
    category,
    products: products || [],
    fallbackName: categoryName,
    fallbackDescription: categoryDescription,
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
        review_title,
        review_text,
        reviewer_name,
        is_verified_purchase,
        helpful_count,
        created_at,
        merchant_response,
        response_at
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

  return createSupabaseClient(url, key);
}

/**
 * Cached dashboard stats (Revenue, Orders, etc.)
 * Uses 'merchant' cacheLife profile (revalidate 60s)
 */
export async function getCachedDashboardStats(merchantId: string) {
  'use cache';
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
  'use cache';
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
 * Uses service role to bypass RLS since settings are public-facing configuration.
 * Uses 'products' cacheLife profile (revalidate 5min)
 */
export async function getCachedFeatureSettings(merchantId: string) {
  'use cache';
  cacheLife('products');
  cacheTag(`features-${merchantId}`);

  try {
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from('merchant_feature_settings')
      .select(
        'blog_enabled, shipping_insurance_enabled, shipping_insurance_min_order_value, shipping_insurance_opt_in_default'
      )
      .eq('merchant_id', merchantId)
      .single();

    if (error) {
      // If no settings found, default to disabled
      return {
        blog_enabled: false,
        shipping_insurance_enabled: false,
        shipping_insurance_min_order_value: 5000,
        shipping_insurance_opt_in_default: false,
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching feature settings:', error);
    // Fallback to disabled on crash (e.g. missing service key)
    return {
      blog_enabled: false,
      shipping_insurance_enabled: false,
      shipping_insurance_min_order_value: 5000,
      shipping_insurance_opt_in_default: false,
    };
  }
}

/**
 * Cached blog post with related posts.
 * Uses 'merchant' cacheLife profile (revalidate 60s)
 */
export async function getCachedBlogPost(
  identifier: string,
  postSlug: string,
  includeDrafts: boolean = false
) {
  'use cache';
  cacheLife('merchant');
  cacheTag('blog-posts', `blog-${identifier}-${postSlug}`);

  const lookupKey = identifier.toLowerCase();
  const merchant =
    lookupKey.includes('.') && !lookupKey.includes('/')
      ? await getCachedMerchantByDomain(lookupKey)
      : await getCachedMerchant(lookupKey);

  if (!merchant) return null;

  // Check if blog is enabled
  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  // Fetch Post
  let query = supabase
    .from('blog_posts')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('slug', postSlug.toLowerCase());

  if (!includeDrafts) {
    query = query.eq('status', 'published');
  }

  const { data: post, error: postError } = await query.single();

  if (postError || !post) {
    if (postError && postError.code !== 'PGRST116') {
      console.error('Error fetching blog post:', postError);
    }
    return null;
  }

  // Fetch Related Posts
  let relatedQuery = supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, category, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .neq('id', post.id)
    .limit(3);

  if (post.category) {
    relatedQuery = relatedQuery.eq('category', post.category);
  }

  const { data: relatedPosts } = await relatedQuery;

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
    },
    post,
    relatedPosts: relatedPosts || [],
  };
}
