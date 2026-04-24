import { cookies } from 'next/headers';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { buildCanonicalBlogPostUrl } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-content';
import {
  getCachedBlogPost,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
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

  const isDatedBlogPermalink =
    catchAll.length === 4 &&
    /^\d{4}$/.test(catchAll[0] ?? '') &&
    /^\d{2}$/.test(catchAll[1] ?? '') &&
    /^\d{2}$/.test(catchAll[2] ?? '');

  if (isDatedBlogPermalink) {
    const postSlug = catchAll[3];
    const data = await getCachedBlogPost(slug, postSlug, false);

    if (!data) {
      notFound();
    }

    permanentRedirect(
      asRoute(buildCanonicalBlogPostUrl(data.merchant, data.post.slug))
    );
  }

  // 308 redirect legacy /blog/sitemap.xml → /sitemap.xml (blog entries merged into main sitemap)
  if (catchAll.length === 1 && catchAll[0] === 'sitemap.xml') {
    permanentRedirect('/sitemap.xml');
  }

  // Filter out WordPress admin URLs and known spam
  // Spam patterns: shopdetail, zhHant (Chinese spam), product IDs, etc.
  const spamKeywords = ['wp-', 'shopdetail', 'zhhant', 'surugaya', '.html'];
  if (
    catchAll.some((segment) =>
      spamKeywords.some((keyword) => segment.toLowerCase().includes(keyword))
    )
  ) {
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
    // Use 301 permanent redirect for SEO; build from merchant canonical URL data
    // so custom-domain rewrites don't leak internal paths to crawlers.
    permanentRedirect(
      asRoute(buildCanonicalBlogPostUrl(cachedMerchant, post.slug))
    );
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
    // Fuzzy matches are best-effort — use a 307 redirect so browsers don't
    // cache it permanently (content authors may later publish a post at the
    // requested slug, and a cached 308 would prevent that URL from resolving).
    redirect(
      asRoute(buildCanonicalBlogPostUrl(cachedMerchant, matchingPost.slug))
    );
  }

  // No matching post found
  notFound();
}
