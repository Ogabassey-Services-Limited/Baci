import { describe, expect, it } from 'vitest';
import type { RefinementCtx } from 'zod';
import { validatePublicProjectionIdentities } from './validate-public-projection-identities';

function collectIssues(
  payload: Parameters<typeof validatePublicProjectionIdentities>[0]
) {
  const issues: Array<{ message: string; path?: PropertyKey[] }> = [];
  const context = {
    addIssue: (issue: { message: string; path?: PropertyKey[] }) => {
      issues.push(issue);
    },
  } as unknown as RefinementCtx;
  validatePublicProjectionIdentities(payload, context);
  return issues;
}

describe('validatePublicProjectionIdentities', () => {
  it('accepts unique product, variant, offer, category, blog, page, and flag identities', () => {
    expect(
      collectIssues({
        blogPosts: [{ id: 'blog-1', slug: 'guide' }],
        categories: [{ id: 'category-1', slug: 'phones' }],
        contentPages: [{ id: 'page-1', slug: 'about' }],
        featureFlags: [{ key: 'reviews' }],
        seoEntries: [{ path: '/about' }],
        products: [
          {
            conditionOffers: [{ id: 'offer-1' }],
            id: 'product-1',
            slug: 'phone',
            variants: [{ id: 'variant-1' }],
          },
        ],
      })
    ).toEqual([]);
  });

  it('reports every duplicate identity family', () => {
    const issues = collectIssues({
      blogPosts: [
        { id: 'blog-1', slug: 'guide' },
        { id: 'blog-1', slug: 'guide' },
      ],
      categories: [
        { id: 'category-1', slug: 'phones' },
        { id: 'category-1', slug: 'phones' },
      ],
      contentPages: [
        { id: 'page-1', slug: 'about' },
        { id: 'page-1', slug: 'about' },
      ],
      featureFlags: [{ key: 'reviews' }, { key: 'reviews' }],
      seoEntries: [{ path: '/about' }, { path: '/about' }],
      products: [
        {
          conditionOffers: [{ id: 'offer-1' }, { id: 'offer-1' }],
          id: 'product-1',
          slug: 'phone',
          variants: [{ id: 'variant-1' }, { id: 'variant-1' }],
        },
        { id: 'product-1', slug: 'phone' },
      ],
    });

    expect(
      issues
        .map(({ message, path }) => `${message} @ ${(path ?? []).join('.')}`)
        .sort()
    ).toEqual([
      'Blog post IDs must be unique @ blogPosts.1.id',
      'Blog post slugs must be unique @ blogPosts.1.slug',
      'Category IDs must be unique @ categories.1.id',
      'Category slugs must be unique @ categories.1.slug',
      'Condition offer IDs must be unique @ products.0.conditionOffers.1.id',
      'Content page IDs must be unique @ contentPages.1.id',
      'Content page slugs must be unique @ contentPages.1.slug',
      'Feature flag keys must be unique @ featureFlags.1.key',
      'Product IDs must be unique @ products.1.id',
      'Product slugs must be unique @ products.1.slug',
      'SEO entry paths must be unique @ seoEntries.1.path',
      'Variant IDs must be unique @ products.0.variants.1.id',
    ]);
  });
});
