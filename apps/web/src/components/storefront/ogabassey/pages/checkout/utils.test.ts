import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAIN_DISPLAY_NAMES,
  CHAIN_EXPLORER_URLS,
  CRYPTO_CHAIN_SUPPORT,
  calculateDeliveryCost,
  getDeliveryDateRange,
  inferAddressLocationFromInput,
  isGatewayAmountDifferentFromOrderTotal,
  isKlumpUnavailableForGatewayAmount,
} from './utils';
import type { ShippingQuote } from './types';

describe('getDeliveryDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct date range format from tomorrow to +3 days', () => {
    vi.setSystemTime(new Date('2026-02-08T12:00:00Z'));
    const result = getDeliveryDateRange();
    expect(result).toBe('9 Feb to 11 Feb');
  });

  it('handles month boundary correctly', () => {
    vi.setSystemTime(new Date('2026-01-29T12:00:00Z'));
    const result = getDeliveryDateRange();
    expect(result).toBe('30 Jan to 1 Feb');
  });

  it('handles year boundary correctly', () => {
    vi.setSystemTime(new Date('2025-12-30T12:00:00Z'));
    const result = getDeliveryDateRange();
    expect(result).toBe('31 Dec to 2 Jan');
  });
});

describe('CRYPTO_CHAIN_SUPPORT', () => {
  it('USDT supports all four chains', () => {
    expect(CRYPTO_CHAIN_SUPPORT.USDT).toEqual(['TRX', 'ETH', 'MATIC', 'AVAXC']);
  });

  it('USDC supports ETH, MATIC, and AVAXC chains', () => {
    expect(CRYPTO_CHAIN_SUPPORT.USDC).toEqual(['ETH', 'MATIC', 'AVAXC']);
  });
});

describe('CHAIN_DISPLAY_NAMES', () => {
  it('maps all four chains to display names', () => {
    expect(CHAIN_DISPLAY_NAMES.TRX).toBe('Tron (TRC-20)');
    expect(CHAIN_DISPLAY_NAMES.ETH).toBe('Ethereum (ERC-20)');
    expect(CHAIN_DISPLAY_NAMES.MATIC).toBe('Polygon');
    expect(CHAIN_DISPLAY_NAMES.AVAXC).toBe('Avalanche C-Chain');
  });
});

describe('CHAIN_EXPLORER_URLS', () => {
  it('maps all four chains to explorer URLs', () => {
    expect(CHAIN_EXPLORER_URLS.TRX).toBe('https://tronscan.org/#/address/');
    expect(CHAIN_EXPLORER_URLS.ETH).toBe('https://etherscan.io/address/');
    expect(CHAIN_EXPLORER_URLS.MATIC).toBe('https://polygonscan.com/address/');
    expect(CHAIN_EXPLORER_URLS.AVAXC).toBe('https://snowtrace.io/address/');
  });
});

describe('calculateDeliveryCost', () => {
  const mockQuotes: ShippingQuote[] = [
    {
      id: '1',
      provider: 'GIGL',
      serviceTier: 'standard',
      carrierName: 'GIGL',
      displayName: 'GIGL Standard',
      price: 3500,
      estimatedDays: 3,
      currency: 'NGN',
      pickupIncluded: false,
      insuranceIncluded: false,
    },
    {
      id: '2',
      provider: 'TOPSHIP',
      serviceTier: 'express',
      carrierName: 'Topship',
      displayName: 'Topship Express',
      price: 5000,
      estimatedDays: 1,
      currency: 'NGN',
      pickupIncluded: false,
      insuranceIncluded: false,
    },
  ];

  it('returns 0 for pickup delivery method', () => {
    const cost = calculateDeliveryCost('pickup', '', mockQuotes, 'delivery');
    expect(cost).toBe(0);
  });

  it('returns the station quote price for provider pickup stations', () => {
    const cost = calculateDeliveryCost(
      'pickup_station',
      'station-1',
      [
        ...mockQuotes,
        {
          id: 'station-1',
          provider: 'GIGL',
          serviceTier: 'station',
          carrierName: 'GIG Logistics',
          displayName: 'Pickup Stations (GIGL)',
          price: 4200,
          estimatedDays: 3,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          isStationPickup: true,
        },
      ],
      'delivery',
    );
    expect(cost).toBe(4200);
  });

  it('returns 0 for door delivery with no selected quote', () => {
    const cost = calculateDeliveryCost('door', '', mockQuotes, 'delivery');
    expect(cost).toBe(0);
  });

  it('returns quote price for door delivery with matching quote ID', () => {
    const cost = calculateDeliveryCost('door', '1', mockQuotes, 'delivery');
    expect(cost).toBe(3500);
  });

  it('returns correct price for different quote ID', () => {
    const cost = calculateDeliveryCost('door', '2', mockQuotes, 'delivery');
    expect(cost).toBe(5000);
  });

  it('returns 0 for door delivery with non-matching quote ID', () => {
    const cost = calculateDeliveryCost('door', '999', mockQuotes, 'delivery');
    expect(cost).toBe(0);
  });

  it('returns 25000 for airport delivery', () => {
    const cost = calculateDeliveryCost('airport', '', mockQuotes, 'delivery');
    expect(cost).toBe(25000);
  });

  it('returns 20000 for airport pickup', () => {
    const cost = calculateDeliveryCost('airport', '', mockQuotes, 'pickup');
    expect(cost).toBe(20000);
  });
});

describe('isGatewayAmountDifferentFromOrderTotal', () => {
  it('returns true when wallet credit reduces the payable gateway amount', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(45_000, 50_000)).toBe(true);
  });

  it('returns true when the payable amount exceeds the order amount', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(55_000, 50_000)).toBe(true);
  });

  it('returns false when the payable amount still matches the order amount', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(50_000, 50_000)).toBe(false);
  });

  it('ignores sub-kobo rounding noise under the payment API threshold', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(49_999.995, 50_000)).toBe(
      false,
    );
  });

  it('returns true at the payment API rejection threshold', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(49_999.99, 50_000)).toBe(
      true,
    );
  });

  it('returns true for non-finite amounts', () => {
    expect(isGatewayAmountDifferentFromOrderTotal(Number.NaN, 50_000)).toBe(
      true,
    );
    expect(
      isGatewayAmountDifferentFromOrderTotal(
        Number.POSITIVE_INFINITY,
        50_000,
      ),
    ).toBe(true);
    expect(
      isGatewayAmountDifferentFromOrderTotal(
        Number.NEGATIVE_INFINITY,
        50_000,
      ),
    ).toBe(true);
    expect(
      isGatewayAmountDifferentFromOrderTotal(
        50_000,
        Number.POSITIVE_INFINITY,
      ),
    ).toBe(true);
  });
});

describe('isKlumpUnavailableForGatewayAmount', () => {
  it('returns true only for Klump gateway amount mismatches', () => {
    expect(
      isKlumpUnavailableForGatewayAmount({
        paymentMethod: 'klump',
        payableAmount: 45_000,
        orderAmount: 50_000,
      }),
    ).toBe(true);
    expect(
      isKlumpUnavailableForGatewayAmount({
        paymentMethod: 'paystack',
        payableAmount: 45_000,
        orderAmount: 50_000,
      }),
    ).toBe(false);
  });
});

describe('inferAddressLocationFromInput', () => {
  it('extracts city/state from a two-part address', () => {
    const result = inferAddressLocationFromInput('Lekki Phase 1, Lagos', [
      'Lagos',
      'Abuja',
    ]);
    expect(result).toEqual({ city: 'Lekki Phase 1', state: 'Lagos' });
  });

  it('extracts city/state from a full street, city, state address', () => {
    const result = inferAddressLocationFromInput(
      '12 Admiralty Way, Lekki, Lagos',
      ['Lagos', 'Abuja'],
    );
    expect(result).toEqual({ city: 'Lekki', state: 'Lagos' });
  });

  it('normalizes "State" suffix and matches configured shipping states', () => {
    const result = inferAddressLocationFromInput('Maitama, Abuja State', [
      'Lagos',
      'Abuja',
    ]);
    expect(result).toEqual({ city: 'Maitama', state: 'Abuja' });
  });

  it('matches Abuja aliases against configured FCT shipping state labels', () => {
    const result = inferAddressLocationFromInput('Maitama, Abuja', [
      'Lagos',
      'FCT - Abuja',
    ]);
    expect(result).toEqual({ city: 'Maitama', state: 'FCT - Abuja' });
  });

  it('strips trailing country tokens before inferring city/state', () => {
    const result = inferAddressLocationFromInput('Lekki, Lagos, Nigeria', [
      'Lagos',
      'Abuja',
    ]);
    expect(result).toEqual({ city: 'Lekki', state: 'Lagos' });
  });

  it('returns null when the trailing state is not configured for shipping', () => {
    const result = inferAddressLocationFromInput('Lekki, Lagos, Ghana', [
      'Lagos',
      'Abuja',
    ]);
    expect(result).toBeNull();
  });

  it('returns null until shipping state whitelist data is available', () => {
    const result = inferAddressLocationFromInput('Lekki Phase 1, Lagos', []);

    expect(result).toBeNull();
  });

  it('returns null when there are not enough address segments', () => {
    const result = inferAddressLocationFromInput('Lagos', ['Lagos']);
    expect(result).toBeNull();
  });
});
