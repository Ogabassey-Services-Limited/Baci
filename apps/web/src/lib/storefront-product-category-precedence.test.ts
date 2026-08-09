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

  it('leaves legacy category text available when a direct join is absent', () => {
    expect(
      resolveStorefrontProductCategory({
        categories: null,
        category: 'Legacy Category',
        product_categories: [{ categories: { slug: 'junction-category' } }],
      })
    ).toBeNull();
  });

  it('uses the first usable junction category when earlier sources are blank', () => {
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
