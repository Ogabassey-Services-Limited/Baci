import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockTrackShipment = vi.fn();
const mockOrderStatusEq = vi.fn();
const mockOrderStatusUpdate = vi.fn();
const mockShipmentStatusEq = vi.fn();
const mockShipmentStatusMaybeSingle = vi.fn();
const mockShipmentStatusSelect = vi.fn();
const mockShipmentStatusUpdate = vi.fn();
const mockRpc = vi.fn();
const mockAuthGetUser = vi.fn();
const mockMaybeNotifyActivateProtection = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => new Map()),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/supabase/admin', () => {
  throw new Error(
    'shipping tracking route must not import the service-role client'
  );
});

vi.mock('@/lib/insurance/notify-activate-protection', () => ({
  maybeNotifyActivateProtection: (...args: unknown[]) =>
    mockMaybeNotifyActivateProtection(...args),
}));

vi.mock('@/lib/shipping', () => ({
  shippingService: {
    trackShipment: (...args: unknown[]) => mockTrackShipment(...args),
  },
}));

import { GET, POST } from './route';

const CSRF_HEADERS = {
  Cookie: 'csrf-token=test-csrf-token',
  'x-csrf-token': 'test-csrf-token',
};

function makePostRequest(trackingNumber = 'TRACK123') {
  return POST(
    new NextRequest(`http://localhost/api/shipping/track/${trackingNumber}`, {
      headers: CSRF_HEADERS,
      method: 'POST',
    }),
    { params: Promise.resolve({ trackingNumber }) }
  );
}

function mockShipmentLookup(data: unknown) {
  let shipmentTableCallCount = 0;

  mockOrderStatusEq.mockResolvedValue({ error: null });
  mockOrderStatusUpdate.mockReturnValue({ eq: mockOrderStatusEq });
  mockShipmentStatusMaybeSingle.mockResolvedValue({
    data: { id: 'shipment-1' },
    error: null,
  });
  mockShipmentStatusSelect.mockReturnValue({
    maybeSingle: mockShipmentStatusMaybeSingle,
  });
  mockShipmentStatusEq.mockReturnValue({ select: mockShipmentStatusSelect });
  mockShipmentStatusUpdate.mockReturnValue({ eq: mockShipmentStatusEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'orders') {
      return {
        update: mockOrderStatusUpdate,
      };
    }

    if (table !== 'shipments') {
      throw new Error(`Unexpected table write/read: ${table}`);
    }

    shipmentTableCallCount += 1;
    if (shipmentTableCallCount > 1) {
      return {
        update: mockShipmentStatusUpdate,
      };
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
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockMaybeNotifyActivateProtection.mockResolvedValue(undefined);
    mockRpc.mockResolvedValue({ data: true, error: null });
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

  it('returns 403 when CSRF validation fails before refreshing tracking', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/shipping/track/TRACK123', {
        method: 'POST',
      }),
      { params: Promise.resolve({ trackingNumber: 'TRACK123' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockTrackShipment).not.toHaveBeenCalled();
  });

  it('returns live tracking data and persists the refreshed shipment and order statuses', async () => {
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
    expect(mockFrom).toHaveBeenCalledWith('shipments');
    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockShipmentStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_location: 'Lagos',
        estimated_delivery_at: '2026-05-12T10:00:00.000Z',
        status: 'in_transit',
        tracking_events: expect.any(Array),
      })
    );
    expect(mockShipmentStatusEq).toHaveBeenCalledWith('id', 'shipment-1');
    expect(mockOrderStatusUpdate).toHaveBeenCalledWith({
      shipping_status: 'shipped',
    });
    expect(mockOrderStatusEq).toHaveBeenCalledWith('id', 'order-1');
    expect(body).toMatchObject({
      shipment: { id: 'shipment-1', orderId: 'order-1' },
      status: 'in_transit',
      trackingNumber: 'TRACK123',
    });
  });

  it('returns live tracking data and skips order updates when snapshot persistence is denied', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockShipmentStatusMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'shipment write failed' },
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: undefined,
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [],
      provider: 'dhl',
      status: 'in_transit',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: 'in_transit',
        trackingNumber: 'TRACK123',
      });
      expect(mockOrderStatusUpdate).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('returns live delivered tracking without a customer-callable fallback when snapshot persistence is denied', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockShipmentStatusMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'shipment write denied by RLS' },
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: new Date('2026-05-12T15:00:00Z'),
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [
        {
          description: 'Delivered',
          location: 'Lagos',
          status: 'delivered',
          timestamp: new Date('2026-05-12T15:00:00Z'),
        },
      ],
      provider: 'dhl',
      status: 'delivered',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ status: 'delivered' });
      expect(mockOrderStatusUpdate).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockMaybeNotifyActivateProtection).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not check customer auth when denied customer persistence cannot transition delivery', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockShipmentStatusMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'shipment write denied by RLS' },
    });
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: new Date('2026-05-12T15:00:00Z'),
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [],
      provider: 'dhl',
      status: 'delivered',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();

      expect(response.status).toBe(200);
      expect(mockAuthGetUser).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockMaybeNotifyActivateProtection).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not use a delivered RPC when customer-scoped shipment update matches zero rows', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockShipmentStatusMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: new Date('2026-05-12T15:00:00Z'),
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [],
      provider: 'dhl',
      status: 'delivered',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();

      expect(response.status).toBe(200);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockMaybeNotifyActivateProtection).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not use a delivered RPC when order status persistence is denied', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockShipmentStatusMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'shipment write denied by RLS' },
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: new Date('2026-05-12T15:00:00Z'),
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [],
      provider: 'dhl',
      status: 'delivered',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();

      expect(response.status).toBe(200);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockMaybeNotifyActivateProtection).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('returns live tracking data when order shipping status persistence is denied', async () => {
    mockShipmentLookup({
      carrier_name: 'DHL',
      estimated_delivery_days: 3,
      id: 'shipment-1',
      order_id: 'order-1',
      provider: 'dhl',
      receiver_address: { city: 'Ikeja', state: 'Lagos' },
    });
    mockOrderStatusEq.mockResolvedValueOnce({
      error: { message: 'order write failed' },
    });
    mockTrackShipment.mockResolvedValue({
      actualDelivery: undefined,
      carrierName: 'DHL',
      estimatedDelivery: new Date('2026-05-12T10:00:00Z'),
      events: [],
      provider: 'dhl',
      status: 'in_transit',
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await makePostRequest();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: 'in_transit',
        trackingNumber: 'TRACK123',
      });
      expect(mockShipmentStatusUpdate).toHaveBeenCalled();
      expect(mockOrderStatusUpdate).toHaveBeenCalledWith({
        shipping_status: 'shipped',
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
