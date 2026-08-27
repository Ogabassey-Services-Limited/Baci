import { toFiniteNumberOrNull } from './transaction-review-row-helpers';

export const DISCOUNT_TOLERANCE = 0.01;

export function getProductVariantIdentity(
  productId: unknown,
  variantId: unknown
): string | null {
  if (
    typeof productId !== 'string' ||
    productId.trim().length === 0 ||
    (variantId !== null && typeof variantId !== 'string')
  ) {
    return null;
  }

  return JSON.stringify([productId, variantId ?? null]);
}

export function toPositiveInteger(value: unknown): number | null {
  const numericValue = toFiniteNumberOrNull(value);
  return numericValue != null &&
    Number.isInteger(numericValue) &&
    numericValue > 0
    ? numericValue
    : null;
}
