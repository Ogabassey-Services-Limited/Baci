import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockTrackShipment = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => new Map()),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    trackShipment: (...args: unknown[]) => mockTrackShipment(...args),
  },
}));

import { GET, POST } from './route';

function makePostRequest(trackingNumber = 'TRACK123') {
  return POST(
    new NextRequest(`http://localhost/api/shipping/track/${trackingNumber}`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ trackingNumber }) }
  );
}

function mockShipmentLookup(data: unknown) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'shipments') {
      throw new Error(`Unexpected table write/read: ${table}`);
    }

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    };
  });
}

describe('/api/shipping/track/[trackingNumber] method boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects GET so tracking refresh cannot be triggered by prefetch or forged navigation', async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(body.error).toContain('Use POST');
  });

  it('returns 400 when the tracking number param is empty', async () => {
    const response = await makePostRequest('');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Tracking number required');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockTrackShipment).not.toHaveBeenCalled();
  });

  it('returns live tracking data without mutating shipment or order rows', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: undefined,
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [
        {
          description: 'Package in transit',
          location: 'Lagos',
          status: 'in_transit',
          timestamp: new Date('2026-05-10T10:00:00Z'),
        },
      ],
      provider: 'dhl',
      status: 'in_transit',
    });

    const response = await makePostRequest();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockTrackShipment).toHaveBeenCalledWith('TRACK123', 'dhl');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({
      shipment: { id: 'shipment-1', orderId: 'order-1' },
      status: 'in_transit',
      trackingNumber: 'TRACK123',
    });
  });

  it('returns 404 when the carrier reports the shipment is not found', async () => {
    mockShipmentLookup(null);
    mockTrackShipment.mockRejectedValue(new Error('Shipment not found'));

    const response = await makePostRequest();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Shipment not found');
    expect(mockFrom).toHaveBeenCalledWith('shipments');
    expect(mockTrackShipment).toHaveBeenCalledWith('TRACK123');
  });

  it('returns 500 when the tracking provider is unavailable', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockTrackShipment.mockRejectedValue(new Error('Service unavailable'));

    const response = await makePostRequest();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to track shipment' });
    expect(mockFrom).toHaveBeenCalledWith('shipments');
    expect(mockTrackShipment).toHaveBeenCalledWith('TRACK123', 'dhl');
  });
});
