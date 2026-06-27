import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingRequest, QuoteRequest } from '@/lib/shipping/types';

const baseUrl = 'https://dev-thirdpartynode.theagilitysystems.com';

const loginResponse = {
  success: true,
  data: {
    message: 'Success',
    status: 200,
    data: {
      'access-token': 'test-access-token',
      UserChannelCode: 'ECO038082',
      UserChannelType: 2,
      CustomerType: 0,
    },
  },
};

const loginResponseWithoutCustomerType = {
  success: true,
  data: {
    message: 'Success',
    status: 200,
    data: {
      'access-token': 'test-access-token',
      UserChannelCode: 'ECO038082',
      UserChannelType: 2,
    },
  },
};

function loginResponseWithToken(
  token: string,
  userChannelCode = 'ECO038082',
  userChannelType = 2
) {
  return {
    success: true,
    data: {
      message: 'Success',
      status: 200,
      data: {
        'access-token': token,
        UserChannelCode: userChannelCode,
        UserChannelType: userChannelType,
      },
    },
  };
}

const stationsResponse = {
  success: true,
  data: {
    message: 'Success',
    status: 200,
    data: [
      {
        StationId: 4,
        StationName: 'LAGOS',
        StationCode: 'LOS',
        StateName: 'LAGOS',
        CountryName: 'NIGERIA',
        Address: 'Lagos station',
        Latitude: 6.5244,
        Longitude: 3.3792,
      },
      {
        StationId: 30,
        StationName: 'PORT HARCOURT',
        StationCode: 'PHC',
        StateName: 'RIVERS',
        CountryName: 'NIGERIA',
        Address: 'Port Harcourt station',
        Latitude: 4.8156,
        Longitude: 7.0498,
      },
    ],
  },
};

const failedStationsEnvelope = {
  success: true,
  data: {
    message: 'Provider unavailable',
    status: 503,
    data: null,
  },
};

const priceResponse = {
  success: true,
  data: {
    message: 'Success',
    status: 200,
    data: {
      GrandTotal: 8941.43,
      DeliverPrice: 8500,
      PickupCharge: 300,
      InsuranceValue: 141.43,
      DeclaredValue: 100000,
    },
  },
};

const bookingResponse = {
  success: true,
  data: {
    message: 'Success',
    status: 200,
    data: {
      Waybill: 'GIGL-WB-1',
    },
  },
};

const quoteRequest: QuoteRequest = {
  sessionId: 'session-1',
  shipmentType: 'domestic',
  sender: {
    name: 'Ogabassey',
    phone: '08000000000',
    address: 'Ikeja, Lagos',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  receiver: {
    name: 'Customer',
    phone: '08000000001',
    address: 'Port Harcourt, Rivers',
    city: 'Port Harcourt',
    state: 'Rivers',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  items: [
    {
      name: 'Phone',
      description: 'Phone',
      quantity: 1,
      weight: 1,
      value: 100000,
    },
  ],
};

const bookingRequest: BookingRequest = {
  orderId: 'order-1',
  quoteId: 'quote-1',
  providerRateId: 'GIGL_30_1',
  sender: {
    name: 'Ogabassey',
    phone: '08000000000',
    address: 'Ikeja, Lagos',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
    latitude: 0,
    longitude: 0,
  },
  receiver: {
    name: 'Customer',
    phone: '08000000001',
    address: 'Port Harcourt, Rivers',
    city: 'Port Harcourt',
    state: 'Rivers',
    country: 'Nigeria',
    countryCode: 'NG',
    latitude: 0,
    longitude: 0,
  },
  items: [
    {
      name: 'Phone',
      description: 'Phone',
      quantity: 1,
      weight: 1,
      value: 100000,
    },
  ],
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function abortingFetchResponse(_url: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const abort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener('abort', abort, { once: true });
  });
}

describe('GiglProvider', () => {
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

  it('fetches a GIGL quote through the configured login, station, and price endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(loginResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(stationsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(priceResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

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
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://dev-thirdpartynode.theagilitysystems.com/login'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://dev-thirdpartynode.theagilitysystems.com/localstations/get'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://dev-thirdpartynode.theagilitysystems.com/price'
    );

    const pricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(pricePayload).toMatchObject({
      SenderStationId: 4,
      ReceiverStationId: 30,
      CustomerCode: 'ECO038082',
      CustomerType: 0,
      PickUpOptions: 0,
      ShipmentItems: [
        {
          ItemName: 'Phone',
          Description: 'Phone',
          Quantity: 1,
          Weight: 1,
          ShipmentType: 1,
          Value: 100000,
        },
      ],
    });
    expect(pricePayload.ShipmentItems[0]).not.toHaveProperty('ItemType');
    expect(pricePayload).not.toHaveProperty('ShipmentType');
  });

  it('tracks shipments from nested API envelopes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(loginResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              status: 200,
              data: [
                {
                  Waybill: 'GIGL123',
                  Origin: 'LAGOS',
                  Destination: 'PORT HARCOURT',
                  PickupOptions: 0,
                  DeliveryType: 0,
                  MobileShipmentTrackings: [
                    {
                      Status: 'Shipment delivered',
                      ScanStatusReason: 'Delivered to receiver',
                      DateTime: '2026-06-27T08:00:00.000Z',
                      DepartureServiceCentre: {
                        Name: 'Port Harcourt',
                      },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const tracking = await provider.trackShipment('GIGL123');

    expect(tracking).toMatchObject({
      provider: 'GIGL',
      trackingNumber: 'GIGL123',
      status: 'delivered',
      carrierName: 'GIG Logistics',
    });
    expect(tracking.events[0]).toMatchObject({
      description: 'Delivered to receiver',
      location: 'Port Harcourt',
      rawStatus: 'Shipment delivered',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://dev-thirdpartynode.theagilitysystems.com/track/mobileShipment?Waybill=GIGL123'
    );
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

  it('rejects unsuccessful login envelopes before parsing login data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          message: 'Invalid credentials',
          status: 401,
          data: {},
        },
      })
    );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getLocations()).rejects.toThrow(
      'Invalid GIGL login response'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent token requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(loginResponseWithoutCustomerType));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(
      Promise.all([provider.isAvailable(), provider.isAvailable()])
    ).resolves.toEqual([true, true]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/login`);
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

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `${baseUrl}/login`,
      `${baseUrl}/localstations/get`,
      `${baseUrl}/localstations/get`,
      `${baseUrl}/price`,
    ]);
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
          data: {
            message: 'Success',
            status: 200,
            data: {
              GrandTotal: '8941.43',
            },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            message: 'Success',
            status: 200,
            data: {},
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
  });

  it('refreshes a stale cached token once when GIGL rejects it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('old-token')))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
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
    const freshStationHeaders = new Headers(
      fetchMock.mock.calls[3]?.[1]?.headers
    );
    const priceHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);

    expect(oldStationHeaders.get('access-token')).toBe('old-token');
    expect(freshStationHeaders.get('access-token')).toBe('new-token');
    expect(priceHeaders.get('access-token')).toBe('new-token');
  });

  it('rebuilds price retry payloads with refreshed channel data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(loginResponseWithToken('old-token', 'OLD-CODE', 2))
      )
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(loginResponseWithToken('new-token', 'NEW-CODE', 4))
      )
      .mockResolvedValueOnce(jsonResponse(priceResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toHaveLength(1);

    const oldPriceHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    const newPriceHeaders = new Headers(fetchMock.mock.calls[4]?.[1]?.headers);
    const oldPricePayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    const newPricePayload = JSON.parse(
      String(fetchMock.mock.calls[4]?.[1]?.body ?? '{}')
    );

    expect(oldPriceHeaders.get('access-token')).toBe('old-token');
    expect(oldPricePayload).toMatchObject({
      CustomerCode: 'OLD-CODE',
      CustomerType: 2,
    });
    expect(newPriceHeaders.get('access-token')).toBe('new-token');
    expect(newPricePayload).toMatchObject({
      CustomerCode: 'NEW-CODE',
      CustomerType: 4,
    });
  });

  it('books the selected station-pickup quote semantics', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(bookingResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const result = await provider.bookShipment(bookingRequest);

    const bookingPayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(bookingPayload).toMatchObject({
      SenderDetails: {
        SenderLocation: {
          Latitude: 0,
          Longitude: 0,
        },
      },
      ReceiverDetails: {
        ReceiverStationId: 30,
        ReceiverLocation: {
          Latitude: 0,
          Longitude: 0,
        },
      },
      ShipmentDetails: {
        PickUpOptions: 1,
        DeliveryOptionIds: [11],
      },
    });
    expect(result).toMatchObject({
      provider: 'GIGL',
      trackingNumber: 'GIGL-WB-1',
      isStationPickup: true,
      pickupStationName: 'PORT HARCOURT',
      pickupStationAddress: 'Port Harcourt station',
    });
  });

  it('rejects station-pickup bookings when the selected station cannot be resolved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(
      provider.bookShipment({
        ...bookingRequest,
        providerRateId: 'GIGL_999_1',
      })
    ).rejects.toThrow('Selected GIGL station was not found');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not call GIGL when credentials are missing', async () => {
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns quickly when GIGL quote requests hang', async () => {
    process.env.GIGL_QUOTE_TIMEOUT_MS = '25';
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(abortingFetchResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const quotePromise = provider.getQuotes(quoteRequest);

    await vi.advanceTimersByTimeAsync(25);

    await expect(quotePromise).resolves.toEqual([]);
  });
});
