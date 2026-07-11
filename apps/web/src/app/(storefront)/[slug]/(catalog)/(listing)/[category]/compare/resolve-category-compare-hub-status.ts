import {
  getCachedCategories,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { buildCategoryCompareHubLinks } from './category-compare-hub-links';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';

export type CategoryCompareHubStatus =
  // Positively-confirmed empty hub on a live, published store → hard 404.
  | { kind: 'empty' }
  // Positively-confirmed renderable hub (published, healthy, >=1 link). Carries
  // merchantId so the route can tag its cache entry for product/category purge.
  | { kind: 'renderable'; merchantId: string }
  // Fail-open: draft store, degraded categories, or degraded inventory. The
  // proxy treats this as renderable, but the route must NEVER cache it — a
  // cached fail-open verdict would keep the proxy from emitting the hard 404
  // once the ambiguity resolves (e.g. a draft store publishes with an empty
  // hub, or a categories outage recovers).
  | { kind: 'unknown' };

/**
 * Resolves whether a category compare hub would 404 (anti-thin-page guard) or
 * render. The proxy preflight calls this via /api/internal/compare-hub-status
 * so crawlers get a true 404 status for empty hubs — under PPR the page's own
 * notFound() only yields a soft-404 (200 + noindex shell).
 *
 * The one outcome this must NEVER produce is a hard 404 on a hub the page would
 * serve with a 200, so it only reports 'empty' for a POSITIVELY-confirmed empty
 * hub on a live, published store with successfully-loaded data. Every ambiguous
 * or degraded state fails open to 'renderable':
 *
 * - Unpublished/draft store: the storefront layout serves the coming-soon shell
 *   (200) before the hub page ever runs, so its hubs must not be hard-404ed.
 * - Degraded categories load: `getCachedCategories` swallows a transient query
 *   error and returns `[]`, which is indistinguishable from a genuinely
 *   category-less store; a store-wide categories outage would otherwise
 *   hard-404 every live hub. This mirrors the `inventoryDegraded` fail-open on
 *   the per-category inventory path.
 *
 * A genuinely-unknown category on an established store (categories loaded
 * non-empty, slug absent) still resolves to 'empty' — that closes the
 * unbounded /{unknown}/compare soft-404 crawl trap. The link determination
 * flows through the same loaders + buildCategoryCompareHubLinks the page uses,
 * so a hub that gains eligible products flips back to 'renderable' (a 200)
 * immediately.
 */
export async function resolveCategoryCompareHubStatus(input: {
  merchantSlug: string;
  categorySlug: string;
}): Promise<CategoryCompareHubStatus> {
  const merchant = await getMerchantByIdentifier(input.merchantSlug);

  // Genuine "no such storefront": getMerchantByIdentifier returns null only on
  // a successful no-row response (transient failures throw and the route fails
  // open), so hard-404ing here matches the layout's own notFound().
  if (!merchant) {
    return { kind: 'empty' };
  }

  // Draft store: mirror the storefront layout, which serves StoreNotPublished
  // (200) for unpublished merchants outside development. Fail open, uncached.
  if (!merchant.is_published && process.env.NODE_ENV !== 'development') {
    return { kind: 'unknown' };
  }

  const requestedCategorySlug = canonicalizeCategorySlug(input.categorySlug);
  if (!requestedCategorySlug) {
    return { kind: 'empty' };
  }

  const categories = await getCachedCategories(merchant.id);
  // Empty list is ambiguous: a transient (swallowed) categories-load failure or
  // a genuinely category-less store. Fail open, uncached — never hard-404 nor
  // cache a verdict on this signal.
  if (categories.length === 0) {
    return { kind: 'unknown' };
  }

  const data = await loadCategoryCompareHubData(input);
  // Null despite non-empty categories = the slug is genuinely absent on this
  // established store: hard-404 (crawl-trap closure).
  if (!data) {
    return { kind: 'empty' };
  }

  // Degraded inventory (a group's load threw, fail-open []): fail open, uncached
  // — a transient failure must never become a hard 404 or a cached verdict.
  if (data.inventoryDegraded) {
    return { kind: 'unknown' };
  }

  const compareLinks = buildCategoryCompareHubLinks(data);
  return compareLinks.length === 0
    ? { kind: 'empty' }
    : { kind: 'renderable', merchantId: merchant.id };
}
