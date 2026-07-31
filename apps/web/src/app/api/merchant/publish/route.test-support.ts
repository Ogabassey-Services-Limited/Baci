import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import type { StoreLaunchReadiness } from '@/lib/store-readiness/build-store-launch-readiness';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  evictStorefrontPublicationCaches: vi.fn(),
  getStorefrontPublicationCacheIdentity: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  loadStoreLaunchReadiness: vi.fn(),
  merchantUpdate: vi.fn(),
}));

export const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
export const mockAuthenticateApiRequest = mocks.authenticateApiRequest;
export const mockGetMerchantForApiRequest = mocks.getMerchantForApiRequest;
export const mockHasPermission = mocks.hasPermission;
export const mockCheckCsrfProtection = mocks.checkCsrfProtection;
export const mockLoadStoreLaunchReadiness = mocks.loadStoreLaunchReadiness;
export const mockGetStorefrontPublicationCacheIdentity =
  mocks.getStorefrontPublicationCacheIdentity;
export const mockEvictStorefrontPublicationCaches =
  mocks.evictStorefrontPublicationCaches;
export const mockMerchantUpdate = mocks.merchantUpdate;

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: (context: {
    merchantId: string;
    staffAccess: Record<string, unknown>;
  }) => ({
    merchantId: context.merchantId,
    ...context.staffAccess,
  }),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/store-readiness/load-store-launch-readiness', () => ({
  loadStoreLaunchReadiness: mocks.loadStoreLaunchReadiness,
}));
vi.mock('@/lib/get-storefront-publication-cache-identity', () => ({
  getStorefrontPublicationCacheIdentity:
    mocks.getStorefrontPublicationCacheIdentity,
}));
vi.mock('@/lib/storefront-publication-cache-eviction', () => ({
  evictStorefrontPublicationCaches: mocks.evictStorefrontPublicationCaches,
}));

export function makeRequest(
  method: 'POST' | 'DELETE',
  authorization?: string,
  body?: unknown
): NextRequest {
  return new NextRequest('http://localhost:3000/api/merchant/publish', {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      body === undefined ? { merchantId: MERCHANT_ID } : body
    ),
  });
}

export function createMockSupabase(
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
        update: vi.fn((data: unknown) => ({
          eq: vi.fn((column: string, value: unknown) => {
            mockMerchantUpdate(data, column, value);
            return Promise.resolve({
              data: null,
              error: options.updateError ?? null,
            });
          }),
        })),
      };
    }),
  };
}

export function readyLaunchReadiness(
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

export function incompleteLaunchReadiness(
  id: StoreLaunchReadiness['items'][number]['id'],
  totalProductCount = 0
): StoreLaunchReadiness {
  return readyLaunchReadiness({
    activeProductCount: 0,
    totalProductCount,
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

export function setupAuthenticatedRequest(supabase = createMockSupabase()) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-123' },
    supabase,
    error: null,
  });
  mockGetMerchantForApiRequest.mockResolvedValue({
    merchantId: MERCHANT_ID,
    staffAccess: {
      isOwner: true,
      isStaff: false,
      permissions: { full_access: { all: true } },
      role: 'owner',
    },
  });
  mockHasPermission.mockReturnValue(true);
  return supabase;
}

export function resetPublishRouteMocks() {
  vi.resetAllMocks();
  setupAuthenticatedRequest();
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
}
