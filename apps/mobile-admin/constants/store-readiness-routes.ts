import type { MobileStoreReadinessItemId } from '@baci/shared';
import type { Href } from 'expo-router';

const MOBILE_STORE_READINESS_ROUTES: Record<MobileStoreReadinessItemId, Href> =
  {
    verify_kyc: '/kyc',
    bank_account: '/payout-settings?from=setup',
    payment_method: '/payment-methods',
    store_url: '/store-settings?from=setup',
    first_product: '/product/new',
    country: '/store-settings?from=setup',
    contact_info: '/store-settings?from=setup',
    business_address: '/store-settings?from=setup',
    hero_carousel: '/customize',
    social_media: '/social-media?from=setup',
    analytics: '/analytics-config?from=setup',
    multiple_products: '/product/new',
  };

export function getMobileStoreReadinessRoute(
  id: MobileStoreReadinessItemId
): Href {
  return MOBILE_STORE_READINESS_ROUTES[id];
}

export function isStoreReadinessSetupOrigin(
  from: string | string[] | undefined
): boolean {
  return from === 'setup';
}
