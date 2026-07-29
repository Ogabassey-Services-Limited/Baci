import type { WebStoreReadinessItemId } from '@baci/shared';

const WEB_STORE_READINESS_HREFS: Record<WebStoreReadinessItemId, string> = {
  verify_kyc: '/dashboard/settings/kyc',
  bank_account: '/dashboard/settings/payments',
  payment_method: '/dashboard/settings/payments',
  store_url: '/dashboard/settings',
  first_product: '/dashboard/products',
  country: '/dashboard/settings',
  contact_info: '/dashboard/settings',
  about_page: '/dashboard/pages',
  privacy_policy: '/dashboard/pages',
  terms_conditions: '/dashboard/pages',
  business_address: '/dashboard/settings',
  hero_carousel: '/builder',
  social_media: '/dashboard/settings',
  analytics: '/dashboard/integrations',
  multiple_products: '/dashboard/products',
};

export function getWebStoreReadinessHref(id: WebStoreReadinessItemId): string {
  return WEB_STORE_READINESS_HREFS[id];
}
