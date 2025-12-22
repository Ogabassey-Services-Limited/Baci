import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
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

  return createSupabaseClient(url, key);
}

// Cache durations in seconds
const CACHE_DURATIONS = {
  storefront: 60, // 1 minute for frequently changing content
  products: 300, // 5 minutes for product data
  static: 3600, // 1 hour for rarely changing data
} as const;

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
  social_media: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    pinterest?: string;
    linkedin?: string;
  } | null;
  brand_colors: {
    primary: string;
    background: string;
    accent: string;
  } | null;
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
  // Favicon properties
  favicon_svg_url?: string;
  favicon_png_32_url?: string;
  favicon_apple_touch_url?: string;
}

/**
 * Cached merchant data by slug
 * Uses 60 second cache with tags for invalidation
 */
export const getCachedMerchant = unstable_cache(
  async (slug: string): Promise<CachedMerchant | null> => {
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
        is_published,
        template_id,
        template_id,
        plan_tier,
        premium_features,
        country,
        country,
        hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url
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
      return null;
    }

    if (!data) {
      const safeSlug = String(slug || '')
        .replace(/[\r\n]/g, '')
        .substring(0, 100);
      console.warn('No merchant data found for slug:', safeSlug);
    } else {
      const safeSlug = String(slug || '')
        .replace(/[\r\n]/g, '')
        .substring(0, 100);
      console.log('Successfully fetched merchant:', safeSlug, data.id);
    }

    // Fetch primary domain
    if (data) {
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
  },
  ['merchant-by-slug'],
  {
    revalidate: CACHE_DURATIONS.storefront,
    tags: ['merchants'],
  }
);

/**
 * Cached merchant data by custom domain
 * Looks up the domain in the domains table and fetches the associated merchant
 * Uses 60 second cache with tags for invalidation
 */
/**
 * Retrieves a merchant using their custom domain.
 * Normalizes the domain to lowercase before lookup.
 * @param domain The custom domain (e.g., "store.com").
 * @returns The merchant object with `custom_domain` property, or null if not found.
 */
export const getCachedMerchantByDomain = unstable_cache(
  async (domain: string): Promise<CachedMerchant | null> => {
    const normalizedDomain = domain.toLowerCase();
    // Reverted to public client as RLS policy now permits anonymous reads
    const supabase = getPublicSupabaseClient();

    // First, find the merchant_id from the domains table
    const { data: domainData, error: domainError } = await supabase
      .from('domains')
      .select('merchant_id, domain')
      .eq('domain', normalizedDomain)
      .eq('status', 'active')
      .single();

    if (domainError || !domainData) {
      console.error('Error fetching domain', {
        domain: normalizedDomain,
        error: domainError ?? 'No data found',
      });
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
        country,
        hero_slides,
        favicon_svg_url,
        favicon_png_32_url,
        favicon_apple_touch_url
      `)
      .eq('id', domainData.merchant_id)
      .single();

    if (error) {
      console.error('Error fetching merchant for domain', {
        domain: normalizedDomain,
        error: error,
      });
      return null;
    }

    if (!data) {
      console.warn('No merchant data found for domain', {
        domain: normalizedDomain,
      });
      return null;
    }

    console.log('Successfully fetched merchant by domain', {
      domain: normalizedDomain,
      slug: data.slug,
      merchantId: data.id,
    });

    // Return with the custom_domain set
    return { ...data, custom_domain: domainData.domain };
  },
  ['merchant-by-domain'],
  {
    revalidate: CACHE_DURATIONS.storefront,
    tags: ['merchants', 'domains'],
  }
);

/**
 * Cached merchant data by ID
 */
export const getCachedMerchantById = unstable_cache(
  async (merchantId: string) => {
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
        favicon_apple_touch_url
      `)
      .eq('id', merchantId)
      .single();

    if (error) {
      console.error('Error fetching merchant by ID:', error);
      return null;
    }

    return data;
  },
  ['merchant-by-id'],
  {
    revalidate: CACHE_DURATIONS.storefront,
    tags: ['merchants'],
  }
);

/**
 * Cached products for a merchant
 * Uses 5 minute cache for product listings
 *
 * Note: Returns product_categories as an array with nested categories objects.
 * Consumers should extract the first category like:
 * `product.product_categories?.[0]?.categories` to get { id, name, slug }
 */
export const getCachedProducts = unstable_cache(
  async (
    merchantId: string,
    options?: {
      limit?: number;
      offset?: number;
      categoryId?: string;
      featured?: boolean;
    }
  ) => {
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
  },
  ['products'],
  {
    revalidate: CACHE_DURATIONS.products,
    tags: ['products'],
  }
);

/**
 * Cached single product by slug
 *
 * Note: Returns product_categories as an array with nested categories objects.
 * Consumers should extract the first category like:
 * `product.product_categories?.[0]?.categories` to get { id, name, slug }
 */
export const getCachedProduct = unstable_cache(
  async (merchantId: string, productSlug: string) => {
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
      query = query.eq('slug', productSlug);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    return data;
  },
  ['product'],
  {
    revalidate: CACHE_DURATIONS.products,
    tags: ['product'],
  }
);

/**
 * Cached categories for a merchant
 * Uses 1 hour cache for category structure
 */
export const getCachedCategories = unstable_cache(
  async (merchantId: string) => {
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
  },
  ['categories'],
  {
    revalidate: CACHE_DURATIONS.static,
    tags: ['categories'],
  }
);

/**
 * Cached category by slug
 */
export const getCachedCategory = unstable_cache(
  async (merchantId: string, categorySlug: string) => {
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
  },
  ['category'],
  {
    revalidate: CACHE_DURATIONS.static,
    tags: ['category'],
  }
);

/**
 * Cached published page config (Puck builder)
 */
export const getCachedPageConfig = unstable_cache(
  async (merchantId: string, pageSlug: string = 'home') => {
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
  },
  ['page-config'],
  {
    revalidate: CACHE_DURATIONS.storefront,
    tags: ['page-config'],
  }
);

/**
 * Cached product reviews
 */
export const getCachedProductReviews = unstable_cache(
  async (
    productId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) => {
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
  },
  ['reviews'],
  {
    revalidate: CACHE_DURATIONS.products,
    tags: ['reviews'],
  }
);

/**
 * Cached product rating stats
 */
export const getCachedProductRatingStats = unstable_cache(
  async (productId: string) => {
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
  },
  ['rating-stats'],
  {
    revalidate: CACHE_DURATIONS.products,
    tags: ['reviews'],
  }
);

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
 * Uses 1 minute cache since dashboard is high-traffic but needs relative freshness
 */
export const getCachedDashboardStats = unstable_cache(
  async (merchantId: string) => {
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
  },
  ['dashboard-stats'],
  {
    revalidate: 60, // 1 minute
    tags: ['dashboard'],
  }
);

/**
 * Cached platform analytics (Admin)
 * Uses 5 minute cache as this is heavy 10-year aggregation
 */
export const getCachedPlatformAnalytics = unstable_cache(
  async (startDate: string, endDate: string) => {
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
  },
  ['platform-analytics'],
  {
    revalidate: 300, // 5 minutes
    tags: ['analytics'],
  }
);

/**
 * Cached merchant feature settings
 * Uses service role to bypass RLS since settings are public-facing configuration
 */
export const getCachedFeatureSettings = unstable_cache(
  async (merchantId: string) => {
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from('merchant_feature_settings')
      .select('blog_enabled')
      .eq('merchant_id', merchantId)
      .single();

    if (error) {
      // If no settings found, default to disabled
      return { blog_enabled: false };
    }

    return data;
  },
  ['feature-settings'],
  {
    revalidate: 300, // 5 minutes
    tags: ['features'],
  }
);
