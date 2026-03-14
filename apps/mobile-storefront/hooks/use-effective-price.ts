/**
 * useEffectivePrice - Calculates the displayed price based on selected product
 * options (condition, storage, variant) and any negotiated price.
 */

import type {
  Product,
  ProductCondition,
  ProductVariant,
} from '@/types/product';

export interface EffectivePrice {
  price: number;
  comparePrice: number | undefined;
}

function calculateEffectivePrice(
  product: Product,
  selectedVariant: ProductVariant | null,
  selectedCondition: ProductCondition | null
): EffectivePrice {
  let price = product.price;
  let comparePrice = product.compare_at_price;

  // Apply condition price if different condition selected
  if (selectedCondition && product.offers) {
    const offer = product.offers.find((o) => o.condition === selectedCondition);
    if (offer) {
      price = offer.price;
      comparePrice = offer.compare_at_price;
    }
  }

  if (selectedVariant) {
    if (selectedVariant.price_override !== undefined) {
      price = selectedVariant.price_override;
      comparePrice = undefined;
    } else if (selectedVariant.price_modifier !== undefined) {
      price += selectedVariant.price_modifier;

      if (comparePrice !== undefined && comparePrice < price) {
        comparePrice = undefined;
      }
    }
  }

  price = Math.max(0, price);

  return { price, comparePrice };
}

export function useEffectivePrice(
  product: Product | null | undefined,
  selectedVariant: ProductVariant | null,
  selectedCondition: ProductCondition | null,
  negotiatedPrice: number | null
): EffectivePrice {
  if (!product) {
    return { price: 0, comparePrice: undefined };
  }

  const { price: calculatedPrice, comparePrice } = calculateEffectivePrice(
    product,
    selectedVariant,
    selectedCondition
  );

  // M11 FIX: Use ?? instead of || so negotiatedPrice of 0 is not treated as falsy
  const price = Math.max(0, negotiatedPrice ?? calculatedPrice);
  const effectiveComparePrice =
    negotiatedPrice !== null ? undefined : comparePrice;

  return { price, comparePrice: effectiveComparePrice };
}
