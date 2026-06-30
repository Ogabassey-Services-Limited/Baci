import { describe, expect, it } from 'vitest';
import { PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT } from '@/lib/storefront-compare/build-compare-discovery-links';
import {
  buildProductSemanticCompareSupport,
  isApprovedSupportLink,
} from './build-product-semantic-compare-support';
import type {
  BuildProductSemanticModelInput,
  ProductSemanticCandidate,
} from './product-semantic-types';

function makeCandidate(
  overrides: Partial<ProductSemanticCandidate> &
    Pick<ProductSemanticCandidate, 'slug' | 'name' | 'price'>
): ProductSemanticCandidate {
  return {
    brand: 'Brand',
    category_slug: 'smartphones',
    condition: 'new',
    product_key_specs: {
      chipset: 'Chip',
      ram_gb: 8,
      storage_gb: 128,
    },
    stock: 5,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<BuildProductSemanticModelInput> &
    Pick<BuildProductSemanticModelInput, 'currentProduct' | 'inventory'>
): BuildProductSemanticModelInput {
  return {
    storeUrl: 'https://ogabassey.com',
    merchantBusinessName: 'Ogabassey',
    categorySlug: 'smartphones',
    categoryName: 'Smartphones',
    ...overrides,
  };
}

describe('buildProductSemanticCompareSupport', () => {
  it('keeps only the category hub when inventory is empty', () => {
    const currentProduct = makeCandidate({
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      price: 495_000,
    });
    const support = buildProductSemanticCompareSupport(
      makeInput({
        currentProduct,
        inventory: [],
      })
    );

    expect(support.approvedCompareSlugs.size).toBe(0);
    expect(support.supportLinks).toEqual([
      {
        href: 'https://ogabassey.com/smartphones',
        label: 'Shop more Smartphones',
      },
    ]);
  });

  it('normalizes trailing store URLs before building support links', () => {
    const currentProduct = makeCandidate({
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      price: 495_000,
    });
    const support = buildProductSemanticCompareSupport(
      makeInput({
        storeUrl: 'https://ogabassey.com/',
        currentProduct,
        inventory: [],
      })
    );

    expect(support.supportLinks[0]).toEqual({
      href: 'https://ogabassey.com/smartphones',
      label: 'Shop more Smartphones',
    });
    expect(
      support.supportLinks.some((link) => link.href.includes('.com//'))
    ).toBe(false);
  });

  it('keeps category support when inventory has no matching category products', () => {
    const currentProduct = makeCandidate({
      slug: 'laptop-pro',
      name: 'Laptop Pro',
      category_slug: 'laptops',
      price: 900_000,
    });
    const support = buildProductSemanticCompareSupport(
      makeInput({
        currentProduct,
        inventory: [
          currentProduct,
          makeCandidate({
            slug: 'laptop-air',
            name: 'Laptop Air',
            category_slug: 'laptops',
            price: 850_000,
          }),
        ],
      })
    );

    expect(support.approvedCompareSlugs.size).toBe(0);
    expect(support.supportLinks).toEqual([
      {
        href: 'https://ogabassey.com/smartphones',
        label: 'Shop more Smartphones',
      },
    ]);
  });

  it('keeps price-band links for deep PDPs without unapproved compare links', () => {
    const inventory = Array.from(
      { length: PRODUCT_SCOPED_COMPARE_DISCOVERY_PRODUCT_LIMIT + 1 },
      (_, index) =>
        makeCandidate({
          slug: `phone-${index}`,
          name: `Phone ${index}`,
          brand: `Brand ${index % 5}`,
          price: 300_000 + index,
          product_key_specs: {
            chipset: `Chip ${index}`,
            ram_gb: 8 + index,
            storage_gb: 128 + index,
          },
        })
    );
    const currentProduct = inventory.at(-1);

    if (!currentProduct) {
      throw new Error('Expected generated current product');
    }

    const support = buildProductSemanticCompareSupport(
      makeInput({
        currentProduct,
        inventory,
      })
    );

    expect(
      support.supportLinks.some((link) => link.href.includes('/compare/'))
    ).toBe(false);
    expect(support.supportLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: 'https://ogabassey.com/smartphones/best-under/under-500k',
        }),
      ])
    );
  });

  it('normalizes missing category slugs before building support links', () => {
    const currentProduct = makeCandidate({
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      category_slug: undefined,
      price: 495_000,
      product_key_specs: {
        chipset: 'A19 Pro',
        ram_gb: 8,
        storage_gb: 256,
      },
    });
    const support = buildProductSemanticCompareSupport(
      makeInput({
        currentProduct,
        inventory: [
          currentProduct,
          makeCandidate({
            slug: 'samsung-galaxy-z-trifold',
            name: 'Samsung Galaxy Z TriFold',
            brand: 'Samsung',
            category_slug: undefined,
            price: 480_000,
            product_key_specs: {
              chipset: 'Snapdragon 8 Elite',
              ram_gb: 16,
              storage_gb: 512,
            },
          }),
        ],
      })
    );

    expect(support.input.currentProduct.category_slug).toBe('smartphones');
    expect(
      support.input.inventory.every((product) => product.category_slug)
    ).toBe(true);
    expect(support.supportLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: 'https://ogabassey.com/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
        }),
      ])
    );
  });

  it('fails closed for malformed compare support links', () => {
    const approvedCompareSlugs = new Set(['iphone-vs-samsung']);

    expect(
      isApprovedSupportLink({
        approvedCompareSlugs,
        categorySlug: 'smartphones',
        href: 'https://ogabassey.com/smartphones/best-under/under-500k',
      })
    ).toBe(true);
    expect(
      isApprovedSupportLink({
        approvedCompareSlugs,
        categorySlug: 'smartphones',
        href: 'https://ogabassey.com/smartphones/compare/samsung-vs-iphone',
      })
    ).toBe(true);
    expect(
      isApprovedSupportLink({
        approvedCompareSlugs,
        categorySlug: 'smartphones',
        href: 'https://ogabassey.com/smartphones/compare/not-a-pair',
      })
    ).toBe(false);
    expect(
      isApprovedSupportLink({
        approvedCompareSlugs,
        categorySlug: 'smartphones',
        href: 'https://ogabassey.com/smartphones/compare/apple-vs-pixel',
      })
    ).toBe(false);
  });
});
