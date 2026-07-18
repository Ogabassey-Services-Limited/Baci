import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { POST } from './route';

const ORDER_ID = '00000000-0000-4000-8000-000000000001';

function request(body: unknown) {
  return new NextRequest(
    'http://localhost:3000/api/orders/credit-direct/client-completion',
    {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );
}

describe('POST /api/orders/credit-direct/client-completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({
      data: { status: 'pending_confirmation' },
      error: null,
    });
  });

  it('records untrusted SDK evidence through the scoped RPC', async () => {
    const response = await POST(
      request({
        checkoutTransactionId: 'cd-transaction-1',
        orderId: ORDER_ID,
        tracking_token: 'track-1',
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      status: 'pending_confirmation',
      success: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_credit_direct_client_completion',
      {
        p_checkout_transaction_id: 'cd-transaction-1',
        p_order_id: ORDER_ID,
        p_session_id: null,
        p_tracking_token: 'track-1',
      }
    );
  });

  it('keeps session-only SDK evidence separate from transaction ids', async () => {
    const response = await POST(
      request({ orderId: ORDER_ID, sessionId: 'session-1' })
    );

    expect(response.status).toBe(202);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_credit_direct_client_completion',
      {
        p_checkout_transaction_id: null,
        p_order_id: ORDER_ID,
        p_session_id: 'session-1',
        p_tracking_token: null,
      }
    );
  });

  it('returns 400 without touching the database for malformed evidence', async () => {
    const response = await POST(
      request({ checkoutTransactionId: '', orderId: 'not-a-uuid' })
    );

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['unauthorized', 403, 'Unauthorized'],
    ['order_not_found', 404, 'Order not found'],
    ['reference_mismatch', 409, 'Payment reference does not match'],
    ['order_not_payable', 409, 'Order is not payable'],
  ])('maps %s safely', async (message, status, clientMessage) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message },
    });

    const response = await POST(
      request({
        checkoutTransactionId: 'cd-transaction-1',
        orderId: ORDER_ID,
      })
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: clientMessage });
  });

  it('masks unexpected database failures', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'database secret' },
    });

    const response = await POST(
      request({
        checkoutTransactionId: 'cd-transaction-1',
        orderId: ORDER_ID,
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to record payment confirmation',
    });
  });
});
