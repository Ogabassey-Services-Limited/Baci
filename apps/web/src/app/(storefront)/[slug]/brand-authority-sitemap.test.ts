import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategory = vi.fn();
const mockInventory = vi.fn();
vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: (...args: unknown[]) => mockCategory(...args),
}));
vi.mock(
  '@/lib/storefront-category/get-cached-brand-authority-inventory',
  () => ({
    getCachedBrandAuthorityInventory: (...args: unknown[]) =>
      mockInventory(...args),
  })
);

describe('getBrandAuthoritySitemapEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategory.mockResolvedValue({
      isCollection: false,
      isInactiveCategory: false,
      productsQueryFailed: false,
    });
  });

  it('emits eligible brand hubs and isolates inventory failures', async () => {
    mockInventory.mockImplementation(
      async (
        _merchant: string,
        _category: string,
        entry: { brandKey: string }
      ) => {
        if (entry.brandKey === 'google') throw new Error('timeout');
        return {
          productCount: entry.brandKey === 'samsung' ? 5 : 0,
          latestUpdatedAt: '2026-07-21T00:00:00Z',
        };
      }
    );
    const { getBrandAuthoritySitemapEntries } = await import(
      './brand-authority-sitemap'
    );
    const entries = await getBrandAuthoritySitemapEntries({
      merchant: { id: 'merchant-1', slug: 'store' },
      storeUrl: 'https://store.test',
    } as never);
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://store.test/smartphones/brands/samsung',
    ]);
  });
});
