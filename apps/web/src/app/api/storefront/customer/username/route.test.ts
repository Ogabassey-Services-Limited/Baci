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
    rpc.mockResolvedValue({
      data: {
        nextEligibleAt: '2026-09-03T12:00:00.000Z',
        username: 'OgaFan_7',
        usernameChangedAt: '2026-08-04T12:00:00.000Z',
      },
      error: null,
    });
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

  it('returns a machine-readable next eligible date during cooldown', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        details: '2026-09-03T12:00:00.000Z',
        message: 'username_change_cooldown',
      },
    });

    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'new_name' })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: 'USERNAME_CHANGE_COOLDOWN',
      error: 'You can change your username once every 30 days.',
      nextEligibleAt: '2026-09-03T12:00:00.000Z',
    });
  });

  it('canonicalizes valid RPC timestamps before returning them', async () => {
    rpc.mockResolvedValue({
      data: {
        nextEligibleAt: '2026-09-03T13:00:00+01:00',
        username: 'OgaFan_7',
        usernameChangedAt: '2026-08-04T13:00:00+01:00',
      },
      error: null,
    });

    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'OgaFan_7' })
    );

    expect(await res.json()).toEqual({
      nextEligibleAt: '2026-09-03T12:00:00.000Z',
      username: 'OgaFan_7',
      usernameChangedAt: '2026-08-04T12:00:00.000Z',
    });
  });

  it('blocks a rename while an attempt is active', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'username_change_active_attempt' },
    });

    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'new_name' })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'USERNAME_CHANGE_ACTIVE_ATTEMPT',
    });
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
    expect(await res.json()).toEqual({
      nextEligibleAt: '2026-09-03T12:00:00.000Z',
      username: 'OgaFan_7',
      usernameChangedAt: '2026-08-04T12:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('set_customer_username_v2', {
      p_merchant_id: MERCHANT_ID,
      p_username: 'OgaFan_7',
    });
  });

  it('fails closed on an invalid success projection', async () => {
    rpc.mockResolvedValue({ data: 'legacy-shape', error: null });

    const res = await POST(
      request({ merchantId: MERCHANT_ID, username: 'OgaFan_7' })
    );

    expect(res.status).toBe(500);
  });
});
