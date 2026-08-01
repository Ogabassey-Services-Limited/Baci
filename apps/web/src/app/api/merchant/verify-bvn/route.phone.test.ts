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
  fullMatchResponse,
  makeRequest,
  makeSupabaseMock,
  validBvnBody,
} from './route.test-helpers';

describe('POST /api/merchant/verify-bvn country and phone resolution', () => {
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

  it('rejects India merchants before consuming provider quota or making provider calls', async () => {
    const supabaseMock = makeSupabaseMock(null, '08012345678', 'IN');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'BVN verification is only available for Nigerian merchants',
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(getMonnifyToken).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
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
        merchantId: validBvnBody.merchantId,
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

  it('uses the supplied mobileNo when it differs from the merchant profile phone', async () => {
    const supabaseMock = makeSupabaseMock(null, '08099999999');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fullMatchResponse,
    } as Response);

    expect((await POST(makeRequest(validBvnBody))).status).toBe(200);
    expect(supabaseMock.merchantMaybeSingle).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/vas/bvn-details-match'),
      expect.objectContaining({
        body: expect.stringContaining('08012345678'),
      })
    );
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
        merchantId: validBvnBody.merchantId,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Add a valid store phone number before verifying BVN',
    });
  });
});
