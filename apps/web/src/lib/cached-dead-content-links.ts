import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import type { DeadStorefrontContentLinkSlugs } from '@/lib/storefront-content-link-targets';

const EMPTY_RESULT: { data: Array<{ slug: string }>; error: null } = {
  data: [],
  error: null,
};

/**
 * Resolves which of the internal link targets collected from blog content are
 * dead: blog slugs with no published post and product slugs with no active
 * product for the merchant. Queries run with the public (anon) client so RLS
 * matches exactly what an anonymous storefront visitor could reach.
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

  const [blogResult, productResult] = await Promise.all([
    blogSlugs.length
      ? supabase
          .from('blog_posts')
          .select('slug')
          .eq('merchant_id', merchantId)
          .eq('status', 'published')
          .not('published_at', 'is', null)
          .in('slug', blogSlugs)
      : Promise.resolve(EMPTY_RESULT),
    productSlugs.length
      ? supabase
          .from('products')
          .select('slug')
          .eq('merchant_id', merchantId)
          .eq('status', 'active')
          .in('slug', productSlugs)
      : Promise.resolve(EMPTY_RESULT),
  ]);

  if (blogResult.error) {
    throw blogResult.error;
  }
  if (productResult.error) {
    throw productResult.error;
  }

  const liveBlogSlugs = new Set((blogResult.data ?? []).map((row) => row.slug));
  const liveProductSlugs = new Set(
    (productResult.data ?? []).map((row) => row.slug)
  );

  return {
    blog: blogSlugs.filter((slug) => !liveBlogSlugs.has(slug)),
    products: productSlugs.filter((slug) => !liveProductSlugs.has(slug)),
  };
}
