import { describe, expect, it } from 'vitest';
import { parseMetaAdsAccount } from './provider-parser';

describe('Meta Ads provider parser', () => {
  it('rejects malformed accounts before they reach reporting code', () => {
    expect(parseMetaAdsAccount({ id: 'not-an-account' })).toBeNull();
  });

  it('normalizes a valid account to the canonical act_ id', () => {
    expect(
      parseMetaAdsAccount({
        currency: 'NGN',
        id: 'act_123',
        name: 'Baci',
        timezone_name: 'Africa/Lagos',
      })
    ).toEqual({
      accountId: 'act_123',
      currencyCode: 'NGN',
      label: 'Baci',
      timezoneName: 'Africa/Lagos',
      timezoneOffsetHours: null,
    });
  });
});
