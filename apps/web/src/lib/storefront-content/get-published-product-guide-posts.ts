import { cacheLife, cacheTag } from 'next/cache';
import {
  getCachedFeatureSettings,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import type { PublishedClusterPost } from './content-cluster-types';

interface LinkedBlogPostRow {
  blog_posts:
    | (PublishedClusterPost & { status?: string | null })
    | Array<PublishedClusterPost & { status?: string | null }>
    | null;
}

function normalizeLinkedPost(
  row: LinkedBlogPostRow
): PublishedClusterPost | null {
  const post = Array.isArray(row.blog_posts)
    ? row.blog_posts[0]
    : row.blog_posts;

  if (!post?.slug || !post.title) {
    return null;
  }

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    keywords: post.keywords,
    featured_image_url: post.featured_image_url,
    published_at: post.published_at,
    reading_time_minutes: post.reading_time_minutes,
  };
}

export async function getPublishedProductGuidePosts(
  merchantId: string,
  productId: string
): Promise<PublishedClusterPost[]> {
  'use cache: remote';
  try {
    cacheLife('merchant');
    cacheTag(
      'blog-posts',
      `published-product-guide-posts-${merchantId}-${productId}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  if (!productId) {
    return [];
  }

  let features: Awaited<ReturnType<typeof getCachedFeatureSettings>>;

  try {
    features = await getCachedFeatureSettings(merchantId);
  } catch (error) {
    console.error('Failed to load feature settings for product guide posts', {
      merchantId,
      productId,
      error,
    });
    return [];
  }

  if (!features?.blog_enabled) {
    return [];
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('blog_post_products')
    .select(
      'blog_posts!inner(slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes, status)'
    )
    .eq('merchant_id', merchantId)
    .eq('product_id', productId)
    .eq('blog_posts.status', 'published')
    .not('blog_posts.published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Failed to load published product guide posts', {
      merchantId,
      productId,
      error,
    });
    return [];
  }

  return (data ?? [])
    .map((row) => normalizeLinkedPost(row as LinkedBlogPostRow))
    .filter((post): post is PublishedClusterPost => Boolean(post));
}
