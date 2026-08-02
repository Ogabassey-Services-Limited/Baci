import { describe, expect, it } from 'vitest';
import {
  CARRIER_PROVIDER_CODE_BY_ID,
  CARRIER_PROVIDER_IDS,
  isCarrierProviderId,
  normalizeCarrierProviderIds,
} from './shipping-providers';

describe('CARRIER_PROVIDER_IDS', () => {
  it('keeps the live merchant carrier catalog stable', () => {
    expect(CARRIER_PROVIDER_IDS).toEqual(['gigl', 'topship']);
    expect(CARRIER_PROVIDER_CODE_BY_ID).toEqual({
      gigl: 'GIGL',
      topship: 'TOPSHIP',
    });
  });

  it('normalizes legacy provider settings into unique supported ids', () => {
    expect(
      normalizeCarrierProviderIds([
        ' GIGL ',
        'shiip',
        'TopShip',
        'gigl',
        'future-carrier',
        42,
      ])
    ).toEqual(['gigl', 'topship']);
  });

  it('treats malformed non-array settings as no carrier opt-in', () => {
    expect(normalizeCarrierProviderIds('gigl')).toEqual([]);
    expect(isCarrierProviderId('gigl')).toBe(true);
    expect(isCarrierProviderId('shiip')).toBe(false);
  });
});
