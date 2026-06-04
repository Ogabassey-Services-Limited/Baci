import { describe, expect, it } from 'vitest';
import {
  determineRoutingAndRates,
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

  it('does not treat generic transport wording as LASG Cowry', () => {
    expect(
      getVtuCommissionRate('Unknown Transport Provider', 'TRANSPORT')
    ).toEqual({
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

  describe('determineRoutingAndRates custom matrix logic', () => {
    it('selects provider with higher rate', () => {
      const { routing, rates } = determineRoutingAndRates({
        kudaRates: { TEST_KEY: { rate: 0.02 } },
        monnifyRates: { TEST_KEY: { rate: 0.03 } },
      });
      expect(routing.TEST_KEY).toBe('monnify');
      expect(rates.TEST_KEY).toEqual({ rate: 0.03 });

      const { routing: routing2, rates: rates2 } = determineRoutingAndRates({
        kudaRates: { TEST_KEY: { rate: 0.04 } },
        monnifyRates: { TEST_KEY: { rate: 0.03 } },
      });
      expect(routing2.TEST_KEY).toBe('kuda');
      expect(rates2.TEST_KEY).toEqual({ rate: 0.04 });
    });

    it('selects uncapped provider on equal rates where one side is capped', () => {
      const { routing: routingKudaUncapped, rates: ratesKudaUncapped } =
        determineRoutingAndRates({
          kudaRates: { TEST_KEY: { rate: 0.02 } },
          monnifyRates: { TEST_KEY: { rate: 0.02, cap: 500 } },
        });
      expect(routingKudaUncapped.TEST_KEY).toBe('kuda');
      expect(ratesKudaUncapped.TEST_KEY).toEqual({ rate: 0.02 });

      const { routing: routingMonnifyUncapped, rates: ratesMonnifyUncapped } =
        determineRoutingAndRates({
          kudaRates: { TEST_KEY: { rate: 0.02, cap: 500 } },
          monnifyRates: { TEST_KEY: { rate: 0.02 } },
        });
      expect(routingMonnifyUncapped.TEST_KEY).toBe('monnify');
      expect(ratesMonnifyUncapped.TEST_KEY).toEqual({ rate: 0.02 });
    });

    it('prefers Monnify on equal rates when both are uncapped', () => {
      const { routing, rates } = determineRoutingAndRates({
        kudaRates: { TEST_KEY: { rate: 0.02 } },
        monnifyRates: { TEST_KEY: { rate: 0.02 } },
      });
      expect(routing.TEST_KEY).toBe('monnify');
      expect(rates.TEST_KEY).toEqual({ rate: 0.02 });
    });

    it('selects provider with higher cap on equal rates when both are capped, and prefers Monnify when caps are equal', () => {
      const { routing: routingMonnifyHigherCap, rates: ratesMonnifyHigherCap } =
        determineRoutingAndRates({
          kudaRates: { TEST_KEY: { rate: 0.02, cap: 500 } },
          monnifyRates: { TEST_KEY: { rate: 0.02, cap: 600 } },
        });
      expect(routingMonnifyHigherCap.TEST_KEY).toBe('monnify');
      expect(ratesMonnifyHigherCap.TEST_KEY).toEqual({ rate: 0.02, cap: 600 });

      const { routing: routingKudaHigherCap, rates: ratesKudaHigherCap } =
        determineRoutingAndRates({
          kudaRates: { TEST_KEY: { rate: 0.02, cap: 700 } },
          monnifyRates: { TEST_KEY: { rate: 0.02, cap: 600 } },
        });
      expect(routingKudaHigherCap.TEST_KEY).toBe('kuda');
      expect(ratesKudaHigherCap.TEST_KEY).toEqual({ rate: 0.02, cap: 700 });

      const { routing: routingEqualCap, rates: ratesEqualCap } =
        determineRoutingAndRates({
          kudaRates: { TEST_KEY: { rate: 0.02, cap: 600 } },
          monnifyRates: { TEST_KEY: { rate: 0.02, cap: 600 } },
        });
      expect(routingEqualCap.TEST_KEY).toBe('monnify');
      expect(ratesEqualCap.TEST_KEY).toEqual({ rate: 0.02, cap: 600 });
    });

    it('includes DEFAULT rate in returned rates', () => {
      const { rates } = determineRoutingAndRates({
        kudaRates: {},
        monnifyRates: {},
      });
      expect(rates.DEFAULT).toEqual({ rate: 0.02 });
    });
  });
});
