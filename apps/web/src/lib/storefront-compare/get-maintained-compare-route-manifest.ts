import {
  type BuildCompareLinkGraphInput,
  buildCompareLinkGraph,
  isActiveCompareProduct,
} from '@/lib/storefront-link-modules/compare-link-graph';
import { buildCategoryCompareGraphSlugSet } from '@/lib/storefront-link-modules/compare-maintained-slug';
import { parseCompareSlug } from './compare-slugs';

const ANCHORED_COMPARE_ROUTE_LIMIT = 8;

/**
 * Builds the complete product-comparison route allow-list for one bounded
 * category inventory snapshot. Alongside discovery and category-graph routes,
 * include the bounded anchored graph emissions used by PDP compare links.
 */
export function getMaintainedCompareRouteManifest(
  input: BuildCompareLinkGraphInput & {
    curatedSlugs: ReadonlySet<string>;
  }
): ReadonlySet<string> {
  const activeProductSlugs = new Set(
    input.products
      .filter((product) =>
        isActiveCompareProduct(product, input.productsAreKnownActive ?? false)
      )
      .map((product) => product.slug?.trim())
      .filter((slug): slug is string => Boolean(slug))
  );
  const slugs = new Set<string>();

  for (const slug of input.curatedSlugs) {
    const parsed = parseCompareSlug(slug);

    if (
      parsed &&
      activeProductSlugs.has(parsed.leftKey) &&
      activeProductSlugs.has(parsed.rightKey)
    ) {
      slugs.add(parsed.canonicalSlug);
    }
  }

  for (const slug of buildCategoryCompareGraphSlugSet(input)) {
    slugs.add(slug);
  }

  for (const anchorProductSlug of activeProductSlugs) {
    for (const entry of buildCompareLinkGraph({
      ...input,
      anchorProductSlug,
      currentComparisonSlug: undefined,
      maxLinks: ANCHORED_COMPARE_ROUTE_LIMIT,
    })) {
      slugs.add(entry.comparisonSlug);
    }
  }

  return slugs;
}
