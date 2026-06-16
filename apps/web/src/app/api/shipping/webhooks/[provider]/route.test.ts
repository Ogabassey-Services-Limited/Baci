import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  default: {
    createHmac: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-signature-hash'),
    timingSafeEqual: vi.fn().mockReturnValue(true),
  },
}));

// Mock Supabase
const mockSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        single: mockSingle,
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: mockUpdate,
      };
    }),
  })),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyOrderStatusChange: vi.fn().mockResolvedValue(undefined),
}));

import crypto from 'node:crypto';
// Need to import POST after the mocks are set up, but let's use standard import structure
import { POST } from './route';

describe('Shipping Webhooks API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Set a mock secret for GIGL
    process.env.GIGL_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockRequest(
    body: string,
    headers: Record<string, string> = {}
  ) {
    return new NextRequest('http://localhost/api/shipping/webhooks/gigl', {
      method: 'POST',
      body,
      headers: new Headers(headers),
    });
  }

  it('returns 401 when signature is invalid or missing', async () => {
    const request = createMockRequest('{"Waybill": "123"}', {});
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Invalid signature' });
  });

  it('returns 400 when JSON payload is invalid', async () => {
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(true);

    const request = createMockRequest('invalid json', {
      'x-webhook-signature': 'mock-signature-hash',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid JSON' });
  });

  it('returns received: true, parsed: false for unknown payloads', async () => {
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(true);

    const request = createMockRequest('{"unknown": "field"}', {
      'x-webhook-signature': 'mock-signature-hash',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, parsed: false });
  });

  it('processes gigl webhook properly when payload is valid and shipment is not found', async () => {
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(true);
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const validGiglPayload = JSON.stringify({
      Waybill: 'GIGL12345',
      ShipmentScanStatus: 'Delivered',
      Description: 'Package has been delivered',
      Location: 'Lagos Hub',
      ScanDate: new Date().toISOString(),
    });

    const request = createMockRequest(validGiglPayload, {
      'x-webhook-signature': 'mock-signature-hash',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      received: true,
      processed: false,
      reason: 'shipment_not_found',
    });
  });

  it('processes gigl webhook properly when payload is valid and shipment is found', async () => {
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(true);

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'shipment-123',
        order_id: 'order-123',
        status: 'pending',
        tracking_events: [],
        orders: [
          {
            order_number: 'ORD-123',
            customer_id: 'cust-123',
            customers: [{ user_id: 'user-123' }],
          },
        ],
      },
      error: null,
    });

    const validGiglPayload = JSON.stringify({
      Waybill: 'GIGL12345',
      Status: 'Delivered',
      Description: 'Package has been delivered',
      Location: 'Lagos Hub',
      DateTime: new Date().toISOString(),
    });

    const request = createMockRequest(validGiglPayload, {
      'x-webhook-signature': 'mock-signature-hash',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      received: true,
      processed: true,
      trackingNumber: 'GIGL12345',
      status: 'delivered', // mapProviderStatus normalizes 'Delivered' to 'delivered'
    });
  });
});
