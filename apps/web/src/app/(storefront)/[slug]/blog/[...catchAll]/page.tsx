import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';

/**
 * Catch-all route for legacy blog URLs with category prefixes.
 *
 * Handles URLs like:
 * - /blog/iphone/the-iphone-15-what-we-know-so-far
 * - /blog/smartphones/8-things-you-didnt-know-your-iphone-can-do
 * - /blog/gadgets/tecno-spark-10-pro-all-you-need-to-know
 *
 * Redirects to the canonical URL: /blog/{postSlug}
 *
 * Also filters out WordPress admin URLs (/blog/wp-admin/...) with 404.
 */
export default async function BlogCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string; catchAll: string[] }>;
}) {
  const { slug, catchAll } = await params;

  // Filter out WordPress admin URLs
  if (catchAll.some((segment) => segment.startsWith('wp-'))) {
    notFound();
  }

  // Get merchant
  const cachedMerchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug.toLowerCase())
    : await getCachedMerchant(slug.toLowerCase());

  if (!cachedMerchant) {
    notFound();
  }

  // Extract merchant ID (TypeScript now knows it's not null)
  const merchantId = cachedMerchant.id;

  // The last segment is likely the post slug
  // e.g., /blog/iphone/the-iphone-15-what-we-know -> postSlug = "the-iphone-15-what-we-know"
  const postSlug = catchAll[catchAll.length - 1];

  // Strip query parameters from the slug
  const cleanPostSlug = postSlug.split('?')[0];

  // Look up the post by slug
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: post } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId)
    .eq('slug', cleanPostSlug)
    .eq('status', 'published')
    .maybeSingle();

  if (post) {
    // Redirect to canonical URL (without category prefix)
    // Use 301 permanent redirect for SEO
    redirect(`/${slug}/blog/${post.slug}`);
  }

  // If post not found, try matching without hyphens/underscores
  // (in case of slight URL variations)
  const normalizedSlug = cleanPostSlug.replace(/[-_]/g, '').toLowerCase();

  const { data: fuzzyPost } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
    .limit(100);

  const matchingPost = fuzzyPost?.find(
    (p) => p.slug.replace(/[-_]/g, '').toLowerCase() === normalizedSlug
  );

  if (matchingPost) {
    redirect(`/${slug}/blog/${matchingPost.slug}`);
  }

  // No matching post found
  notFound();
}
