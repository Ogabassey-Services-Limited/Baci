import { cacheLife, cacheTag } from 'next/cache';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getMerchantStrict, getPublicSupabaseClient } from '@/lib/cached-data';
import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';
import { getOrderedBlogPostProductLinks } from '@/lib/ordered-blog-post-product-links';
import {
  filterPublicBlogPosts,
  isPublicBlogPost,
} from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import {
  normalizeRelatedBlogProductLinks,
  normalizeRelatedBlogProducts,
  RELATED_BLOG_PRODUCTS_SELECT,
} from '@/lib/related-blog-products';
import { selectSemanticRelatedBlogPosts } from '@/lib/semantic-related-blog-posts';
import { STOREFRONT_BLOG_POST_SELECT } from '@/lib/storefront-blog-post-select';

const RELATED_BLOG_POSTS_LIMIT = 3;
const RELATED_BLOG_POSTS_FETCH_LIMIT = 36;
const RELATED_BLOG_CATEGORY_FETCH_LIMIT = 24;

const RELATED_BLOG_POST_SELECT =
  'id, title, slug, excerpt, featured_image_url, category, tags, keywords, published_at, reading_time_minutes';

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

/**
 * Cache only the route-critical blog post read. Transient failures throw so a
 * cache entry can never turn a temporarily unavailable post into a 404.
 */
async function getCachedBlogPostCore(
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

  // The core includes payout_currency, so it must invalidate with merchant
  // settings changes rather than waiting for the blog cache profile to expire.
  cacheTag(
    `merchant-id-${merchant.id}`,
    `merchant-${merchant.slug}`,
    ...(merchant.custom_domain
      ? [`domain-${merchant.custom_domain.toLowerCase()}`]
      : [])
  );

  if (!merchant.feature_settings?.blog_enabled) return null;

  const supabase = getPublicSupabaseClient();

  let query = supabase
    .from('blog_posts')
    .select(STOREFRONT_BLOG_POST_SELECT)
    .eq('merchant_id', merchant.id)
    .eq('slug', postSlug.toLowerCase());

  if (!includeDrafts) {
    query = query.eq('status', 'published').not('published_at', 'is', null);
  }

  const { data: post, error: postError } = await query.single();

  if (postError) {
    if (postError.code === 'PGRST116') return null;
    console.error('Error fetching blog post:', postError);
    throw postError;
  }
  if (!post) return null;
  if (!includeDrafts && !isPublicBlogPost(post)) {
    return null;
  }

  return {
    merchant: {
      id: merchant.id,
      business_name: merchant.business_name,
      slug: merchant.slug,
      logo_url: merchant.logo_url,
      custom_domain: merchant.custom_domain,
      country: merchant.country,
      payout_currency: merchant.payout_currency,
      social_media: merchant.social_media,
    },
    post,
  };
}

type CachedBlogPostCore = NonNullable<
  Awaited<ReturnType<typeof getCachedBlogPostCore>>
>;

/**
 * Cache successful optional enrichment independently from the core post.
 * Every query error escapes this cache scope; the public wrapper applies a
 * request-local empty fallback so a transient failure is never persisted.
 */
async function getCachedBlogPostEnrichment(core: CachedBlogPostCore) {
  'use cache';
  cacheLife('blog');
  cacheTag('blog-posts', 'products', `products-${core.merchant.id}`);

  const { merchant, post } = core;
  const supabase = getPublicSupabaseClient();

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
    getOrderedBlogPostProductLinks(supabase, merchant.id, post.id),
  ]);

  if (relatedPostsError) {
    throw relatedPostsError;
  }

  if (categoryRelatedPostsError) {
    throw categoryRelatedPostsError;
  }

  const relatedPostCandidates = combineUniqueRelatedBlogPosts(
    recentRelatedPosts,
    categoryRelatedPosts
  );

  if (linkedProductsError) {
    throw linkedProductsError;
  }

  let normalizedRelatedProducts = normalizeRelatedBlogProductLinks(
    linkedProducts
  ).slice(0, 8);

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
      throw relatedProductsError;
    }

    normalizedRelatedProducts = normalizeRelatedBlogProducts(relatedProducts);
  }

  return {
    relatedPosts: selectSemanticRelatedBlogPosts(
      post,
      filterPublicBlogPosts(relatedPostCandidates),
      RELATED_BLOG_POSTS_LIMIT
    ),
    relatedProducts: normalizedRelatedProducts,
  };
}

/**
 * Public blog post contract. Core content and route identity are cached
 * independently from optional links. Optional failures degrade only the
 * current request and remain retryable on the next request.
 */
export async function getCachedBlogPost(
  identifier: string,
  postSlug: string,
  includeDrafts: boolean = false
) {
  const core = await getCachedBlogPostCore(identifier, postSlug, includeDrafts);

  if (!core) return null;

  try {
    const enrichment = await getCachedBlogPostEnrichment(core);
    return { ...core, ...enrichment };
  } catch (error) {
    console.warn('Optional blog post enrichment unavailable', {
      merchantId: core.merchant.id,
      postId: core.post.id,
      error,
    });
    return { ...core, relatedPosts: [], relatedProducts: [] };
  }
}
