import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
import type { loadCategoryCompareHubData } from './load-category-compare-hub-data';

export type CategoryCompareHubData = NonNullable<
  Awaited<ReturnType<typeof loadCategoryCompareHubData>>
>;

const CATEGORY_COMPARE_HUB_LINK_LIMIT = 48;
const CATEGORY_COMPARE_HUB_MIN_LINKS_PER_GROUP = 6;

/**
 * Builds the hub's compare-link list from loaded hub data. Extracted from the
 * hub page so the page, the thin-hub 404 guard, and the proxy's empty-hub
 * preflight (via /api/internal/compare-hub-status) all share ONE definition of
 * "which links does this hub have" — the hard-404 preflight must never judge
 * emptiness by a different criterion than the page that renders (or 404s) it.
 */
export function buildCategoryCompareHubLinks(data: CategoryCompareHubData) {
  const productGroups =
    data.productGroups?.length > 0
      ? data.productGroups
      : [
          {
            categoryName: data.categoryName,
            categorySlug: data.categorySlug,
            products: data.products,
          },
        ];
  const linksPerGroup = Math.max(
    CATEGORY_COMPARE_HUB_MIN_LINKS_PER_GROUP,
    Math.ceil(CATEGORY_COMPARE_HUB_LINK_LIMIT / productGroups.length)
  );

  return productGroups
    .flatMap((group) =>
      buildCompareLinkGraph({
        storeUrl: data.storeUrl,
        categorySlug: group.categorySlug,
        categoryName: group.categoryName,
        products: group.products,
        productsAreKnownActive: true,
        maxLinks: linksPerGroup,
      })
    )
    .slice(0, CATEGORY_COMPARE_HUB_LINK_LIMIT);
}
