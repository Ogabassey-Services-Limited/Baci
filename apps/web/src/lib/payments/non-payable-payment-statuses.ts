/**
 * THE list of `orders.payment_status` values that mean "this order is already
 * committed to a tender — do not take money for it again".
 *
 * This exists as one exported constant because it previously did not: the PayPal
 * create-order route kept one list and the capture resolver kept a second, shorter
 * one that omitted `bnpl_approved`. The resolver therefore treated a BNPL-approved
 * order as plainly unpaid and captured it on PayPal — the buyer owed Credit Direct
 * for the loan AND was charged the full residual again on PayPal, settled cleanly,
 * with no duplicate-capture review filed. Any surface deciding "may I charge this
 * order?" MUST import this rather than hand-maintain its own copy.
 *
 * `bnpl_approved` is non-payable even though no cash has moved: the lender has
 * committed to pay the merchant, so the buyer's debt is already booked.
 */
export const NON_PAYABLE_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'paid',
  'partially_paid',
  'bnpl_approved',
  'refunded',
]);

/** True when the order's payment_status means no further tender may be charged. */
export function isNonPayablePaymentStatus(
  paymentStatus: string | null | undefined
): boolean {
  return NON_PAYABLE_PAYMENT_STATUSES.has(String(paymentStatus));
}

/**
 * `orders.payment_status` values that mean the checkout is dead.
 *
 * Kept SEPARATE from the non-payable set on purpose: a cancelled order that
 * somehow captured must be CLAMPED (refunded + reviewed), whereas a settled one
 * must be blocked. Routing cancellation through the settled branch would leave the
 * buyer's money with the merchant.
 *
 * Checking these matters because cancellation is half-expressed in this schema:
 * the abandoned-order cron sets `payment_status = 'cancelled'` while leaving
 * `shipping_status = 'pending'` (1,018 such rows in production at the time of
 * writing). Any guard that keys off `shipping_status` alone therefore sees an
 * abandoned checkout as live, and a late PayPal approval would resurrect it.
 */
export const CANCELLED_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'cancelled',
  'expired',
]);

/** True when the order's payment_status means the checkout is dead. */
export function isCancelledPaymentStatus(
  paymentStatus: string | null | undefined
): boolean {
  return CANCELLED_PAYMENT_STATUSES.has(String(paymentStatus));
}
