import { ALL_PRODUCT_FILTER_CATEGORY_SLUG } from '@/lib/product-filter-options';
import { resolveProductGridCategoryId } from './product-grid-category-resolution';

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
        selectedCategorySlug: ALL_PRODUCT_FILTER_CATEGORY_SLUG,
      })
    ).toBe('cat-parent');
  });

  it('returns the category id when the selected chip slug maps to a real category', () => {
    expect(
      resolveProductGridCategoryId({
        categories: [{ id: 'cat-laptops', name: 'Laptops', slug: 'laptops' }],
        parentSelectedCategoryId: null,
        selectedCategorySlug: 'laptops',
      })
    ).toBe('cat-laptops');
  });

  it('returns undefined when ALL is selected and parentSelectedCategoryId is null', () => {
    expect(
      resolveProductGridCategoryId({
        categories: [],
        parentSelectedCategoryId: null,
        selectedCategorySlug: ALL_PRODUCT_FILTER_CATEGORY_SLUG,
      })
    ).toBeUndefined();
  });

  it('returns undefined when ALL is selected and parentSelectedCategoryId starts with u-', () => {
    expect(
      resolveProductGridCategoryId({
        categories: [],
        parentSelectedCategoryId: 'u-abc123',
        selectedCategorySlug: ALL_PRODUCT_FILTER_CATEGORY_SLUG,
      })
    ).toBeUndefined();
  });
});
