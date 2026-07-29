import type { MobileStoreReadinessItemId } from '@baci/shared';
import type { Href } from 'expo-router';

const MOBILE_STORE_READINESS_ROUTES: Record<MobileStoreReadinessItemId, Href> =
  {
    verify_kyc: '/kyc',
    bank_account: '/payout-settings',
    payment_method: '/payment-methods',
    store_url: '/store-settings',
    first_product: '/product/new',
    country: '/store-settings',
    contact_info: '/store-settings',
    business_address: '/store-settings',
    hero_carousel: '/customize',
    social_media: '/social-media',
    analytics: '/analytics-config',
    multiple_products: '/product/new',
  };

export function getMobileStoreReadinessRoute(
  id: MobileStoreReadinessItemId
): Href {
  return MOBILE_STORE_READINESS_ROUTES[id];
}
