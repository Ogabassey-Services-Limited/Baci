import type { PayPalCaptureResponse } from '@/lib/paypal';

/**
 * Validates the FULL set of captures on a PayPal capture response against the
 * expected presentment amount/currency (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 item 4). The prototype
 * only inspected `captures[0]`, which would accept a partial/split capture or
 * miss a second capture on the order. This sums every capture across every
 * purchase unit, rejects any capture that is not COMPLETED, requires a single
 * consistent currency, and rejects unless the total matches the expected
 * amount within PayPal's rounding tolerance.
 */

const AMOUNT_TOLERANCE = 0.02;

export type CaptureSetValidation =
  | { ok: true; capturedTotal: number; currency: string }
  | { ok: false; reason: string };

export function validatePaypalCaptureSet(
  captureData: Pick<PayPalCaptureResponse, 'purchase_units'>,
  expectedAmount: number,
  expectedCurrency: string | undefined
): CaptureSetValidation {
  if (
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    !expectedCurrency
  ) {
    return { ok: false, reason: 'Missing PayPal presentment metadata' };
  }

  const normalizedExpectedCurrency = expectedCurrency.toUpperCase();

  const captures = captureData.purchase_units.flatMap(
    (unit) => unit.payments.captures
  );

  if (captures.length === 0) {
    return { ok: false, reason: 'No captures found in PayPal response' };
  }

  let capturedTotal = 0;
  for (const capture of captures) {
    if (capture.status !== 'COMPLETED') {
      return { ok: false, reason: 'PayPal capture is not completed' };
    }

    const value = Number(capture.amount.value);
    const currency = capture.amount.currency_code.toUpperCase();

    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: 'PayPal capture amount is invalid' };
    }

    if (currency !== normalizedExpectedCurrency) {
      return {
        ok: false,
        reason: 'Payment currency mismatch with PayPal capture',
      };
    }

    capturedTotal += value;
  }

  const roundedTotal = Number(capturedTotal.toFixed(2));
  if (Math.abs(roundedTotal - expectedAmount) > AMOUNT_TOLERANCE) {
    return { ok: false, reason: 'Payment amount mismatch with PayPal capture' };
  }

  return {
    ok: true,
    capturedTotal: roundedTotal,
    currency: normalizedExpectedCurrency,
  };
}
