import {
  getProductGridCategoryNames,
  resolveProductGridCategoryId,
} from './product-grid-category-resolution';

describe('getProductGridCategoryNames', () => {
  it('does not expose unresolved fallback category chips before merchant categories load', () => {
    expect(getProductGridCategoryNames([])).toEqual(['All']);
  });
});

describe('resolveProductGridCategoryId', () => {
  it('does not fall back to the parent category once a product-grid chip is active', () => {
    expect(
      resolveProductGridCategoryId({
        categories: [{ id: 'cat-laptops', name: 'Laptops', slug: 'laptops' }],
        parentSelectedCategoryId: 'cat-parent',
        selectedCategorySlug: 'phones',
      })
    ).toBeUndefined();
  });

  it('preserves the parent selection only when no chip filter is active', () => {
    expect(
      resolveProductGridCategoryId({
        categories: [{ id: 'cat-laptops', name: 'Laptops', slug: 'laptops' }],
        parentSelectedCategoryId: 'cat-parent',
        selectedCategorySlug: 'all',
      })
    ).toBe('cat-parent');
  });
});
