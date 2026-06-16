import crypto from 'node:crypto';
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

// Create a builder object that acts as a Thenable
// This prevents await from returning the builder itself
const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  // biome-ignore lint/suspicious/noThenProperty: intentionally implementing Thenable for mocked fluent interface
  then: (resolve: (value: { data: null; error: null }) => void) =>
    resolve({ data: null, error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => mockBuilder),
  })),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyOrderStatusChange: vi.fn().mockResolvedValue(undefined),
}));

// Need to import POST after the mocks are set up, but let's use standard import structure
import { POST } from './route';

describe('Shipping Webhooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GIGL_WEBHOOK_SECRET', 'test-secret');
    vi.stubEnv('TOPSHIP_WEBHOOK_SECRET', 'test-secret-topship');
    // We need to set timingSafeEqual to true by default for tests that assume valid signatures
    vi.mocked(crypto.timingSafeEqual).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createMockRequest(
    provider: string,
    body: string,
    headers: Record<string, string> = {}
  ) {
    return new NextRequest(
      `http://localhost/api/shipping/webhooks/${provider}`,
      {
        method: 'POST',
        body,
        headers: new Headers(headers),
      }
    );
  }

  it('returns 401 when signature is missing', async () => {
    const request = createMockRequest('gigl', '{"Waybill": "123"}', {});
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Invalid signature' });
  });

  it('returns 401 when signature is invalid', async () => {
    // Force timingSafeEqual to return false for this specific test
    vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(false);

    const request = createMockRequest('gigl', '{"Waybill": "123"}', {
      // Must match length of "mock-signature-hash" (19 chars) so length check passes
      'x-webhook-signature': '1234567890123456789',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Invalid signature' });
  });

  it('returns 400 when JSON payload is invalid', async () => {
    const request = createMockRequest('gigl', 'invalid json', {
      // Must match length of "mock-signature-hash"
      'x-webhook-signature': '1234567890123456789',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'Invalid JSON' });
  });

  it('returns received: true, parsed: false for unknown payloads', async () => {
    const request = createMockRequest('gigl', '{"unknown": "field"}', {
      // Must match length of "mock-signature-hash"
      'x-webhook-signature': '1234567890123456789',
    });
    const params = Promise.resolve({ provider: 'gigl' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, parsed: false });
  });

  it('processes gigl webhook properly when payload is valid and shipment is not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const validGiglPayload = JSON.stringify({
      Waybill: 'GIGL12345',
      ShipmentScanStatus: 'Delivered',
      Description: 'Package has been delivered',
      Location: 'Lagos Hub',
      ScanDate: new Date().toISOString(),
    });

    const request = createMockRequest('gigl', validGiglPayload, {
      // Must match length of "mock-signature-hash"
      'x-webhook-signature': '1234567890123456789',
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

    const request = createMockRequest('gigl', validGiglPayload, {
      // Must match length of "mock-signature-hash"
      'x-webhook-signature': '1234567890123456789',
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

  it('processes topship webhook properly when payload is valid and shipment is found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'shipment-top-1',
        order_id: 'order-top-1',
        status: 'pending',
        tracking_events: [],
        orders: [
          {
            order_number: 'ORD-TOP-1',
            customer_id: 'cust-top-1',
            customers: [{ user_id: 'user-top-1' }],
          },
        ],
      },
      error: null,
    });

    const validTopshipPayload = JSON.stringify({
      shipmentId: 'TS123456',
      status: 'InTransit',
      description: 'Package has left the facility',
      location: 'Abuja Hub',
      timestamp: new Date().toISOString(),
    });

    const request = createMockRequest('topship', validTopshipPayload, {
      // Must match length of "mock-signature-hash"
      'x-webhook-signature': '1234567890123456789',
    });
    const params = Promise.resolve({ provider: 'topship' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      received: true,
      processed: true,
      trackingNumber: '',
      status: 'in_transit',
    });
  });
});
