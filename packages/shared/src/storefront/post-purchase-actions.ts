const RECEIPT_READY_SHIPPING_STATUSES = new Set(['shipped', 'delivered']);
const RIDER_CONTACT_SHIPPING_STATUSES = new Set([
  'shipped',
  'out_for_delivery',
]);
const CANCELLABLE_SHIPPING_STATUSES = new Set(['pending', 'processing']);

export const BACI_GOOGLE_REVIEW_URL = 'https://g.page/r/CR1gsFYL8eu9EBM/review';

/**
 * Selectable reasons shown to a customer cancelling their own order.
 * `Other` is the free-text escape hatch.
 */
export const CUSTOMER_CANCELLATION_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price',
  'Item no longer needed',
  'Other',
] as const;

export type CustomerCancellationReason =
  (typeof CUSTOMER_CANCELLATION_REASONS)[number];

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';
}

export function isStorefrontReceiptAvailable(input: {
  paymentStatus: string | null | undefined;
  shippingStatus: string | null | undefined;
}) {
  return (
    normalizeStatus(input.paymentStatus) === 'paid' &&
    RECEIPT_READY_SHIPPING_STATUSES.has(normalizeStatus(input.shippingStatus))
  );
}

export function canShowStorefrontRiderContact(
  shippingStatus: string | null | undefined
) {
  return RIDER_CONTACT_SHIPPING_STATUSES.has(normalizeStatus(shippingStatus));
}

export function canLeaveStorefrontGoogleReview(
  shippingStatus: string | null | undefined
) {
  return normalizeStatus(shippingStatus) === 'delivered';
}

export function canRequestStorefrontOrderReturn(
  shippingStatus: string | null | undefined
) {
  return normalizeStatus(shippingStatus) === 'delivered';
}

/**
 * Cheap client-side pre-gate for the customer "Cancel Order" CTA.
 *
 * NOTE: this is NOT authoritative — the server additionally rejects orders that
 * have a payment transaction in flight (see `customer_order_can_cancel`). Always
 * treat the cancel endpoint's 409 as the source of truth.
 */
export function canCancelStorefrontOrder(input: {
  shippingStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
}) {
  return (
    CANCELLABLE_SHIPPING_STATUSES.has(normalizeStatus(input.shippingStatus)) &&
    normalizeStatus(input.paymentStatus) === 'unpaid'
  );
}
