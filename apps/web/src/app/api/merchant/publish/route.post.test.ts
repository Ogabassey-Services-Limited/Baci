import { beforeEach, describe, expect, it, vi } from 'vitest';

const { POST } = await import('./route');

import {
  createMockSupabase,
  incompleteLaunchReadiness,
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
  readyLaunchReadiness,
  resetPublishRouteMocks,
  setupAuthenticatedRequest,
} from './route.test-support';

beforeEach(resetPublishRouteMocks);

describe('POST /api/merchant/publish', () => {
  it('authenticates before evaluating CSRF for an unauthenticated request', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('enforces a rejected cookie CSRF check after authenticating', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
    expect((await POST(makeRequest('POST'))).status).toBe(403);
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

    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: status === 404 ? 'Merchant not found' : 'Permission denied',
    });
    expect(mockLoadStoreLaunchReadiness).not.toHaveBeenCalled();
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('retains the bearer-authenticated CSRF bypass result', async () => {
    const supabase = setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockImplementation(async (request) => ({
      valid:
        request.headers.get('authorization')?.startsWith('Bearer ') === true,
      response: null,
    }));
    expect(
      (await POST(makeRequest('POST', 'Bearer mobile-token'))).status
    ).toBe(200);
    expect(mockCheckCsrfProtection).toHaveBeenCalledTimes(1);
    expect(mockLoadStoreLaunchReadiness).toHaveBeenCalledWith({
      supabase,
      merchantId: MERCHANT_ID,
    });
  });

  it.each([
    'verify_kyc',
    'bank_account',
    'payment_method',
    'store_url',
    'first_product',
    'country',
    'contact_info',
  ] as const)('blocks incomplete canonical %s', async (id) => {
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      incompleteLaunchReadiness(id)
    );
    expect((await POST(makeRequest('POST'))).status).toBe(400);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
  });

  it('uses canonical product facts for inactive-product copy', async () => {
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      incompleteLaunchReadiness('first_product', 5)
    );
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot publish store',
      message: 'Please complete the following required items:',
      missingItems: [
        'At least one active product (you have 5 product(s) but none are active - go to Products and activate them)',
      ],
    });
  });

  it('returns 500 without publishing when the readiness loader fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockRejectedValue(
      new Error('readiness unavailable')
    );
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('publishes with the canonical merchant ID and normalized slug', async () => {
    const supabase = setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      readyLaunchReadiness({ slug: 'normalized-store' })
    );
    const identity = { identifiers: ['normalized-store', 'shop.example.com'] };
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(identity);
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Store published successfully',
    });
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      'normalized-store'
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_published: true }),
      'id',
      MERCHANT_ID
    );
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('merchants');
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(identity);
  });

  it.each([
    [
      'Cloudflare cache eviction',
      () =>
        mockEvictStorefrontPublicationCaches.mockResolvedValue({
          ok: false,
          reason: 'provider_rejected',
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
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        'Store state changed, but storefront cache eviction could not be confirmed',
      code: 'STOREFRONT_CACHE_EVICTION_FAILED',
      retryable: true,
    });
  });

  it('does not mutate or evict when publication cache identity lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    mockGetStorefrontPublicationCacheIdentity.mockRejectedValue(
      new Error('alias lookup failed')
    );
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('returns the stable publish failure envelope when the update fails', async () => {
    setupAuthenticatedRequest(
      createMockSupabase({ updateError: { message: 'unavailable' } })
    );
    const response = await POST(makeRequest('POST'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to publish store',
    });
  });
});
