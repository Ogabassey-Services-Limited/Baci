import {
  resolveDefaultVariantSelection,
  resolveLowestPricedVariantSelection,
} from '@baci/shared/lib';
import type { Product } from '@/types/product';

export function resolveProductDetailDefaultVariantSelection(
  product: Product | null
) {
  if (!product) {
    return null;
  }

  // Product detail pages intentionally open on the cheapest buyable variant
  // first. Listing/cards/cart keep the shared condition-first resolver.
  return (
    resolveLowestPricedVariantSelection(product) ??
    resolveDefaultVariantSelection(product)
  );
}
