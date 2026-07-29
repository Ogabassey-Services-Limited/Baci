import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import type { StoreLaunchReadiness } from '@/lib/store-readiness/build-store-launch-readiness';

export const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
export const mockAuthenticateApiRequest = vi.fn();
export const mockGetUserAccess = vi.fn();
export const mockHasPermission = vi.fn();
export const mockCheckCsrfProtection = vi.fn();
export const mockLoadStoreLaunchReadiness = vi.fn();
export const mockGetStorefrontPublicationCacheIdentity = vi.fn();
export const mockEvictStorefrontPublicationCaches = vi.fn();
export const mockMerchantUpdate = vi.fn();

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

export function makeRequest(
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
  mockGetUserAccess.mockResolvedValue({
    merchantId: MERCHANT_ID,
    role: 'owner',
  });
  mockHasPermission.mockReturnValue(true);
  return supabase;
}

export function resetPublishRouteMocks() {
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
}
