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
import {
  baseUrl,
  failedStationsEnvelope,
  jsonResponse,
  loginResponse,
  loginResponseWithoutCustomerType,
  priceResponse,
  quoteRequest,
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

function buildQuoteHarness() {
  const log = vi.fn();
  const safeFetch = (
    url: string,
    options?: RequestInit & { timeout?: number }
  ) => fetch(url, options);
  const apiClient = new GiglApiClient({ safeFetch, log });
  const stationsService = new GiglStationsService(apiClient);

  return {
    getQuotes: (request: typeof quoteRequest) =>
      getGiglQuotes(
        apiClient,
        stationsService,
        {
          safeFetch,
          log,
          generateQuoteId: () => 'quote-1',
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
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponse),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();
    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({
      provider: 'GIGL',
      serviceTier: 'Standard',
      carrierName: 'GIG Logistics',
      price: 8941,
      currency: 'NGN',
      providerRateId: 'GIGL_30_0_1',
    });
    expect(quotes[1]).toMatchObject({
      provider: 'GIGL',
      serviceTier: 'Station Pickup',
      providerRateId: 'GIGL_30_1_1',
      isStationPickup: true,
      stationId: 30,
      stationName: 'PORT HARCOURT',
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${baseUrl}/login`,
      `${baseUrl}/localstations/get`,
      `${baseUrl}/price`,
      `${baseUrl}/price`,
    ]);

    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload).toMatchObject({
      SenderStationId: 4,
      ReceiverStationId: 30,
      CustomerCode: 'ECO038082',
      CustomerType: 0,
      PickUpOptions: 0,
      VehicleType: 1,
    });
    expect(pricePayload.ShipmentItems[0]).not.toHaveProperty('ItemType');
    expect(pricePayload).not.toHaveProperty('ShipmentType');
    const stationPickupPayload = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body ?? '{}')
    );
    expect(stationPickupPayload.PickUpOptions).toBe(1);
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
    expect(pricePayload.CustomerType).toBe(2);
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
      'GIGL_30_0_2',
      'GIGL_30_1_2',
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
});
