import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type SupabaseResponse = { data: unknown; error: { message: string } | null };
  type UpdateBuilder = Promise<SupabaseResponse> & {
    eq: ReturnType<typeof vi.fn>;
  };

  const createUpdateBuilder = (): UpdateBuilder => {
    const builder = Promise.resolve({
      data: null,
      error: null,
    }) as UpdateBuilder;
    builder.eq = vi.fn(() => builder);
    return builder;
  };

  const shipmentQuery = { eq: vi.fn(), single: vi.fn() };
  shipmentQuery.eq.mockImplementation(() => shipmentQuery);
  const shipmentSelect = vi.fn(() => shipmentQuery);

  const shipmentUpdateBuilders: UpdateBuilder[] = [];
  const orderUpdateBuilders: UpdateBuilder[] = [];
  const webhookEventUpdateBuilders: UpdateBuilder[] = [];

  const shipmentUpdate = vi.fn(() => {
    const builder = createUpdateBuilder();
    shipmentUpdateBuilders.push(builder);
    return builder;
  });
  const orderUpdate = vi.fn(() => {
    const builder = createUpdateBuilder();
    orderUpdateBuilders.push(builder);
    return builder;
  });
  const webhookEventInsert = vi.fn();
  const webhookEventUpdate = vi.fn(() => {
    const builder = createUpdateBuilder();
    webhookEventUpdateBuilders.push(builder);
    return builder;
  });

  const from = vi.fn((table: string) => {
    if (table === 'shipments') {
      return { select: shipmentSelect, update: shipmentUpdate };
    }
    if (table === 'orders') return { update: orderUpdate };
    if (table === 'shipping_webhook_events') {
      return { insert: webhookEventInsert, update: webhookEventUpdate };
    }
    return { insert: vi.fn(async () => ({ error: null })) };
  });

  const hmac = { update: vi.fn(), digest: vi.fn() };
  const crypto = { createHmac: vi.fn(), timingSafeEqual: vi.fn() };

  return {
    crypto,
    from,
    hmac,
    orderUpdate,
    orderUpdateBuilders,
    shipmentQuery,
    shipmentSelect,
    shipmentUpdate,
    shipmentUpdateBuilders,
    webhookEventInsert,
    webhookEventUpdate,
    webhookEventUpdateBuilders,
  };
});

vi.mock('node:crypto', () => ({ default: mocks.crypto }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mocks.from })),
}));
vi.mock('@/lib/expo-push', () => ({
  notifyOrderStatusChange: vi.fn().mockResolvedValue(undefined),
}));

import crypto from 'node:crypto';
import { notifyOrderStatusChange } from '@/lib/expo-push';
import { POST } from './route';

const signatureHeaders = { 'x-webhook-signature': 'mock-signature-hash' };

function createMockRequest(
  provider: string,
  body: string,
  headers: Record<string, string> = {}
) {
  return new NextRequest(`http://localhost/api/shipping/webhooks/${provider}`, {
    method: 'POST',
    body,
    headers: new Headers(headers),
  });
}

function createShipment(id: string, orderId: string) {
  return {
    id,
    order_id: orderId,
    status: 'pending',
    tracking_events: [],
    orders: [
      {
        order_number: `ORD-${id}`,
        customer_id: `cust-${id}`,
        customers: [{ user_id: `user-${id}` }],
      },
    ],
  };
}

function postWebhook(provider: string, body: string) {
  return POST(createMockRequest(provider, body, signatureHeaders), {
    params: Promise.resolve({ provider }),
  });
}

describe('Shipping Webhooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hmac.update.mockReturnValue(mocks.hmac);
    mocks.hmac.digest.mockReturnValue('mock-signature-hash');
    mocks.crypto.createHmac.mockReturnValue(mocks.hmac);
    mocks.crypto.timingSafeEqual.mockReturnValue(true);
    mocks.shipmentQuery.single.mockResolvedValue({ data: null, error: null });
    mocks.webhookEventInsert.mockResolvedValue({ error: null });
    vi.stubEnv('GIGL_WEBHOOK_SECRET', 'test-secret');
    vi.stubEnv('TOPSHIP_WEBHOOK_SECRET', 'topship-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when signature is missing', async () => {
    const request = createMockRequest('gigl', '{"Waybill":"123"}');
    const response = await POST(request, {
      params: Promise.resolve({ provider: 'gigl' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid signature' });
  });

  it('returns 401 when signature is invalid', async () => {
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(false);

    const response = await postWebhook('gigl', '{"Waybill":"123"}');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Invalid signature' });
  });

  it('returns 400 when JSON payload is invalid', async () => {
    const response = await postWebhook('gigl', 'invalid json');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON' });
  });

  it.each([
    'gigl',
    'topship',
  ])('returns parsed false for unknown %s payloads', async (provider) => {
    const response = await postWebhook(provider, '{"unknown":"field"}');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, parsed: false });
  });

  it('processes GIGL webhook when shipment is not found', async () => {
    const response = await postWebhook(
      'gigl',
      JSON.stringify({
        Waybill: 'GIGL12345',
        ShipmentScanStatus: 'Delivered',
        ScanDate: '2026-06-16T10:30:00.000Z',
      })
    );

    expect(mocks.shipmentSelect).toHaveBeenCalledWith(
      expect.stringContaining('id, order_id, status, tracking_events')
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      processed: false,
      reason: 'shipment_not_found',
    });
    expect(mocks.webhookEventUpdateBuilders.at(-1)?.eq).toHaveBeenCalledWith(
      'tracking_number',
      'GIGL12345'
    );
  });

  it('processes GIGL webhook when shipment is found', async () => {
    mocks.shipmentQuery.single.mockResolvedValueOnce({
      data: createShipment('shipment-123', 'order-123'),
      error: null,
    });

    const response = await postWebhook(
      'gigl',
      JSON.stringify({
        Waybill: 'GIGL12345',
        Status: 'Delivered',
        Location: 'Lagos Hub',
        DateTime: '2026-06-16T10:45:00.000Z',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      processed: true,
      trackingNumber: 'GIGL12345',
      status: 'delivered',
    });
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_location: 'Lagos Hub',
        delivered_at: expect.any(String),
        status: 'delivered',
      })
    );
    expect(mocks.shipmentUpdateBuilders.at(-1)?.eq).toHaveBeenCalledWith(
      'id',
      'shipment-123'
    );
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      shipping_status: 'delivered',
    });
    expect(mocks.orderUpdateBuilders.at(-1)?.eq).toHaveBeenCalledWith(
      'id',
      'order-123'
    );
    expect(notifyOrderStatusChange).toHaveBeenCalledWith(
      'user-shipment-123',
      'order-123',
      'ORD-shipment-123',
      'delivered'
    );
  });

  it('processes Topship webhook when only provider shipment ID is present', async () => {
    mocks.shipmentQuery.single.mockResolvedValueOnce({
      data: createShipment('topship-123', 'order-topship-123'),
      error: null,
    });

    const response = await postWebhook(
      'topship',
      JSON.stringify({
        shipmentId: 'TS-SHIPMENT-123',
        status: 'InTransit',
        location: 'Ikeja Hub',
        timestamp: '2026-06-16T11:00:00.000Z',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      processed: true,
      trackingNumber: '',
      status: 'in_transit',
    });
    expect(mocks.shipmentQuery.eq).toHaveBeenCalledWith('provider', 'TOPSHIP');
    expect(mocks.shipmentQuery.eq).toHaveBeenCalledWith(
      'provider_shipment_id',
      'TS-SHIPMENT-123'
    );
    expect(mocks.shipmentUpdateBuilders.at(-1)?.eq).toHaveBeenCalledWith(
      'id',
      'topship-123'
    );
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      shipping_status: 'shipped',
    });
  });

  it('returns 500 when the database client throws', async () => {
    mocks.from.mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });

    const response = await postWebhook(
      'gigl',
      JSON.stringify({ Waybill: 'GIGL12345', Status: 'Delivered' })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});
