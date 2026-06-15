import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockSendOrderCancellationEmail = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/order-cancellation-email', () => ({
  sendOrderCancellationEmail: (...args: unknown[]) =>
    mockSendOrderCancellationEmail(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from './route';

const ORDER_ID = '00000000-0000-4000-8000-000000000abc';

function makeRequest(body?: unknown) {
  return new NextRequest(
    `http://localhost:3000/api/storefront/account/orders/${ORDER_ID}/cancel`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
}

const params = Promise.resolve({ id: ORDER_ID });

function authOk() {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
    supabase: { rpc: mockRpc },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
  mockSendOrderCancellationEmail.mockResolvedValue({ success: true });
});

describe('POST /api/storefront/account/orders/[id]/cancel', () => {
  it('returns 401 when the request is not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('checks auth before CSRF', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    await POST(makeRequest({}), { params });

    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    authOk();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });

    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid reason', async () => {
    authOk();

    const res = await POST(makeRequest({ reason: 123 }), { params });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 404 when the order is not found / not owned', async () => {
    authOk();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'order_not_found', code: 'P0002' },
    });

    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(404);
    expect(mockSendOrderCancellationEmail).not.toHaveBeenCalled();
  });

  it('returns 409 when the order is not cancellable', async () => {
    authOk();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'order_not_cancellable', code: 'P0001' },
    });

    const res = await POST(makeRequest({ reason: 'Changed my mind' }), {
      params,
    });

    expect(res.status).toBe(409);
    expect(mockSendOrderCancellationEmail).not.toHaveBeenCalled();
  });

  it('cancels and sends the cancellation email on success', async () => {
    authOk();
    mockRpc.mockResolvedValue({ data: true, error: null });

    const res = await POST(makeRequest({ reason: 'Ordered by mistake' }), {
      params,
    });

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('cancel_order_as_customer', {
      p_order_id: ORDER_ID,
      p_reason: 'Ordered by mistake',
    });
    expect(mockSendOrderCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        cancelledBy: 'customer',
        reason: 'Ordered by mistake',
      })
    );
  });

  it('does not send an email when the order was already cancelled (no-op)', async () => {
    authOk();
    mockRpc.mockResolvedValue({ data: false, error: null });

    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(200);
    expect(mockSendOrderCancellationEmail).not.toHaveBeenCalled();
  });

  it('still returns 200 when the cancellation email fails (best-effort)', async () => {
    authOk();
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockSendOrderCancellationEmail.mockResolvedValue({
      success: false,
      error: 'zeptomail down',
    });

    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(200);
  });
});
