import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({ authenticateApiRequest: vi.fn() }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: vi.fn() }));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/monnify', () => ({ getMonnifyToken: vi.fn() }));

import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';
import {
  makeRequest,
  makeSupabaseMock,
  validBvnBody,
} from './route.test-helpers';

describe('POST /api/merchant/verify-bvn provider failures', () => {
  afterEach(() => vi.restoreAllMocks());

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
      merchantId: validBvnBody.merchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
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

  it('rejects undocumented Monnify success payloads instead of treating them as a mismatch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ requestSuccessful: true, responseBody: {} }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'BVN verification service returned invalid data',
    });
  });

  it('returns 500 when Monnify API fails', async () => {
    vi.mocked(getMonnifyToken).mockRejectedValueOnce(new Error('Auth failed'));

    expect((await POST(makeRequest(validBvnBody))).status).toBe(500);
  });
});
