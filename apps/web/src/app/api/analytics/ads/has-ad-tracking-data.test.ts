import { describe, expect, it } from 'vitest';
import { hasAdTrackingData } from './has-ad-tracking-data';

describe('hasAdTrackingData', () => {
  it('does not count discount provenance metadata as ad tracking', () => {
    expect(
      hasAdTrackingData({
        baci_transaction_discount: {
          lineDiscounts: [],
          version: 2,
        },
      })
    ).toBe(false);
  });

  it('counts ordinary attribution fields', () => {
    expect(hasAdTrackingData({ fbclid: 'fb-1' })).toBe(true);
  });
});
