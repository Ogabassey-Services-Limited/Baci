import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/env';

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
  storefront: 60,    // 1 minute for frequently changing content
  products: 300,     // 5 minutes for product data
  static: 3600,      // 1 hour for rarely changing data
} as const;

/**
 * Cached merchant data by slug
 * Uses 60 second cache with tags for invalidation
 */
export const getCachedMerchant = unstable_cache(
  async (slug: string) => {
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
        payout_currency,
        category
      `)
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching merchant:', error);
      return null;
    }

    return data;
  },
  ['merchant'],
  {
    revalidate: CACHE_DURATIONS.storefront,
    tags: ['merchant'],
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
        slug
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
    tags: ['merchant'],
  }
);

/**
 * Cached products for a merchant
 * Uses 5 minute cache for product listings
 */
export const getCachedProducts = unstable_cache(
  async (merchantId: string, options?: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    featured?: boolean;
  }) => {
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
        quantity,
        track_quantity,
        images,
        product_variants (
          id,
          name,
          options,
          price_modifier,
          stock
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
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
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
 */
export const getCachedProduct = unstable_cache(
  async (merchantId: string, productSlug: string) => {
    const supabase = getPublicSupabaseClient();

    const { data, error } = await supabase
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
        created_at,
        product_variants (
          id,
          name,
          options,
          price_modifier,
          stock
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
      .eq('slug', productSlug)
      .eq('status', 'active')
      .single();

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
        parent_id,
        position
      `)
      .eq('merchant_id', merchantId)
      .order('position', { ascending: true });

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
        parent_id,
        position
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
  async (productId: string, options?: {
    limit?: number;
    offset?: number;
  }) => {
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
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
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
    data.forEach(r => {
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
 * Cached store SEO summary data for generating dynamic meta descriptions
 * Fetches product count, top categories, and basic store stats
 */
export const getCachedStoreSEOData = unstable_cache(
  async (merchantId: string) => {
    const supabase = getPublicSupabaseClient();

    // Fetch product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    // Fetch top categories (by product count)
    const { data: categories } = await supabase
      .from('categories')
      .select('name')
      .eq('merchant_id', merchantId)
      .order('position', { ascending: true })
      .limit(5);

    // Fetch featured products for keywords
    const { data: featuredProducts } = await supabase
      .from('products')
      .select('name')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .eq('is_featured', true)
      .limit(3);

    return {
      productCount: productCount || 0,
      categoryNames: categories?.map(c => c.name) || [],
      featuredProductNames: featuredProducts?.map(p => p.name) || [],
    };
  },
  ['store-seo-data'],
  {
    revalidate: CACHE_DURATIONS.products,
    tags: ['products', 'categories'],
  }
);

/**
 * Generate a dynamic meta description for a storefront
 * Falls back to increasingly generic descriptions based on available data
 */
export function generateStorefrontDescription(
  merchant: {
    business_name: string;
    site_description?: string | null;
    site_tagline?: string | null;
    business_type?: string | null;
    category?: string | null;
  },
  seoData?: {
    productCount: number;
    categoryNames: string[];
    featuredProductNames: string[];
  }
): string {
  // 1. Use custom description if set
  if (merchant.site_description) {
    return merchant.site_description;
  }

  // 2. Use tagline if set
  if (merchant.site_tagline) {
    return merchant.site_tagline;
  }

  // 3. Generate dynamic description from store data
  if (seoData && seoData.productCount > 0) {
    const parts: string[] = [];

    // Start with store name and what they sell
    if (seoData.categoryNames.length > 0) {
      const topCategories = seoData.categoryNames.slice(0, 3).join(', ');
      parts.push(`Shop ${topCategories} at ${merchant.business_name}`);
    } else {
      parts.push(`Shop at ${merchant.business_name}`);
    }

    // Add product count
    if (seoData.productCount >= 10) {
      parts.push(`Browse ${seoData.productCount}+ products`);
    }

    // Add business type context
    if (merchant.business_type || merchant.category) {
      const type = merchant.business_type || merchant.category;
      parts.push(`Your trusted ${type} store`);
    }

    return parts.join('. ') + '.';
  }

  // 4. Fallback with business type
  if (merchant.business_type || merchant.category) {
    const type = merchant.business_type || merchant.category;
    return `Shop quality ${type} products at ${merchant.business_name}. Browse our collection and find what you need.`;
  }

  // 5. Generic fallback
  return `Welcome to ${merchant.business_name}. Browse our collection of quality products and shop online with confidence.`;
}
