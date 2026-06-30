import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GIGL_BASE_URL =
    'https://dev-thirdpartynode.theagilitysystems.com';
  process.env.GIGL_EMAIL = 'test@example.com';
  process.env.GIGL_PASSWORD = 'test-password';
});

import { GiglApiClient } from './gigl.auth';
import { GIGL_QUOTE_TIMEOUT_MS } from './gigl.constants';
import { getGiglQuotes } from './gigl.quotes';
import { GiglStationsService } from './gigl.stations';
import {
  abortingFetchResponse,
  baseUrl,
  failedStationsEnvelope,
  jsonResponse,
  loginResponse,
  loginResponseWithoutCustomerType,
  loginResponseWithToken,
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
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();
    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      provider: 'GIGL',
      serviceTier: 'Standard',
      carrierName: 'GIG Logistics',
      price: 8941,
      currency: 'NGN',
      providerRateId: 'GIGL_30_0_1',
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${baseUrl}/login`,
      `${baseUrl}/localstations/get`,
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
  });

  it('falls back to UserChannelType when CustomerType is absent', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(1);
    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload.CustomerType).toBe(2);
  });

  it('prices and identifies heavy quotes with the van vehicle type', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    const quotes = await provider.getQuotes({
      ...quoteRequest,
      items: [{ ...quoteRequest.items[0], weight: 31 }],
    });

    expect(quotes[0]?.providerRateId).toBe('GIGL_30_0_2');
    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload.VehicleType).toBe(2);
  });

  it('refreshes tokens rejected inside successful GIGL envelopes', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithToken('old-token')),
      jsonResponse(stationsResponse),
      jsonResponse({
        success: true,
        data: { message: 'Token expired', status: 401, data: null },
      }),
      jsonResponse(loginResponseWithToken('new-token')),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);

    const oldPriceHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    const newPriceHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);
    expect(oldPriceHeaders.get('access-token')).toBe('old-token');
    expect(newPriceHeaders.get('access-token')).toBe('new-token');
  });

  it('refreshes cached tokens rejected with HTTP 403', async () => {
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithToken('old-token')),
      new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      jsonResponse(loginResponseWithToken('new-token')),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);

    const oldStationHeaders = new Headers(
      fetchMock.mock.calls[1]?.[1]?.headers
    );
    const newStationHeaders = new Headers(
      fetchMock.mock.calls[3]?.[1]?.headers
    );
    const priceHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);
    expect(oldStationHeaders.get('access-token')).toBe('old-token');
    expect(newStationHeaders.get('access-token')).toBe('new-token');
    expect(priceHeaders.get('access-token')).toBe('new-token');
  });

  it('uses the original quote signal during stale-token refresh', async () => {
    vi.useFakeTimers();
    let resolveUnauthorized: (response: Response) => void = () => undefined;
    const unauthorizedResponse = new Promise<Response>((resolve) => {
      resolveUnauthorized = resolve;
    });
    const fetchMock = mockGiglFetchSequence(
      jsonResponse(loginResponseWithToken('old-token')),
      jsonResponse(stationsResponse),
      () => unauthorizedResponse,
      abortingFetchResponse
    );

    const provider = buildQuoteHarness();
    const quotePromise = provider.getQuotes(quoteRequest);

    resolveUnauthorized(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(GIGL_QUOTE_TIMEOUT_MS);

    await expect(quotePromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not cache a failed station envelope as an empty station list', async () => {
    mockGiglFetchSequence(
      jsonResponse(loginResponseWithoutCustomerType),
      jsonResponse(failedStationsEnvelope),
      jsonResponse(stationsResponse),
      jsonResponse(priceResponse)
    );

    const provider = buildQuoteHarness();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);
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
      jsonResponse({ success: true, data: {} })
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
