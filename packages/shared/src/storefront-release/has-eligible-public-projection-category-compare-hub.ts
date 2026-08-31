import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

interface SeoCategory {
  id: string;
  parentId?: string | null;
  slug: string;
}

interface SeoProduct {
  available: boolean;
  categoryIds?: readonly string[];
  name: string;
  priceMinor: number;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  primaryCategoryId?: string | null;
  slug: string;
}

/** Checks whether a category has a maintained, eligible comparison link. */
export function hasEligiblePublicProjectionCategoryCompareHub(
  categorySlug: string,
  categoriesBySlug: ReadonlyMap<string, SeoCategory>,
  products: readonly SeoProduct[],
  maintainedComparePaths: ReadonlySet<string>,
  currency: string
): boolean {
  const category = categoriesBySlug.get(categorySlug);
  if (!category) return false;
  const descendantIds = new Set([category.id]);
  const eligibleCategorySlugs = new Set([categorySlug]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const candidate of categoriesBySlug.values()) {
      if (
        !candidate.parentId ||
        !descendantIds.has(candidate.parentId) ||
        descendantIds.has(candidate.id)
      )
        continue;
      descendantIds.add(candidate.id);
      eligibleCategorySlugs.add(candidate.slug);
      expanded = true;
    }
  }
  return [...maintainedComparePaths].some((path) => {
    const categoryMatch = /^\/([^/]+)\/compare\//u.exec(path);
    return (
      categoryMatch?.[1] !== undefined &&
      eligibleCategorySlugs.has(categoryMatch[1]) &&
      hasEligibleCommercialSupportPath(path, categoriesBySlug, products, {
        currency,
        maintainedComparePaths,
      })
    );
  });
}
