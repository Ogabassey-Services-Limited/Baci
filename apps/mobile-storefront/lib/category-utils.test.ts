import { getProductGridCategories, sortCategoriesByPriority } from './category-utils';

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

describe('getProductGridCategories', () => {
  it('returns only shopper-facing top-level categories for the product grid', () => {
    expect(
      getProductGridCategories([
        'Samsung',
        'HP',
        'Smartphones',
        'Gaming Laptops',
        'MacBook',
        'Audio',
        'Accessories',
        'Printers',
      ])
    ).toEqual([
      'Smartphones',
      'Gaming Laptops',
      'Audio',
      'Accessories',
      'Printers',
    ]);
  });

  it('falls back to sorted categories when no preferred group is present', () => {
    expect(getProductGridCategories(['Wearables', 'Monitors', 'VR Headsets'])).toEqual([
      'Monitors',
      'VR Headsets',
      'Wearables',
    ]);
  });

  it('deduplicates categories case-insensitively before matching product grid groups', () => {
    expect(getProductGridCategories(['Phones', 'phones', 'Audio'])).toEqual([
      'Phones',
      'Audio',
    ]);
  });
});
