const RECEIPT_READY_SHIPPING_STATUSES = new Set(['shipped', 'delivered']);
const RIDER_CONTACT_SHIPPING_STATUSES = new Set([
  'shipped',
  'out_for_delivery',
]);

export const BACI_GOOGLE_REVIEW_URL = 'https://g.page/r/CR1gsFYL8eu9EBM/review';

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
