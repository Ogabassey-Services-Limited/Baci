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
          value,
        ] as const,
      ];
    });

  it.each([
    ['airtime', 'AIRTIME'],
    ['Cable TV', 'CABLE'],
    ['power', 'ELECTRICITY'],
    ['JAMB', 'EDUCATION'],
    ['cowry', 'TRANSPORT'],
    ['ISP', 'INTERNET'],
    ['unknown', 'AIRTIME'],
    [null, 'AIRTIME'],
    [undefined, 'AIRTIME'],
    ['', 'AIRTIME'],
  ] as const)('normalizes %s to %s', (value, expected) => {
    expect(normalizeVtuCommissionCategory(value)).toBe(expected);
  });

  it.each(
    commissionMatrixCases
  )('returns %s + %s specific rate', (provider, category, expectedRate) => {
    expect(getVtuCommissionRate(provider, category)).toEqual(expectedRate);
  });

  it.each([
    ['Glo Nigeria', 'AIRTIME', { rate: 0.05 }],
    ['MTN NG', 'DATA', { rate: 0.03 }],
    ['Ikeja Electric', 'ELECTRICITY', { rate: 0.008 }],
    ['Naija Bet', 'BETTING', { rate: 0.001 }],
    ['Showmax', 'CABLE', { rate: 0.02 }],
    ['Football.com', 'BETTING', { rate: 0.005, cap: 800 }],
    ['Access Bet', 'BETTING', { rate: 0.004, cap: 1000 }],
    ['JAMB UTME', 'EDUCATION', { rate: 0.024 }],
    ['Switch Solar', 'SOLAR', { rate: 0.004, cap: 500 }],
    ['LASG Cowry', 'TRANSPORT', { rate: 0.008 }],
    ['Spectranet', 'INTERNET', { rate: 0.02 }],
  ] as const)('normalizes alias %s + %s to its rate', (provider, category, expectedRate) => {
    expect(getVtuCommissionRate(provider, category)).toEqual(expectedRate);
  });

  it.each([
    'AIRTIME',
    'DATA',
    'ELECTRICITY',
    'CABLE',
    'BETTING',
    'EDUCATION',
    'SOLAR',
    'TRANSPORT',
    'INTERNET',
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
