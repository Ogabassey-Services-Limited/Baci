import { describe, expect, it } from 'vitest';
import {
  formatSocialAdsCount,
  formatSocialAdsSpend,
} from './social-ads-provider-panel';

describe('social ads provider panel formatting', () => {
  it('formats safe counts and preserves high-precision spend', () => {
    expect(formatSocialAdsCount('1234')).toBe('1,234');
    expect(formatSocialAdsCount('not-a-number')).toBe('not-a-number');
    expect(
      formatSocialAdsSpend({
        currencyCode: 'USD',
        spendAmountDecimal: '9007199254740993.123456',
      })
    ).toBe('USD 9007199254740993.123456');
  });
});
