import { describe, expect, it } from 'vitest';
import { parseMerchantFeatureSettingsPatchBody } from './parse-feature-settings-patch-body';

describe('parseMerchantFeatureSettingsPatchBody', () => {
  it('keeps feature updates separate from an optional merchant selector', () => {
    expect(
      parseMerchantFeatureSettingsPatchBody({
        loyalty_enabled: true,
        merchantId: '22222222-2222-4222-8222-222222222222',
      })
    ).toEqual({
      featureUpdates: { loyalty_enabled: true },
      requestedMerchantId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('preserves the implicit-merchant fallback for an empty object', () => {
    expect(parseMerchantFeatureSettingsPatchBody({})).toEqual({
      featureUpdates: {},
      requestedMerchantId: undefined,
    });
  });

  it.each<readonly [unknown]>([
    [null],
    ['loyalty_enabled=true'],
    [['loyalty_enabled']],
  ])('rejects a non-object request body: %j', (body) => {
    expect(parseMerchantFeatureSettingsPatchBody(body)).toBeNull();
  });
});
