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
    // Base price is the price-first resolver's fallback when a variant has no
    // absolute price/override, so a base-price change must reseed too.
    price: product.price ?? null,
    variantAttributes: product.variant_attributes ?? null,
    variants:
      product.variants?.map((variant) => ({
        attributes: variant.attributes ?? null,
        id: variant.id,
        price: variant.price ?? null,
        price_modifier: variant.price_modifier ?? null,
        price_override: variant.price_override ?? null,
        stock_quantity: variant.stock_quantity ?? null,
      })) ?? [],
  });
}
