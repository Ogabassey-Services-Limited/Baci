import { MOBILE_STORE_READINESS_ITEM_IDS } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import { getMobileStoreReadinessRoute } from './store-readiness-routes';

describe('mobile store readiness routes', () => {
  it.each(MOBILE_STORE_READINESS_ITEM_IDS)('maps %s to an Expo route', (id) => {
    expect(getMobileStoreReadinessRoute(id)).toMatch(/^\//);
  });

  it('keeps the core readiness destinations explicit', () => {
    expect(getMobileStoreReadinessRoute('bank_account')).toBe(
      '/payout-settings?from=setup'
    );
    expect(getMobileStoreReadinessRoute('payment_method')).toBe(
      '/payment-methods'
    );
    expect(getMobileStoreReadinessRoute('store_url')).toBe(
      '/store-settings?from=setup'
    );
    expect(getMobileStoreReadinessRoute('contact_info')).toBe(
      '/store-settings?from=setup'
    );
    expect(getMobileStoreReadinessRoute('business_address')).toBe(
      '/store-settings?from=setup'
    );
    expect(getMobileStoreReadinessRoute('first_product')).toBe('/product/new');
    expect(getMobileStoreReadinessRoute('hero_carousel')).toBe('/customize');
    expect(getMobileStoreReadinessRoute('social_media')).toBe(
      '/social-media?from=setup'
    );
    expect(getMobileStoreReadinessRoute('analytics')).toBe(
      '/analytics-config?from=setup'
    );
  });
});
