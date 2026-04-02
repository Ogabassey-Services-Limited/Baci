import type { ShippingStatus } from '@baci/shared/types';

export const BACI_GOOGLE_REVIEW_URL = 'https://g.page/r/CR1gsFYL8eu9EBM/review';

export function canShowStorefrontRiderContact(
  shippingStatus: ShippingStatus | string | null | undefined
) {
  return shippingStatus === 'shipped';
}

export function canLeaveStorefrontGoogleReview(
  shippingStatus: ShippingStatus | string | null | undefined
) {
  return shippingStatus === 'delivered';
}

export function canRequestStorefrontOrderReturn(
  shippingStatus: ShippingStatus | string | null | undefined
) {
  return shippingStatus === 'delivered';
}
