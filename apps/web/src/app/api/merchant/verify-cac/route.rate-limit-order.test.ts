import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, vi } from 'vitest';
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

const merchantId = '11111111-1111-4111-8111-111111111111';

function createRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);

  return {
    method: 'POST',
    headers: new Headers(),
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

function createValidFile(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], 'cac.jpg', {
    type: 'image/jpeg',
  });
}

function createValidRequest(): NextRequest {
  return createRequest({
    merchantId,
    file: createValidFile(),
    rcNumber: 'RC123456',
    approvedName: 'Baci',
  });
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
    merchantId,
    staffAccess: { isOwner: true },
  });
  return supabase;
}

describe('POST /api/merchant/verify-cac rate-limit ordering', () => {
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
      createRequest({ merchantId, rcNumber: 'RC123456', approvedName: 'Baci' }),
    createValidRequest,
    getMerchantForApiRequest: mocks.getMerchantForApiRequest,
    post: POST,
    preflightEndpoint: 'verify-cac-preflight',
    providerEndpoint: 'verify-cac',
    providerMaxRequests: 3,
    setAuthorizedMerchantAndSupabase,
    userId: 'user-1',
    assertMalformedRequest: (request) => {
      expect(request.formData).toHaveBeenCalledOnce();
    },
    assertPreflightRequest: (request) => {
      expect(request.formData).toHaveBeenCalledOnce();
    },
  });
});
