import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const dynamic = 'force-dynamic';

function resolveRouteIdentifier(
  headersList: Awaited<ReturnType<typeof headers>>
) {
  const customDomain = headersList.get('x-custom-domain')?.toLowerCase();
  if (customDomain) {
    return customDomain;
  }

  const merchantSlug = headersList.get('x-merchant-slug')?.toLowerCase();
  if (merchantSlug) {
    return merchantSlug;
  }

  const host = headersList.get('host')?.split(':')[0].toLowerCase();
  if (!host) {
    return '';
  }

  const normalizedHost = host.replace(/^www\./, '');
  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
  ).toLowerCase();

  if (normalizedHost === rootDomain) {
    return '';
  }

  if (normalizedHost.endsWith(`.${rootDomain}`)) {
    return normalizedHost.slice(0, -(rootDomain.length + 1));
  }

  return normalizedHost;
}

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

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, published_at, updated_at, featured_image_url')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published');

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
