import { describe, expect, it } from 'vitest';
import { resolveStorefrontProductCategoryName } from './storefront-product-category-name';

describe('resolveStorefrontProductCategoryName', () => {
  it('prefers a joined category name, then its slug, before stale legacy text', () => {
    expect(
      resolveStorefrontProductCategoryName({
        categories: { name: 'Action Cameras', slug: 'action-cameras' },
        category: 'Smartphones',
      })
    ).toBe('Action Cameras');

    expect(
      resolveStorefrontProductCategoryName({
        categories: { slug: 'action-cameras' },
        category: 'Smartphones',
      })
    ).toBe('action-cameras');
  });

  it('uses canonical category_slug before stale legacy text when the join is missing', () => {
    expect(
      resolveStorefrontProductCategoryName({
        categories: null,
        category_slug: 'action-cameras',
        category: 'Smartphones',
      })
    ).toBe('action-cameras');
  });
  it('skips unsupported joined names before using a relation-backed slug', () => {
    expect(
      resolveStorefrontProductCategoryName({
        categories: { name: 'Unknown', slug: 'action-cameras' },
        category: 'Smartphones',
      })
    ).toBe('action-cameras');
  });
});
