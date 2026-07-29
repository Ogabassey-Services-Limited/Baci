import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreLaunchReadiness } from '@/lib/store-readiness/build-store-launch-readiness';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockLoadStoreLaunchReadiness = vi.fn();
const mockGetStorefrontPublicationCacheIdentity = vi.fn();
const mockEvictStorefrontPublicationCaches = vi.fn();
const mockMerchantUpdate = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/store-readiness/load-store-launch-readiness', () => ({
  loadStoreLaunchReadiness: (...args: unknown[]) =>
    mockLoadStoreLaunchReadiness(...args),
}));

vi.mock('@/lib/get-storefront-publication-cache-identity', () => ({
  getStorefrontPublicationCacheIdentity: (...args: unknown[]) =>
    mockGetStorefrontPublicationCacheIdentity(...args),
}));

vi.mock('@/lib/storefront-publication-cache-eviction', () => ({
  evictStorefrontPublicationCaches: (...args: unknown[]) =>
    mockEvictStorefrontPublicationCaches(...args),
}));

import { DELETE, POST } from './route';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

function makeRequest(
  method: 'POST' | 'DELETE',
  authorization?: string
): NextRequest {
  return new NextRequest('http://localhost:3000/api/merchant/publish', {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      'Content-Type': 'application/json',
    },
  });
}

function createMockSupabase(
  options: {
    merchant?: { id: string; slug: string | null } | null;
    merchantError?: { message: string } | null;
    updateError?: { message: string } | null;
  } = {}
) {
  const merchant =
    'merchant' in options
      ? options.merchant
      : { id: MERCHANT_ID, slug: 'test-store' };

  return {
    from: vi.fn((table: string) => {
      if (table !== 'merchants') {
        throw new Error(`Unexpected route-local ${table} query`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: merchant,
              error: options.merchantError ?? null,
            }),
          })),
        })),
        update: vi.fn((data: unknown) => {
          mockMerchantUpdate(data);
          return {
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: options.updateError ?? null,
            }),
          };
        }),
      };
    }),
  };
}

function readyLaunchReadiness(
  overrides: Partial<StoreLaunchReadiness> = {}
): StoreLaunchReadiness {
  return {
    merchantId: MERCHANT_ID,
    slug: 'test-store',
    activeProductCount: 1,
    totalProductCount: 1,
    completedRequired: 6,
    totalRequired: 6,
    isReady: true,
    items: [],
    ...overrides,
  };
}

function incompleteLaunchReadiness(
  id: StoreLaunchReadiness['items'][number]['id'],
  options: { totalProductCount?: number } = {}
): StoreLaunchReadiness {
  return readyLaunchReadiness({
    activeProductCount: 0,
    totalProductCount: options.totalProductCount ?? 0,
    completedRequired: 0,
    isReady: false,
    items: [
      {
        id,
        label: id,
        description: id,
        completed: false,
        priority: 'required',
        category: 'store',
      },
    ],
  });
}

function setupAuthenticatedRequest(supabase = createMockSupabase()) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-123' },
    supabase,
    error: null,
  });
  mockGetUserAccess.mockResolvedValue({
    merchantId: MERCHANT_ID,
    role: 'owner',
  });
  mockHasPermission.mockReturnValue(true);
  return supabase;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
  mockLoadStoreLaunchReadiness.mockResolvedValue(readyLaunchReadiness());
  mockGetStorefrontPublicationCacheIdentity.mockResolvedValue({
    merchantId: MERCHANT_ID,
    canonicalMerchantSlug: 'test-store',
    merchantSlugs: ['test-store'],
    customDomains: [],
    identifiers: ['test-store'],
  });
  mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: true });
});

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
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('enforces a rejected cookie CSRF check after authenticating', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(403);
    expect(mockGetUserAccess).not.toHaveBeenCalled();
  });

  it('retains the bearer-authenticated CSRF bypass result', async () => {
    const supabase = setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockImplementation(
      async (request: NextRequest) => ({
        valid:
          request.headers.get('authorization')?.startsWith('Bearer ') === true,
        response: null,
      })
    );

    const response = await POST(makeRequest('POST', 'Bearer mobile-token'));

    expect(response.status).toBe(200);
    expect(mockCheckCsrfProtection).toHaveBeenCalledTimes(1);
    expect(mockLoadStoreLaunchReadiness).toHaveBeenCalledWith({
      supabase,
      merchantId: MERCHANT_ID,
    });
  });

  it('uses only the canonical launch loader on the caller-scoped client', async () => {
    const supabase = setupAuthenticatedRequest();

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(200);
    expect(mockLoadStoreLaunchReadiness).toHaveBeenCalledWith({
      supabase,
      merchantId: MERCHANT_ID,
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('merchants');
  });

  it.each([
    'verify_kyc',
    'bank_account',
    'payment_method',
    'store_url',
    'first_product',
    'country',
    'contact_info',
  ] as const)('blocks publication for incomplete canonical %s', async (id) => {
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      incompleteLaunchReadiness(id)
    );

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(400);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockGetStorefrontPublicationCacheIdentity).not.toHaveBeenCalled();
  });

  it('uses the canonical active and total product facts for inactive-product copy', async () => {
    setupAuthenticatedRequest();
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      incompleteLaunchReadiness('first_product', { totalProductCount: 5 })
    );

    const response = await POST(makeRequest('POST'));
    const body = await response.json();

    expect(body.missingItems).toEqual([
      'At least one active product (you have 5 product(s) but none are active - go to Products and activate them)',
    ]);
  });

  it('returns the stable 500 failure shape without publishing when readiness loading fails', async () => {
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
  });

  it('publishes using the canonical merchant ID and normalized slug', async () => {
    const supabase = setupAuthenticatedRequest();
    const cacheIdentity = { identifiers: ['normalized-store'] };
    mockLoadStoreLaunchReadiness.mockResolvedValue(
      readyLaunchReadiness({ slug: 'normalized-store' })
    );
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(cacheIdentity);

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(200);
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      'normalized-store'
    );
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
      cacheIdentity
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_published: true })
    );
  });

  it('does not claim success when cache eviction fails after publication', async () => {
    setupAuthenticatedRequest();
    mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: false });

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'STOREFRONT_CACHE_EVICTION_FAILED',
    });
  });

  it('does not mutate when publication cache identity lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    mockGetStorefrontPublicationCacheIdentity.mockRejectedValue(
      new Error('alias lookup failed')
    );

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(500);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('returns the existing publish failure response when the update fails', async () => {
    setupAuthenticatedRequest(
      createMockSupabase({ updateError: { message: 'database unavailable' } })
    );

    const response = await POST(makeRequest('POST'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to publish store',
    });
  });
});

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
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('enforces a rejected cookie CSRF check after authenticating', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(403);
    expect(mockGetUserAccess).not.toHaveBeenCalled();
  });

  it('retains the bearer-authenticated CSRF bypass result', async () => {
    setupAuthenticatedRequest();
    mockCheckCsrfProtection.mockImplementation(
      async (request: NextRequest) => ({
        valid:
          request.headers.get('authorization')?.startsWith('Bearer ') === true,
        response: null,
      })
    );

    const response = await DELETE(makeRequest('DELETE', 'Bearer mobile-token'));

    expect(response.status).toBe(200);
  });

  it('unpublishes and evicts every resolved storefront identity', async () => {
    const supabase = setupAuthenticatedRequest();
    const cacheIdentity = { identifiers: ['test-store', 'shop.example.com'] };
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(cacheIdentity);

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(200);
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      'test-store'
    );
    expect(mockMerchantUpdate).toHaveBeenCalledWith({ is_published: false });
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
      cacheIdentity
    );
  });

  it('unpublishes a legacy null-slug merchant with its resolved custom domains', async () => {
    const supabase = setupAuthenticatedRequest(
      createMockSupabase({ merchant: { id: MERCHANT_ID, slug: null } })
    );
    const cacheIdentity = {
      identifiers: ['retired-store', 'shop.example.com'],
    };
    mockGetStorefrontPublicationCacheIdentity.mockResolvedValue(cacheIdentity);

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(200);
    expect(mockGetStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
      supabase,
      MERCHANT_ID,
      null
    );
    expect(mockEvictStorefrontPublicationCaches).toHaveBeenCalledWith(
      cacheIdentity
    );
  });

  it('does not claim success when cache eviction fails after unpublishing', async () => {
    setupAuthenticatedRequest();
    mockEvictStorefrontPublicationCaches.mockResolvedValue({ ok: false });

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'STOREFRONT_CACHE_EVICTION_FAILED',
    });
  });

  it('returns the existing failure response when the merchant lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest(
      createMockSupabase({ merchantError: { message: 'database unavailable' } })
    );

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load merchant',
    });
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
  });

  it('does not mutate when unpublish cache identity lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupAuthenticatedRequest();
    mockGetStorefrontPublicationCacheIdentity.mockRejectedValue(
      new Error('alias lookup failed')
    );

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(500);
    expect(mockMerchantUpdate).not.toHaveBeenCalled();
    expect(mockEvictStorefrontPublicationCaches).not.toHaveBeenCalled();
  });

  it('returns the existing unpublish failure response when the update fails', async () => {
    setupAuthenticatedRequest(
      createMockSupabase({ updateError: { message: 'database unavailable' } })
    );

    const response = await DELETE(makeRequest('DELETE'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to unpublish store',
    });
  });
});
