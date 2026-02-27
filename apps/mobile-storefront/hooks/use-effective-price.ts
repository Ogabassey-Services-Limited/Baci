/**
 * useEffectivePrice - Calculates the displayed price based on selected product
 * options (condition, storage, variant) and any negotiated price.
 */

import type { Product, ProductCondition } from '@/types/product';

export interface EffectivePrice {
  price: number;
  comparePrice: number | undefined;
}

function calculateEffectivePrice(
  product: Product,
  selectedVariant: string | null,
  selectedStorage: string | null,
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

  // Apply storage-based variant price modifier
  if (selectedStorage && product.variants) {
    const variant = product.variants.find(
      (v) =>
        v.attributes?.storage === selectedStorage ||
        v.name?.includes(selectedStorage)
    );
    if (variant) {
      if (variant.price_override !== undefined) {
        price = variant.price_override;
      } else if (variant.price_modifier !== undefined) {
        price += variant.price_modifier;
      }
    }
  }

  // Apply variant price modifier if variant selected (fallback for legacy)
  if (selectedVariant && product.variants) {
    const variant = product.variants.find((v) => v.id === selectedVariant);
    if (variant) {
      if (variant.price_override !== undefined) {
        price = variant.price_override;
      } else if (variant.price_modifier !== undefined) {
        price += variant.price_modifier;
      }
    }
  }

  return { price, comparePrice };
}

export function useEffectivePrice(
  product: Product | null | undefined,
  selectedVariant: string | null,
  selectedStorage: string | null,
  selectedCondition: ProductCondition | null,
  negotiatedPrice: number | null
): EffectivePrice {
  if (!product) {
    return { price: 0, comparePrice: undefined };
  }

  const { price: calculatedPrice, comparePrice } = calculateEffectivePrice(
    product,
    selectedVariant,
    selectedStorage,
    selectedCondition
  );

  // M11 FIX: Use ?? instead of || so negotiatedPrice of 0 is not treated as falsy
  const price = negotiatedPrice ?? calculatedPrice;

  return { price, comparePrice };
}
