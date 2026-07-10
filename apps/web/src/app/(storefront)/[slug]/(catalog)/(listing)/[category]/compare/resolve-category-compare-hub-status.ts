import { buildCategoryCompareHubLinks } from './category-compare-hub-links';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';

export type CategoryCompareHubStatus =
  | { kind: 'empty' }
  | { kind: 'renderable' };

/**
 * Resolves whether a category compare hub would 404 (anti-thin-page guard) or
 * render, using EXACTLY the page's own criterion: unknown merchant/category or
 * zero eligible compare links → 'empty'; anything else → 'renderable'.
 *
 * Degraded inventory (a group's load threw, fail-open []) is 'renderable' on
 * purpose, mirroring the page: a transient failure on a live hub must never
 * become a proxy-level hard 404. The proxy preflight calls this via
 * /api/internal/compare-hub-status so crawlers get a true 404 status for empty
 * hubs — under PPR the page's own notFound() only yields a soft-404 (200 +
 * noindex shell). The verdict is computed per request from the same loaders
 * the page uses, so a hub that gains eligible products flips back to
 * 'renderable' (and a 200) immediately.
 */
export async function resolveCategoryCompareHubStatus(input: {
  merchantSlug: string;
  categorySlug: string;
}): Promise<CategoryCompareHubStatus> {
  const data = await loadCategoryCompareHubData(input);

  if (!data) {
    return { kind: 'empty' };
  }

  if (data.inventoryDegraded) {
    return { kind: 'renderable' };
  }

  const compareLinks = buildCategoryCompareHubLinks(data);
  return compareLinks.length === 0 ? { kind: 'empty' } : { kind: 'renderable' };
}
