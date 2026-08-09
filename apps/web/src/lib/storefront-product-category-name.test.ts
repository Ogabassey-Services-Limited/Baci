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
});
