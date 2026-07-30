import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn(),
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

const validNinBody = {
  nin: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  merchantId: '11111111-1111-4111-8111-111111111111',
};

function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

function makeSupabaseMock(rpcError: unknown = null, country = 'NG') {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: { country },
    error: null,
  });

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: merchantMaybeSingle,
        })),
      })),
    })),
    merchantMaybeSingle,
    rpc: makeRpcMock(rpcError),
  };
}

function makeRequest(body: unknown): NextRequest {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    nextUrl: new URL('http://localhost/api/merchant/verify-nin'),
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

function makeNinResponse(firstName: string, lastName: string) {
  return {
    requestSuccessful: true,
    responseBody: {
      nin: '12345678901',
      firstName,
      lastName,
      middleName: '',
      dateOfBirth: '1990-01-15',
      gender: 'M',
      mobileNumber: '08012345678',
    },
  };
}

describe('POST /api/merchant/verify-nin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(getMonnifyToken).mockResolvedValue('mock-token');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: makeSupabaseMock(),
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: validNinBody.merchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: validNinBody.merchantId,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {},
        role: 'manager',
      },
    });

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'verify-nin',
      3,
      1
    );
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const req = makeRequest(validNinBody);
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(req.json).not.toHaveBeenCalled();
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rate limits before parsing a malformed NIN request body', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const req = makeRequest(validNinBody);
    req.json = vi.fn().mockRejectedValue(new Error('malformed JSON'));

    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(req.json).not.toHaveBeenCalled();
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects India merchants before provider calls after the authenticated-user rate limit', async () => {
    const supabaseMock = makeSupabaseMock(null, 'IN');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'NIN verification is only available for Nigerian merchants',
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      supabaseMock,
      'user-1',
      'verify-nin',
      3,
      1
    );
    expect(getMonnifyToken).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 when NIN validation fails (10 digits)', async () => {
    const res = await POST(makeRequest({ ...validNinBody, nin: '1234567890' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when dateOfBirth is not YYYY-MM-DD format', async () => {
    const res = await POST(
      makeRequest({ ...validNinBody, dateOfBirth: '15-01-1990' })
    );

    expect(res.status).toBe(400);
  });

  it('returns 200 with verified: true when names match', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => makeNinResponse('John', 'Doe'),
    } as Response);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_nin_verification',
      expect.objectContaining({
        p_merchant_id: validNinBody.merchantId,
        p_nin: '12345678901',
      })
    );
  });

  it('records a verified NIN for the exact merchant selected by a multi-merchant owner', async () => {
    const supabaseMock = makeSupabaseMock();
    const selectedMerchantId = '22222222-2222-4222-8222-222222222222';
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: selectedMerchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => makeNinResponse('John', 'Doe'),
    } as Response);

    const res = await POST(
      makeRequest({ ...validNinBody, merchantId: selectedMerchantId })
    );

    expect(res.status).toBe(200);
    expect(getMerchantForApiRequest).toHaveBeenCalledWith(
      supabaseMock,
      'user-1',
      { requestedMerchantId: selectedMerchantId }
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_nin_verification',
      expect.objectContaining({ p_merchant_id: selectedMerchantId })
    );
  });

  it('returns 200 with verified: false when names do not match', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => makeNinResponse('Jane', 'Smith'),
    } as Response);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: false });
  });

  it('returns 500 when Monnify API fails', async () => {
    vi.mocked(getMonnifyToken).mockRejectedValueOnce(new Error('Auth failed'));

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(500);
  });
});
