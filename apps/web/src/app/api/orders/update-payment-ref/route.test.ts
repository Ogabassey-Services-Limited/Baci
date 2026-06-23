import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockRpc = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { POST } from './route';

const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000001';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/orders/update-payment-ref',
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

describe('POST /api/orders/update-payment-ref', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mockCreateClient.mockReturnValue({ rpc: mockRpc });
  });

  it('updates the payment reference through the scoped RPC', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    const response = await POST(
      makeRequest({
        gateway: 'credit_direct',
        orderId: VALID_ORDER_ID,
        paymentRef: 'CD-122',
        tracking_token: 'track_123',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('set_order_payment_ref', {
      p_gateway: 'credit_direct',
      p_order_id: VALID_ORDER_ID,
      p_payment_ref: 'CD-122',
      p_tracking_token: 'track_123',
    });
  });

  it('returns 400 and skips the RPC for invalid request data', async () => {
    const response = await POST(
      makeRequest({
        gateway: 'credit_direct',
        orderId: 'not-a-uuid',
        paymentRef: '',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request data');
    expect(body.details).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 403 and logs a warning when the RPC rejects an unauthorized update', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'unauthorized' },
    });

    const response = await POST(
      makeRequest({
        gateway: 'credit_direct',
        orderId: VALID_ORDER_ID,
        paymentRef: 'CD-123',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(warnSpy).toHaveBeenCalledWith('Rejected order payment ref update:', {
      code: 'P0001',
      message: 'unauthorized',
      status: 403,
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs unexpected RPC failures as errors and masks the client response', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rpcError = { code: 'XX000', message: 'database unavailable' };
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    const response = await POST(
      makeRequest({
        orderId: VALID_ORDER_ID,
        paymentRef: 'CD-124',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update order' });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to update order payment ref:',
      rpcError
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
