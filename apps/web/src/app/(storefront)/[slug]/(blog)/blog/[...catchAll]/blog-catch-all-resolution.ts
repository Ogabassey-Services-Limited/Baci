import { cookies } from 'next/headers';
import { buildCanonicalBlogPostUrl } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/blog-post-content';
import { getBlogPostRedirect } from '@/lib/blog-post-redirects';
import {
  getCachedBlogPost,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';

type BlogCatchAllRedirectStatus = 307 | 308;

export type BlogCatchAllResolution =
  | {
      type: 'redirect';
      status: BlogCatchAllRedirectStatus;
      url: string;
    }
  | {
      type: 'notFound';
    };

export async function resolveBlogCatchAllOutcome({
  params,
}: {
  params: Promise<{ slug: string; catchAll: string[] }>;
}): Promise<BlogCatchAllResolution> {
  const { slug, catchAll } = await params;

  // Over-long / repeatedly-encoded bot segments can never match a post; bail
  // before any `'use cache'` (getCachedBlogPost), `'use cache: remote'`
  // (getBlogPostRedirect) or Supabase lookup runs with an unbounded key. This
  // is the single choke point for the blog catch-all route and the author
  // route's unknown-author fallback (both route through here). The last
  // segment is checked on its pre-`?` slug portion to mirror the downstream
  // `cleanPostSlug = postSlug.split('?')[0]`, so a valid slug with a tracking
  // tail is not falsely rejected while an over-long slug still is.
  if (
    catchAll.some(
      (segment, index) =>
        !evaluateStorefrontSlugSafety(
          index === catchAll.length - 1
            ? (segment.split('?')[0] ?? '')
            : segment
        ).safe
    )
  ) {
    return { type: 'notFound' };
  }

  const isDatedBlogPermalink =
    catchAll.length === 4 &&
    /^\d{4}$/.test(catchAll[0] ?? '') &&
    /^\d{2}$/.test(catchAll[1] ?? '') &&
    /^\d{2}$/.test(catchAll[2] ?? '');

  if (isDatedBlogPermalink) {
    const postSlug = catchAll[3];
    const data = await getCachedBlogPost(slug, postSlug, false);

    if (!data) {
      return { type: 'notFound' };
    }

    return {
      type: 'redirect',
      status: 308,
      url: asRoute(buildCanonicalBlogPostUrl(data.merchant, data.post.slug)),
    };
  }

  // 308 redirect legacy /blog/sitemap.xml -> /sitemap.xml (blog entries merged into main sitemap)
  if (catchAll.length === 1 && catchAll[0] === 'sitemap.xml') {
    return { type: 'redirect', status: 308, url: '/sitemap.xml' };
  }

  // Filter out WordPress/admin probes and known spam before any merchant lookup.
  const spamKeywords = [
    'wp-',
    'wp-content',
    'shopdetail',
    'zhhant',
    'surugaya',
    '.html',
    '.sql',
  ];
  if (
    catchAll.some((segment) =>
      spamKeywords.some((keyword) => segment.toLowerCase().includes(keyword))
    )
  ) {
    return { type: 'notFound' };
  }

  // Get merchant
  const cachedMerchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug.toLowerCase())
    : await getCachedMerchant(slug.toLowerCase());

  if (!cachedMerchant) {
    return { type: 'notFound' };
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

  const { data: post, error: postError } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId)
    .eq('slug', cleanPostSlug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .maybeSingle();

  if (postError) {
    throw postError;
  }

  if (post) {
    // Redirect to canonical URL (without category prefix)
    // Use a permanent redirect for SEO; build from merchant canonical URL data
    // so custom-domain rewrites don't leak internal paths to crawlers.
    return {
      type: 'redirect',
      status: 308,
      url: asRoute(buildCanonicalBlogPostUrl(cachedMerchant, post.slug)),
    };
  }

  const redirectedPost = await getBlogPostRedirect(slug, cleanPostSlug);
  if (redirectedPost) {
    return {
      type: 'redirect',
      status: 308,
      url: asRoute(
        buildCanonicalBlogPostUrl(
          redirectedPost.merchant,
          redirectedPost.targetSlug
        )
      ),
    };
  }

  // If post not found, try matching without hyphens/underscores
  // (in case of slight URL variations)
  const normalizedSlug = cleanPostSlug.replace(/[-_]/g, '').toLowerCase();

  const { data: fuzzyPost, error: fuzzyPostError } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .limit(100);

  if (fuzzyPostError) {
    throw fuzzyPostError;
  }

  const matchingPost = fuzzyPost?.find(
    (p) => p.slug.replace(/[-_]/g, '').toLowerCase() === normalizedSlug
  );

  if (matchingPost) {
    // Fuzzy matches are best-effort - use a 307 redirect so browsers don't
    // cache it permanently (content authors may later publish a post at the
    // requested slug, and a cached 308 would prevent that URL from resolving).
    return {
      type: 'redirect',
      status: 307,
      url: asRoute(
        buildCanonicalBlogPostUrl(cachedMerchant, matchingPost.slug)
      ),
    };
  }

  // No matching post found
  return { type: 'notFound' };
}
