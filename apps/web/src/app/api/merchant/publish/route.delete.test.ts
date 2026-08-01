import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockSupabase,
  MERCHANT_ID,
  makeRequest,
  mockAuthenticateApiRequest,
  mockCheckCsrfProtection,
  mockEvictStorefrontPublicationCaches,
  mockGetMerchantForApiRequest,
  mockGetStorefrontPublicationCacheIdentity,
  mockHasPermission,
  mockLoadStoreLaunchReadiness,
  mockMerchantUpdate,
  resetPublishRouteMocks,
  setupAuthenticatedRequest,
} from './route.test-support';

const { DELETE } = await import('./route');

beforeEach(resetPublishRouteMocks);

describe('DELETE /api/merchant/publish', () => {
  it('authenticates before evaluating CSRF for an unauthenticated request', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('enforces a rejected cookie CSRF check after authenticating', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    expect((await DELETE(makeRequest('DELETE'))).status).toBe(403);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['requested merchant access is missing', null, 404],
    [
      'settings permission is denied',
      {
        merchantId: MERCHANT_ID,
        staffAccess: {
          isOwner: true,
          isStaff: false,
          permissions: { full_access: { all: true } },
          role: 'owner',
        },
      },
      403,
    ],
  ] as const)('stops before publication effects when %s', async (_name, merchantContext, status) => {
    setupAuthenticatedRequest();
    mockGetMerchantForApiRequest.mockResolvedValue(merchantContext);
    if (status === 403) mockHasPermission.mockReturnValue(false);

    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: status === 404 ? 'Merchant not found' : 'Permission denied',
    });
    expect(mockLoadStoreLaunchReadiness).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('rejects an unpublish request without a valid merchant ID before resolving access', async () => {
    setupAuthenticatedRequest();

    const response = await DELETE(makeRequest('DELETE', undefined, null));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
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
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(200);
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
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Store unpublished successfully',
    });
  });

  it('unpublishes only the merchant explicitly selected by the request', async () => {
    const supabase = setupAuthenticatedRequest();
    const requestedMerchantId = '33333333-3333-4333-8333-333333333333';
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: requestedMerchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: 'owner',
      },
    });

    const response = await DELETE(
      makeRequest('DELETE', undefined, { merchantId: requestedMerchantId })
    );

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      supabase,
      'user-123',
      { requestedMerchantId }
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith(
      { is_published: false },
      'id',
      requestedMerchantId
    );
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      requestedMerchantId,
      'test-store'
    );
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
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(identity);
  });

  it.each([
    [
      'Cloudflare cache eviction',
      () =>
        mockEvictStorefrontPublicationCaches.mockResolvedValue({
          ok: false,
          reason: 'request_failed',
          stage: 'cloudflare',
        }),
    ],
    [
      'Vercel cache eviction',
      () =>
        mockEvictStorefrontPublicationCaches.mockResolvedValue({
          ok: false,
          reason: 'request_failed',
          stage: 'vercel',
        }),
    ],
  ])('returns the cache-eviction failure code after %s', async (_name, arrange) => {
    setupAuthenticatedRequest();
    arrange();
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        'Store state changed, but storefront cache eviction could not be confirmed',
      code: 'STOREFRONT_CACHE_EVICTION_FAILED',
      retryable: true,
    });
  });

  it('returns the stable merchant lookup failure envelope without mutation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest(
      createMockSupabase({ merchantError: { message: 'unavailable' } })
    );
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load merchant',
    });
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('does not mutate or evict when unpublish cache identity lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    mockGetStorefrontPublicationCacheIdentity.mockRejectedValue(
      new Error('alias lookup failed')
    );
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('returns the stable unpublish failure envelope when the update fails', async () => {
    setupAuthenticatedRequest(
      createMockSupabase({ updateError: { message: 'unavailable' } })
    );
    const response = await DELETE(makeRequest('DELETE'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to unpublish store',
    });
  });
});
