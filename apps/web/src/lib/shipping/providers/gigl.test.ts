import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteRequest } from '@/lib/shipping/types';

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

describe('GiglProvider', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL =
      'https://dev-thirdpartynode.theagilitysystems.com';
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches a GIGL quote through the documented login, station, and price endpoints', async () => {
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
});
