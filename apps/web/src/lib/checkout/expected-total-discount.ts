export const MAX_AUTO_NEGOTIATION_DISCOUNT_RATE = 0.03;
const TOTAL_PARITY_TOLERANCE = 1;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface ExpectedTotalDiscountInput {
  canonicalSubtotal: number;
  canonicalTaxAmount: number;
  shippingFee: number;
  giftWrappingFee: number;
  expectedTotal: number | null;
}

export function computeExpectedTotalDiscount({
  canonicalSubtotal,
  canonicalTaxAmount,
  shippingFee,
  giftWrappingFee,
  expectedTotal,
}: ExpectedTotalDiscountInput): number {
  if (expectedTotal === null) {
    return 0;
  }

  const canonicalOrderTotal = roundMoney(
    canonicalSubtotal + canonicalTaxAmount + shippingFee + giftWrappingFee
  );
  const requiredDiscount = roundMoney(canonicalOrderTotal - expectedTotal);

  if (requiredDiscount <= TOTAL_PARITY_TOLERANCE) {
    return 0;
  }

  const maxAutoNegotiationDiscount = roundMoney(
    (canonicalSubtotal + canonicalTaxAmount) *
      MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
  );

  if (requiredDiscount > maxAutoNegotiationDiscount + TOTAL_PARITY_TOLERANCE) {
    return 0;
  }

  return requiredDiscount;
}
