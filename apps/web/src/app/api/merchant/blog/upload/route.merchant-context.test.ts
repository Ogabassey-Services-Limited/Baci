import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockGetMerchantForApiRequest,
  mockGetUserAccess,
  mockHasPermission,
  mockToUserAccess,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockCheckCsrfProtection: vi.fn(),
  mockGetMerchantForApiRequest: vi.fn(),
  mockGetUserAccess: vi.fn(),
  mockHasPermission: vi.fn(),
  mockToUserAccess: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn(() => true) }));

const { POST } = await import('./route');

function requestWithMerchantContext(merchantId: string): NextRequest {
  const formData = new FormData();
  formData.append(
    'file',
    new File(['image'], 'inline.png', { type: 'image/png' })
  );
  return {
    headers: new Headers({ 'x-baci-merchant-id': merchantId }),
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

describe('blog upload requested merchant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'implicit-merchant' });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: '123e4567-e89b-42d3-a456-426614174099',
      staffAccess: {},
    });
    mockToUserAccess.mockReturnValue({
      merchantId: '123e4567-e89b-42d3-a456-426614174099',
      isOwner: true,
      isStaff: false,
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    const upload = vi.fn().mockResolvedValue({ error: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { storage: { from: () => ({ upload }) } },
      user: { id: 'user-1' },
    });
  });

  it('uploads under the authorized selected merchant rather than the implicit merchant', async () => {
    const merchantId = '123e4567-e89b-42d3-a456-426614174099';

    const response = await POST(requestWithMerchantContext(merchantId));
    const body = await response.json();

    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId: merchantId }
    );
    expect(body.path).toContain(`${merchantId}/blog/`);
    expect(body.path).not.toContain('implicit-merchant');
  });
});
