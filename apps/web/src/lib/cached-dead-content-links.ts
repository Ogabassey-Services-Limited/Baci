import { cacheLife, cacheTag } from 'next/cache';
import { getBlogContentLinksCacheTag } from '@/lib/blog-content-link-cache-tags';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';
import { isPublicBlogPost } from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import {
  type DeadStorefrontContentLinkSlugs,
  UUID_SHAPED_PRODUCT_IDENTIFIER_REGEX,
} from '@/lib/storefront-content-link-targets';

const EMPTY_BLOG_RESULT: {
  data: Array<{ slug: string; title: string | null }>;
  error: null;
} = {
  data: [],
  error: null,
};

const EMPTY_PRODUCT_RESULT: { data: Array<{ slug: string }>; error: null } = {
  data: [],
  error: null,
};

/**
 * Resolves which of the internal link targets collected from blog content are
 * dead: blog slugs with no publicly served post and product slugs with no
 * active product for the merchant. The blog check mirrors the public blog
 * route (`getCachedBlogPost`) by applying the same suppression filters, so
 * published-but-suppressed posts (test posts etc.) are treated as dead. The
 * product check accepts UUID-shaped identifiers the PDP resolves by id.
 * Queries run with the public (anon) client so RLS matches exactly what an
 * anonymous storefront visitor could reach.
 *
 * Throws on query errors so Cache Components skips caching the failure —
 * callers fail open (treat all links as live).
 */
export async function getCachedDeadContentLinkSlugs(
  merchantId: string,
  blogSlugs: string[],
  productSlugs: string[]
): Promise<DeadStorefrontContentLinkSlugs> {
  // PR4b review round 4: stays `'use cache: remote'` (demotion REVERTED).
  // Tagged with this merchant's derived blog-content-links tag, the generic
  // blog-content-links compatibility tag, and `products-${merchantId}`.
  // Dead-link detection must see a product/post going live or dying on EVERY
  // instance; a local entry would keep an unpublished link marked live (or
  // strike a republished one) until `cacheLife` expiry. Already fail-loud
  // (throws so callers fail open, treating all links as live).
  'use cache: remote';
  cacheLife('merchant');
  cacheTag(
    getBlogContentLinksCacheTag(merchantId),
    'blog-content-links',
    `products-${merchantId}`
  );

  if (blogSlugs.length === 0 && productSlugs.length === 0) {
    return { blog: [], products: [] };
  }

  const supabase = getPublicSupabaseClient();

  const productIdCandidates = productSlugs.filter((slug) =>
    UUID_SHAPED_PRODUCT_IDENTIFIER_REGEX.test(slug)
  );

  const [blogResult, productResult, productIdResult] = await Promise.all([
    blogSlugs.length
      ? applyPublicBlogSqlFilters(
          supabase
            .from('blog_posts')
            .select('slug, title')
            .eq('merchant_id', merchantId)
            .eq('status', 'published')
            .not('published_at', 'is', null)
            .in('slug', blogSlugs)
        )
      : Promise.resolve(EMPTY_BLOG_RESULT),
    productSlugs.length
      ? supabase
          .from('products')
          .select('slug')
          .eq('merchant_id', merchantId)
          .eq('status', 'active')
          .in('slug', productSlugs)
      : Promise.resolve(EMPTY_PRODUCT_RESULT),
    // The PDP also resolves UUID-shaped identifiers against product ids, so a
    // `/products/<uuid>` link to an active product must not be unwrapped.
    productIdCandidates.length
      ? supabase
          .from('products')
          .select('id')
          .eq('merchant_id', merchantId)
          .eq('status', 'active')
          .in('id', productIdCandidates)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
  ]);

  if (blogResult.error) {
    throw blogResult.error;
  }
  if (productResult.error) {
    throw productResult.error;
  }
  if (productIdResult.error) {
    throw productIdResult.error;
  }

  const liveBlogSlugs = new Set(
    (blogResult.data ?? [])
      .filter((row) => isPublicBlogPost(row))
      .map((row) => row.slug)
  );
  const liveProductSlugs = new Set([
    ...(productResult.data ?? []).map((row) => row.slug),
    ...(productIdResult.data ?? []).map((row) => row.id.toLowerCase()),
  ]);

  // UUID identifiers that did not resolve as active are adjudicated through
  // the same anon-callable RPC the PDP/proxy use: `present` covers both an
  // active product and an archived id that 308s to its active parent, so
  // only genuinely nonexistent ids are reported dead. On resolver errors the
  // id stays live (fail open — never destroy a possibly working link).
  const unresolvedUuids = productIdCandidates.filter(
    (uuid) => !liveProductSlugs.has(uuid.toLowerCase())
  );
  const deadUuids = new Set<string>();
  await Promise.all(
    unresolvedUuids.map(async (uuid) => {
      const resolution = await getCachedStorefrontProductSlugResolution(
        merchantId,
        uuid
      );
      if (!resolution.hasError && !resolution.present) {
        deadUuids.add(uuid);
      }
    })
  );

  return {
    blog: blogSlugs.filter((slug) => !liveBlogSlugs.has(slug)),
    products: productSlugs.filter((slug) =>
      UUID_SHAPED_PRODUCT_IDENTIFIER_REGEX.test(slug)
        ? deadUuids.has(slug)
        : !liveProductSlugs.has(slug.toLowerCase())
    ),
  };
}
