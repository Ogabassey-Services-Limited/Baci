import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GIGL_TRACKING_RESPONSE_MAX_BYTES } from './gigl.constants';
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
    delete process.env.GIGL_TRACKING_TIMEOUT_MS;
    vi.useRealTimers();
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
    expect(tracking.actualDelivery).toEqual(
      new Date('2026-06-27T08:00:00.000Z')
    );
    expect(tracking.events[0]).toMatchObject({
      status: 'delivered',
      description: 'Delivered to receiver',
      location: 'Port Harcourt',
      rawStatus: 'Shipment delivered',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${baseUrl}/track/mobileShipment?Waybill=GIGL123&fetchOption=2`
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

  it('rejects non-OK tracking responses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Service unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).rejects.toThrow(
      'Failed to track GIGL shipment'
    );
  });

  it('rejects a tracking response that exceeds the configured response limit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(trackingEnvelope), {
          status: 200,
          headers: {
            'Content-Length': String(GIGL_TRACKING_RESPONSE_MAX_BYTES + 1),
            'Content-Type': 'application/json',
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).rejects.toThrow(
      'GIGL response exceeds maximum size'
    );
  });

  it('rejects unsuccessful tracking envelopes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            status: 503,
            message: 'Provider unavailable',
            data: null,
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).rejects.toThrow(
      'Invalid GIGL tracking response'
    );
  });

  it('rejects empty tracking results', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            status: 200,
            data: [],
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).rejects.toThrow(
      'Shipment not found'
    );
  });

  it('rejects null tracking events instead of regressing shipment status', async () => {
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
                Waybill: 'GIGL123',
                MobileShipmentTrackings: null,
              },
            ],
          },
        })
      );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.trackShipment('GIGL123')).rejects.toThrow(
      'GIGL tracking result has no valid tracking events'
    );
  });

  it('bounds tracking token fetches with the GIGL tracking timeout', async () => {
    process.env.GIGL_TRACKING_TIMEOUT_MS = '25';
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    const trackingPromise = provider.trackShipment('TOPSHIP123');
    const trackingAssertion = expect(trackingPromise).rejects.toThrow(
      'GIGL tracking timed out'
    );

    await vi.advanceTimersByTimeAsync(25);

    await trackingAssertion;
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/login`,
      expect.objectContaining({ method: 'POST' })
    );
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
