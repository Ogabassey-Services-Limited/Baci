import { describe, expect, it } from 'vitest';
import { validatePublicProjectionSeoEntryGuards } from './validate-public-projection-seo-entry-guards';

type GuardInput = Omit<
  Parameters<typeof validatePublicProjectionSeoEntryGuards>[0],
  'context'
>;

function issueMessages(input: GuardInput) {
  const messages: string[] = [];
  validatePublicProjectionSeoEntryGuards({
    ...input,
    context: {
      addIssue(issue: { message?: string }) {
        messages.push(issue.message ?? '');
      },
    } as Parameters<
      typeof validatePublicProjectionSeoEntryGuards
    >[0]['context'],
  });
  return messages;
}

const category = { id: 'category-1' };

describe('validatePublicProjectionSeoEntryGuards', () => {
  it('rejects indexable empty categories but keeps them valid when noindexed', () => {
    const base = {
      categoriesBySlug: new Map([['phones', category]]),
      categoryHasProducts: new Map([['category-1', false]]),
      entry: { indexable: true, path: '/phones' },
      index: 0,
      products: [],
    };

    expect(issueMessages(base)).toContain(
      'Empty category routes must not be indexable'
    );
    expect(
      issueMessages({ ...base, entry: { indexable: false, path: '/phones' } })
    ).toEqual([]);
  });

  it('rejects indexable legacy policy and categorized product aliases', () => {
    const products = [{ canonicalPath: '/phones/phone', slug: 'phone' }];
    const base = {
      categoriesBySlug: new Map<string, { id: string }>(),
      categoryHasProducts: new Map<string, boolean>(),
      index: 0,
      products,
    };

    expect(
      issueMessages({
        ...base,
        entry: { indexable: true, path: '/privacy-policy' },
      })
    ).toContain('Legacy policy redirect routes must not be indexable');
    expect(
      issueMessages({
        ...base,
        entry: { indexable: true, path: '/products/phone' },
      })
    ).toContain('Legacy product alias routes must not be indexable');
  });

  it('rejects indexable secondary-category product aliases', () => {
    const products = [
      {
        canonicalPath: '/smartphones/phone',
        categoryIds: ['category-smartphones', 'category-sale'],
        primaryCategoryId: 'category-smartphones',
        slug: 'phone',
      },
    ];
    const categoriesBySlug = new Map([
      ['smartphones', { id: 'category-smartphones' }],
      ['sale', { id: 'category-sale' }],
    ]);

    expect(
      issueMessages({
        categoriesBySlug,
        categoryHasProducts: new Map(),
        entry: { indexable: true, path: '/sale/phone' },
        index: 0,
        products,
      })
    ).toContain('Noncanonical product category aliases must not be indexable');
    expect(
      issueMessages({
        categoriesBySlug,
        categoryHasProducts: new Map(),
        entry: { indexable: true, path: '/smartphones/phone' },
        index: 0,
        products,
      })
    ).toEqual([]);
  });
});
