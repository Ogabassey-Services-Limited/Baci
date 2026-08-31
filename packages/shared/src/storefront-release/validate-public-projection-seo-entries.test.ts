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
});
