import { STOREFRONT_PUBLIC_CACHE_POLICIES } from '@/config/storefront-cache';
import { getBlogAuthorSlugs } from '@/lib/blog-authors';
import { getProductUrl } from '@/lib/seo-utils';

/**
 * Build the canonical public URLs to evict from Cloudflare when a storefront's
 * blog content changes. Only storefronts with a configured public cache policy
 * (i.e. a Cloudflare-fronted custom domain) produce URLs; everyone else returns
 * an empty list so the purge is a no-op.
 *
 * `identifiers` may be either a merchant slug (e.g. `ogabassey`) or one of the
 * policy's custom hostnames — both resolve to the same policy.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePurgeHostnames(identifier: string): readonly string[] {
  const normalized = normalize(identifier);
  if (!normalized) {
    return [];
  }

  for (const policy of STOREFRONT_PUBLIC_CACHE_POLICIES) {
    const matchesSlug = policy.slug.toLowerCase() === normalized;
    const matchesHostname = policy.customHostnames.some(
      (hostname) => hostname.toLowerCase() === normalized
    );
    if (matchesSlug || matchesHostname) {
      return policy.customHostnames;
    }
  }

  return [];
}

/**
 * Dedup path segments by their normalized (trim + lowercase) form and drop
 * blanks, but KEEP the original casing for the emitted URL: the CDN path is
 * case-sensitive, so lowercasing here would purge the wrong URL for a
 * mixed-case segment.
 */
// Dedupe is CASE-SENSITIVE on the trimmed value: CDN cache keys are
// case-sensitive URLs, so two segments differing only by casing are two
// distinct cached entries and BOTH must be purged (e.g. a case-only rename
// queues the old and new slug). Blank segments are dropped.
function dedupePathSegmentsPreservingCasing(
  segments: readonly string[]
): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    deduped.push(trimmed);
  }
  return deduped;
}

export function buildStorefrontBlogPurgeUrls(
  identifiers: readonly string[],
  postSlugs: readonly string[],
  categorySlugs: readonly string[] = []
): string[] {
  const urls = new Set<string>();

  const dedupedSlugs = dedupePathSegmentsPreservingCasing(postSlugs);
  const dedupedCategorySlugs =
    dedupePathSegmentsPreservingCasing(categorySlugs);
  // Author hub pages (/blog/author/<slug>) list a byline's posts, so any post
  // create/update/delete/publish can change them. They exist only for the small
  // static, ogabassey-gated author registry — and purge hostnames only resolve
  // for ogabassey — so emitting every registered author slug on every resolved
  // hostname is correct and requires no per-post author threading. The slugs are
  // registry keys (already lowercase, comma-free).
  const authorSlugs = getBlogAuthorSlugs();

  for (const identifier of identifiers) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      urls.add(`https://${hostname}/blog`);
      for (const slug of dedupedSlugs) {
        urls.add(`https://${hostname}/blog/${encodeURIComponent(slug)}`);
      }
      // A post moving into or out of a category changes that category's
      // listing page (/blog/category/<slug>), which shares the same raised
      // edge TTL as /blog and the per-post URLs, so it must be evicted too.
      for (const categorySlug of dedupedCategorySlugs) {
        urls.add(
          `https://${hostname}/blog/category/${encodeURIComponent(categorySlug)}`
        );
      }
      for (const authorSlug of authorSlugs) {
        urls.add(
          `https://${hostname}/blog/author/${encodeURIComponent(authorSlug)}`
        );
      }
    }
  }

  return Array.from(urls);
}

/**
 * One product's purge target: its slug plus the canonical category segment of
 * its PDP (e.g. `smartphones`), or null when the product resolves to the
 * `/products/<slug>` fallback path (no category). Derive `categorySegment`
 * with `resolveProductPurgeCategorySegment` so it matches the URL the
 * storefront actually serves.
 */
export interface StorefrontProductPurgeEntry {
  /** Product slug — original casing preserved (the CDN path is case-sensitive). */
  slug: string;
  categorySegment?: string | null;
}

interface ProductPurgeCategoryInput {
  slug?: string | null;
  name?: string | null;
  category?: string | null;
  categories?: { name?: string; slug?: string } | null;
  category_slug?: string | null;
}

/**
 * Derive the canonical category segment for a product's PDP purge URL by
 * reusing the SAME resolution `getProductUrl` performs for the storefront
 * canonical (PR #2914 precedence: direct category join → legacy text →
 * junction), then reading the leading path segment of the resolved path.
 *
 * Returns null when the product resolves to the `/products/<slug>` fallback
 * (no category) so callers only emit the fallback PDP URL. NEVER throws: any
 * failure resolving the URL yields null, so building a purge target can never
 * break the mutation path that schedules it.
 */
export function resolveProductPurgeCategorySegment(
  product: ProductPurgeCategoryInput
): string | null {
  try {
    const slug = product.slug?.trim();
    if (!slug) {
      return null;
    }

    const path = getProductUrl({
      id: '',
      name: product.name ?? '',
      slug,
      category: product.category ?? null,
      categories: product.categories ?? null,
      category_slug: product.category_slug ?? null,
      // Ignore any stored canonical_url: the derived slug/category path is the
      // URL the PDP canonicalizes to and edge-caches (getValidatedProductUrl
      // discards a divergent canonical_url), so it is the correct purge target.
      canonical_url: null,
    });

    const [firstSegment] = path.split('/').filter(Boolean);
    if (!firstSegment || firstSegment.toLowerCase() === 'products') {
      return null;
    }
    return firstSegment;
  } catch {
    return null;
  }
}

/**
 * Normalize a PostgREST to-one category embed (`categories:category_id(slug)`),
 * which comes back as an object, an array, or null, to its single non-blank
 * slug (or null). Mirrors `firstJoinedCategory` in
 * `cached-product-canonical-paths.ts`.
 */
function extractDirectJoinCategorySlug(categories: unknown): string | null {
  const record = Array.isArray(categories) ? categories[0] : categories;
  if (record && typeof record === 'object' && 'slug' in record) {
    const slug = (record as { slug?: unknown }).slug;
    if (typeof slug === 'string' && slug.trim()) {
      return slug.trim();
    }
  }
  return null;
}

/**
 * Normalize a PostgREST junction embed (`product_categories(categories(slug))`)
 * to the first non-blank joined category slug (or null). Mirrors the loop in
 * `normalizeJoinedCategory` (`cached-product-canonical-paths.ts`).
 */
function extractJunctionCategorySlug(
  productCategories: unknown
): string | null {
  if (!Array.isArray(productCategories)) {
    return null;
  }
  for (const entry of productCategories) {
    const categories =
      entry && typeof entry === 'object'
        ? (entry as { categories?: unknown }).categories
        : null;
    const slug = extractDirectJoinCategorySlug(categories);
    if (slug) {
      return slug;
    }
  }
  return null;
}

/**
 * The raw PostgREST product row shape a purge caller reads to resolve a PDP's
 * canonical category segment: the legacy text column plus the direct
 * `category_id` join and the `product_categories` junction embeds.
 */
export interface ProductPurgeCategoryRow {
  slug?: string | null;
  name?: string | null;
  category?: string | null;
  /** `categories:category_id(slug)` embed (object | array | null). */
  categories?: unknown;
  /** `product_categories(categories(slug))` junction embed. */
  product_categories?: unknown;
}

/**
 * Resolve a product's canonical PDP category segment from a raw product row,
 * applying the SAME precedence the storefront canonical uses
 * (`normalizeJoinedCategory`, PR #2914): the direct `category_id` join wins,
 * then the legacy text column (which suppresses the junction so `getProductUrl`
 * derives the slug from the text), and the `product_categories` junction only
 * when both are absent. Without this, a product assigned ONLY via the junction
 * (no `category_id`, no legacy text) would resolve to the `/products/<slug>`
 * fallback here while the storefront serves it under `/<junction-category>/…`,
 * leaving the categorized PDP and category listing un-purged. Never throws.
 */
export function resolveProductPurgeCategorySegmentForRow(
  row: ProductPurgeCategoryRow
): string | null {
  const directSlug = extractDirectJoinCategorySlug(row.categories);
  let joinedCategory: { slug: string } | null = null;
  if (directSlug) {
    joinedCategory = { slug: directSlug };
  } else if (!row.category?.trim()) {
    const junctionSlug = extractJunctionCategorySlug(row.product_categories);
    joinedCategory = junctionSlug ? { slug: junctionSlug } : null;
  }
  return resolveProductPurgeCategorySegment({
    slug: row.slug,
    name: row.name,
    category: row.category,
    categories: joinedCategory,
  });
}

function dedupeProductPurgeEntries(
  entries: readonly StorefrontProductPurgeEntry[]
): Array<{ slug: string; categorySegment: string | null }> {
  const seen = new Set<string>();
  const deduped: Array<{ slug: string; categorySegment: string | null }> = [];
  for (const entry of entries) {
    const slug = entry.slug?.trim();
    if (!slug) {
      continue;
    }
    const rawSegment = entry.categorySegment?.trim() ?? '';
    // Dedupe by the EXACT (slug, segment) pair: CDN paths are case-sensitive,
    // so case-only-distinct entries are distinct cached URLs (e.g. a case-only
    // rename queues old + new) and BOTH must survive to be purged.
    const key = `${slug}|${rawSegment}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({ slug, categorySegment: rawSegment || null });
  }
  return deduped;
}

export interface BuildStorefrontProductPurgeUrlsOptions {
  /**
   * Emit ONLY the listing surfaces (home `/`, the all-products listing
   * `/products`, and each distinct category listing `/<category>`) and skip the
   * per-product PDP URLs. Used by high-cardinality bulk operations so a single
   * op does not fan out one purge per product past Cloudflare's per-request URL
   * budget — the short-TTL PDPs self-heal, and the listings (which every
   * affected product shares) are still evicted. The entries' category segments
   * still drive which listings are emitted.
   */
  listingsOnly?: boolean;
}

/**
 * Build the canonical public URLs to evict from Cloudflare when a storefront's
 * products change. For every resolved hostname of a matched storefront this
 * emits, per affected product: the canonical PDP `/<category>/<slug>` (when the
 * category is known) and the always-valid fallback `/products/<slug>`; plus,
 * once per hostname, each affected category listing `/<category>`, the
 * all-products listing `/products`, and the home page `/` (all list products).
 * Storefronts without a public cache policy resolve to no hostnames and return
 * an empty list (purge is a no-op).
 *
 * With `listingsOnly`, the per-product PDP URLs are skipped and only the shared
 * listing surfaces are emitted (see the option's docs).
 */
export function buildStorefrontProductPurgeUrls(
  identifiers: readonly string[],
  entries: readonly StorefrontProductPurgeEntry[],
  options: BuildStorefrontProductPurgeUrlsOptions = {}
): string[] {
  const dedupedEntries = dedupeProductPurgeEntries(entries);
  if (dedupedEntries.length === 0) {
    return [];
  }

  const categorySegments = dedupePathSegmentsPreservingCasing(
    dedupedEntries
      .map((entry) => entry.categorySegment ?? '')
      .filter((segment): segment is string => segment.length > 0)
  );

  const urls = new Set<string>();
  for (const identifier of identifiers) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      // The storefront home lists products, so any product mutation can change
      // it — evict it once per hostname.
      urls.add(`https://${hostname}/`);
      // The all-products listing (/products) is a cacheable public document
      // rendered from the product index, so any create / delete / status change
      // can leave it stale — evict it once per hostname too.
      urls.add(`https://${hostname}/products`);

      if (!options.listingsOnly) {
        for (const entry of dedupedEntries) {
          // The canonical categorized PDP is the URL the storefront serves 200
          // for (mismatched paths 308 away), so evict it when the category is
          // known.
          if (entry.categorySegment) {
            urls.add(
              `https://${hostname}/${encodeURIComponent(
                entry.categorySegment
              )}/${encodeURIComponent(entry.slug)}`
            );
          }
          // The `/products/<slug>` fallback PDP path resolves for every product
          // regardless of category, so always evict it.
          urls.add(
            `https://${hostname}/products/${encodeURIComponent(entry.slug)}`
          );
        }
      }

      // Category listing pages list their products, so a product entering,
      // leaving, or changing within a category must evict them.
      for (const segment of categorySegments) {
        urls.add(`https://${hostname}/${encodeURIComponent(segment)}`);
      }
    }
  }

  return Array.from(urls);
}
