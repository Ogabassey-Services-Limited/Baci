import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('GiglProvider quote requests', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
    vi.resetModules();
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
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

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
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const quotes = await provider.getQuotes(quoteRequest);

    expect(quotes).toHaveLength(1);
    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload.CustomerType).toBe(2);
  });

  it('prices and identifies heavy quotes with the van vehicle type', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

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
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('old-token')))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { message: 'Token expired', status: 401, data: null },
        })
      )
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('new-token')))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);

    const oldPriceHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    const newPriceHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);
    expect(oldPriceHeaders.get('access-token')).toBe('old-token');
    expect(newPriceHeaders.get('access-token')).toBe('new-token');
  });

  it('refreshes cached tokens rejected with HTTP 403', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('old-token')))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('new-token')))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

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
    process.env.GIGL_QUOTE_TIMEOUT_MS = '25';
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('old-token')))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                  })
                ),
              20
            );
          })
      )
      .mockImplementationOnce(abortingFetchResponse);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const quotePromise = provider.getQuotes(quoteRequest);

    await vi.advanceTimersByTimeAsync(20);
    await vi.advanceTimersByTimeAsync(5);

    await expect(quotePromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not cache a failed station envelope as an empty station list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(failedStationsEnvelope))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);
  });

  it('rejects malformed price envelopes with schema validation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { message: 'Success', status: 200, data: { GrandTotal: 'x' } },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
  });
});
