import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/public-supabase-client';
import type { PublishedClusterPost } from '@/lib/storefront-content/content-cluster-types';

const PDP_PRODUCT_GUIDE_LIMIT = 8;
const PDP_PRODUCT_GUIDE_TIMEOUT_MS = 3_000;

type LinkedBlogPost = PublishedClusterPost & { status?: string | null };

interface LinkedBlogPostRow {
  blog_posts: LinkedBlogPost | LinkedBlogPost[] | null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableStringArray(value: unknown): value is string[] | null {
  return (
    value === null ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

function normalizeLinkedPost(
  row: LinkedBlogPostRow
): PublishedClusterPost | null {
  const post = Array.isArray(row.blog_posts)
    ? row.blog_posts[0]
    : row.blog_posts;

  if (
    !post?.slug ||
    !post.title ||
    !isNullableString(post.excerpt) ||
    !isNullableString(post.category) ||
    !isNullableStringArray(post.tags) ||
    !isNullableStringArray(post.keywords) ||
    !isNullableString(post.featured_image_url) ||
    !isNullableString(post.published_at) ||
    !isNullableFiniteNumber(post.reading_time_minutes)
  ) {
    return null;
  }

  return {
    category: post.category,
    excerpt: post.excerpt,
    featured_image_url: post.featured_image_url,
    keywords: post.keywords,
    published_at: post.published_at,
    reading_time_minutes: post.reading_time_minutes,
    slug: post.slug,
    tags: post.tags,
    title: post.title,
  };
}

/**
 * Loads product-linked guides independently from the category inventory.
 *
 * This stays on the local cache handler. Product ids are high-cardinality and
 * the repository has an established failure mode where remote cache SETs can
 * hang under crawler load. A bounded indexed read plus local cache avoids both
 * the old combined-RPC timeout and a new remote-cache write on every PDP.
 */
export async function getCachedPdpProductGuidePosts(
  merchantId: string,
  productId: string
): Promise<PublishedClusterPost[]> {
  'use cache';

  try {
    cacheLife('blog');
    cacheTag(
      'blog-posts',
      `products-${merchantId}`,
      `published-product-guide-posts-${merchantId}-${productId}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  if (!productId) return [];

  const query = getPublicSupabaseClient()
    .from('blog_post_products')
    .select(
      'blog_posts!inner(slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes, status)'
    )
    .eq('merchant_id', merchantId)
    .eq('product_id', productId)
    .eq('blog_posts.merchant_id', merchantId)
    .eq('blog_posts.status', 'published')
    .not('blog_posts.published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(PDP_PRODUCT_GUIDE_LIMIT)
    .abortSignal(AbortSignal.timeout(PDP_PRODUCT_GUIDE_TIMEOUT_MS));
  const boundedQuery =
    typeof query.retry === 'function' ? query.retry(false) : query;
  const { data, error } = await boundedQuery;

  if (error) throw error;

  return ((data ?? []) as LinkedBlogPostRow[])
    .map(normalizeLinkedPost)
    .filter((post): post is PublishedClusterPost => post !== null);
}
