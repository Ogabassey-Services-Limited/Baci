import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QuoteAggregator,
  rankQuotes,
  selectFeaturedQuotes,
} from './aggregator';
import {
  type ShippingProvider,
  ShippingProviderRegistry,
} from './providers/base';
import type { QuoteRequest, ShippingQuote } from './types';

const quoteRequest: QuoteRequest = {
  sessionId: 'session-agg-1',
  shipmentType: 'domestic',
  receiver: {
    name: 'Customer',
    phone: '+2348000000001',
    address: '1 Customer Street',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  items: [{ name: 'Phone', quantity: 1, weight: 1, value: 50_000 }],
} as QuoteRequest;

function createProvider(
  overrides: Partial<ShippingProvider> = {}
): ShippingProvider {
  return {
    code: 'GIGL',
    name: 'GIG Logistics',
    supportsDomestic: true,
    supportsInternational: false,
    getQuotes: vi.fn(() => Promise.resolve([])),
    ...overrides,
  } as unknown as ShippingProvider;
}

const successfulQuote = {
  id: 'gigl-quote-1',
  provider: 'GIGL' as const,
  serviceTier: 'Standard',
  carrierName: 'GIG Logistics',
  displayName: 'GIG Logistics',
  estimatedDays: 3,
  price: 5000,
  currency: 'NGN',
  pickupIncluded: true,
  insuranceIncluded: true,
  expiresAt: new Date(Date.now() + 60_000),
};

describe('QuoteAggregator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the provider quotes with no warnings on the happy path', async () => {
    const registry = new ShippingProviderRegistry();
    registry.register(
      createProvider({
        getQuotes: vi.fn(() => Promise.resolve([successfulQuote])),
      })
    );
    const aggregator = new QuoteAggregator(registry);

    const response = await aggregator.getQuotes(quoteRequest);

    expect(response.quotes.all).toHaveLength(1);
    expect(response.quotes.all[0].id).toBe('gigl-quote-1');
    expect(response.quotes.featured).toContainEqual(
      expect.objectContaining({ id: 'gigl-quote-1' })
    );
    expect(response.warnings).toBeUndefined();
  });

  it('quotes only the carrier providers enabled by the merchant', async () => {
    const registry = new ShippingProviderRegistry();
    const giglQuotes = vi.fn(() => Promise.resolve([successfulQuote]));
    const topshipQuotes = vi.fn(() =>
      Promise.resolve([
        {
          ...successfulQuote,
          id: 'topship-quote-1',
          provider: 'TOPSHIP' as const,
          carrierName: 'Topship',
          displayName: 'Topship',
        },
      ])
    );
    registry.register(createProvider({ code: 'GIGL', getQuotes: giglQuotes }));
    registry.register(
      createProvider({
        code: 'TOPSHIP',
        name: 'Topship',
        getQuotes: topshipQuotes,
      })
    );
    const aggregator = new QuoteAggregator(registry);

    const response = await aggregator.getQuotes({
      ...quoteRequest,
      enabledProviderCodes: ['TOPSHIP'],
    });

    expect(giglQuotes).not.toHaveBeenCalled();
    expect(topshipQuotes).toHaveBeenCalledOnce();
    expect(response.quotes.all.map((quote) => quote.provider)).toEqual([
      'TOPSHIP',
    ]);
  });

  it('does not query any carriers when the merchant opted out of all providers', async () => {
    const registry = new ShippingProviderRegistry();
    const giglQuotes = vi.fn(() => Promise.resolve([successfulQuote]));
    const topshipQuotes = vi.fn(() => Promise.resolve([successfulQuote]));
    registry.register(createProvider({ code: 'GIGL', getQuotes: giglQuotes }));
    registry.register(
      createProvider({
        code: 'TOPSHIP',
        name: 'Topship',
        getQuotes: topshipQuotes,
      })
    );
    const aggregator = new QuoteAggregator(registry);

    const response = await aggregator.getQuotes({
      ...quoteRequest,
      enabledProviderCodes: [],
    });

    expect(giglQuotes).not.toHaveBeenCalled();
    expect(topshipQuotes).not.toHaveBeenCalled();
    expect(response.quotes.all).toEqual([]);
    expect(response.warnings).toEqual([
      'No shipping providers are enabled for this store',
    ]);
  });

  it('returns an explicit warning when the registry has no quote providers', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const aggregator = new QuoteAggregator(new ShippingProviderRegistry());

    const response = await aggregator.getQuotes(quoteRequest);

    expect(response.quotes.all).toHaveLength(0);
    expect(response.warnings).toEqual([
      'No shipping providers are currently enabled',
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[QuoteAggregator] No providers registered for quotes',
      { shipmentType: 'domestic' }
    );
  });

  it('collects provider failures as warnings when a registered provider rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registry = new ShippingProviderRegistry();
    registry.register(
      createProvider({
        getQuotes: vi.fn(() =>
          Promise.reject(new Error('upstream unavailable'))
        ),
      })
    );
    const aggregator = new QuoteAggregator(registry);

    const response = await aggregator.getQuotes(quoteRequest);

    expect(response.quotes.all).toHaveLength(0);
    expect(response.warnings).toEqual(['GIG Logistics: upstream unavailable']);
  });
});

describe('rankQuotes', () => {
  function buildQuote(overrides: Partial<ShippingQuote>): ShippingQuote {
    return {
      ...successfulQuote,
      ...overrides,
    } as ShippingQuote;
  }

  it('does not rank an unknown-ETA merchant rate ahead of a cheaper known-ETA carrier', () => {
    // A merchant rate with no configured delivery days carries estimatedDays: 0
    // (the unknown-ETA sentinel). It must NOT be scored as 0-day/fastest and
    // out-rank a cheaper carrier with a real ETA — `quotes.all` ordering drives
    // checkout's first-door-quote auto-select.
    const unknownEtaMerchantRate = buildQuote({
      id: 'mrate_1',
      provider: 'MERCHANT',
      carrierName: 'Store Delivery',
      displayName: 'Store Delivery',
      estimatedDays: 0,
      price: 5000,
    });
    const cheaperKnownEtaCarrier = buildQuote({
      id: 'courier-1',
      carrierName: 'Local Courier',
      displayName: 'Local Courier',
      estimatedDays: 3,
      price: 4000,
    });

    const ranked = rankQuotes([unknownEtaMerchantRate, cheaperKnownEtaCarrier]);

    expect(ranked[0].id).toBe('courier-1');
    expect(ranked[1].id).toBe('mrate_1');
  });

  it('keeps a cheaper known-ETA merchant rate ahead of a pricier carrier', () => {
    // The penalty only applies to the unknown-ETA sentinel; a merchant rate
    // with a real ETA is scored normally and still wins when it is cheaper.
    const cheapMerchantRate = buildQuote({
      id: 'mrate_2',
      provider: 'MERCHANT',
      carrierName: 'Store Delivery',
      displayName: 'Store Delivery',
      estimatedDays: 2,
      price: 1000,
    });
    const carrierQuote = buildQuote({
      id: 'courier-2',
      carrierName: 'Local Courier',
      displayName: 'Local Courier',
      estimatedDays: 3,
      price: 5000,
    });

    const ranked = rankQuotes([carrierQuote, cheapMerchantRate]);

    expect(ranked[0].id).toBe('mrate_2');
  });
});

describe('selectFeaturedQuotes', () => {
  function buildQuote(overrides: Partial<ShippingQuote>): ShippingQuote {
    return {
      ...successfulQuote,
      ...overrides,
    } as ShippingQuote;
  }

  it('returns an empty list when there are no quotes', () => {
    expect(selectFeaturedQuotes([])).toEqual([]);
  });

  it('lets a merchant-rate quote win the cheapest bucket', () => {
    const merchantQuote = buildQuote({
      id: 'mrate_1',
      provider: 'MERCHANT',
      carrierName: 'Standard Delivery',
      displayName: 'Standard Delivery',
      estimatedDays: 2,
      price: 1000,
    });
    const carrierQuote = buildQuote({ id: 'gigl-1', price: 5000 });

    const featured = selectFeaturedQuotes([carrierQuote, merchantQuote]);

    expect(featured[0]).toMatchObject({
      id: 'mrate_1',
      displayName: expect.stringContaining('Economy Delivery'),
    });
  });

  it('never selects a 0-estimatedDays quote as the fastest pick', () => {
    const unEstimatedMerchantQuote = buildQuote({
      id: 'mrate_1',
      provider: 'MERCHANT',
      estimatedDays: 0,
      price: 1000,
    });
    const fastCarrierQuote = buildQuote({
      id: 'gigl-fast',
      estimatedDays: 2,
      price: 6000,
    });
    const slowCarrierQuote = buildQuote({
      id: 'gigl-slow',
      estimatedDays: 5,
      price: 4000,
    });

    const featured = selectFeaturedQuotes([
      unEstimatedMerchantQuote,
      fastCarrierQuote,
      slowCarrierQuote,
    ]);

    const express = featured.find((quote) =>
      quote.displayName.includes('Express Delivery')
    );
    expect(express).toMatchObject({ id: 'gigl-fast', estimatedDays: 2 });
  });

  it('omits the fastest bucket entirely when every candidate lacks an estimate', () => {
    const cheapQuote = buildQuote({
      id: 'mrate_1',
      provider: 'MERCHANT',
      estimatedDays: 0,
      price: 1000,
    });
    const otherQuote = buildQuote({
      id: 'mrate_2',
      provider: 'MERCHANT',
      estimatedDays: 0,
      price: 2000,
    });

    const featured = selectFeaturedQuotes([cheapQuote, otherQuote]);

    expect(featured).toHaveLength(2);
    expect(
      featured.some((quote) => quote.displayName.includes('Express Delivery'))
    ).toBe(false);
  });
});
