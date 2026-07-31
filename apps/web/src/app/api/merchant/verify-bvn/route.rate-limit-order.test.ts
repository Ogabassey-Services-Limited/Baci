import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  checkRateLimit: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from './route';

const validBody = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  bvn: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  mobileNo: '08012345678',
};

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/merchant/verify-bvn', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as NextRequest;
}

describe('POST /api/merchant/verify-bvn rate-limit ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: {},
    });
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.checkRateLimit.mockResolvedValue(true);
  });

  it('does not consume quota for a malformed request', async () => {
    const response = await POST(createRequest({ ...validBody, bvn: '123' }));

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('uses only the preflight quota for an inaccessible requested merchant', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(404);
    expect(mocks.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      {},
      'user-1',
      'verify-bvn-preflight',
      30,
      1
    );
  });

  it('skips merchant lookup when the preflight quota is exhausted', async () => {
    mocks.checkRateLimit.mockResolvedValue(false);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(429);
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      {},
      'user-1',
      'verify-bvn-preflight',
      30,
      1
    );
  });

  it('checks the provider quota after authorized merchant access', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { country: 'NG', phone: validBody.mobileNo },
              error: null,
            }),
          })),
        })),
      })),
    };
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase,
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: validBody.merchantId,
      staffAccess: { isOwner: true },
    });
    mocks.checkRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      1,
      supabase,
      'user-1',
      'verify-bvn-preflight',
      30,
      1
    );
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      supabase,
      'user-1',
      'verify-bvn',
      3,
      1
    );
  });
});
