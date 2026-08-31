import type { PublishProduct } from '@/schemas/jumia/publish-products';
import type { JumiaProductMappingState } from './publish-products-data-loader';

function getSellableProductSkus(product: PublishProduct): string[] {
  const variantSkus = (product.variants ?? [])
    .filter(
      (variant) =>
        variant.is_inventory_anchor !== true &&
        typeof variant.sku === 'string' &&
        variant.sku.trim()
    )
    .map((variant) => variant.sku?.trim() ?? '');

  if (variantSkus.length > 0) {
    return Array.from(new Set(variantSkus));
  }

  return product.sku?.trim() ? [product.sku.trim()] : [];
}

export function isJumiaProductFullyMapped(
  product: PublishProduct,
  mappings: readonly JumiaProductMappingState[] | undefined
): boolean {
  const sellerSkus = getSellableProductSkus(product);
  if (!mappings || mappings.length === 0) {
    return false;
  }

  const mappedSkus = new Set(
    mappings
      .filter((mapping) => mapping.syncStatus !== 'error')
      .map((mapping) => mapping.sellerSku)
  );
  if (sellerSkus.length === 0) {
    return mappedSkus.size > 0;
  }
  return sellerSkus.every((sellerSku) => mappedSkus.has(sellerSku));
}
