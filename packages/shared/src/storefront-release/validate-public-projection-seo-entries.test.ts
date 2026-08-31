import { describe, expect, it } from 'vitest';
import { validatePublicProjectionSeoEntries } from './validate-public-projection-seo-entries';

const categories = [{ id: 'category-1', slug: 'smartphones' }];
const products = [
  {
    available: true,
    categoryIds: ['category-1'],
    id: 'product-1',
    name: 'Phone A',
    priceMinor: 100_000,
    productKeySpecs: { camera: 12, screen: 6, storage: 128 },
    slug: 'phone-a',
  },
  {
    available: true,
    categoryIds: ['category-1'],
    id: 'product-2',
    name: 'Phone B',
    priceMinor: 110_000,
    productKeySpecs: { camera: 48, screen: 6.7, storage: 256 },
    slug: 'phone-b',
  },
];

function issueMessages(maintainedComparePaths: readonly string[]) {
  const messages: string[] = [];
  validatePublicProjectionSeoEntries(
    {
      categories,
      maintainedComparePaths,
      merchant: {
        currency: 'NGN',
        hostname: 'pilot-store.usebaci.com',
        slug: 'pilot-store',
      },
      products,
      seoEntries: [{ indexable: true, path: '/smartphones/compare' }],
    },
    {
      addIssue(issue: { message?: string }) {
        messages.push(issue.message ?? '');
      },
    } as Parameters<typeof validatePublicProjectionSeoEntries>[1]
  );
  return messages;
}

function compareHubIssueMessages(
  compareCategories: readonly { id: string; slug: string }[],
  compareProducts: typeof products
) {
  const messages: string[] = [];
  validatePublicProjectionSeoEntries(
    {
      categories: compareCategories,
      merchant: {
        currency: 'NGN',
        hostname: 'pilot-store.usebaci.com',
        slug: 'pilot-store',
      },
      products: compareProducts,
      seoEntries: [{ indexable: true, path: '/compare' }],
    },
    {
      addIssue(issue: { message?: string }) {
        messages.push(issue.message ?? '');
      },
    } as Parameters<typeof validatePublicProjectionSeoEntries>[1]
  );
  return messages;
}

describe('validatePublicProjectionSeoEntries', () => {
  it('accepts a category compare hub with a maintained eligible link', () => {
    expect(issueMessages(['/smartphones/compare/phone-a-vs-phone-b'])).toEqual(
      []
    );
  });

  it('rejects an indexable category compare hub without an eligible link', () => {
    expect(issueMessages([])).toContain(
      'Category compare SEO requires an eligible projected comparison link'
    );
  });

  it('accepts a parent compare hub with an eligible child-category link', () => {
    const parent = { id: 'category-parent', slug: 'smartphones' };
    const child = {
      id: 'category-child',
      parentId: parent.id,
      slug: 'android-phones',
    };
    const childProducts = products.map((product) => ({
      ...product,
      categoryIds: [child.id],
    }));
    const messages: string[] = [];

    validatePublicProjectionSeoEntries(
      {
        categories: [parent, child],
        maintainedComparePaths: ['/android-phones/compare/phone-a-vs-phone-b'],
        merchant: {
          currency: 'NGN',
          hostname: 'pilot-store.usebaci.com',
          slug: 'pilot-store',
        },
        products: childProducts,
        seoEntries: [{ indexable: true, path: '/smartphones/compare' }],
      },
      {
        addIssue(issue: { message?: string }) {
          messages.push(issue.message ?? '');
        },
      } as Parameters<typeof validatePublicProjectionSeoEntries>[1]
    );

    expect(messages).not.toContain(
      'Category compare SEO requires an eligible projected comparison link'
    );
  });

  it('applies the origin category and product discovery bounds', () => {
    const categories = [
      ...Array.from({ length: 80 }, (_, index) => ({
        id: `category-${index}`,
        slug: `category-${index}`,
      })),
      { id: 'category-81', slug: 'category-81' },
    ];
    const lateCategoryProducts = [
      {
        ...products[0],
        categoryIds: ['category-81'],
        id: 'late-category-a',
        slug: 'late-category-a',
      },
      {
        ...products[1],
        categoryIds: ['category-81'],
        id: 'late-category-b',
        slug: 'late-category-b',
      },
    ];

    expect(compareHubIssueMessages(categories, lateCategoryProducts)).toContain(
      'Compare SEO requires an eligible projected comparison pair'
    );

    const boundedCategoryProducts = Array.from({ length: 80 }, (_, index) => ({
      ...products[0],
      categoryIds: ['category-0'],
      id: `bounded-${index}`,
      slug: `bounded-${index}`,
    }));
    boundedCategoryProducts.push(
      {
        ...products[0],
        categoryIds: ['category-0'],
        id: 'late-product-a',
        slug: 'late-product-a',
      },
      {
        ...products[1],
        categoryIds: ['category-0'],
        id: 'late-product-b',
        slug: 'late-product-b',
      }
    );

    expect(
      compareHubIssueMessages(
        [{ id: 'category-0', slug: 'category-0' }],
        boundedCategoryProducts
      )
    ).toContain('Compare SEO requires an eligible projected comparison pair');
  });
});
