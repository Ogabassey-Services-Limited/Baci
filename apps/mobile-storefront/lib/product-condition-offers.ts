import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import type { ProductCondition, ProductConditionOffer } from '@/types/product';

export function findMatchingConditionOffer(
  offers: ProductConditionOffer[] | null | undefined,
  selectedCondition: ProductCondition | null
): ProductConditionOffer | null {
  if (!offers?.length) {
    return null;
  }

  if (!selectedCondition) {
    return offers.length === 1 ? offers[0] : null;
  }

  const normalizedSelectedCondition =
    normalizeCanonicalProductCondition(selectedCondition);

  return (
    offers.find((offer) => offer.condition === selectedCondition) ??
    (normalizedSelectedCondition
      ? offers.find(
          (offer) =>
            normalizeCanonicalProductCondition(offer.condition) ===
            normalizedSelectedCondition
        )
      : undefined) ??
    null
  );
}
