import { describe, expect, it, vi } from 'vitest';
import { createGiglStationQuoteExpander } from './gigl.station-quote-expander';

describe('createGiglStationQuoteExpander', () => {
  it('uses synchronized directory centres without calling the live endpoint', async () => {
    const fetchLiveCentres = vi.fn();
    const expand = createGiglStationQuoteExpander({
      directoryCentres: [
        {
          StationId: 4,
          StationName: 'LAGOS',
          StationCode: undefined,
          ServiceCentreId: 65,
          ServiceCentreName: 'SANGO OTTA',
          ServiceCentreCode: undefined,
          Latitude: 6.707,
          Longitude: 3.243,
          Address: undefined,
        },
      ],
      fetchLiveCentres,
      generateQuoteId: () => 'expanded-id',
      log: vi.fn(),
      receiver: {
        name: 'Customer',
        phone: '08000000000',
        address: 'Alagbado',
        city: 'Alagbado',
        state: 'Ogun',
        country: 'NG',
        countryCode: 'NG',
        latitude: 6.68,
        longitude: 3.27,
      },
      receiverStation: {
        StationId: 4,
        StationName: 'LAGOS',
        StationCode: undefined,
        State: undefined,
        StateName: 'LAGOS',
        City: undefined,
        Address: undefined,
        Latitude: undefined,
        Longitude: undefined,
      },
    });

    const result = await expand({
      id: 'base',
      provider: 'GIGL',
      serviceTier: 'Station Pickup - GoStandard',
      carrierName: 'GIG Logistics',
      displayName: 'Pickup',
      estimatedDays: 2,
      price: 1000,
      currency: 'NGN',
      expiresAt: new Date(),
      pickupIncluded: false,
      insuranceIncluded: false,
    });

    expect(result[0]).toEqual(expect.objectContaining({ pickupStationId: 65 }));
    expect(fetchLiveCentres).not.toHaveBeenCalled();
  });
});
