import {
  normalizeProductConditionFilterValue,
  resolveSelectedCategoryId,
} from './product-filter-options';

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
