import { sortCategoriesByPriority } from './category-utils';

describe('sortCategoriesByPriority', () => {
  it('prioritizes phones, then laptops, then tablets, then accessories', () => {
    expect(
      sortCategoriesByPriority([
        'Accessories',
        'Laptops',
        'Phones',
        'Tablets',
      ])
    ).toEqual(['Phones', 'Laptops', 'Tablets', 'Accessories']);
  });

  it('uses locale compare as a stable tie-breaker for same priority groups', () => {
    expect(sortCategoriesByPriority(['MacBook', 'Computers', 'Laptops'])).toEqual([
      'Computers',
      'Laptops',
      'MacBook',
    ]);
  });

  it('trims whitespace and removes empty category names', () => {
    expect(sortCategoriesByPriority(['  ', ' Phones ', ''])).toEqual(['Phones']);
  });

  it('ignores malformed entries and returns only valid category names', () => {
    const malformed = [
      null,
      undefined,
      42,
      ' Tablets ',
      'Phones',
      {},
      'Accessories',
    ];

    expect(() => sortCategoriesByPriority(malformed)).not.toThrow();
    expect(sortCategoriesByPriority(malformed)).toEqual([
      'Phones',
      'Tablets',
      'Accessories',
    ]);
  });
});
