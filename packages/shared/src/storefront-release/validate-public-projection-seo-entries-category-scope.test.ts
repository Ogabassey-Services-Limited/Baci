import { describe, expect, it } from 'vitest';
import { validatePublicProjectionSeoEntries } from './validate-public-projection-seo-entries';

describe('category SEO product scope', () => {
  it('keeps a parent category indexable when an active child owns its products', () => {
    const messages: string[] = [];
    validatePublicProjectionSeoEntries(
      {
        categories: [
          { id: 'parent', slug: 'phones', status: 'active' },
          {
            id: 'child',
            parentId: 'parent',
            slug: 'android-phones',
            status: 'active',
          },
        ],
        merchant: {
          currency: 'NGN',
          hostname: 'pilot-store.usebaci.com',
          slug: 'pilot-store',
        },
        products: [
          {
            available: true,
            categoryIds: ['child'],
            id: 'product-1',
            name: 'Phone',
            priceMinor: 100_000,
            slug: 'phone',
          },
        ],
        seoEntries: [{ indexable: true, path: '/phones' }],
      },
      {
        addIssue(issue: { message?: string }) {
          messages.push(issue.message ?? '');
        },
      } as Parameters<typeof validatePublicProjectionSeoEntries>[1]
    );

    expect(messages).not.toContain(
      'Empty category routes must not be indexable'
    );
  });
});
