import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { getCachedProductCanonicalPaths } from '@/lib/cached-product-canonical-paths';
import type { StorefrontContentLinkRewrites } from '@/lib/storefront-content-link-targets';
import { createAdminClient } from '@/lib/supabase/admin';

const EMPTY_REWRITES: StorefrontContentLinkRewrites = {
  blogSlugs: {},
  productPaths: {},
};

interface ArchivedProductParentRow {
  slug: string | null;
  parent: { slug: string | null; status: string | null } | null;
}

async function resolveBlogSlugRewrites(
  merchantId: string,
  blogSlugs: string[]
): Promise<Record<string, string>> {
  if (blogSlugs.length === 0) {
    return {};
  }

  const supabase = getPublicSupabaseClient();
  const { data: redirects, error: redirectsError } = await supabase
    .from('blog_post_redirects')
    .select('source_slug, target_post_id')
    .eq('merchant_id', merchantId)
    .in('source_slug', blogSlugs);

  if (redirectsError) {
    throw redirectsError;
  }

  const targetIdBySource = new Map<string, string>();
  for (const row of redirects ?? []) {
    if (row.source_slug && row.target_post_id) {
      targetIdBySource.set(row.source_slug, row.target_post_id);
    }
  }
  if (targetIdBySource.size === 0) {
    return {};
  }

  const { data: targets, error: targetsError } = await supabase
    .from('blog_posts')
    .select('id, slug')
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .in('id', Array.from(new Set(targetIdBySource.values())));

  if (targetsError) {
    throw targetsError;
  }

  const slugById = new Map(
    (targets ?? []).flatMap((row) => (row.slug ? [[row.id, row.slug]] : []))
  );
  const rewrites: Record<string, string> = {};
  for (const [sourceSlug, targetId] of targetIdBySource) {
    const targetSlug = slugById.get(targetId);
    if (targetSlug && targetSlug !== sourceSlug) {
      rewrites[sourceSlug] = targetSlug;
    }
  }

  return rewrites;
}

// Archived rows are invisible to the anon role (products_select_policy only
// exposes status='active'), so the consolidated-variant parent lookup uses the
// service role — the same read-only pattern as getCachedLegacyProductRedirectTarget,
// which powers the PDP's public 308 for these exact slugs.
async function resolveArchivedParentSlugs(
  merchantId: string,
  productSlugs: string[]
): Promise<Map<string, string>> {
  if (productSlugs.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .select('slug, parent:parent_product_id(slug, status)')
    .eq('merchant_id', merchantId)
    .eq('status', 'archived')
    .in('slug', productSlugs);

  if (error) {
    throw error;
  }

  const parentSlugByArchivedSlug = new Map<string, string>();
  for (const row of (data ?? []) as unknown as ArchivedProductParentRow[]) {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    if (row.slug && parent?.slug && parent.status === 'active') {
      parentSlugByArchivedSlug.set(row.slug, parent.slug);
    }
  }

  return parentSlugByArchivedSlug;
}

/**
 * Resolves canonical replacements for internal content links that would
 * otherwise resolve through permanent redirects: renamed blog posts (via
 * blog_post_redirects), re-categorized live products, and archived variant
 * products consolidated into an active parent. Complements
 * getCachedDeadContentLinkSlugs — slugs with a rewrite here must NOT be
 * treated as dead, or working links would be unwrapped instead of fixed.
 *
 * The blog-redirect and archived-parent lookups throw on query errors so
 * Cache Components skips caching the failure — callers fail open (leave hrefs
 * untouched). Note getCachedProductCanonicalPaths swallows its own errors and
 * returns {} instead, so a transient failure there yields a cached
 * missing-rewrite for its lifetime rather than a thrown error.
 */
export async function getCachedContentLinkRewrites(
  merchantId: string,
  blogSlugs: string[],
  productSlugs: string[]
): Promise<StorefrontContentLinkRewrites> {
  'use cache: remote';
  cacheLife('merchant');
  cacheTag(
    'blog-posts',
    'product-legacy-redirect',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (blogSlugs.length === 0 && productSlugs.length === 0) {
    return EMPTY_REWRITES;
  }

  const [blogRewrites, livePaths, parentSlugByArchivedSlug] = await Promise.all(
    [
      resolveBlogSlugRewrites(merchantId, blogSlugs),
      productSlugs.length
        ? getCachedProductCanonicalPaths(merchantId, productSlugs)
        : Promise.resolve({}),
      resolveArchivedParentSlugs(merchantId, productSlugs),
    ]
  );

  const productPaths: Record<string, string> = { ...livePaths };

  const unresolvedParentSlugs = Array.from(
    new Set(parentSlugByArchivedSlug.values())
  ).filter((slug) => !productPaths[slug]);
  const parentPaths = unresolvedParentSlugs.length
    ? await getCachedProductCanonicalPaths(merchantId, unresolvedParentSlugs)
    : {};
  for (const [archivedSlug, parentSlug] of parentSlugByArchivedSlug) {
    const parentPath = productPaths[parentSlug] ?? parentPaths[parentSlug];
    if (parentPath) {
      productPaths[archivedSlug] = parentPath;
    }
  }

  return { blogSlugs: blogRewrites, productPaths };
}
