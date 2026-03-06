import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLegacyProductTarget } from './resolve-legacy-product-target';

const {
  getCachedMerchantMock,
  getCachedMerchantByDomainMock,
  getCachedProductMock,
} = vi.hoisted(() => ({
  getCachedMerchantMock: vi.fn(),
  getCachedMerchantByDomainMock: vi.fn(),
  getCachedProductMock: vi.fn(),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: getCachedMerchantMock,
  getCachedMerchantByDomain: getCachedMerchantByDomainMock,
  getCachedProduct: getCachedProductMock,
}));

describe('resolveLegacyProductTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedMerchantMock.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    getCachedMerchantByDomainMock.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
  });

  it('returns the canonical path for an exact active product match', async () => {
    getCachedProductMock.mockResolvedValueOnce({
      id: 'product-1',
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      product_categories: [
        {
          categories: {
            name: 'Smartphones',
            slug: 'smartphones',
          },
        },
      ],
    });

    const result = await resolveLegacyProductTarget(
      'ogabassey.com',
      'iphone-15-pro'
    );

    expect(result).toBe('/smartphones/iphone-15-pro');
    expect(getCachedProductMock).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-15-pro'
    );
  });

  it('falls back to an active parent slug when a legacy variant slug no longer exists', async () => {
    getCachedProductMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'product-2',
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        product_categories: [
          {
            categories: {
              name: 'Smartphones',
              slug: 'smartphones',
            },
          },
        ],
      });

    const result = await resolveLegacyProductTarget(
      'ogabassey.com',
      'iphone-15-pro-8gb-128gb'
    );

    expect(result).toBe('/smartphones/iphone-15-pro');
    expect(
      getCachedProductMock.mock.calls.map((call) => call[1])
    ).toStrictEqual([
      'iphone-15-pro-8gb-128gb',
      'iphone-15-pro-8gb',
      'iphone-15-pro',
    ]);
  });

  it('returns null when no active replacement can be resolved', async () => {
    getCachedProductMock.mockResolvedValue(null);

    const result = await resolveLegacyProductTarget(
      'ogabassey.com',
      'unknown-product-8gb-256gb'
    );

    expect(result).toBeNull();
  });
});
