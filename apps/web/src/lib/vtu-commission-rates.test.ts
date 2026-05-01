import { describe, expect, it } from 'vitest';
import {
  getVtuCommissionRate,
  normalizeVtuCommissionCategory,
  VTU_COMMISSION_RATES,
} from '@/lib/vtu-commission-rates';

describe('vtu commission rates', () => {
  const commissionMatrixCases = Object.entries(VTU_COMMISSION_RATES)
    .filter(([key]) => key !== 'DEFAULT')
    .flatMap(([key, value]) => {
      const separatorIndex = key.lastIndexOf('_');
      if (separatorIndex === -1) {
        return [];
      }
      return [
        [
          key.slice(0, separatorIndex),
          key.slice(separatorIndex + 1),
          value.rate,
        ] as const,
      ];
    });

  it.each([
    ['airtime', 'AIRTIME'],
    ['Cable TV', 'CABLE'],
    ['power', 'ELECTRICITY'],
    ['unknown', 'AIRTIME'],
    [null, 'AIRTIME'],
    [undefined, 'AIRTIME'],
    ['', 'AIRTIME'],
  ] as const)('normalizes %s to %s', (value, expected) => {
    expect(normalizeVtuCommissionCategory(value)).toBe(expected);
  });

  it.each(
    commissionMatrixCases
  )('returns %s + %s specific rate %s', (provider, category, expectedRate) => {
    expect(getVtuCommissionRate(provider, category)).toEqual({
      rate: expectedRate,
    });
  });

  it.each([
    ['Glo Nigeria', 'AIRTIME', 0.05],
    ['MTN NG', 'DATA', 0.03],
    ['Ikeja Electric', 'ELECTRICITY', 0.008],
    ['Naija Bet', 'BETTING', 0.001],
  ] as const)('normalizes alias %s + %s to rate %s', (provider, category, expectedRate) => {
    expect(getVtuCommissionRate(provider, category)).toEqual({
      rate: expectedRate,
    });
  });

  it.each([
    'AIRTIME',
    'DATA',
    'ELECTRICITY',
    'CABLE',
    'BETTING',
  ] as const)('falls back to the default commission rate for unknown providers in %s', (category) => {
    expect(getVtuCommissionRate('Unknown Provider', category)).toEqual({
      rate: 0.02,
    });
  });

  it.each([
    null,
    undefined,
    '',
  ] as const)('falls back to the default commission rate for invalid provider %s', (provider) => {
    expect(getVtuCommissionRate(provider, 'DATA')).toEqual({ rate: 0.02 });
  });

  it.each([
    null,
    undefined,
    'unknown',
  ] as const)('falls back to airtime rates for invalid category %s', (category) => {
    expect(getVtuCommissionRate('MTN', category)).toEqual({ rate: 0.03 });
  });

  it.each([
    [null, null],
    [undefined, undefined],
    ['', 'unknown'],
  ] as const)('falls back to default rate when provider %s and category %s are invalid', (provider, category) => {
    expect(getVtuCommissionRate(provider, category)).toEqual({ rate: 0.02 });
  });
});
