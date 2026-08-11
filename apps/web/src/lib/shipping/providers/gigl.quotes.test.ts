import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GIGL_BASE_URL =
    'https://dev-thirdpartynode.theagilitysystems.com';
  process.env.GIGL_EMAIL = 'test@example.com';
  process.env.GIGL_PASSWORD = 'test-password';
});

import { GiglApiClient } from './gigl.auth';
import { getGiglQuotes } from './gigl.quotes';
import { GiglStationsService } from './gigl.stations';
import { quoteProviderFailure } from '../quote-provider-failure';
import {
  baseUrl,
  failedStationsEnvelope,
  jsonResponse,
  loginResponse,
  loginResponseWithoutCustomerType,
  priceResponse,
  quoteRequest,
  serviceCentresResponse,
  stationsResponse,
} from './gigl.test-helpers';

type FetchResponseFactory = (
  url: string,
  init?: RequestInit
) => Response | Promise<Response>;

function mockGiglFetchSequence(
  ...responses: Array<Response | FetchResponseFactory>
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const nextResponse = responses.shift();
    if (!nextResponse) {
      throw new Error(`Unexpected GIGL fetch: ${url}`);
    }

    return typeof nextResponse === 'function'
      ? nextResponse(url, init)
      : nextResponse;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function buildQuoteHarness(generateQuoteId?: () => string) {
  const log = vi.fn();
  const safeFetch = (
    url: string,
    options?: RequestInit & { timeout?: number }
  ) => fetch(url, options);
  const apiClient = new GiglApiClient({ safeFetch, log });
  const stationsService = new GiglStationsService(apiClient);
  const quoteIds = ['quote-1', 'quote-2', 'quote-3', 'quote-4'];

  return {
    getQuotes: (request: typeof quoteRequest) =>
      getGiglQuotes(
        apiClient,
        stationsService,
        {
          safeFetch,
          log,
          generateQuoteId:
            generateQuoteId ?? (() => quoteIds.shift() ?? 'quote-fallback'),
          getQuoteExpiry: (hours = 1) =>
            new Date(Date.now() + hours * 60 * 60 * 1000),
        },
        request
      ),
  };
}

describe('GiglProvider quote requests', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    delete process.env.GIGL_QUOTE_TIMEOUT_MS;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches a quote through the configured login, station, and price endpoints', async () => {
    const resolutionSpy = vi.spyOn(
      GiglStationsService.prototype,
      'resolveStationForLocation'
    );
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();
    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({
      provider: 'GIGL',
      serviceTier: 'GoStandard',
      carrierName: 'GIG Logistics',
      price: 8941,
      currency: 'NGN',
      providerRateId: 'GIGL_30_0_1_0_0',
    });
    expect(quotes[1]).toMatchObject({
      serviceTier: 'GoFaster',
      providerRateId: 'GIGL_30_0_1_0_1',
    });
    expect(quotes.some((quote) => quote.isStationPickup)).toBe(false);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${baseUrl}/login`,
      `${baseUrl}/localstations/get`,
      `${baseUrl}/price/v3`,
      `${baseUrl}/price/v3`,
      `${baseUrl}/price/v3`,
      `${baseUrl}/price/v3`,
    ]);

    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload).toMatchObject({
      SenderStationId: 4,
      ReceiverStationId: 30,
      PickUpOptions: 0,
      VehicleType: 1,
      IsPriorityShipment: false,
    });
    expect(pricePayload.ShipmentItems[0]).toMatchObject({
      SpecialPackageId: 1,
    });
    expect(pricePayload.ShipmentItems[0]).not.toHaveProperty('ItemType');
    expect(pricePayload).not.toHaveProperty('ShipmentType');
    const goFasterPayload = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body ?? '{}')
    );
    expect(goFasterPayload).toMatchObject({
      PickUpOptions: 0,
      IsPriorityShipment: true,
    });
    expect(pricePayload).not.toHaveProperty('CustomerCode');
    expect(pricePayload).not.toHaveProperty('CustomerType');
    expect(
      resolutionSpy.mock.calls.map((call) => call[1]?.preferNearest)
    ).toEqual([false]);
  });

  it('falls back to a station-pickup quote when home delivery is unavailable', async () => {
    const resolutionSpy = vi.spyOn(
      GiglStationsService.prototype,
      'resolveStationForLocation'
    );
    mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse({
        success: true,
        data: { message: 'Home delivery unavailable', status: 503, data: null },
      }),
      jsonResponse({
        success: true,
        data: { message: 'Home delivery unavailable', status: 503, data: null },
      }),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse),
      jsonResponse(serviceCentresResponse)
    );

    const provider = buildQuoteHarness();
    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(6);
    expect(quotes[0]).toMatchObject({
      provider: 'GIGL',
      serviceTier: 'Station Pickup - GoStandard',
      displayName:
        'GIG Logistics - Pickup at PHC RUMUOLUMENI IWOFE - GoStandard',
      providerRateId: 'GIGL_30_1_1_575_0',
      isStationPickup: true,
      stationId: 30,
      stationName: 'PHC RUMUOLUMENI IWOFE',
      stationCode: 'RUM',
      pickupStationCode: 'RUM',
      deliveryRange: '1-3 working days',
      minDays: 1,
      maxDays: 3,
    });
    expect(
      resolutionSpy.mock.calls.map((call) => call[1]?.preferNearest)
    ).toEqual([false, true]);
  });

  it('keeps prefetched station centres when nearest-station repricing fails', async () => {
    const portHarcourtStation = {
      StationId: 30,
      StationName: 'PORT HARCOURT',
      StationCode: 'PHC',
      State: 'RIVERS',
      StateName: 'RIVERS',
      City: 'PORT HARCOURT',
      Address: undefined,
      Latitude: undefined,
      Longitude: undefined,
    };
    const lagosStation = {
      ...portHarcourtStation,
      StationId: 4,
      StationName: 'LAGOS',
      StationCode: 'LOS',
      State: 'LAGOS',
      StateName: 'LAGOS',
      City: 'LAGOS',
    };
    vi.spyOn(GiglStationsService.prototype, 'resolveStationForLocation')
      .mockResolvedValueOnce({ station: portHarcourtStation })
      .mockResolvedValueOnce({
        station: lagosStation,
        serviceCentres: [
          {
            StationId: 4,
            StationName: 'LAGOS',
            StationCode: 'LOS',
            ServiceCentreId: 65,
            ServiceCentreName: 'SANGO OTTA',
            ServiceCentreCode: 'SOT',
            Address: undefined,
            Latitude: 6.707,
            Longitude: 3.243,
          },
        ],
      });
    const unavailable = jsonResponse({
      success: true,
      data: { message: 'Unavailable', status: 503, data: null },
    });
    mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      unavailable.clone(),
      unavailable.clone(),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse),
      unavailable.clone(),
      unavailable.clone(),
      jsonResponse(serviceCentresResponse)
    );

    const quotes = await buildQuoteHarness().getQuotes(quoteRequest);

    expect(quotes).not.toHaveLength(0);
    expect(
      quotes.every((quote) => quote.providerRateId?.startsWith('GIGL_30_'))
    ).toBe(true);
    expect(quotes.every((quote) => quote.stationId === 30)).toBe(true);
  });

  it('keeps station-pickup fallback when only GoFaster home delivery succeeds', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse({
        success: true,
        data: { message: 'GoStandard unavailable', status: 503, data: null },
      }),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse),
      jsonResponse({
        success: true,
        data: {
          message: 'GoFaster pickup unavailable',
          status: 503,
          data: null,
        },
      }),
      jsonResponse(serviceCentresResponse)
    );

    const quotes = await buildQuoteHarness().getQuotes(quoteRequest);

    expect(quotes.some((quote) => quote.serviceTier === 'GoFaster')).toBe(true);
    expect(quotes.some((quote) => quote.isStationPickup)).toBe(true);
  });

  it('preserves home delivery when the service-centre request throws', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      () => Promise.reject(new Error('service-centre pricing unavailable'))
    );

    const quotes = await buildQuoteHarness().getQuotes(quoteRequest);

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      isStationPickup: false,
      providerRateId: 'GIGL_30_0_1_0_0',
    });
  });

  it('preserves a pickup quote when service-centre expansion throws', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(serviceCentresResponse)
    );
    const generateQuoteId = vi
      .fn<() => string>()
      .mockReturnValueOnce('base-station-quote')
      .mockImplementation(() => {
        throw new Error('quote id unavailable');
      });

    const quotes = await buildQuoteHarness(generateQuoteId).getQuotes({
      ...quoteRequest,
      deliveryPreference: 'pickup_station',
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      id: 'base-station-quote',
      isStationPickup: true,
      providerRateId: 'GIGL_30_1_1_0_0',
    });
  });

  it('falls back to UserChannelType when CustomerType is absent', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(2);
    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload).not.toHaveProperty('CustomerType');
  });

  it('prices and identifies heavy quotes with the van vehicle type', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    const quotes = await provider.getQuotes({
      ...quoteRequest,
      items: [{ ...quoteRequest.items[0], weight: 31 }],
    });

    expect(quotes.map((quote) => quote.providerRateId)).toEqual([
      'GIGL_30_0_2_0_0',
      'GIGL_30_0_2_0_1',
    ]);
    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload.VehicleType).toBe(2);
  });

  it('does not cache a failed station envelope as an empty station list', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(failedStationsEnvelope),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(2);
  });

  it('skips GIGL quotes when the sender station cannot be resolved', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse)
    );

    const provider = buildQuoteHarness();
    if (!quoteRequest.sender) {
      throw new Error('Quote fixture must include sender details');
    }

    await expect(
      provider.getQuotes({
        ...quoteRequest,
        sender: {
          ...quoteRequest.sender,
          city: 'Asaba',
          state: 'Delta',
        },
      })
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed price envelopes with schema validation', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse({
        success: true,
        data: { message: 'Success', status: 200, data: { GrandTotal: 'x' } },
      }),
      jsonResponse({
        success: true,
        data: { message: 'Success', status: 200, data: { GrandTotal: 'x' } },
      })
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
  });

  it('rejects zero-value GIGL prices as unpriced routes', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse({
        success: true,
        data: {
          message: 'Success',
          status: 200,
          data: { GrandTotal: 0 },
        },
      }),
      jsonResponse({
        success: true,
        data: {
          message: 'Success',
          status: 200,
          data: { GrandTotal: 0 },
        },
      })
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
  });

  it('marks a domestic GIGL request failure for aggregate diagnostics', async () => {
    mockGiglFetchSequence(() => Promise.reject(new Error('login unavailable')));

    const provider = buildQuoteHarness();
    const result = await provider.getQuotes(quoteRequest);

    expect(result).toEqual([]);
    expect(quoteProviderFailure.get(result)?.message).toBe('login unavailable');
  });
});
