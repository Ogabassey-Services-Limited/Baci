import { getFreshNgnPerUsdt, RATE_CACHE_TTL_MS } from '@/lib/juicyway/rates';
import { logger } from '@/lib/logger';
import { getOrder, type PayPalMode } from '@/lib/paypal';
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
 * converted to USD using a FRESH live rate only — there is NO hardcoded
 * fallback AND no stale-cache fallback: the rate must be no older than the
 * CoinGecko cache TTL or the checkout fails closed.
 *
 * Failures are distinguished so the route can map them to the right status:
 * - `'unsupported_currency'`: a non-NGN currency PayPal cannot present (a
 *   deterministic client error → 400), and
 * - `'fx_unavailable'`: no fresh NGN→USD rate is available — the live fetch
 *   failed and any cached rate is stale — or it returned a non-finite/
 *   non-positive value (a transient outage → 503), so nothing is initialized
 *   at an arbitrary rate.
 */
export async function resolvePaypalPresentment(
  orderCurrency: string,
  orderTotal: number
): Promise<PaypalPresentment> {
  let fxRate = 1;
  const normalizedOrderCurrency = orderCurrency.trim().toUpperCase();

  if (normalizedOrderCurrency === 'NGN') {
    try {
      // Require a rate no older than the cache TTL: a stale cache after a
      // CoinGecko outage must NOT lock the customer to an out-of-date rate.
      fxRate = await getFreshNgnPerUsdt(RATE_CACHE_TTL_MS);
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

/**
 * PayPal Order statuses at which a stored order can still be approved+captured.
 * A COMPLETED/VOIDED/expired order is no longer approvable and must not be
 * reused for a retry (a fresh order is created instead).
 */
const APPROVABLE_PAYPAL_STATUSES = new Set([
  'CREATED',
  'PAYER_ACTION_REQUIRED',
  'APPROVED',
]);

export function isPaypalOrderApprovable(status: string): boolean {
  return APPROVABLE_PAYPAL_STATUSES.has(status.trim().toUpperCase());
}

/**
 * Returns the buyer-facing approval link from a PayPal order's HATEOAS links,
 * or `undefined` when none is present (a consumed/expired order).
 */
export function pickPaypalApprovalUrl(order: {
  links?: { rel: string; href: string }[];
}): string | undefined {
  return order.links?.find(
    (link) => link.rel === 'approve' || link.rel === 'payer-action'
  )?.href;
}

/**
 * PayPal Order statuses at which money is already captured (COMPLETED) or the
 * buyer has already approved and the order is capturable (APPROVED). A
 * create-order retry that finds the stored order in one of these states must NOT
 * fall through to a fresh order — PayPal already holds/collected the funds, so a
 * second approval link would double-charge the buyer (H1).
 */
const CAPTURED_OR_CAPTURABLE_STATUSES = new Set(['COMPLETED', 'APPROVED']);

/**
 * Outcome of inspecting a stored, reuse-eligible PayPal order:
 * - `reuse`: still awaiting approval — hand its approval link back so the buyer
 *   completes the SAME order (no duplicate).
 * - `already_captured`: PayPal already captured (COMPLETED) or the buyer already
 *   approved a capturable order (APPROVED). The caller must block/reconcile —
 *   minting a fresh order here would double-charge.
 * - `create_fresh`: the order is expired/voided (or the lookup failed) and is
 *   neither approvable nor captured — safe to mint a replacement.
 */
export type ReusablePaypalApproval =
  | { outcome: 'reuse'; approveUrl: string }
  | { outcome: 'already_captured' }
  | { outcome: 'create_fresh' };

/**
 * Inspects a stored, reuse-eligible PayPal order and tells the caller how to
 * proceed. Reuses the order while it is still approvable (returning its approval
 * link so a cancel-then-retry completes the SAME order — the client
 * `startPaypalCheckout` dead-ends without an `approveUrl`). Crucially, a
 * COMPLETED order (PayPal captured but the local transaction update failed) or
 * an APPROVED order (capturable) resolves to `already_captured` so the caller
 * blocks instead of minting a fresh order for money PayPal already holds — that
 * would double-charge and overwrite the local reference (H1). Only a dead order
 * (voided/expired, or a failed lookup) resolves to `create_fresh`.
 */
export async function resolveReusablePaypalApproval(
  credentials: { clientId: string; secretKey: string },
  reusablePayPalOrderId: string,
  mode: PayPalMode
): Promise<ReusablePaypalApproval> {
  const existingOrder = await getOrder(
    credentials.clientId,
    credentials.secretKey,
    reusablePayPalOrderId,
    mode
  );
  if (!existingOrder.success) {
    // The lookup failed (e.g. a 404 for an expired order); nothing indicates a
    // capture, so a replacement order is safe.
    return { outcome: 'create_fresh' };
  }

  const status = existingOrder.data.status.trim().toUpperCase();
  if (CAPTURED_OR_CAPTURABLE_STATUSES.has(status)) {
    return { outcome: 'already_captured' };
  }
  if (!isPaypalOrderApprovable(status)) {
    // VOIDED/expired/unknown and not captured → safe to mint a replacement.
    return { outcome: 'create_fresh' };
  }

  const approveUrl = pickPaypalApprovalUrl(existingOrder.data);
  return approveUrl
    ? { outcome: 'reuse', approveUrl }
    : { outcome: 'create_fresh' };
}
