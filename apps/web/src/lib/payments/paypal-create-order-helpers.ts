import { getNgnPerUsdt } from '@/lib/juicyway/rates';
import { logger } from '@/lib/logger';
import { PAYPAL_SUPPORTED_CURRENCIES } from '@/lib/paypal/paypal-currency';

/**
 * Pure/side-effecting helpers for the PayPal create-order route, split out to
 * keep the route under the 300-line cap and independently testable (Wave 2,
 * see docs/payments/byok-payment-providers-plan.md Phase 2).
 */

const PRESENTMENT_AMOUNT_TOLERANCE = 0.02;

/**
 * Ensures a merchant-supplied return/cancel URL shares the checkout origin.
 * Throws on a cross-origin URL so the route can reject it (open-redirect
 * guard). Returns `undefined` when no URL was provided.
 */
export function validateSameOriginUrl(
  value: string | undefined,
  requestOrigin: string
): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new URL(value);
  if (parsed.origin !== requestOrigin) {
    throw new Error('URL origin must match the checkout origin');
  }
  return parsed.toString();
}

/**
 * Returns an existing pending PayPal order id to reuse when a prior attempt for
 * the same Baci order was made at the same presentment amount/currency, so a
 * retry does not create a duplicate PayPal order. Returns `null` when there is
 * no reusable match (the presentment moved, or no prior transaction).
 */
export function getReusablePayPalOrderId(
  transaction: { gateway_reference?: string | null; metadata?: unknown } | null,
  expectedAmount: number,
  expectedCurrency: string
): string | null {
  if (!transaction?.gateway_reference) {
    return null;
  }

  const metadata = transaction.metadata as Record<string, unknown> | null;
  const existingAmount = Number(metadata?.paypal_presentment_amount);
  const existingCurrency = metadata?.paypal_presentment_currency;
  if (
    Number.isFinite(existingAmount) &&
    Math.abs(existingAmount - expectedAmount) <= PRESENTMENT_AMOUNT_TOLERANCE &&
    existingCurrency === expectedCurrency
  ) {
    return transaction.gateway_reference;
  }

  return null;
}

export type PaypalPresentment =
  | {
      ok: true;
      presentmentAmount: number;
      presentmentCurrency: string;
      fxRate: number;
    }
  | { ok: false; reason: 'unsupported_currency' | 'fx_unavailable' };

/**
 * Computes the PayPal presentment amount/currency for an order (Phase 2.5).
 * Non-NGN order currencies are presented as-is (fxRate 1). NGN orders are
 * converted to USD using the LIVE rate only — there is NO hardcoded fallback.
 *
 * Failures are distinguished so the route can map them to the right status:
 * - `'unsupported_currency'`: a non-NGN currency PayPal cannot present (a
 *   deterministic client error → 400), and
 * - `'fx_unavailable'`: the NGN→USD live rate fetch failed or returned a
 *   non-finite/non-positive value (a transient outage → 503), so nothing is
 *   initialized at an arbitrary rate.
 */
export async function resolvePaypalPresentment(
  orderCurrency: string,
  orderTotal: number
): Promise<PaypalPresentment> {
  let fxRate = 1;
  const normalizedOrderCurrency = orderCurrency.trim().toUpperCase();

  if (normalizedOrderCurrency === 'NGN') {
    try {
      fxRate = await getNgnPerUsdt();
    } catch (error) {
      logger.error({
        message: 'PayPal create-order: live FX rate unavailable',
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, reason: 'fx_unavailable' };
    }

    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      return { ok: false, reason: 'fx_unavailable' };
    }
  } else if (!PAYPAL_SUPPORTED_CURRENCIES.has(normalizedOrderCurrency)) {
    return { ok: false, reason: 'unsupported_currency' };
  }

  const presentmentCurrency =
    normalizedOrderCurrency === 'NGN' ? 'USD' : normalizedOrderCurrency;
  const presentmentAmount =
    normalizedOrderCurrency === 'NGN'
      ? Number((orderTotal / fxRate).toFixed(2))
      : Number(orderTotal.toFixed(2));

  return { ok: true, presentmentAmount, presentmentCurrency, fxRate };
}
