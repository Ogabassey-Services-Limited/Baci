import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';
import { resolveRouteIdentifier } from '@/lib/storefront-route-identifier';
import { createAnonClient } from '@/lib/supabase/anon';

export const dynamic = 'force-dynamic';

/**
 * Blog-specific sitemap for Search Console properties scoped to /blog.
 * Generates ogabassey.com/blog/sitemap.xml
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Blog sitemap has no generateSitemaps, but Next.js 16 still doesn't
  // reliably pass params for metadata routes. Read from proxy headers.
  const headersList = await headers();
  const routeIdentifier = resolveRouteIdentifier(headersList);
  const merchant = routeIdentifier
    ? await getMerchantByIdentifier(routeIdentifier)
    : null;

  if (!merchant) return [];
  const storeUrl = buildStoreUrl(merchant);
  const supabase = createAnonClient();

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
