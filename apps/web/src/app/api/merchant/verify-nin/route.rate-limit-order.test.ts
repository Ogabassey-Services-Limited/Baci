import type { NextRequest } from 'next/server';
import { beforeEach, describe, vi } from 'vitest';
import { defineVerificationRateLimitOrderTests } from '@/test-support/verification-rate-limit-order.test-support';

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
  nin: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
};

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/merchant/verify-nin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as NextRequest;
}

function setAuthorizedMerchantAndSupabase() {
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { country: 'NG' },
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
  return supabase;
}

describe('POST /api/merchant/verify-nin rate-limit ordering', () => {
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

  defineVerificationRateLimitOrderTests({
    checkRateLimit: mocks.checkRateLimit,
    createMalformedRequest: () => createRequest({ ...validBody, nin: '123' }),
    createValidRequest: () => createRequest(validBody),
    getMerchantForApiRequest: mocks.getMerchantForApiRequest,
    post: POST,
    preflightEndpoint: 'verify-nin-preflight',
    providerEndpoint: 'verify-nin',
    providerMaxRequests: 3,
    setAuthorizedMerchantAndSupabase,
    userId: 'user-1',
  });
});
