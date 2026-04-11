import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
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

import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

const mockOwnerAccess = {
  merchantId: 'merchant-1',
  role: 'owner',
  isOwner: true,
  isStaff: false,
  permissions: {},
};

const mockStaffAccess = {
  ...mockOwnerAccess,
  role: 'staff',
  isOwner: false,
  isStaff: true,
};

const validBvnBody = {
  bvn: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  mobileNo: '08012345678',
};

function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

function makeSupabaseMock(
  rpcError: unknown = null,
  merchantPhone: string | null = '08012345678'
) {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: merchantPhone ? { phone: merchantPhone } : null,
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
    nextUrl: new URL('http://localhost/api/merchant/verify-bvn'),
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

const fullMatchResponse = {
  requestSuccessful: true,
  responseBody: {
    matchStatus: 'FULL_MATCH',
    individualDetails: {
      firstName: 'John',
      lastName: 'Doe',
      middleName: '',
      dateOfBirth: '1990-01-15',
      mobileNo: '08012345678',
    },
  },
};

const noMatchResponse = {
  requestSuccessful: true,
  responseBody: {
    matchStatus: 'NO_MATCH',
    individualDetails: {
      firstName: 'Jane',
      lastName: 'Smith',
      middleName: '',
      dateOfBirth: '1985-06-20',
      mobileNo: '08099999999',
    },
  },
};

describe('POST /api/merchant/verify-bvn', () => {
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
    vi.mocked(getUserAccess).mockResolvedValue(mockOwnerAccess);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getUserAccess).mockResolvedValue(mockStaffAccess);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(429);
  });

  it('returns 400 when BVN validation fails (10 digits)', async () => {
    const res = await POST(makeRequest({ ...validBvnBody, bvn: '1234567890' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when dateOfBirth is not YYYY-MM-DD format', async () => {
    const res = await POST(
      makeRequest({ ...validBvnBody, dateOfBirth: '15-01-1990' })
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 when mobileNo has no leading 0', async () => {
    const res = await POST(
      makeRequest({ ...validBvnBody, mobileNo: '8012345678' })
    );

    expect(res.status).toBe(400);
  });

  it('uses the merchant phone number when mobileNo is omitted', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fullMatchResponse,
    } as Response);

    const res = await POST(
      makeRequest({
        bvn: validBvnBody.bvn,
        firstName: validBvnBody.firstName,
        lastName: validBvnBody.lastName,
        dateOfBirth: validBvnBody.dateOfBirth,
      })
    );

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/vas/bvn-details-match'),
      expect.objectContaining({
        body: JSON.stringify({
          bvn: validBvnBody.bvn,
          name: `${validBvnBody.firstName} ${validBvnBody.lastName}`,
          dateOfBirth: '15-Jan-1990',
          mobileNo: validBvnBody.mobileNo,
        }),
      })
    );
    expect(supabaseMock.merchantMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('does not query the merchant phone when mobileNo is provided', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fullMatchResponse,
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(200);
    expect(supabaseMock.merchantMaybeSingle).not.toHaveBeenCalled();
  });

  it('returns 400 with Monnify validation message when the upstream request is rejected', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        requestSuccessful: false,
        responseMessage:
          'Invalid date format supplied. Accepted date format - dd-MMM-yyyy',
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid date format supplied. Accepted date format - dd-MMM-yyyy',
    });
  });

  it('returns 503 when Monnify marks the account as restricted', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        requestSuccessful: false,
        responseMessage: 'Restricted account',
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error:
        'BVN verification is temporarily unavailable because the Monnify account is restricted.',
      code: 'bvn_verification_provider_restricted',
    });
  });

  it('returns 502 when Monnify rejects provider authentication', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        requestSuccessful: false,
        responseMessage: 'Unauthorized',
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'BVN verification provider authentication failed.',
      code: 'bvn_verification_provider_auth_failed',
    });
  });

  it('returns 503 when Monnify rate limits the request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        requestSuccessful: false,
        responseMessage: 'Too many requests',
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: 'BVN verification is temporarily unavailable.',
      code: 'bvn_verification_provider_rate_limited',
    });
  });

  it('returns 400 when neither request nor merchant profile has a phone number', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: makeSupabaseMock(null, null),
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const res = await POST(
      makeRequest({
        bvn: validBvnBody.bvn,
        firstName: validBvnBody.firstName,
        lastName: validBvnBody.lastName,
        dateOfBirth: validBvnBody.dateOfBirth,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Add a valid store phone number before verifying BVN',
    });
  });

  it('returns 503 when Monnify credentials are not configured', async () => {
    vi.mocked(getMonnifyToken).mockRejectedValueOnce(
      new Error('Monnify credentials not configured')
    );

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error:
        'BVN verification is not configured on this environment yet. Add Monnify credentials to continue.',
      code: 'bvn_verification_unconfigured',
    });
  });

  it('returns 200 with verified: true when Monnify returns FULL_MATCH', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fullMatchResponse,
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_bvn_verification',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_bvn: '12345678901',
      })
    );
  });

  it('returns 200 with verified: false when Monnify returns NO_MATCH', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => noMatchResponse,
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: false });
  });

  it('returns 500 when Monnify API fails', async () => {
    vi.mocked(getMonnifyToken).mockRejectedValueOnce(new Error('Auth failed'));

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(500);
  });
});
