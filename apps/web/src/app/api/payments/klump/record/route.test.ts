import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/payments/klump/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  merchant_reference: 'BAC-ABCD12345678',
  klump_transaction_id: 'klump-txn-123',
  tracking_token: 'tracking-token-123',
};

describe('POST /api/payments/klump/record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.rpc.mockResolvedValue({
      data: [{ code: 'OK', transaction_id: 'transaction-123' }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it('records the Klump transaction id through the narrow RPC', async () => {
    const response = await POST(createRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      code: 'OK',
      transaction_id: 'transaction-123',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('record_klump_transaction_id', {
      p_merchant_reference: 'BAC-ABCD12345678',
      p_klump_transaction_id: 'klump-txn-123',
      p_tracking_token: 'tracking-token-123',
    });
  });

  it('returns 403 and skips the RPC when csrf validation fails', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    const response = await POST(createRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('CSRF validation failed');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid request bodies before calling the RPC', async () => {
    const response = await POST(
      createRequest({ ...validBody, merchant_reference: 'PAY-123' })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_FOUND', 404],
    ['UNAUTHORIZED', 401],
    ['REFERENCE_NOT_UNIQUE', 409],
    ['KLUMP_ID_CONFLICT', 409],
  ] as const)('maps RPC code %s to HTTP %s', async (code, status) => {
    mocks.rpc.mockResolvedValue({
      data: [{ code, transaction_id: 'transaction-123' }],
      error: null,
    });

    const response = await POST(createRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(status);
    expect(payload.code).toBe(code);
  });

  it('returns 500 when the RPC fails', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await POST(createRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.code).toBe('RPC_FAILED');
  });
});
