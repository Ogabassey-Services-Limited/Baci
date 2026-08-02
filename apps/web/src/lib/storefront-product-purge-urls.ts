import { getProductUrl } from '@/lib/seo-utils';
import {
  dedupePathSegmentsPreservingCasing,
  resolvePurgeHostnames,
} from '@/lib/storefront-purge-shared';

// Past this many DISTINCT product purge targets in one operation, use the
// bounded hostname-wide Cloudflare purge instead of URL-by-URL fan-out. That
// evicts every affected PDP (plus other public documents for this storefront)
// while remaining bounded by the configured aliases. Shared by every
// product-purge caller; compare `countDistinctProductPurgeEntries`.
export const PURGE_WHOLE_STOREFRONT_THRESHOLD = 50;

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
  /**
   * Product id — the URL path segment (`/products/<id>`, `/<category>/<id>`) for
   * legacy rows whose slug is null/blank, so it is the EFFECTIVE slug fallback
   * when resolving the category segment below.
   */
  id?: string | null;
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
  // Legacy rows can carry a null/blank slug but stay addressable by id
  // (`/products/<id>`, `/<category>/<id>`), so resolve the segment against the
  // EFFECTIVE slug (id fallback). Without it, a null slug short-circuits
  // `resolveProductPurgeCategorySegment` to null BEFORE the join is considered,
  // dropping the categorized PDP + category listing from the purge. Passing the
  // id is safe: `getProductUrl` only uses the slug as the URL path segment,
  // which IS the id for these rows.
  const effectiveSlug = row.slug?.trim() || row.id;
  return resolveProductPurgeCategorySegment({
    slug: effectiveSlug,
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

/**
 * Count the DISTINCT purge targets in `entries`, deduped by the exact
 * `${slug}|${segment}` pair — the SAME key `dedupeProductPurgeEntries` (and thus
 * `buildStorefrontProductPurgeUrls`) collapses on. The hostname-purge fallback
 * threshold MUST use this, never `entries.length`: an import sheet with repeated
 * rows for one product (or callers that fan a product into several entries)
 * would otherwise escalate a small, well-under-budget change unnecessarily.
 */
export function countDistinctProductPurgeEntries(
  entries: readonly StorefrontProductPurgeEntry[]
): number {
  return dedupeProductPurgeEntries(entries).length;
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
 */
export function buildStorefrontProductPurgeUrls(
  identifiers: readonly string[],
  entries: readonly StorefrontProductPurgeEntry[]
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

      // Category listing pages list their products, so a product entering,
      // leaving, or changing within a category must evict them.
      for (const segment of categorySegments) {
        urls.add(`https://${hostname}/${encodeURIComponent(segment)}`);
      }
    }
  }

  return Array.from(urls);
}
