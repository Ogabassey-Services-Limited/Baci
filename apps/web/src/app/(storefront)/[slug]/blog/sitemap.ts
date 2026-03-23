import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const dynamic = 'force-dynamic';

/**
 * Derive merchant slug and canonical store URL from the route segment.
 * The [slug] param is either a plain merchant slug (e.g. "ogabassey")
 * or a full custom domain (e.g. "ogabassey.com").
 */
function resolveIdentifier(routeSlug: string) {
  const isDomain = routeSlug.includes('.');
  const merchantSlug = isDomain
    ? routeSlug.replace('.com', '').replace('.', '-')
    : routeSlug;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const storeUrl = isDomain
    ? `https://${routeSlug}`
    : `https://${routeSlug}.${rootDomain}`;
  return { merchantSlug, storeUrl };
}

/**
 * Blog-specific sitemap for Search Console properties scoped to /blog.
 * Generates ogabassey.com/blog/sitemap.xml
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Blog sitemap has no generateSitemaps, but Next.js 16 still doesn't
  // reliably pass params for metadata routes. Read from proxy headers.
  const headersList = await headers();
  const routeSlug =
    headersList.get('x-merchant-slug') ??
    headersList.get('x-custom-domain') ??
    headersList.get('host')?.split('.')[0] ??
    '';
  const { merchantSlug, storeUrl } = resolveIdentifier(routeSlug);

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', merchantSlug)
    .single();

  if (!merchant) return [];

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
