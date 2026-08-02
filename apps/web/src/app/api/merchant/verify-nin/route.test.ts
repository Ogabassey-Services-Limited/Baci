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
import {
  makeRequest,
  makeSupabaseMock,
  validNinBody,
} from './route.test-helpers';

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
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when the provider quota is exceeded after authorization', async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const req = makeRequest(validNinBody);
    const json = vi.spyOn(req, 'json');
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(json).toHaveBeenCalledOnce();
    expect(getMerchantForApiRequest).toHaveBeenCalledOnce();
    expect(
      vi.mocked(getMerchantForApiRequest).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(checkRateLimit).mock.invocationCallOrder[1]);
  });

  it('does not consume quota for a malformed NIN request body', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const req = makeRequest(validNinBody);
    const json = vi
      .spyOn(req, 'json')
      .mockRejectedValue(new Error('malformed JSON'));

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(json).toHaveBeenCalledOnce();
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('rejects India merchants before consuming provider quota or making provider calls', async () => {
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
    expect(checkRateLimit).not.toHaveBeenCalled();
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
});
