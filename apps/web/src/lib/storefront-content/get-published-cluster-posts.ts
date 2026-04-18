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
    cacheLife('merchant');
    cacheTag('blog-posts', `published-cluster-posts-${merchantId}`);
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
