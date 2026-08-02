import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategory = vi.fn();
const mockInventory = vi.fn();
vi.mock('@/lib/storefront-category/brand-authority-public-data', () => ({
  brandAuthorityPublicData: {
    getCategory: (...args: unknown[]) => mockCategory(...args),
  },
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
    mockCategory.mockResolvedValue({ id: 'category-1', name: 'Smartphones' });
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
          products: [],
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

  it('emits family hubs only when the family has enough products', async () => {
    mockInventory.mockImplementation(
      async (
        _merchant: string,
        _category: string,
        entry: { brandKey: string }
      ) => ({
        productCount: entry.brandKey === 'samsung' ? 6 : 0,
        latestUpdatedAt: '2026-07-21T00:00:00Z',
        products:
          entry.brandKey === 'samsung'
            ? [
                { name: 'Samsung Galaxy S24' },
                { name: 'Samsung Galaxy S25' },
                { name: 'Samsung Galaxy S26' },
                { name: 'Samsung Galaxy A56' },
                { name: 'Samsung Galaxy A36' },
                { name: 'Samsung Galaxy Z Fold 7' },
              ]
            : [],
      })
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
      'https://store.test/smartphones/brands/samsung/families/galaxy-s',
    ]);
  });

  it('keeps the brand hub when no model family meets its threshold', async () => {
    mockInventory.mockImplementation(
      async (
        _merchant: string,
        _category: string,
        entry: { brandKey: string }
      ) => ({
        productCount: entry.brandKey === 'samsung' ? 5 : 0,
        latestUpdatedAt: '2026-07-21T00:00:00Z',
        products:
          entry.brandKey === 'samsung'
            ? [
                { name: 'Samsung Galaxy S25' },
                { name: 'Samsung Galaxy S26' },
                { name: 'Samsung Galaxy A56' },
                { name: 'Samsung Galaxy Z Fold 7' },
                { name: 'Samsung Galaxy Z Flip 7' },
              ]
            : [],
      })
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

  it('checks family eligibility against the same 48 products rendered by the page', async () => {
    mockInventory.mockImplementation(
      async (
        _merchant: string,
        _category: string,
        entry: { brandKey: string }
      ) => ({
        productCount: entry.brandKey === 'samsung' ? 51 : 0,
        latestUpdatedAt: '2026-07-21T00:00:00Z',
        products:
          entry.brandKey === 'samsung'
            ? [
                ...Array.from({ length: 48 }, (_, index) => ({
                  name: `Samsung Other ${index}`,
                })),
                { name: 'Galaxy S24' },
                { name: 'Galaxy S25' },
                { name: 'Galaxy S26' },
              ]
            : [],
      })
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
