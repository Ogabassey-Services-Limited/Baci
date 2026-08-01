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
  taxIdentificationNumber: '2522599781276',
};

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/merchant/verify-tax-id', {
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
          single: vi.fn().mockResolvedValue({
            data: {
              business_name: 'Baci',
              cac_rc_number: 'RC123456',
              country: 'NG',
              id: validBody.merchantId,
              legal_entity_name: 'Baci Limited',
            },
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

describe('POST /api/merchant/verify-tax-id rate-limit ordering', () => {
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
    createMalformedRequest: () =>
      createRequest({ ...validBody, taxIdentificationNumber: '123' }),
    createValidRequest: () => createRequest(validBody),
    getMerchantForApiRequest: mocks.getMerchantForApiRequest,
    post: POST,
    preflightEndpoint: 'verify-tax-id-preflight',
    providerEndpoint: 'verify-tax-id',
    providerMaxRequests: 10,
    setAuthorizedMerchantAndSupabase,
    userId: 'user-1',
  });
});
