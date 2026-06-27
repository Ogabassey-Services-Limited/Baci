import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  jsonResponse,
  loginResponse,
  loginResponseWithToken,
} from './gigl.test-helpers';

const trackingEnvelope = {
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
            DepartureServiceCentre: { Name: 'Port Harcourt' },
          },
        ],
      },
    ],
  },
};

describe('GiglProvider tracking requests', () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('tracks shipments from nested API envelopes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(jsonResponse(trackingEnvelope));

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
      `${baseUrl}/track/mobileShipment?Waybill=GIGL123`
    );
  });

  it('derives the tracking status from the newest event after sorting', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            status: 200,
            data: [
              {
                ...trackingEnvelope.data.data[0],
                MobileShipmentTrackings: [
                  {
                    Status: 'Shipment in transit',
                    ScanStatusReason: 'Departed origin centre',
                    DateTime: '2026-06-27T08:00:00.000Z',
                    DepartureServiceCentre: { Name: 'Lagos' },
                  },
                  {
                    Status: 'Shipment delivered',
                    ScanStatusReason: 'Delivered to receiver',
                    DateTime: '2026-06-27T12:00:00.000Z',
                    DepartureServiceCentre: { Name: 'Port Harcourt' },
                  },
                ],
              },
            ],
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const tracking = await provider.trackShipment('GIGL123');

    expect(tracking.status).toBe('delivered');
    expect(tracking.events.map((event) => event.rawStatus)).toEqual([
      'Shipment delivered',
      'Shipment in transit',
    ]);
  });

  it('refreshes tracking tokens rejected inside successful envelopes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('old-token')))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { message: 'Unauthorized token', status: 401, data: null },
        })
      )
      .mockResolvedValueOnce(jsonResponse(loginResponseWithToken('new-token')))
      .mockResolvedValueOnce(jsonResponse(trackingEnvelope));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).resolves.toMatchObject({
      trackingNumber: 'GIGL123',
    });

    const oldHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    const newHeaders = new Headers(fetchMock.mock.calls[3]?.[1]?.headers);
    expect(oldHeaders.get('access-token')).toBe('old-token');
    expect(newHeaders.get('access-token')).toBe('new-token');
  });
});
