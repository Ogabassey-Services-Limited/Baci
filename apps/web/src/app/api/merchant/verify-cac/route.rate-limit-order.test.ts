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

  it('consumes the authenticated-user preflight quota before parsing a malformed form', async () => {
    const request = createRequest({
      merchantId,
      rcNumber: 'RC123456',
      approvedName: 'Baci',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      {},
      'user-1',
      'verify-cac-preflight',
      30,
      1
    );
    expect(request.formData).toHaveBeenCalledOnce();
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('uses only the preflight quota for an inaccessible requested merchant', async () => {
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
    expect(mocks.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      {},
      'user-1',
      'verify-cac-preflight',
      30,
      1
    );
  });

  it('rejects exhausted preflight quota before multipart parsing or merchant lookup', async () => {
    mocks.checkRateLimit.mockResolvedValue(false);
    const request = createRequest({
      merchantId,
      file: createValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci',
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(request.formData).not.toHaveBeenCalled();
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledExactlyOnceWith(
      {},
      'user-1',
      'verify-cac-preflight',
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
    mocks.checkRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await POST(
      createRequest({
        merchantId,
        file: createValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci',
      })
    );

    expect(response.status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      1,
      supabase,
      'user-1',
      'verify-cac-preflight',
      30,
      1
    );
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      supabase,
      'user-1',
      'verify-cac',
      3,
      1
    );
  });
});
