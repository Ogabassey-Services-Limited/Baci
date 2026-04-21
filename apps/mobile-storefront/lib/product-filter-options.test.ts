import {
  ALL_PRODUCT_FILTER_CATEGORY_SLUG,
  normalizeProductConditionFilterValue,
  normalizeSelectedCategorySlug,
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

  it('treats a lowercase "all" input as the ALL sentinel', () => {
    expect(
      normalizeSelectedCategorySlug('all', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
      ])
    ).toBe(ALL_PRODUCT_FILTER_CATEGORY_SLUG);
  });

  it('prefers the stable category slug over the display name', () => {
    expect(
      normalizeSelectedCategorySlug('Phones', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
        { id: 'gaming', name: 'Gaming Laptops', slug: 'gaming-laptops' },
      ])
    ).toBe('phones');
  });

  it('resolves to the category slug when matching by name where slug differs from name', () => {
    expect(
      normalizeSelectedCategorySlug('Smartphones', [
        { id: 'cat-phones', name: 'Smartphones', slug: 'phones' },
        { id: 'cat-gaming', name: 'Gaming Laptops', slug: 'gaming-laptops' },
      ])
    ).toBe('phones');
  });

  it('falls back to the normalized token when no category matches', () => {
    expect(
      normalizeSelectedCategorySlug('Mystery Category', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
      ])
    ).toBe('mystery-category');
  });

  it('returns only the all sentinel when categoriesData is empty', () => {
    // When no categories exist the ProductGrid categoryNames IIFE skips the
    // category map entirely, so the only chip available should be "All".
    expect(normalizeSelectedCategorySlug('All', [])).toBe(
      ALL_PRODUCT_FILTER_CATEGORY_SLUG
    );
  });
});

describe('resolveSelectedCategoryId', () => {
  it('returns undefined for All', () => {
    expect(
      resolveSelectedCategoryId('All', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
      ])
    ).toBeUndefined();
  });

  it('resolves the category id from the selected category name', () => {
    expect(
      resolveSelectedCategoryId('Smartphones', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
        { id: 'gaming', name: 'Gaming Laptops', slug: 'gaming-laptops' },
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

  it('returns undefined for a non-All chip when the category ID cannot resolve', () => {
    // Mirrors the normalizedCategoryId IIFE in ProductGrid: when a chip slug
    // does not match any known category the component must pass undefined to
    // useProducts so that no category filter is applied.
    expect(
      resolveSelectedCategoryId('unknown-category', [
        { id: 'phones', name: 'Smartphones', slug: 'phones' },
      ])
    ).toBeUndefined();
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
