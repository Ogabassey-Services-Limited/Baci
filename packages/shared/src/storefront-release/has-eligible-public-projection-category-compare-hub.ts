import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

interface SeoCategory {
  id: string;
  parentId?: string | null;
  slug: string;
  status?: string;
}

interface SeoProduct {
  available: boolean;
  categoryIds?: readonly string[];
  brand?: string | null;
  createdAt?: string;
  id?: string;
  name: string;
  priceMinor: number;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
  primaryCategoryId?: string | null;
  slug: string;
}

const CATEGORY_COMPARE_HUB_PRODUCT_LIMIT = 300;

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
      .filter(
        (candidate) =>
          candidate.parentId === category.id &&
          (candidate.status === undefined || candidate.status === 'active')
      )
      .map((candidate) => candidate.slug),
  ]);
  return [...maintainedComparePaths].some((path) => {
    const categoryMatch = /^\/([^/]+)\/compare\//u.exec(path);
    const matchedCategory = categoryMatch?.[1]
      ? categoriesBySlug.get(categoryMatch[1])
      : undefined;
    return (
      categoryMatch?.[1] !== undefined &&
      eligibleCategorySlugs.has(categoryMatch[1]) &&
      matchedCategory !== undefined &&
      hasEligibleCommercialSupportPath(path, categoriesBySlug, products, {
        currency,
        maintainedComparePaths,
        productInventoryLimit: CATEGORY_COMPARE_HUB_PRODUCT_LIMIT,
        // The hub builds links independently for the requested category and
        // each direct child. Brand candidates must therefore use the same
        // exact-category group rather than the compare page's broader
        // parent-plus-children scope.
        brandCategoryScopeIds: new Set([matchedCategory.id]),
      })
    );
  });
}
