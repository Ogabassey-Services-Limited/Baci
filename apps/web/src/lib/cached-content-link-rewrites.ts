import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { getCachedProductCanonicalPaths } from '@/lib/cached-product-canonical-paths';
import { isPublicBlogPost } from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import type { StorefrontContentLinkRewrites } from '@/lib/storefront-content-link-rewriting';
import { createAdminClient } from '@/lib/supabase/admin';

const EMPTY_REWRITES: StorefrontContentLinkRewrites = {
  blogSlugs: {},
  productPaths: {},
};

// The PDP resolves UUID-shaped identifiers against product ids, so content
// links like /products/<uuid> participate in rewriting the same way.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ArchivedProductParentRow {
  id: string;
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

  // Mirror the public blog route's suppression filters: a redirect pointing
  // at a published-but-suppressed post must not count as a rewrite, or the
  // source link would be "fixed" onto a target the route 404s.
  const { data: targets, error: targetsError } =
    await applyPublicBlogSqlFilters(
      supabase
        .from('blog_posts')
        .select('id, slug, title')
        .eq('merchant_id', merchantId)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .in('id', Array.from(new Set(targetIdBySource.values())))
    );

  if (targetsError) {
    throw targetsError;
  }

  const slugById = new Map(
    (targets ?? []).flatMap((row) =>
      row.slug && isPublicBlogPost(row) ? [[row.id, row.slug]] : []
    )
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

function collectArchivedParents(
  rows: ArchivedProductParentRow[],
  keyOf: (row: ArchivedProductParentRow) => string | null,
  into: Map<string, string>
): void {
  for (const row of rows) {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    const key = keyOf(row);
    if (key && parent?.slug && parent.status === 'active') {
      into.set(key, parent.slug);
    }
  }
}

// Archived rows are invisible to the anon role (products_select_policy only
// exposes status='active'), so the consolidated-variant parent lookup uses the
// service role — the same read-only pattern as getCachedLegacyProductRedirectTarget,
// which powers the PDP's public 308 for these exact slugs/ids.
async function resolveArchivedParentSlugs(
  merchantId: string,
  slugCandidates: string[],
  uuidCandidates: string[]
): Promise<Map<string, string>> {
  const parentSlugByCandidate = new Map<string, string>();
  if (slugCandidates.length === 0 && uuidCandidates.length === 0) {
    return parentSlugByCandidate;
  }

  const supabase = createAdminClient();
  const select = 'id, slug, parent:parent_product_id(slug, status)';

  const [bySlug, byId] = await Promise.all([
    slugCandidates.length
      ? supabase
          .from('products')
          .select(select)
          .eq('merchant_id', merchantId)
          .eq('status', 'archived')
          .in('slug', slugCandidates)
      : Promise.resolve({ data: [], error: null }),
    uuidCandidates.length
      ? supabase
          .from('products')
          .select(select)
          .eq('merchant_id', merchantId)
          .eq('status', 'archived')
          .in('id', uuidCandidates)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (bySlug.error) {
    throw bySlug.error;
  }
  if (byId.error) {
    throw byId.error;
  }

  collectArchivedParents(
    (bySlug.data ?? []) as unknown as ArchivedProductParentRow[],
    (row) => row.slug,
    parentSlugByCandidate
  );
  collectArchivedParents(
    (byId.data ?? []) as unknown as ArchivedProductParentRow[],
    (row) => row.id?.toLowerCase() ?? null,
    parentSlugByCandidate
  );

  return parentSlugByCandidate;
}

// Active products linked by UUID rewrite to their canonical slug path, the
// same resolution the PDP applies before redirecting id-shaped URLs.
async function resolveActiveUuidSlugs(
  merchantId: string,
  uuidCandidates: string[]
): Promise<Map<string, string>> {
  const slugByUuid = new Map<string, string>();
  if (uuidCandidates.length === 0) {
    return slugByUuid;
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, slug')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('id', uuidCandidates);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    if (row.id && row.slug) {
      slugByUuid.set(row.id.toLowerCase(), row.slug);
    }
  }

  return slugByUuid;
}

/**
 * Resolves canonical replacements for internal content links that would
 * otherwise resolve through permanent redirects: renamed blog posts (via
 * blog_post_redirects), re-categorized live products, archived variant
 * products consolidated into an active parent, and UUID-shaped product links.
 * Complements getCachedDeadContentLinkSlugs — slugs with a rewrite here must
 * NOT be treated as dead, or working links would be unwrapped instead of
 * fixed.
 *
 * The blog-redirect and product lookups throw on query errors so Cache
 * Components skips caching the failure — callers fail open (leave hrefs
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

  const slugCandidates = productSlugs.filter((slug) => !UUID_REGEX.test(slug));
  const uuidCandidates = productSlugs.filter((slug) => UUID_REGEX.test(slug));

  const [blogRewrites, livePaths, parentSlugByCandidate, activeSlugByUuid] =
    await Promise.all([
      resolveBlogSlugRewrites(merchantId, blogSlugs),
      slugCandidates.length
        ? getCachedProductCanonicalPaths(merchantId, slugCandidates)
        : Promise.resolve({}),
      resolveArchivedParentSlugs(merchantId, slugCandidates, uuidCandidates),
      resolveActiveUuidSlugs(merchantId, uuidCandidates),
    ]);

  const productPaths: Record<string, string> = { ...livePaths };

  // Canonical paths for slugs only reachable through a parent/uuid hop.
  const indirectSlugs = Array.from(
    new Set([...parentSlugByCandidate.values(), ...activeSlugByUuid.values()])
  ).filter((slug) => !productPaths[slug]);
  const indirectPaths = indirectSlugs.length
    ? await getCachedProductCanonicalPaths(merchantId, indirectSlugs)
    : {};

  const resolvePath = (slug: string): string | undefined =>
    productPaths[slug] ?? indirectPaths[slug];

  for (const [candidate, parentSlug] of parentSlugByCandidate) {
    const parentPath = resolvePath(parentSlug);
    if (parentPath) {
      productPaths[candidate] = parentPath;
    }
  }
  for (const [uuid, slug] of activeSlugByUuid) {
    const slugPath = resolvePath(slug);
    if (slugPath) {
      productPaths[uuid] = slugPath;
    }
  }

  return { blogSlugs: blogRewrites, productPaths };
}
