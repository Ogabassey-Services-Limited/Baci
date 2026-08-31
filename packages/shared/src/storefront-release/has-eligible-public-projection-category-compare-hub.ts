import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

interface SeoCategory {
  id: string;
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
  return [...maintainedComparePaths].some(
    (path) =>
      path.startsWith(`/${categorySlug}/compare/`) &&
      hasEligibleCommercialSupportPath(
        path,
        categoriesBySlug,
        products,
        { currency, maintainedComparePaths }
      )
  );
}
