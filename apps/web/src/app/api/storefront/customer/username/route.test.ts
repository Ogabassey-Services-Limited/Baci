import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateApiRequest = vi.fn();
const rpc = vi.fn();
const checkCsrfProtection = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (req: unknown) => authenticateApiRequest(req),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (req: unknown) => checkCsrfProtection(req),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from './route';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

function request(body: unknown) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/username',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/storefront/customer/username', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: { rpc },
    });
    checkCsrfProtection.mockResolvedValue({ valid: true });
    rpc.mockResolvedValue({ data: 'OgaFan_7', error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    authenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'oga_fan' })
    );
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a not_authenticated RPC error to 401', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'not_authenticated' },
    });
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'oga_fan' })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 403 when CSRF validation fails', async () => {
    checkCsrfProtection.mockResolvedValue({ valid: false });
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'oga_fan' })
    );
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid input', async () => {
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: '_bad' })
    );
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 409 when the username is taken', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'username_taken' } });
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'oga_fan' })
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('returns 500 on an unmapped RPC error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'deadlock_detected' },
    });
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'oga_fan' })
    );
    expect(res.status).toBe(500);
  });

  it('returns 200 with the stored username on success', async () => {
    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'OgaFan_7' })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: 'OgaFan_7' });
    expect(rpc).toHaveBeenCalledWith('set_customer_username', {
      p_merchant_id: MERCHANT_ID,
      p_username: 'OgaFan_7',
    });
  });
});
