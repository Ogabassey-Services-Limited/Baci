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

  it('does not consume quota for a malformed form', async () => {
    const response = await POST(
      createRequest({ merchantId, rcNumber: 'RC123456', approvedName: 'Baci' })
    );

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('does not consume quota for an inaccessible requested merchant', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        merchantId,
        file: createValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci',
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });
});
