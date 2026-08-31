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
  // The origin hub loads the requested category and its direct active
  // children, not the entire descendant tree. Keep the projection eligibility
  // test aligned so a grandchild-only compare pair cannot make the parent
  // route look publishable when the live hub would still be thin.
  const eligibleCategorySlugs = new Set([
    categorySlug,
    ...[...categoriesBySlug.values()]
      .filter((candidate) => candidate.parentId === category.id)
      .map((candidate) => candidate.slug),
  ]);
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
