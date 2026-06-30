import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildCompareDiscoveryLinks = vi.hoisted(() => vi.fn());

vi.mock('@/lib/storefront-compare/build-compare-discovery-links', () => ({
  buildCompareDiscoveryLinks: (...args: unknown[]) =>
    mockBuildCompareDiscoveryLinks(...args),
}));

const {
  buildCompareIndexSections,
  COMPARE_INDEX_CATEGORY_DISCOVERY_LIMIT,
  COMPARE_INDEX_DISCOVERY_CONCURRENCY,
  COMPARE_INDEX_PRODUCTS_PER_CATEGORY_LIMIT,
} = await import('./compare-index-discovery');

function makeProducts() {
  return [
    {
      id: 'product-a',
      name: 'Product A',
      slug: 'product-a',
      brand: 'Brand A',
      category: 'Category',
      price: 1000,
      product_key_specs: {
        chipset: 'A1',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
    {
      id: 'product-b',
      name: 'Product B',
      slug: 'product-b',
      brand: 'Brand B',
      category: 'Category',
      price: 2000,
      product_key_specs: {
        chipset: 'B1',
        ram_gb: 16,
        storage_gb: 256,
      },
    },
  ];
}

describe('compare index discovery', () => {
  beforeEach(() => {
    mockBuildCompareDiscoveryLinks.mockReset();
    mockBuildCompareDiscoveryLinks.mockImplementation(
      ({ categorySlug }: { categorySlug: string }) => [
        {
          canonicalSlug: 'product-a-vs-product-b',
          href: `https://store.test/${categorySlug}/compare/product-a-vs-product-b`,
          label: 'Product A vs Product B',
        },
      ]
    );
  });

  it('bounds category discovery and concurrent category data loads', async () => {
    const categories = Array.from(
      { length: COMPARE_INDEX_CATEGORY_DISCOVERY_LIMIT + 4 },
      (_, index) => ({
        name: `Category ${index}`,
        slug: `category-${index}`,
      })
    );
    let activeLoads = 0;
    let maxActiveLoads = 0;
    const getCategoryPageData = vi.fn(
      async (_categorySlug: string, _productOffset: number) => {
        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
        await Promise.resolve();

        activeLoads -= 1;

        return {
          isCollection: false,
          isInactiveCategory: false,
          products: makeProducts(),
        };
      }
    );

    await buildCompareIndexSections({
      categories,
      getCategoryPageData,
      storeUrl: 'https://store.test',
    });

    expect(getCategoryPageData).toHaveBeenCalledTimes(
      COMPARE_INDEX_CATEGORY_DISCOVERY_LIMIT
    );
    expect(getCategoryPageData).toHaveBeenCalledWith(
      'category-0',
      0,
      COMPARE_INDEX_PRODUCTS_PER_CATEGORY_LIMIT
    );
    expect(maxActiveLoads).toBe(COMPARE_INDEX_DISCOVERY_CONCURRENCY);
  });

  it('caps compare links per category and across the full index', async () => {
    mockBuildCompareDiscoveryLinks.mockImplementation(
      ({ categorySlug }: { categorySlug: string }) =>
        Array.from({ length: 5 }, (_, index) => ({
          canonicalSlug: `product-a-${index}-vs-product-b-${index}`,
          href: `https://store.test/${categorySlug}/compare/product-a-${index}-vs-product-b-${index}`,
          label: `Product A ${index} vs Product B ${index}`,
        }))
    );

    const sections = await buildCompareIndexSections({
      categories: [
        { name: 'Category A', slug: 'category-a' },
        { name: 'Category B', slug: 'category-b' },
      ],
      getCategoryPageData: vi.fn(async () => ({
        isCollection: false,
        isInactiveCategory: false,
        products: makeProducts(),
      })),
      linksPerCategoryLimit: 3,
      pathPrefix: '/demo-store',
      storeUrl: 'https://store.test',
      totalLinkLimit: 4,
    });

    expect(sections.map((section) => section.links.length)).toEqual([3, 1]);
    expect(sections[0]?.links[0]).toEqual({
      href: '/demo-store/category-a/compare/product-a-0-vs-product-b-0',
      label: 'Product A 0 vs Product B 0',
    });
  });

  it('can stop category discovery after the total link limit is satisfied', async () => {
    const categories = Array.from({ length: 6 }, (_, index) => ({
      name: `Category ${index}`,
      slug: `category-${index}`,
    }));
    const getCategoryPageData = vi.fn(async () => ({
      isCollection: false,
      isInactiveCategory: false,
      products: makeProducts(),
    }));

    const sections = await buildCompareIndexSections({
      categories,
      concurrency: 2,
      getCategoryPageData,
      linksPerCategoryLimit: 1,
      stopWhenTotalLinkLimitReached: true,
      storeUrl: 'https://store.test',
      totalLinkLimit: 1,
    });

    expect(getCategoryPageData).toHaveBeenCalledTimes(2);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.links).toHaveLength(1);
  });

  it('enforces the configured product cap even when category data returns extra rows', async () => {
    mockBuildCompareDiscoveryLinks.mockImplementation(
      ({
        categorySlug,
        products,
      }: {
        categorySlug: string;
        products: Array<{ slug: string; name: string }>;
      }) =>
        products.map((product) => ({
          canonicalSlug: `${product.slug}-vs-anchor`,
          href: `https://store.test/${categorySlug}/compare/${product.slug}-vs-anchor`,
          label: `${product.name} vs Anchor`,
        }))
    );

    const sections = await buildCompareIndexSections({
      categories: [{ name: 'Category A', slug: 'category-a' }],
      getCategoryPageData: vi.fn(async () => ({
        isCollection: false,
        isInactiveCategory: false,
        products: [
          ...makeProducts(),
          {
            id: 'product-c',
            name: 'Product C',
            slug: 'product-c',
            brand: 'Brand C',
            category: 'Category',
            price: 3000,
            product_key_specs: {
              chipset: 'C1',
              ram_gb: 32,
              storage_gb: 512,
            },
          },
        ],
      })),
      productLimit: 1,
      storeUrl: 'https://store.test',
    });

    expect(mockBuildCompareDiscoveryLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        includeBrandCompareLinks: false,
        products: [
          expect.objectContaining({
            slug: 'product-a',
          }),
        ],
      })
    );
    expect(sections[0]?.links).toEqual([
      {
        href: '/category-a/compare/product-a-vs-anchor',
        label: 'Product A vs Anchor',
      },
    ]);
  });

  it('skips categories that cannot publish compare index links', async () => {
    mockBuildCompareDiscoveryLinks.mockImplementation(
      ({ categorySlug }: { categorySlug: string }) =>
        categorySlug === 'without-links'
          ? []
          : [
              {
                canonicalSlug: 'product-a-vs-product-b',
                href: `https://store.test/${categorySlug}/compare/product-a-vs-product-b`,
                label: 'Product A vs Product B',
              },
            ]
    );

    const sections = await buildCompareIndexSections({
      categories: [
        { name: 'Missing', slug: 'missing' },
        { name: 'Collection', slug: 'collection' },
        { name: 'Inactive', slug: 'inactive' },
        { name: 'Without links', slug: 'without-links' },
        { name: 'Working', slug: 'working' },
      ],
      getCategoryPageData: vi.fn((categorySlug: string) => {
        if (categorySlug === 'missing') {
          return Promise.resolve(null);
        }

        if (categorySlug === 'collection') {
          return Promise.resolve({
            isCollection: true,
            products: makeProducts(),
          });
        }

        if (categorySlug === 'inactive') {
          return Promise.resolve({
            isCollection: false,
            isInactiveCategory: true,
            products: makeProducts(),
          });
        }

        return Promise.resolve({
          isCollection: false,
          isInactiveCategory: false,
          products: makeProducts(),
        });
      }),
      storeUrl: 'https://store.test',
    });

    expect(sections).toEqual([
      {
        categoryName: 'Working',
        categorySlug: 'working',
        links: [
          {
            href: '/working/compare/product-a-vs-product-b',
            label: 'Product A vs Product B',
          },
        ],
      },
    ]);
  });

  it('skips rejected category loads while keeping later sections', async () => {
    const sections = await buildCompareIndexSections({
      categories: [
        { name: 'Broken', slug: 'broken' },
        { name: 'Working', slug: 'working' },
      ],
      getCategoryPageData: vi.fn((categorySlug: string) => {
        if (categorySlug === 'broken') {
          return Promise.reject(new Error('Category load failed'));
        }

        return Promise.resolve({
          isCollection: false,
          isInactiveCategory: false,
          products: makeProducts(),
        });
      }),
      storeUrl: 'https://store.test',
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.categorySlug).toBe('working');
  });
});
