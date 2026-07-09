import { cacheLife, cacheTag } from 'next/cache';
import {
  getCachedFeatureSettings,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import type { PublishedClusterPost } from './content-cluster-types';

export async function getPublishedClusterPosts(
  merchantId: string
): Promise<PublishedClusterPost[]> {
  'use cache: remote';
  try {
    // 'blog' (revalidate 3600) instead of 'merchant' (revalidate 60):
    // freshness is tag-driven — every blog mutation fires
    // revalidateTag('blog-posts') and blog_enabled toggles fire
    // revalidateFeatures — so the short window only forced this ~400KB
    // remote entry to be re-written every 60s, the dominant source of
    // Vercel data-cache write failures (502s) on compare/PDP routes.
    cacheLife('blog');
    cacheTag(
      'blog-posts',
      `published-cluster-posts-${merchantId}`,
      // Explicit, though the nested getCachedFeatureSettings call already
      // propagates it: the blog_enabled gate below must bust this entry.
      `features-${merchantId}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  const features = await getCachedFeatureSettings(merchantId);

  if (!features?.blog_enabled) {
    return [];
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      'slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Failed to load published cluster posts', {
      merchantId,
      error,
    });
    return [];
  }

  return (data ?? []) as PublishedClusterPost[];
}
