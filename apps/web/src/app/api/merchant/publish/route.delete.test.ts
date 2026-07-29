import { beforeEach, describe, expect, it, vi } from 'vitest';

const { DELETE } = await import('./route');

import {
  createMockSupabase,
  MERCHANT_ID,
  makeRequest,
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockEvictStorefrontPublicationCaches,
  mockGetStorefrontPublicationCacheIdentity,
  mockGetUserAccess,
  mockHasPermission,
  mockLoadStoreLaunchReadiness,
  mockMerchantUpdate,
  resetPublishRouteMocks,
  setupAuthenticatedRequest,
} from './route.test-support';

beforeEach(resetPublishRouteMocks);

describe('DELETE /api/merchant/publish', () => {
  it('authenticates before evaluating CSRF for an unauthenticated request', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('enforces a rejected cookie CSRF check after authenticating', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(403);
    expect(mockGetUserAccess).not.toHaveBeenCalled();
  });

  it.each([
    ['access is missing', null, 404],
    [
      'settings permission is denied',
      { merchantId: MERCHANT_ID, role: 'owner' },
      403,
    ],
  ] as const)('stops before publication effects when %s', async (_name, access, status) => {
    setupAuthenticatedRequest();
    mockGetUserAccess.mockResolvedValue(access);
    if (status === 403) mockHasPermission.mockReturnValue(false);

    expect((await DELETE(makeRequest('DELETE'))).status).toBe(status);
    expect(mockLoadStoreLaunchReadiness).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('retains the bearer-authenticated CSRF bypass result', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockImplementation(async (request) => ({
      valid:
        request.headers.get('authorization')?.startsWith('Bearer ') === true,
      response: null,
    }));
    expect(
      (await DELETE(makeRequest('DELETE', 'Bearer mobile-token'))).status
    ).toBe(200);
  });

  it('unpublishes with the canonical merchant ID and every resolved identity', async () => {
    const supabase = setupAuthenticatedRequest();
    const identity = { identifiers: ['test-store', 'shop.example.com'] };
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(identity);
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(200);
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      'test-store'
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith(
      { is_published: false },
      'id',
      MERCHANT_ID
    );
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(identity);
  });

  it('unpublishes a null-slug merchant with resolved custom domains', async () => {
    const supabase = setupAuthenticatedRequest(
      createMockSupabase({ merchant: { id: MERCHANT_ID, slug: null } })
    );
    const identity = { identifiers: ['retired-store', 'shop.example.com'] };
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(identity);
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(200);
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      null
    );
  });

  it.each([
    [
      'cache eviction',
      () =>
        mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: false }),
      503,
    ],
    [
      'merchant lookup',
      () =>
        setupAuthenticatedRequest(
          createMockSupabase({ merchantError: { message: 'unavailable' } })
        ),
      500,
    ],
    [
      'cache identity lookup',
      () =>
        mockGetStorefrontPublicationCacheIdentity.mockRejectedValue(
          new Error('alias lookup failed')
        ),
      500,
    ],
    [
      'merchant update',
      () =>
        setupAuthenticatedRequest(
          createMockSupabase({ updateError: { message: 'unavailable' } })
        ),
      500,
    ],
  ])('preserves the unpublish failure response for %s failure', async (_name, arrange, status) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    arrange();
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(status);
  });
});
