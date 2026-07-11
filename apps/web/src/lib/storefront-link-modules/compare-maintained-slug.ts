import { parseCompareSlug } from '@/lib/storefront-compare/compare-slugs';
import {
  type BuildCompareLinkGraphInput,
  buildCompareLinkGraph,
  COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
  type CompareLinkGraphEntry,
  type CompareLinkGraphProduct,
  isActiveCompareProduct,
} from './compare-link-graph';

/**
 * The set of canonical comparison slugs in the UNANCHORED maintained category
 * compare-graph. This is O(activeProducts^2) — it scores + indexability-tests
 * every product pair (buildProductCompareCandidate). The approval selector must
 * not rebuild the complete discovery graph for each already-indexable pair;
 * doing so nested this graph inside up to 150 more graph builds and cost ~14s
 * locally / ~28s on Vercel. Build one request-scoped set from the already-loaded
 * inventory and pass it to isMaintainedCompareGraphSlug for O(1) membership.
 */
export function buildCategoryCompareGraphSlugSet(
  input: BuildCompareLinkGraphInput
): string[] {
  return buildCompareLinkGraph({
    ...input,
    anchorProductSlug: undefined,
    currentComparisonSlug: undefined,
    maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
  }).map((entry) => entry.comparisonSlug);
}

/**
 * Both products of a canonical compare pair are present AND active in the given
 * route products. Used to gate the cached-set fast path: the per-category slug
 * set can outlive a refreshed product inventory (a product unpublished within
 * the cache window), so a warm-but-stale set hit must still be confirmed against
 * the currently-active route products before treating the page as maintained.
 * O(products) — never rebuilds the O(n^2) graph.
 */
function comparePairProductsAreActive(
  leftKey: string,
  rightKey: string,
  products: CompareLinkGraphProduct[],
  productsAreKnownActive: boolean
) {
  const activeSlugs = new Set<string>();
  for (const product of products) {
    if (isActiveCompareProduct(product, productsAreKnownActive)) {
      activeSlugs.add((product.slug as string).trim());
    }
  }

  return activeSlugs.has(leftKey) && activeSlugs.has(rightKey);
}

export function isMaintainedCompareGraphSlug(
  input: BuildCompareLinkGraphInput & {
    comparisonSlug: string;
    // Precomputed unanchored category-graph slugs. When
    // provided, the expensive O(n^2) unanchored build is skipped in favour of
    // an O(1) membership check; the cheap anchored checks still run per URL.
    categoryGraphSlugs?: ReadonlySet<string>;
  }
) {
  const parsed = parseCompareSlug(input.comparisonSlug);

  if (!parsed) {
    return false;
  }

  const isInGraph = (links: CompareLinkGraphEntry[]) =>
    links.some((entry) => entry.comparisonSlug === parsed.canonicalSlug);

  const inCategoryGraph = input.categoryGraphSlugs
    ? // Confirm the warm cached hit against the current route products: the set
      // can be staler than the inventory, so a slug for a since-unpublished
      // product must not stay maintained until the set cache expires.
      input.categoryGraphSlugs.has(parsed.canonicalSlug) &&
      comparePairProductsAreActive(
        parsed.leftKey,
        parsed.rightKey,
        input.products,
        input.productsAreKnownActive ?? false
      )
    : isInGraph(
        buildCompareLinkGraph({
          ...input,
          anchorProductSlug: undefined,
          currentComparisonSlug: undefined,
          maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
        })
      );

  if (inCategoryGraph) {
    return true;
  }

  return [parsed.leftKey, parsed.rightKey].some((anchorProductSlug) =>
    isInGraph(
      buildCompareLinkGraph({
        ...input,
        anchorProductSlug,
        currentComparisonSlug: undefined,
        maxLinks: 8,
      })
    )
  );
}
