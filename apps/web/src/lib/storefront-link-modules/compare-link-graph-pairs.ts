import { parseCompareSlug } from '@/lib/storefront-compare/compare-slugs';
import type { CompareLinkGraphProduct } from './compare-link-graph';

export function forEachComparePair(
  products: CompareLinkGraphProduct[],
  anchorProductSlug: string | undefined,
  visit: (left: CompareLinkGraphProduct, right: CompareLinkGraphProduct) => void
) {
  const anchorSlug = anchorProductSlug?.trim();

  if (anchorSlug) {
    const anchorProduct = products.find(
      (product) => product.slug?.trim() === anchorSlug
    );

    if (!anchorProduct) {
      return;
    }

    for (const product of products) {
      if (product.slug?.trim() === anchorSlug) {
        continue;
      }

      visit(anchorProduct, product);
    }

    return;
  }

  for (let leftIndex = 0; leftIndex < products.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < products.length;
      rightIndex += 1
    ) {
      visit(products[leftIndex], products[rightIndex]);
    }
  }
}

export function buildCanonicalPair(input: {
  comparisonSlug: string;
  left: CompareLinkGraphProduct;
  leftSlug: string;
  right: CompareLinkGraphProduct;
  rightSlug: string;
}) {
  const parsed = parseCompareSlug(input.comparisonSlug);

  if (!parsed) {
    return null;
  }

  if (
    parsed.leftKey === input.leftSlug &&
    parsed.rightKey === input.rightSlug
  ) {
    return {
      left: input.left,
      leftSlug: input.leftSlug,
      right: input.right,
      rightSlug: input.rightSlug,
    };
  }

  if (
    parsed.leftKey === input.rightSlug &&
    parsed.rightKey === input.leftSlug
  ) {
    return {
      left: input.right,
      leftSlug: input.rightSlug,
      right: input.left,
      rightSlug: input.leftSlug,
    };
  }

  return null;
}
