import { describe, expect, it } from 'vitest';
import { StorefrontPublicPoliciesSchema } from './public-projection-policies-schema';

describe('StorefrontPublicPoliciesSchema', () => {
  it('accepts public policy copy and release-safe links', () => {
    const policies = {
      privacy: '<p>Private by design. <a href="/contact">Contact us</a>.</p>',
    };
    expect(StorefrontPublicPoliciesSchema.parse(policies)).toEqual(policies);
  });

  it('rejects query-bearing links in policy bodies', () => {
    expect(
      StorefrontPublicPoliciesSchema.safeParse({
        privacy:
          '<a href="https://example.test/export?token=secret">Download</a>',
      }).success
    ).toBe(false);
  });

  it('preserves structured return and shipping terms', () => {
    const policies = {
      returnPolicy: {
        localRoute: '/returns',
        returnFees: 'customer_pays',
        returnMethod: 'carrier_dropoff',
        summary: 'Return eligible items within 14 days.',
        windowDays: 14,
      },
      shippingPolicy: {
        handlingDaysMax: 2,
        handlingDaysMin: 0,
        localRoute: '/shipping',
        regions: ['NG', 'GH'],
        shippingFeeType: 'calculated',
        summary: 'Delivery is available nationwide.',
        transitDaysMax: 5,
        transitDaysMin: 1,
      },
    } as const;

    expect(StorefrontPublicPoliciesSchema.parse(policies)).toEqual(policies);
  });

  it('rejects inverted structured delivery windows', () => {
    expect(
      StorefrontPublicPoliciesSchema.safeParse({
        shippingPolicy: {
          handlingDaysMax: 1,
          handlingDaysMin: 2,
          localRoute: '/shipping',
          regions: ['NG'],
        },
      }).success
    ).toBe(false);
  });
});
