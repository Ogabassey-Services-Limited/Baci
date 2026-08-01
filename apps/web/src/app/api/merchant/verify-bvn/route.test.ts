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

describe('POST /api/merchant/verify-bvn access and validation', () => {
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

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    expect((await POST(makeRequest(validBvnBody))).status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    expect((await POST(makeRequest(validBvnBody))).status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: validBvnBody.merchantId,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {},
        role: 'manager',
      },
    });

    const res = await POST(makeRequest(validBvnBody));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when the provider quota is exceeded after authorization', async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const req = makeRequest(validBvnBody);

    expect((await POST(req)).status).toBe(429);
    expect(req.json).toHaveBeenCalledOnce();
    expect(getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId: validBvnBody.merchantId }
    );
  });

  it('does not rate limit a malformed BVN request body', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const req = makeRequest(validBvnBody);
    req.json = vi.fn().mockRejectedValue(new Error('malformed JSON'));

    expect((await POST(req)).status).toBe(400);
    expect(req.json).toHaveBeenCalledOnce();
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns 400 when BVN validation fails (10 digits)', async () => {
    expect(
      (await POST(makeRequest({ ...validBvnBody, bvn: '1234567890' }))).status
    ).toBe(400);
  });

  it('returns 400 when dateOfBirth is not YYYY-MM-DD format', async () => {
    expect(
      (await POST(makeRequest({ ...validBvnBody, dateOfBirth: '15-01-1990' })))
        .status
    ).toBe(400);
  });

  it('returns 400 when mobileNo has no leading 0', async () => {
    expect(
      (await POST(makeRequest({ ...validBvnBody, mobileNo: '8012345678' })))
        .status
    ).toBe(400);
  });
});
