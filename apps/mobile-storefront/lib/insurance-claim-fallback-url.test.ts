import { describe, expect, it } from '@jest/globals';
import { buildWebInsuranceClaimUrl } from './insurance-claim-fallback-url';

describe('buildWebInsuranceClaimUrl', () => {
  it('builds the storefront insurance page URL from origin, slug, and order id', () => {
    expect(
      buildWebInsuranceClaimUrl('https://ogabassey.com', 'ogabassey', 'order-1')
    ).toBe('https://ogabassey.com/ogabassey/account/orders/order-1/insurance');
  });

  it('preserves an origin path and encodes slug/order id', () => {
    expect(
      buildWebInsuranceClaimUrl('https://ogabassey.com', 'oga bassey', 'a/b')
    ).toBe('https://ogabassey.com/oga%20bassey/account/orders/a%2Fb/insurance');
  });

  it('returns null when any input is missing or blank', () => {
    expect(buildWebInsuranceClaimUrl('', 'slug', 'id')).toBeNull();
    expect(buildWebInsuranceClaimUrl('https://x.com', '  ', 'id')).toBeNull();
    expect(buildWebInsuranceClaimUrl('https://x.com', 'slug', '')).toBeNull();
  });

  it('rejects non-http(s) and malformed base URLs', () => {
    expect(
      buildWebInsuranceClaimUrl('javascript:alert(1)', 'slug', 'id')
    ).toBeNull();
    expect(buildWebInsuranceClaimUrl('not a url', 'slug', 'id')).toBeNull();
  });
});
