import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getCachedFeatureSettings } from '@/lib/cached-data';
import { resolveStorefrontSitemapContext } from '../../sitemap-data';

export const dynamic = 'force-dynamic';

/**
 * Blog-specific sitemap for Search Console properties scoped to /blog.
 * Generates ogabassey.com/blog/sitemap.xml
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const context = await resolveStorefrontSitemapContext(headersList);

  if (!context) return [];
  const { merchant, storeUrl, supabase } = context;

  // Mirror the blog feature flag guard used in getCachedBlogListing /
  // getCachedBlogPost so disabled storefronts don't expose a sitemap
  // pointing at routes that return 404.
  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) {
    return [];
  }

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('slug, published_at, updated_at, featured_image_url')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published');

  if (error) {
    throw new Error('Failed to fetch blog posts for sitemap', { cause: error });
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${storeUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  for (const post of posts || []) {
    entries.push({
      url: `${storeUrl}/blog/${post.slug}`,
      lastModified: post.updated_at
        ? new Date(post.updated_at)
        : new Date(post.published_at || Date.now()),
      changeFrequency: 'monthly',
      priority: 0.8,
      ...(post.featured_image_url?.startsWith('http') && {
        images: [post.featured_image_url],
      }),
    });
  }

  return entries;
}
