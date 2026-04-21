import {
  normalizeSelectedCategorySlug,
  normalizeProductConditionFilterValue,
  resolveSelectedCategoryId,
} from './product-filter-options';

describe('normalizeSelectedCategorySlug', () => {
  it('returns the all sentinel for the All filter', () => {
    expect(
      normalizeSelectedCategorySlug('All', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
      ])
    ).toBe('all');
  });

  it('prefers the stable category slug over the display name', () => {
    expect(
      normalizeSelectedCategorySlug('Phones', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
        { id: 'gaming', name: 'Gaming Laptops', slug: 'gaming-laptops' },
      ])
    ).toBe('phones');
  });
});

describe('resolveSelectedCategoryId', () => {
  it('returns undefined for All', () => {
    expect(
      resolveSelectedCategoryId('All', [{ id: 'phones', name: 'Smartphones' }])
    ).toBeUndefined();
  });

  it('resolves the category id from the selected category name', () => {
    expect(
      resolveSelectedCategoryId('Smartphones', [
        { id: 'phones', name: 'Smartphones' },
        { id: 'gaming', name: 'Gaming Laptops' },
      ])
    ).toBe('phones');
  });

  it('resolves the category id from the normalized category slug', () => {
    expect(
      resolveSelectedCategoryId('phones', [
        { id: 'cat-phones', name: 'Smartphones', slug: 'phones' },
        { id: 'cat-gaming', name: 'Gaming Laptops', slug: 'gaming-laptops' },
      ])
    ).toBe('cat-phones');
  });
});

describe('normalizeProductConditionFilterValue', () => {
  it('maps display values to raw database values', () => {
    expect(normalizeProductConditionFilterValue('New')).toBe('new');
    expect(normalizeProductConditionFilterValue('Used')).toBe('used');
    expect(normalizeProductConditionFilterValue('Open Box')).toBe('open_box');
  });

  it('accepts already-normalized raw values', () => {
    expect(normalizeProductConditionFilterValue('open_box')).toBe('open_box');
  });

  it('returns undefined for unsupported values', () => {
    expect(normalizeProductConditionFilterValue('All')).toBeUndefined();
    expect(normalizeProductConditionFilterValue('Whatever')).toBeUndefined();
  });
});
