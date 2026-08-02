import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadBrandPage = vi.fn();
vi.mock('@/lib/storefront-category/load-brand-authority-page', () => ({
  brandAuthorityPageLoader: {
    load: (...args: unknown[]) => mockLoadBrandPage(...args),
  },
}));

describe('model family authority page loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadBrandPage.mockResolvedValue({
      canonicalUrl: 'https://store.test/smartphones/brands/samsung',
      merchant: { business_name: 'Store', country: 'NG' },
      brand: { brandKey: 'samsung', displayName: 'Samsung' },
      products: [
        { name: 'Samsung Galaxy S24' },
        { name: 'Samsung Galaxy S25' },
        { name: 'Samsung Galaxy S26' },
        { name: 'Samsung Galaxy A56' },
      ],
      breadcrumbItems: [
        { name: 'Store', url: 'https://store.test' },
        { name: 'Smartphones', url: 'https://store.test/smartphones' },
        {
          name: 'Samsung',
          url: 'https://store.test/smartphones/brands/samsung',
        },
      ],
    });
  });

  it('builds an indexable family page at the inventory threshold', async () => {
    const { modelFamilyAuthorityPageLoader } = await import(
      './load-model-family-authority-page'
    );
    const page = await modelFamilyAuthorityPageLoader.load({
      merchantSlug: 'store',
      categorySlug: 'smartphones',
      brandSlug: 'samsung',
      familySlug: 'galaxy-s',
    });

    expect(page).toMatchObject({
      canonicalUrl:
        'https://store.test/smartphones/brands/samsung/families/galaxy-s',
      heading: 'Samsung Galaxy S Phones and Prices in Nigeria',
    });
    expect(page?.products).toHaveLength(3);
  });

  it('rejects thin and uncurated family pages', async () => {
    const { modelFamilyAuthorityPageLoader } = await import(
      './load-model-family-authority-page'
    );
    expect(
      await modelFamilyAuthorityPageLoader.load({
        merchantSlug: 'store',
        categorySlug: 'smartphones',
        brandSlug: 'samsung',
        familySlug: 'galaxy-z',
      })
    ).toBeNull();
    expect(
      await modelFamilyAuthorityPageLoader.load({
        merchantSlug: 'store',
        categorySlug: 'smartphones',
        brandSlug: 'samsung',
        familySlug: 'unknown',
      })
    ).toBeNull();
  });
});
