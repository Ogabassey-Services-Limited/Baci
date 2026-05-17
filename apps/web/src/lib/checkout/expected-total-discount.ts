export const MAX_AUTO_NEGOTIATION_DISCOUNT_RATE = 0.03;
const TOTAL_PARITY_TOLERANCE = 1;
const MIN_SUBTOTAL_FOR_WHOLE_NAIRA_CAP_ROUNDING = 1000;

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
    canonicalSubtotal * MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
  );

  if (requiredDiscount > maxAutoNegotiationDiscount) {
    const canAcceptRoundedCounterOffer =
      canonicalSubtotal >= MIN_SUBTOTAL_FOR_WHOLE_NAIRA_CAP_ROUNDING &&
      Number.isInteger(expectedTotal) &&
      Number.isInteger(requiredDiscount) &&
      requiredDiscount <= Math.ceil(maxAutoNegotiationDiscount);

    if (canAcceptRoundedCounterOffer) {
      return requiredDiscount;
    }

    return 0;
  }

  return requiredDiscount;
}
