import type { Product } from '@/types/product';

export function getSelectionSyncSignature(product: Product | null) {
  if (!product) {
    return '';
  }

  return JSON.stringify({
    colorImages: product.color_images ?? null,
    images: product.images ?? null,
    colors: product.colors ?? null,
    id: product.id,
    variantAttributes: product.variant_attributes ?? null,
    variants:
      product.variants?.map((variant) => ({
        attributes: variant.attributes ?? null,
        id: variant.id,
        stock_quantity: variant.stock_quantity ?? null,
      })) ?? [],
  });
}
