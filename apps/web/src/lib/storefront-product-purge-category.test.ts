import { describe, expect, it } from 'vitest';
import { resolveStorefrontProductPurgeCategorySlug } from './storefront-product-purge-category';

describe('resolveStorefrontProductPurgeCategorySlug', () => {
  it('keeps an active direct category ahead of junction categories', () => {
    expect(
      resolveStorefrontProductPurgeCategorySlug({
        categories: { is_active: true, slug: 'direct-category' },
        productCategories: [
          { category_id: 'category-a', categories: { slug: 'junction-category' } },
        ],
      })
    ).toBe('direct-category');
  });

  it('skips an inactive direct category and chooses the lowest active junction id', () => {
    expect(
      resolveStorefrontProductPurgeCategorySlug({
        categories: { is_active: false, slug: 'retired-category' },
        productCategories: [
          {
            category_id: 'category-z',
            categories: { is_active: true, slug: 'z-category' },
          },
          {
            category_id: 'category-a',
            categories: { is_active: true, slug: 'a-category' },
          },
        ],
      })
    ).toBe('a-category');
  });

  it('preserves input order only when junction rows have no category id', () => {
    expect(
      resolveStorefrontProductPurgeCategorySlug({
        productCategories: [
          { categories: { slug: 'first-category' } },
          { categories: { slug: 'second-category' } },
        ],
      })
    ).toBe('first-category');
  });
});
