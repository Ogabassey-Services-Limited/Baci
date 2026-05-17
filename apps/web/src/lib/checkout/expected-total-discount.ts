/**
 * Maximum auto-negotiation discount cap as a rate (0.03 = 3%).
 * AI-accepted offers stay within 3%; deeper discounts require human review.
 */
export const MAX_AUTO_NEGOTIATION_DISCOUNT_RATE = 0.03;
/**
 * Allowed total-parity drift in currency units. A <= ₦1 difference covers
 * display/rounding drift and is not treated as a negotiated discount.
 */
const TOTAL_PARITY_TOLERANCE = 1;
/**
 * Minimum subtotal in NGN for whole-naira cap rounding. Example: ₦1,001 * 3%
 * = ₦30.03, so a ₦31 integer counter-offer can still pass policy.
 */
const MIN_SUBTOTAL_FOR_WHOLE_NAIRA_CAP_ROUNDING = 1000;

function roundMoney(value: number): number {
  const sign = Math.sign(value);
  const minorUnits = Math.round(Number(`${Math.abs(value)}e2`));
  return sign * Number(`${minorUnits}e-2`);
}

interface ExpectedTotalCalculationInput {
  canonicalSubtotal: number;
  canonicalTaxAmount: number;
  shippingFee: number;
  giftWrappingFee: number;
}

interface ExpectedTotalDiscountInput extends ExpectedTotalCalculationInput {
  expectedTotal: number | null;
}

type MoneyInputName = keyof ExpectedTotalCalculationInput;

function assertNonNegativeMoneyInput(
  parameterName: MoneyInputName,
  value: number
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(
      `computeExpectedTotalDiscount expected ${parameterName} to be a finite number; received ${String(value)}`
    );
  }

  if (value < 0) {
    throw new RangeError(
      `computeExpectedTotalDiscount expected ${parameterName} to be non-negative; received ${value}`
    );
  }
}

function validateExpectedTotalInputs(
  input: ExpectedTotalCalculationInput
): void {
  assertNonNegativeMoneyInput('canonicalSubtotal', input.canonicalSubtotal);
  assertNonNegativeMoneyInput('canonicalTaxAmount', input.canonicalTaxAmount);
  assertNonNegativeMoneyInput('shippingFee', input.shippingFee);
  assertNonNegativeMoneyInput('giftWrappingFee', input.giftWrappingFee);
}

function computeCanonicalOrderTotal({
  canonicalSubtotal,
  canonicalTaxAmount,
  shippingFee,
  giftWrappingFee,
}: ExpectedTotalCalculationInput): number {
  return roundMoney(
    canonicalSubtotal + canonicalTaxAmount + shippingFee + giftWrappingFee
  );
}

export function hasExpectedTotalMismatch(
  input: ExpectedTotalDiscountInput
): boolean {
  validateExpectedTotalInputs(input);

  if (input.expectedTotal === null) {
    return false;
  }

  const requiredDiscount = roundMoney(
    computeCanonicalOrderTotal(input) - input.expectedTotal
  );

  return Math.abs(requiredDiscount) > TOTAL_PARITY_TOLERANCE;
}

export function computeExpectedTotalDiscount({
  canonicalSubtotal,
  canonicalTaxAmount,
  shippingFee,
  giftWrappingFee,
  expectedTotal,
}: ExpectedTotalDiscountInput): number {
  validateExpectedTotalInputs({
    canonicalSubtotal,
    canonicalTaxAmount,
    shippingFee,
    giftWrappingFee,
  });

  if (expectedTotal === null) {
    return 0;
  }

  const canonicalOrderTotal = computeCanonicalOrderTotal({
    canonicalSubtotal,
    canonicalTaxAmount,
    shippingFee,
    giftWrappingFee,
  });
  const requiredDiscount = roundMoney(canonicalOrderTotal - expectedTotal);

  if (requiredDiscount <= 0) {
    return 0;
  }

  // Discounted totals for VAT-registered merchants include both the pre-tax
  // subtotal reduction and the tax reduction that follows from it. Cap against
  // subtotal + tax (not shipping/gift) so valid 3% offers remain payable.
  const maxAutoNegotiationDiscount = roundMoney(
    (canonicalSubtotal + canonicalTaxAmount) *
      MAX_AUTO_NEGOTIATION_DISCOUNT_RATE
  );

  if (requiredDiscount > maxAutoNegotiationDiscount) {
    // `maxAutoNegotiationDiscount` is rounded to 2 decimals by `roundMoney`;
    // `Math.ceil` intentionally lets integer `requiredDiscount`/`expectedTotal`
    // values accept a whole-naira cap (e.g. 30.03 -> 31) once subtotals reach
    // `MIN_SUBTOTAL_FOR_WHOLE_NAIRA_CAP_ROUNDING`.
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

  if (requiredDiscount <= TOTAL_PARITY_TOLERANCE) {
    return requiredDiscount;
  }

  return requiredDiscount;
}
