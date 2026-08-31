interface CompareCategory {
  id: string;
}

interface CompareProduct {
  categoryIds?: readonly string[];
  createdAt?: string;
  id: string;
  primaryCategoryId?: string | null;
  productKeySpecs?: Readonly<Record<string, unknown>> | null;
}

const COMPARE_HUB_CATEGORY_SCAN_LIMIT = 80;
const COMPARE_HUB_PRODUCTS_PER_CATEGORY_LIMIT = 80;

function compareCreatedAtDescending(
  left: string | undefined,
  right: string | undefined
): number {
  const leftTimestamp = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTimestamp = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  return rightTimestamp - leftTimestamp;
}

function haveDifferentComparableSpecs(
  left: CompareProduct,
  right: CompareProduct
): number {
  const leftSpecs = left.productKeySpecs ?? {};
  const rightSpecs = right.productKeySpecs ?? {};
  const sharedKeys = Object.keys(leftSpecs).filter((key) => key in rightSpecs);
  return sharedKeys.filter((key) => {
    const leftValue = leftSpecs[key];
    const rightValue = rightSpecs[key];
    if (Array.isArray(leftValue) && Array.isArray(rightValue))
      return (
        JSON.stringify([...leftValue].map(String).sort()) !==
        JSON.stringify([...rightValue].map(String).sort())
      );
    return leftValue !== rightValue;
  }).length;
}

/** Mirrors the origin's bounded, created-at/id ordered compare inventory. */
export function hasEligiblePublicProjectionCompareHub(
  categories: readonly CompareCategory[],
  products: readonly CompareProduct[]
): boolean {
  for (const category of categories.slice(0, COMPARE_HUB_CATEGORY_SCAN_LIMIT)) {
    const categoryProducts = products
      .filter((product) =>
        [
          ...(product.categoryIds ?? []),
          ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
        ].includes(category.id)
      )
      .sort(
        (left, right) =>
          compareCreatedAtDescending(left.createdAt, right.createdAt) ||
          left.id.localeCompare(right.id)
      )
      .slice(0, COMPARE_HUB_PRODUCTS_PER_CATEGORY_LIMIT);
    for (let leftIndex = 0; leftIndex < categoryProducts.length; leftIndex += 1)
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < categoryProducts.length;
        rightIndex += 1
      )
        if (
          haveDifferentComparableSpecs(
            categoryProducts[leftIndex],
            categoryProducts[rightIndex]
          ) >= 3
        )
          return true;
  }
  return false;
}
