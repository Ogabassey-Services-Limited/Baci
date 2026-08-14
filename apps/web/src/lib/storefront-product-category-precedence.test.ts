import { describe, expect, it } from 'vitest';
import { resolveStorefrontProductCategory } from './storefront-product-category-precedence';

describe('resolveStorefrontProductCategory', () => {
  it('prefers a direct category join over legacy text and a junction category', () => {
    expect(
      resolveStorefrontProductCategory({
        categories: { slug: 'direct-category' },
        category: 'Legacy Category',
        product_categories: [{ categories: { slug: 'junction-category' } }],
      })
    ).toEqual({ slug: 'direct-category' });
  });

  it('prefers an active junction category over legacy text when the direct join is absent', () => {
    expect(
      resolveStorefrontProductCategory({
        categories: null,
        category: 'Legacy Category',
        product_categories: [{ categories: { slug: 'junction-category' } }],
      })
    ).toEqual({ slug: 'junction-category' });
  });

  it('ignores inactive direct categories and selects the lowest active junction id', () => {
    expect(
      resolveStorefrontProductCategory({
        categories: { slug: 'retired', is_active: false },
        category: ' ',
        product_categories: [
          {
            category_id: 'category-z',
            categories: { slug: 'z-category', is_active: true },
          },
          {
            category_id: 'category-a',
            categories: { slug: 'a-category', is_active: true },
          },
        ],
      })
    ).toEqual({ slug: 'a-category' });
  });

  it('keeps the first usable junction category when relation ids are unavailable', () => {
    expect(
      resolveStorefrontProductCategory({
        categories: { slug: ' ' },
        category: ' ',
        product_categories: [
          { categories: { slug: ' ' } },
          { categories: { slug: 'junction-category' } },
        ],
      })
    ).toEqual({ slug: 'junction-category' });
  });
});
