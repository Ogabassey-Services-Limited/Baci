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
  noMatchResponse,
  validBvnBody,
} from './route.test-helpers';

describe('POST /api/merchant/verify-bvn provider results', () => {
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
        p_merchant_id: validBvnBody.merchantId,
        p_bvn: '12345678901',
      })
    );
  });

  it('records a verified BVN for the exact merchant selected by a multi-merchant owner', async () => {
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
      json: async () => fullMatchResponse,
    } as Response);

    const res = await POST(
      makeRequest({ ...validBvnBody, merchantId: selectedMerchantId })
    );

    expect(res.status).toBe(200);
    expect(getMerchantForApiRequest).toHaveBeenCalledWith(
      supabaseMock,
      'user-1',
      { requestedMerchantId: selectedMerchantId }
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_bvn_verification',
      expect.objectContaining({ p_merchant_id: selectedMerchantId })
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

  it('reports the mobile number mismatch from Monnify field-level results', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        requestSuccessful: true,
        responseBody: {
          name: { matchStatus: 'FULL_MATCH', matchPercentage: 100 },
          dateOfBirth: 'FULL_MATCH',
          mobileNo: 'NO_MATCH',
        },
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      verified: false,
      mismatchFields: ['mobile_number'],
    });
  });

  it('accepts Monnify current-guide overall match responses', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        requestSuccessful: true,
        responseBody: { bvnInformationMatch: true },
      }),
    } as Response);

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
  });
});
