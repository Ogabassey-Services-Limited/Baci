import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { isPublicBlogPost } from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import type { DeadStorefrontContentLinkSlugs } from '@/lib/storefront-content-link-targets';

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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  'use cache: remote';
  cacheLife('merchant');
  cacheTag('blog-posts', `products-${merchantId}`);

  if (blogSlugs.length === 0 && productSlugs.length === 0) {
    return { blog: [], products: [] };
  }

  const supabase = getPublicSupabaseClient();

  const productIdCandidates = productSlugs.filter((slug) =>
    UUID_REGEX.test(slug)
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

  return {
    blog: blogSlugs.filter((slug) => !liveBlogSlugs.has(slug)),
    // UUID-shaped identifiers that did not resolve as active are NEVER dead:
    // an archived id 308s to its active parent on the PDP, and telling that
    // apart from a nonexistent id would require a privileged read this anon
    // path must not perform. Fail open — the link stays clickable and the
    // PDP adjudicates it at request time.
    products: productSlugs.filter(
      (slug) =>
        !liveProductSlugs.has(slug.toLowerCase()) && !UUID_REGEX.test(slug)
    ),
  };
}
