import { WEB_STORE_READINESS_ITEM_IDS } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import { getWebStoreReadinessHref } from './store-readiness-hrefs';

describe('getWebStoreReadinessHref', () => {
  it.each(WEB_STORE_READINESS_ITEM_IDS)('maps %s to a web route', (id) => {
    expect(getWebStoreReadinessHref(id)).toMatch(/^\//);
  });

  it('routes the readiness actions to their owned web screens', () => {
    expect(getWebStoreReadinessHref('verify_kyc')).toBe(
      '/dashboard/settings/kyc'
    );
    expect(getWebStoreReadinessHref('bank_account')).toBe(
      '/dashboard/settings/payments'
    );
    expect(getWebStoreReadinessHref('payment_method')).toBe(
      '/dashboard/settings/payments'
    );
    expect(getWebStoreReadinessHref('store_url')).toBe('/dashboard/settings');
    expect(getWebStoreReadinessHref('first_product')).toBe(
      '/dashboard/products'
    );
    expect(getWebStoreReadinessHref('hero_carousel')).toBe('/builder');
  });

  it('routes every legal setup task to the existing shared pages editor', () => {
    const legalItemIds = [
      'about_page',
      'privacy_policy',
      'terms_conditions',
    ] as const;

    expect(legalItemIds.map((id) => getWebStoreReadinessHref(id))).toEqual([
      '/dashboard/pages',
      '/dashboard/pages',
      '/dashboard/pages',
    ]);
  });
});
