import { describe, expect, it, vi } from 'vitest';
import type { ShippingQuote } from '../types';
import { expandGiglServiceCentreQuotes } from './gigl.service-centre-quotes';
import { serviceCentresResponse, stationsResponse } from './gigl.test-helpers';

const baseQuote: ShippingQuote = {
  id: 'base-quote',
  provider: 'GIGL',
  serviceTier: 'Station Pickup',
  carrierName: 'GIG Logistics',
  displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
  estimatedDays: 2,
  deliveryRange: '1-3 working days',
  minDays: 1,
  maxDays: 3,
  price: 7692,
  currency: 'NGN',
  pickupIncluded: true,
  insuranceIncluded: true,
  providerRateId: 'GIGL_30_1_1',
  expiresAt: new Date('2026-07-09T12:00:00.000Z'),
  isStationPickup: true,
};

describe('expandGiglServiceCentreQuotes', () => {
  it('returns only the nearest three service centres to the receiver', async () => {
    const generateQuoteId = vi
      .fn()
      .mockReturnValueOnce('centre-1')
      .mockReturnValueOnce('centre-2')
      .mockReturnValueOnce('centre-3');
    const receiverStation = stationsResponse.data.data[1];

    const quotes = await expandGiglServiceCentreQuotes({
      baseQuote,
      generateQuoteId,
      receiver: { latitude: 4.8156, longitude: 7.0498 },
      receiverStation,
      serviceCentres: serviceCentresResponse.data.data,
    });

    expect(quotes).toHaveLength(3);
    expect(quotes.map((quote) => quote.providerRateId)).toEqual([
      'GIGL_30_1_1_575_0',
      'GIGL_30_1_1_407_0',
      'GIGL_30_1_1_524_0',
    ]);
    expect(quotes[0]).toMatchObject({
      displayName:
        'GIG Logistics - Pickup at PHC RUMUOLUMENI IWOFE - GoStandard',
      stationName: 'PHC RUMUOLUMENI IWOFE',
      stationAddress: 'Eagle Cement Junction, Rumuolumeni, Port Harcourt',
      stationCode: 'RUM',
      pickupStationId: 575,
    });
  });

  it('keeps GoFaster visible after expanding a service-centre quote', async () => {
    const [quote] = await expandGiglServiceCentreQuotes({
      baseQuote: {
        ...baseQuote,
        displayName: 'GIG Logistics - Pickup at PORT HARCOURT - GoFaster',
        serviceTier: 'Station Pickup - GoFaster',
      },
      generateQuoteId: () => 'gofaster-centre',
      receiver: { latitude: 4.8156, longitude: 7.0498 },
      receiverStation: stationsResponse.data.data[1],
      serviceCentres: serviceCentresResponse.data.data,
    });

    expect(quote?.displayName).toBe(
      'GIG Logistics - Pickup at PHC RUMUOLUMENI IWOFE - GoFaster'
    );
  });

  it('uses a deterministic three-centre fallback without coordinates', async () => {
    const quotes = await expandGiglServiceCentreQuotes({
      baseQuote,
      generateQuoteId: () => 'quote-id',
      receiver: {},
      receiverStation: stationsResponse.data.data[1],
      serviceCentres: [...serviceCentresResponse.data.data].reverse(),
    });

    expect(quotes.map((quote) => quote.stationName)).toEqual([
      'HUAWEI-PHC',
      'PHC D-LINE',
      'PHC PETER ODILLI',
    ]);
  });

  it('sorts centres without coordinates deterministically', async () => {
    const centresWithoutCoordinates = serviceCentresResponse.data.data
      .slice(0, 3)
      .reverse()
      .map((centre) => ({
        ...centre,
        Latitude: undefined,
        Longitude: undefined,
      }));

    const quotes = await expandGiglServiceCentreQuotes({
      baseQuote,
      generateQuoteId: () => 'quote-id',
      receiver: { latitude: 4.8156, longitude: 7.0498 },
      receiverStation: stationsResponse.data.data[1],
      serviceCentres: centresWithoutCoordinates,
    });

    expect(quotes.map((quote) => quote.stationName)).toEqual([
      'PHC D-LINE',
      'PHC PETER ODILLI',
      'PHC RUMUOLUMENI IWOFE',
    ]);
  });

  it('returns the base quote and logs when centre lookup fails', async () => {
    const log = vi.fn();

    const quotes = await expandGiglServiceCentreQuotes({
      baseQuote,
      fetchServiceCentres: () => Promise.reject(new Error('offline')),
      generateQuoteId: vi.fn(),
      log,
      receiver: {},
      receiverStation: stationsResponse.data.data[1],
    });

    expect(quotes).toEqual([baseQuote]);
    expect(log).toHaveBeenCalledWith(
      'warn',
      'Failed to expand GIGL service centres',
      expect.objectContaining({ stationId: 30 })
    );
  });

  it('returns the base quote without generating ids for an empty centre list', async () => {
    const generateQuoteId = vi.fn();

    const quotes = await expandGiglServiceCentreQuotes({
      baseQuote,
      generateQuoteId,
      receiver: {},
      receiverStation: stationsResponse.data.data[1],
      serviceCentres: [],
    });

    expect(quotes).toEqual([baseQuote]);
    expect(generateQuoteId).not.toHaveBeenCalled();
  });
});
