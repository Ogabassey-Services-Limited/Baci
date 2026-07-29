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
    expect((await POST(makeRequest('POST'))).status).toBe(401);
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

    expect((await POST(makeRequest('POST'))).status).toBe(status);
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
  });

  it('uses canonical product facts for inactive-product copy', async () => {
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      incompleteLaunchReadiness('first_product', 5)
    );
    const response = await POST(makeRequest('POST'));
    await expect(response.json()).resolves.toMatchObject({
      missingItems: [expect.stringContaining('you have 5 product(s)')],
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
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('publishes with the canonical merchant ID and normalized slug', async () => {
    const supabase = setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      readyLaunchReadiness({ slug: 'normalized-store' })
    );
    expect((await POST(makeRequest('POST'))).status).toBe(200);
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
  });

  it.each([
    [
      'cache eviction',
      () =>
        mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: false }),
      503,
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
  ])('preserves the publish failure response for %s failure', async (_name, arrange, status) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    arrange();
    expect((await POST(makeRequest('POST'))).status).toBe(status);
  });
});
