import { getProductGridCategoryNames } from './product-grid-category-names';

describe('getProductGridCategoryNames', () => {
  it('returns only All when categories are empty', () => {
    expect(getProductGridCategoryNames([])).toEqual(['All']);
  });

  it('prepends All to sorted category names', () => {
    const result = getProductGridCategoryNames([
      { id: 'cat-1', name: 'Laptops', slug: 'laptops' },
      { id: 'cat-2', name: 'Phones', slug: 'phones' },
    ]);
    expect(result[0]).toBe('All');
    expect(result).toContain('Laptops');
    expect(result).toContain('Phones');
  });
});
